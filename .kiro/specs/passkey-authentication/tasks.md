# Implementation Plan — Passkey Authentication

## Overview

Adds passkeys (WebAuthn/FIDO2) as an advanced authentication method alongside the existing
authenticator-app (TOTP) 2FA. Backend uses `@simplewebauthn/server`; frontend uses
`@simplewebauthn/browser`. Reuses the existing MFA challenge/login flow and audit patterns.
Passkeys are password-free/phishing-resistant but require server connectivity (no offline login),
and the email+password base credential is retained.

## Tasks

- [x] 1. Install WebAuthn libraries and add DB schema (migration 124)
  - Installed `@simplewebauthn/server@^13` (backend) + `@simplewebauthn/browser@^13` (frontend).
  - Created `124_passkeys.ts` with tenant-isolated `user_passkeys` (credential_id unique,
    public_key, counter, transports, device_label, failed_attempts/locked_until, last_used_at)
    and `webauthn_challenges` (type, 120s expiry). Ran migration (batch 40); both tables verified.
  - _Requirements: 4.3, 4.4, 6.1_

- [x] 2. Backend: passkeyService — registration ceremony
  - `passkeyService.getRegistrationOptions` (RP_ID www.wiskulsl.com, excludeCredentials, 120s
    challenge, per-user limit 10) + `verifyRegistration` (consume/verify challenge+origin+RP_ID,
    store credential, default label, validate 1–64, audit passkey_added).
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11_

- [x] 3. Backend: passkeyService — authentication ceremony (login second factor)
  - `getAuthenticationOptions(mfaToken)` + `verifyAuthentication(mfaToken, response)`:
    tenant-scoped credential lookup, cross-tenant reject, counter replay guard + advance,
    per-credential lockout (5/300s), last_used_at, consume mfa challenge, audit passkey_login.
    authService.completePasskeyLogin issues the same session as 2FA.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.11, 2.12, 4.5, 4.6, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [x] 4. Backend: passkeyService — manage passkeys (list/rename/remove)
  - `listPasskeys` (tenant-scoped), `renamePasskey` (label validation + not-found guard),
    `removePasskey` (not-found + last-second-factor lockout guard). Audits rename/remove.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 7.3, 7.4_

- [x] 5. Backend: routes + wire into auth
  - `/api/v1/auth/passkeys/*` routes added (register/options+verify [auth]; authenticate/
    options+verify [public+mfa_token]; GET list, PATCH rename, DELETE remove [auth]).
    authenticate/verify issues the same tokens as 2fa/verify-login. AppError codes per design.
    Backend builds green.
  - _Requirements: 2.9, 2.10, 5.4, 7.1, 7.2_

- [ ] 6. Backend: unit + integration tests (Vitest)
  - Service tests: challenge lifecycle/expiry, registration verify happy + tampered, auth verify +
    replay + cross-tenant reject, remove-last-factor guard, label validation, lockout.
  - Route tests: auth guards + mfa_token requirement on authenticate routes.
  - _Requirements: 6.2, 6.3, 6.4, 6.6, 6.7, 6.8, 7.3_

- [x] 7. Frontend: authService passkey methods
  - Added getPasskeyRegistrationOptions, verifyPasskeyRegistration, getPasskeyAuthOptions,
    verifyPasskeyAuth (persists tokens like verifyTwoFactorLogin), listPasskeys, renamePasskey,
    removePasskey.
  - _Requirements: 1.2, 2.1, 3.1_

- [x] 8. Frontend: PasskeySettings + Advanced security section
  - New `PasskeySettings.tsx` (register via startRegistration, list with label/created/last-used,
    rename inline, remove with confirm). Added an "Advanced security" section to
    `TwoFactorSettings.tsx`. Hidden where `browserSupportsWebAuthn()` is false. Also fixed stale
    teal 2FA button colors to brand blue.
  - _Requirements: 1.1, 3.1, 3.2, 3.3, 3.4, 3.5, 5.4_

- [x] 9. Frontend: LoginPage passkey option at MFA step
  - Added "USE A PASSKEY" button at the MFA step (startAuthentication + verifyPasskeyAuth →
    same session as TOTP), with typed-code fallback; hidden where WebAuthn unsupported.
  - _Requirements: 2.6, 2.7, 5.4, 7.1, 7.2_

- [x] 10. Cross-platform: Digital Asset Links + Android config
  - Added `frontend/public/.well-known/assetlinks.json` (package sl.wiskul.app; release SHA-256
    fingerprint placeholder, builds into dist/.well-known and served by Vercel via the filesystem
    route before the SPA catch-all). Backend already reads `WEBAUTHN_ANDROID_ORIGIN`; added
    WEBAUTHN_* to .env.example and a `docs/PASSKEYS.md` guide with exact fingerprint→assetlinks→env
    steps. Web/PWA passkeys work now; native Android needs the release keystore fingerprint filled in.
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 11. Build green + migrate + commit/push
  - Backend + frontend (`build` and `build:app`) green throughout; migration 124 applied to dev DB;
    each stable unit committed + pushed to feature/sl-report-cards.
  - _Requirements: 4.3_

## Notes

- Native passkeys require a release-signed APK whose SHA-256 cert fingerprint matches the
  published `assetlinks.json`; until then, passkeys work on web/PWA and the Android app falls
  back to password + TOTP/backup codes.
- No offline login: every ceremony needs the server. Password remains the base credential.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2", "3", "4"] },
    { "wave": 3, "tasks": ["5"] },
    { "wave": 4, "tasks": ["6", "7", "10"] },
    { "wave": 5, "tasks": ["8", "9"] },
    { "wave": 6, "tasks": ["11"] }
  ]
}
```

- [x] 12. Passwordless passkey login (follow-up)
  - Usernameless ceremony: getUsernamelessOptions (empty allowCredentials → discoverable) +
    verifyUsernameless (resolves user FROM the credential; replay/lockout/counter guards).
    authService.completePasskeyPasswordlessLogin issues the session. Public routes
    /auth/passkeys/login/{options,verify}. LoginPage: "SIGN IN WITH A PASSKEY" button on the
    password step; email+password and 2FA remain as fallback if the passkey has issues.
  - _Requirements: 2 (extends), 7.1_
