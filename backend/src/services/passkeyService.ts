/**
 * passkeyService — WebAuthn/FIDO2 passkey authentication.
 *
 * Provides an advanced, phishing-resistant auth method alongside TOTP 2FA:
 *   - Registration ceremony: getRegistrationOptions() → verifyRegistration()
 *   - Authentication ceremony (login 2nd factor): getAuthenticationOptions(mfaToken)
 *       → verifyAuthentication(mfaToken) — completes the existing mfa_challenges flow.
 *   - Management: listPasskeys / renamePasskey / removePasskey (lockout-guarded).
 *
 * Security invariants (see spec Correctness Properties):
 *   - Server-issued, single-use, 120s challenges (webauthn_challenges).
 *   - Origin + RP_ID verified on every ceremony; only web + configured Android origins.
 *   - Signature-counter replay guard; counter advances on success.
 *   - Strict tenant isolation on every user_passkeys query.
 *   - Per-credential attempt lockout (5 / 300s).
 *   - Never removes the last remaining factor (no lockout).
 *
 * NOTE: passkeys require server connectivity — they are NOT an offline-login mechanism.
 */
import crypto from 'crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/server';
import { db } from '@utils/database';
import { logger } from '@utils/logger';
import { AppError } from '@middleware/errorHandler';
import PlatformAuditService from './platformAuditService';

// ── Config ──────────────────────────────────────────────────────────────────
const RP_NAME = 'WiSkul';
const RP_ID = process.env.WEBAUTHN_RP_ID || 'www.wiskulsl.com';
const WEB_ORIGIN = process.env.WEBAUTHN_ORIGIN || 'https://www.wiskulsl.com';
// Android app origin (android:apk-key-hash:<base64url-sha256-cert>). Set once the
// release keystore fingerprint is known + assetlinks.json is published.
const ANDROID_ORIGIN = process.env.WEBAUTHN_ANDROID_ORIGIN || '';

const EXPECTED_ORIGINS = [WEB_ORIGIN, ANDROID_ORIGIN].filter(Boolean);

const CHALLENGE_TTL_MS = 120 * 1000; // 120 seconds (Req 2.1, 6.2)
const MAX_PASSKEYS_PER_USER = 10; // Req 1.5
const LOCKOUT_MAX_ATTEMPTS = 5; // Req 2.8
const LOCKOUT_WINDOW_MS = 300 * 1000; // 5 minutes
const LABEL_MIN = 1;
const LABEL_MAX = 64;

export interface PasskeyDTO {
  id: string;
  deviceLabel: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** base64url helpers (avoid depending on isoBase64URL export shape). */
const toB64Url = (buf: Buffer | Uint8Array): string =>
  Buffer.from(buf).toString('base64url');
const fromB64Url = (s: string): Buffer => Buffer.from(s, 'base64url');

class PasskeyService {
  // ── Challenge helpers ──────────────────────────────────────────────────────

  private async storeChallenge(
    type: 'registration' | 'authentication',
    challenge: string,
    userId: string | null,
    tenantId: string | null
  ): Promise<void> {
    await db('webauthn_challenges').insert({
      user_id: userId,
      tenant_id: tenantId,
      challenge,
      type,
      expires_at: new Date(Date.now() + CHALLENGE_TTL_MS),
      created_at: new Date(),
    });
  }

  /** Consume the most-recent matching challenge; returns it or throws if invalid/expired. */
  private async consumeChallenge(
    type: 'registration' | 'authentication',
    userId: string | null
  ): Promise<{ id: string; challenge: string; tenant_id: string | null }> {
    const row = await db('webauthn_challenges')
      .where({ type })
      .modify((q) => {
        if (userId) q.where({ user_id: userId });
      })
      .orderBy('created_at', 'desc')
      .first();

    if (!row) {
      throw new AppError('Invalid or expired session. Please try again.', 401, 'WEBAUTHN_CHALLENGE_INVALID');
    }
    // Always delete (single-use) before validating expiry.
    await db('webauthn_challenges').where({ id: row.id }).del();
    if (new Date(row.expires_at) < new Date()) {
      throw new AppError('Verification session expired. Please try again.', 401, 'WEBAUTHN_CHALLENGE_INVALID');
    }
    return { id: row.id, challenge: row.challenge, tenant_id: row.tenant_id };
  }

  // ── Registration ceremony (Req 1) ───────────────────────────────────────────

  async getRegistrationOptions(
    userId: string,
    tenantId: string
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const user = await db('users').where({ id: userId, tenant_id: tenantId }).first();
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    const existing = await db('user_passkeys').where({ user_id: userId, tenant_id: tenantId });
    if (existing.length >= MAX_PASSKEYS_PER_USER) {
      throw new AppError('You have reached the maximum number of passkeys.', 400, 'PASSKEY_LIMIT_REACHED');
    }

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: user.email,
      userDisplayName: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email,
      attestationType: 'none',
      excludeCredentials: existing.map((c: any) => ({
        id: c.credential_id,
        transports: this.parseTransports(c.transports),
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    await this.storeChallenge('registration', options.challenge, userId, tenantId);
    return options;
  }

  async verifyRegistration(
    userId: string,
    tenantId: string,
    response: RegistrationResponseJSON,
    deviceLabel?: string
  ): Promise<PasskeyDTO> {
    const label = this.validateLabel(deviceLabel);

    const { challenge } = await this.consumeChallenge('registration', userId);

    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: EXPECTED_ORIGINS,
        expectedRPID: RP_ID,
        requireUserVerification: false,
      });
    } catch (err) {
      logger.warn(`[passkey] registration verify failed: ${(err as any)?.message || err}`);
      throw new AppError('Could not verify passkey. Please try again.', 400, 'WEBAUTHN_VERIFY_FAILED');
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new AppError('Passkey verification failed.', 400, 'WEBAUTHN_VERIFY_FAILED');
    }

    const { credential } = verification.registrationInfo;
    const credentialId = credential.id; // base64url string in v13
    const publicKey = toB64Url(credential.publicKey);
    const counter = credential.counter ?? 0;
    const transports = response.response.transports || [];

    const finalLabel = label || this.defaultLabel(transports, response);

    const [row] = await db('user_passkeys')
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        credential_id: credentialId,
        public_key: publicKey,
        counter,
        transports: JSON.stringify(transports),
        device_label: finalLabel,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning(['id', 'device_label', 'created_at', 'last_used_at']);

    await PlatformAuditService.record({
      tenantId,
      actorUserId: userId,
      action: 'passkey_added',
      entityType: 'passkey',
      entityId: row.id,
    });

    return this.toDTO(row);
  }

  // ── Authentication ceremony — login 2nd factor (Req 2) ──────────────────────

  /** Resolve the user behind an mfa_token (issued after a correct password). */
  private async userFromMfaToken(mfaToken: string): Promise<{ userId: string; tenantId: string }> {
    const challenge = await db('mfa_challenges').where({ token: mfaToken }).first();
    if (!challenge) throw new AppError('Invalid or expired session', 401, 'INVALID_MFA_TOKEN');
    if (new Date(challenge.expires_at) < new Date()) {
      await db('mfa_challenges').where({ id: challenge.id }).del();
      throw new AppError('Verification session expired. Please sign in again.', 401, 'MFA_EXPIRED');
    }
    const user = await db('users').where({ id: challenge.user_id }).first();
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    return { userId: user.id, tenantId: user.tenant_id };
  }

  async getAuthenticationOptions(mfaToken: string): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const { userId, tenantId } = await this.userFromMfaToken(mfaToken);

    const passkeys = await db('user_passkeys').where({ user_id: userId, tenant_id: tenantId });

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'preferred',
      allowCredentials: passkeys.map((c: any) => ({
        id: c.credential_id,
        transports: this.parseTransports(c.transports),
      })),
    });

    await this.storeChallenge('authentication', options.challenge, userId, tenantId);
    return options;
  }

  /** Verify the assertion and return the userId; caller issues session tokens. */
  async verifyAuthentication(
    mfaToken: string,
    response: AuthenticationResponseJSON
  ): Promise<{ userId: string }> {
    const { userId, tenantId } = await this.userFromMfaToken(mfaToken);

    // Look up the credential ONLY within the resolving tenant (Req 2.4, 6.7/6.8).
    const cred = await db('user_passkeys')
      .where({ credential_id: response.id, user_id: userId, tenant_id: tenantId })
      .first();
    if (!cred) {
      throw new AppError('Passkey not recognized.', 401, 'PASSKEY_NOT_FOUND');
    }

    // Per-credential lockout (Req 2.8).
    if (cred.locked_until && new Date(cred.locked_until) > new Date()) {
      throw new AppError('Too many attempts. Please try again shortly.', 429, 'PASSKEY_LOCKED');
    }

    const { challenge } = await this.consumeChallenge('authentication', userId);

    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: EXPECTED_ORIGINS,
        expectedRPID: RP_ID,
        requireUserVerification: false,
        credential: {
          id: cred.credential_id,
          publicKey: fromB64Url(cred.public_key),
          counter: Number(cred.counter),
          transports: this.parseTransports(cred.transports),
        },
      });
    } catch (err) {
      await this.registerFailure(cred);
      logger.warn(`[passkey] auth verify failed: ${(err as any)?.message || err}`);
      throw new AppError('Passkey authentication failed.', 401, 'WEBAUTHN_VERIFY_FAILED');
    }

    if (!verification.verified) {
      await this.registerFailure(cred);
      throw new AppError('Passkey authentication failed.', 401, 'WEBAUTHN_VERIFY_FAILED');
    }

    const newCounter = verification.authenticationInfo.newCounter;
    // Replay guard: reject if counter regressed for a credential that previously
    // reported a nonzero counter (Req 6.6).
    if (Number(cred.counter) > 0 && newCounter <= Number(cred.counter)) {
      await this.registerFailure(cred);
      throw new AppError('Passkey authentication failed (replay detected).', 401, 'WEBAUTHN_REPLAY');
    }

    // Success — advance counter, clear lockout, stamp last_used_at, consume mfa challenge.
    await db('user_passkeys').where({ id: cred.id }).update({
      counter: newCounter,
      failed_attempts: 0,
      locked_until: null,
      last_used_at: new Date(),
      updated_at: new Date(),
    });
    await db('mfa_challenges').where({ token: mfaToken }).del();

    await PlatformAuditService.record({
      tenantId,
      actorUserId: userId,
      action: 'passkey_login',
      entityType: 'passkey',
      entityId: cred.id,
    });

    return { userId };
  }

  /** Increment failed attempts; lock the credential when the threshold is hit. */
  private async registerFailure(cred: any): Promise<void> {
    const attempts = (cred.failed_attempts || 0) + 1;
    const update: any = { failed_attempts: attempts, updated_at: new Date() };
    if (attempts >= LOCKOUT_MAX_ATTEMPTS) {
      update.locked_until = new Date(Date.now() + LOCKOUT_WINDOW_MS);
      update.failed_attempts = 0;
    }
    await db('user_passkeys').where({ id: cred.id }).update(update);
  }

  // ── Management (Req 3) ──────────────────────────────────────────────────────

  async listPasskeys(userId: string, tenantId: string): Promise<PasskeyDTO[]> {
    const rows = await db('user_passkeys')
      .where({ user_id: userId, tenant_id: tenantId })
      .orderBy('created_at', 'desc')
      .select('id', 'device_label', 'created_at', 'last_used_at');
    return rows.map((r: any) => this.toDTO(r));
  }

  async renamePasskey(
    userId: string,
    tenantId: string,
    id: string,
    label: string
  ): Promise<PasskeyDTO> {
    const validated = this.validateLabel(label);
    if (!validated) throw new AppError('A device label is required.', 400, 'PASSKEY_LABEL_INVALID');

    const cred = await db('user_passkeys').where({ id, user_id: userId, tenant_id: tenantId }).first();
    if (!cred) throw new AppError('Passkey not found.', 404, 'PASSKEY_NOT_FOUND');

    await db('user_passkeys').where({ id: cred.id }).update({
      device_label: validated,
      updated_at: new Date(),
    });

    await PlatformAuditService.record({
      tenantId,
      actorUserId: userId,
      action: 'passkey_updated',
      entityType: 'passkey',
      entityId: cred.id,
    });

    const updated = await db('user_passkeys')
      .where({ id: cred.id })
      .select('id', 'device_label', 'created_at', 'last_used_at')
      .first();
    return this.toDTO(updated);
  }

  async removePasskey(userId: string, tenantId: string, id: string): Promise<void> {
    const cred = await db('user_passkeys').where({ id, user_id: userId, tenant_id: tenantId }).first();
    if (!cred) throw new AppError('Passkey not found.', 404, 'PASSKEY_NOT_FOUND');

    // Lockout guard (Req 3.7 / 7.3). The email+password base credential always
    // remains, so removal is safe. We still refuse to remove the user's LAST
    // passkey when it is currently their ONLY enabled second factor (no TOTP),
    // so a user who deliberately relies on passkeys as their second factor can't
    // accidentally strand themselves — they must add TOTP or another passkey first.
    const user = await db('users').where({ id: userId, tenant_id: tenantId }).first();
    const totpEnabled = !!user?.two_factor_enabled;
    const passkeyCount = await db('user_passkeys')
      .where({ user_id: userId, tenant_id: tenantId })
      .count<{ count: string }[]>('* as count');
    const remainingPasskeys = Number(passkeyCount[0]?.count || 0) - 1;

    if (!totpEnabled && remainingPasskeys <= 0) {
      throw new AppError(
        'This is your only second-factor passkey. Add an authenticator app or another passkey before removing it.',
        400,
        'PASSKEY_LAST_FACTOR'
      );
    }

    await db('user_passkeys').where({ id: cred.id }).del();

    await PlatformAuditService.record({
      tenantId,
      actorUserId: userId,
      action: 'passkey_removed',
      entityType: 'passkey',
      entityId: cred.id,
    });
  }

  // ── helpers ─────────────────────────────────────────────────────────────────

  private toDTO(row: any): PasskeyDTO {
    return {
      id: row.id,
      deviceLabel: row.device_label,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      lastUsedAt: row.last_used_at
        ? row.last_used_at instanceof Date
          ? row.last_used_at.toISOString()
          : row.last_used_at
        : null,
    };
  }

  private validateLabel(label?: string): string | undefined {
    if (label == null) return undefined;
    const trimmed = String(label).trim();
    if (trimmed.length === 0) return undefined;
    if (trimmed.length < LABEL_MIN || trimmed.length > LABEL_MAX) {
      throw new AppError(`Device label must be ${LABEL_MIN}–${LABEL_MAX} characters.`, 400, 'PASSKEY_LABEL_INVALID');
    }
    return trimmed;
  }

  private defaultLabel(transports: string[], response: RegistrationResponseJSON): string {
    if (transports.includes('internal')) return 'This device';
    if (transports.includes('hybrid')) return 'Phone or tablet';
    if (transports.includes('usb') || transports.includes('nfc') || transports.includes('ble')) {
      return 'Security key';
    }
    return 'Passkey';
  }

  private parseTransports(raw: any): any[] {
    if (!raw) return [];
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return [];
    }
  }
}

export default new PasskeyService();
