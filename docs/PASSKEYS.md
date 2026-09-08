# Passkeys (WebAuthn) — setup & operations

Passkeys are a phishing-resistant, password-free sign-in method offered alongside the
authenticator-app (TOTP) 2FA. They are **not** an offline-login mechanism — every ceremony
needs the server to issue and verify a challenge. The email+password credential remains the
account base credential.

## Status

- **Web + installed PWA:** fully working. Origin is `https://www.wiskulsl.com` (same origin
  the app loads from), so registration and login work out of the box once deployed.
- **Native Android app:** needs Digital Asset Links bound to the **release** signing cert
  (see below). Until then, the Android app falls back to password + TOTP/backup codes.

## Where things live

- Backend: `backend/src/services/passkeyService.ts`, routes in `backend/src/routes/authRoutes.ts`
  (`/api/v1/auth/passkeys/*`), migration `124_passkeys.ts`.
- Frontend: `frontend/src/components/settings/PasskeySettings.tsx` (register/manage),
  `frontend/src/pages/LoginPage.tsx` ("USE A PASSKEY" at the MFA step),
  `frontend/src/services/authService.ts` (API methods).
- Asset links: `frontend/public/.well-known/assetlinks.json` (served at
  `https://www.wiskulsl.com/.well-known/assetlinks.json`).

## Backend env

```
WEBAUTHN_RP_ID=www.wiskulsl.com
WEBAUTHN_ORIGIN=https://www.wiskulsl.com
WEBAUTHN_ANDROID_ORIGIN=          # fill in once release keystore exists (see below)
```

## Enabling native Android passkeys

Native passkeys require the app's signing certificate to be bound to the domain via
`assetlinks.json`, and the backend must accept the corresponding Android origin.

1. **Get the release cert SHA-256 fingerprint** from the release keystore
   (see `docs/ANDROID_RELEASE.md` for keystore creation):

   ```
   keytool -list -v -keystore <release.jks> -alias <alias>
   ```

   Copy the `SHA256:` fingerprint (colon-separated hex).

2. **Fill `frontend/public/.well-known/assetlinks.json`** — replace
   `REPLACE_WITH_RELEASE_SHA256_FINGERPRINT` with that colon-separated SHA-256 value, e.g.
   `AB:CD:...:EF`. Commit + deploy so it's live at
   `https://www.wiskulsl.com/.well-known/assetlinks.json`.

3. **Set the backend Android origin.** The Android WebAuthn origin is
   `android:apk-key-hash:<base64url>`, where `<base64url>` is the base64url encoding of the
   RAW SHA-256 bytes of the release cert (not the hex string). Set it in Vercel:

   ```
   WEBAUTHN_ANDROID_ORIGIN=android:apk-key-hash:<base64url-sha256>
   ```

   Helper to convert the hex fingerprint to base64url:
   ```bash
   echo "AB:CD:...:EF" | tr -d ':' | xxd -r -p | openssl base64 -A | tr '+/' '-_' | tr -d '='
   ```

4. **Use a release-signed APK.** Debug builds are signed with a different key whose
   fingerprint won't match `assetlinks.json`, so passkeys won't verify on debug builds.

5. Redeploy the app; native passkeys should now register and authenticate.

## Security notes

- Server-issued, single-use, 120s challenges (`webauthn_challenges`).
- Origin + RP_ID verified on every ceremony; only the web origin and the configured Android
  origin are accepted.
- Signature-counter replay guard; per-credential attempt lockout (5 / 300s).
- Strict tenant isolation on all `user_passkeys` queries.
- Removal is blocked if it would strand the user's only second factor.
- All add/rename/remove/login events are written to the audit log.
