# Requirements Document

## Introduction

This feature adds passkeys (WebAuthn/FIDO2) to WiSkul as an advanced, phishing-resistant
sign-in and second-factor option, offered alongside the existing authenticator-app (TOTP)
two-factor authentication. From the Security tab in Settings, a user can choose between the
existing authenticator-app method and passkeys, register one or more passkeys, and later use
a passkey to sign in — either as an alternative to entering a TOTP code as the second factor,
or (where enabled) as a single-gesture step following the base password credential.

Passkeys are a **password-free / phishing-resistant** authentication choice. They are **not**
an offline-access mechanism: every WebAuthn ceremony requires the WiSkul backend to issue and
verify a single-use, time-limited challenge, so the server must be reachable. Offline login is
an explicit non-goal (see Non-Goals). The email + password credential remains the account base
credential for the first release; passwordless-only accounts are out of scope.

The feature must work in a standard web browser, inside the installed PWA ("app mode"), and
inside the native Android app (Capacitor, app id `sl.wiskul.app`) which loads the live web
bundle from `https://www.wiskulsl.com`. All storage and verification must enforce WiSkul's
multi-tenant isolation model, and all passkey add/remove/login events must be recorded in the
existing platform audit trail.

## Glossary

- **WiSkul**: The multi-tenant school-management platform. Backend is Node/Express/Knex on
  Postgres (Neon); frontend is React 18 + Vite + Tailwind.
- **Passkey**: A WebAuthn/FIDO2 discoverable credential bound to a device or synced credential
  provider, used to authenticate a WiSkul user without a shared secret.
- **WebAuthn_Service**: The backend service and routes that generate and verify WebAuthn
  registration and authentication ceremonies (built on a WebAuthn library such as
  `@simplewebauthn/server`).
- **Passkey_Store**: The tenant-isolated persistence layer holding, per credential: credential
  ID, public key, signature counter, transports, device label, owning user ID, tenant ID,
  created timestamp, and last-used timestamp.
- **Challenge_Store**: Persistence for server-issued WebAuthn challenges, analogous to the
  existing `mfa_challenges` mechanism (single-use, time-limited, attempt-bounded).
- **Registration_Ceremony**: The WebAuthn flow that creates and stores a new passkey
  (options generation followed by attestation verification).
- **Authentication_Ceremony**: The WebAuthn flow that proves possession of a registered passkey
  (options generation followed by assertion verification).
- **RP_ID (Relying Party ID)**: The domain the passkey is bound to. For WiSkul this is
  `www.wiskulsl.com`.
- **Origin**: The full origin presented by the client during a ceremony (for example
  `https://www.wiskulsl.com` for web/PWA, and the Android app origin derived from the app
  signing certificate).
- **Digital_Asset_Links**: The `assetlinks.json` file served from the WiSkul domain that binds
  the Android app package and signing certificate to the RP ID, enabling native passkeys.
- **Second_Factor**: An authentication factor applied after the password credential succeeds.
  Existing factors are authenticator-app TOTP codes and backup codes; passkeys are added.
- **Base_Credential**: The email + password credential that every account retains in this release.
- **Auth_Method**: Any configured means of authenticating a factor — the Base_Credential, the
  authenticator app (TOTP) with its backup codes, or one or more passkeys.
- **Audit_Trail**: The existing platform audit mechanism (`audit_logs`, keyed by user and
  tenant) used to record security-relevant events.
- **Security_Settings**: The Security tab within the WiSkul Settings page where users manage
  two-factor and passkey options.

## Requirements

### Requirement 1: Register a Passkey from Security Settings

**User Story:** As a WiSkul user, I want to register one or more passkeys from the Security
settings, so that I can use a phishing-resistant, password-free method instead of an
authenticator app.

#### Acceptance Criteria

1. WHERE a user opens Security_Settings, THE WiSkul SHALL present a choice between the
   authenticator-app (TOTP) method and the passkey method for advanced authentication.
2. WHEN an authenticated user requests to add a passkey, THE WebAuthn_Service SHALL generate
   registration options that include a server-issued single-use challenge bound to that user
   and that user's tenant, and that expires 120 seconds after issuance.
3. WHEN registration options are generated, THE WebAuthn_Service SHALL set the RP_ID to
   `www.wiskulsl.com`.
4. WHEN registration options are generated, THE WebAuthn_Service SHALL exclude credentials
   already registered to the user so that the same authenticator is not registered twice.
5. IF a user already has 10 passkeys registered, THEN THE WebAuthn_Service SHALL reject the
   request to add another and return an error indicating the per-user passkey limit is reached.
6. WHEN the client returns a registration response, THE WebAuthn_Service SHALL verify the
   attestation against the issued challenge, the expected Origin, and the RP_ID before storing
   any credential.
7. WHEN attestation verification succeeds, THE Passkey_Store SHALL persist the credential ID,
   public key, initial signature counter, transports, device label, owning user ID, tenant ID,
   and created timestamp.
8. IF attestation verification fails or the challenge has expired or was already consumed, THEN
   THE WebAuthn_Service SHALL reject the registration and return a descriptive error without
   storing any credential.
9. WHEN a user submits a registration without providing a device label, THE WiSkul SHALL assign
   a default device label derived from the reported authenticator or platform.
10. WHERE a device label is provided, THE WiSkul SHALL accept a label of 1 to 64 characters and
    reject a label outside that range with a validation error.
11. WHEN a passkey is successfully registered, THE Audit_Trail SHALL record a passkey-added event
    containing the acting user ID and tenant ID.

### Requirement 2: Sign In Using a Passkey

**User Story:** As a WiSkul user, I want to sign in with a registered passkey, so that I can
authenticate without typing a password and TOTP code.

#### Acceptance Criteria

1. WHEN a user initiates passkey sign-in, THE WebAuthn_Service SHALL generate authentication
   options that include a server-issued single-use challenge that expires 120 seconds after issuance.
2. WHEN authentication options are generated, THE WebAuthn_Service SHALL set the RP_ID to
   `www.wiskulsl.com`.
3. WHEN the client returns an authentication response, THE WebAuthn_Service SHALL verify the
   assertion against the issued challenge, the expected Origin, and the RP_ID before granting
   access, completing verification within 3 seconds of receiving the response.
4. IF a client returns an authentication response after its associated challenge has expired or
   against a challenge that has already been consumed, THEN THE WebAuthn_Service SHALL reject the
   authentication, return an authentication error indicating the challenge is invalid or expired,
   and grant no session access.
5. WHEN assertion verification requires a stored credential, THE WebAuthn_Service SHALL look up
   the credential only within the tenant that owns the presented credential ID.
6. IF a presented credential ID is not found in the Passkey_Store for the resolving tenant,
   THEN THE WebAuthn_Service SHALL reject the authentication, return an authentication error, and
   grant no session access.
7. IF assertion verification fails against the issued challenge, the expected Origin, or the
   RP_ID, THEN THE WebAuthn_Service SHALL reject the authentication, return an authentication
   error, grant no session access, and leave the credential's last-used timestamp unchanged.
8. IF a user submits 5 consecutive failed passkey authentication attempts for the same credential
   ID within a 300-second window, THEN THE WebAuthn_Service SHALL reject further attempts for that
   credential ID and return an error indicating that authentication is temporarily locked.
9. WHEN assertion verification succeeds, THE WiSkul SHALL issue the same session tokens that a
   completed password-plus-second-factor login issues.
10. WHEN a passkey is used as the Second_Factor after the Base_Credential, THE WebAuthn_Service
    SHALL complete the existing second-factor challenge in place of a TOTP or backup code.
11. WHEN a passkey authentication succeeds, THE Passkey_Store SHALL update the credential's
    last-used timestamp.
12. WHEN a passkey authentication succeeds, THE Audit_Trail SHALL record a passkey-login event
    containing the authenticated user ID, tenant ID, and the credential ID used.

### Requirement 3: Manage Registered Passkeys

**User Story:** As a WiSkul user, I want to view, rename, and remove my registered passkeys, so
that I can keep my list of trusted devices accurate and revoke access I no longer trust.

#### Acceptance Criteria

1. WHEN an authenticated user opens the passkey section of Security_Settings, THE Passkey_Store
   SHALL return only the passkeys owned by that user within that user's tenant.
2. WHEN the passkey list is displayed, THE WiSkul SHALL show, for each passkey, the device label,
   the created timestamp, and the last-used timestamp.
3. WHEN an authenticated user renames a passkey to a label of 1 to 64 characters, THE
   Passkey_Store SHALL update the device label for the identified credential owned by that user.
4. IF an authenticated user renames a passkey to a label outside 1 to 64 characters, THEN THE
   WiSkul SHALL reject the rename and return a validation error.
5. IF an authenticated user attempts to rename or remove a credential ID that does not exist or
   is not owned by that user within that user's tenant, THEN THE WiSkul SHALL reject the request
   and return a not-found error without modifying any credential.
6. WHEN an authenticated user removes a passkey and at least one other Auth_Method remains
   available for that user, THE Passkey_Store SHALL delete the identified credential owned by
   that user.
7. IF removing a passkey would leave the user with no Auth_Method beyond the Base_Credential and
   no remaining Second_Factor while a Second_Factor is required, THEN THE WiSkul SHALL reject the
   removal and return a message explaining that at least one other method must remain.
8. WHEN a passkey is renamed, THE Audit_Trail SHALL record a passkey-updated event containing the
   acting user ID and tenant ID.
9. WHEN a passkey is removed, THE Audit_Trail SHALL record a passkey-removed event containing the
   acting user ID, tenant ID, and the removed credential ID.

### Requirement 4: Backend WebAuthn Ceremonies and Credential Storage

**User Story:** As a WiSkul platform engineer, I want the backend to run standards-compliant
WebAuthn ceremonies and store credentials in a tenant-isolated way, so that passkey
authentication is correct and secure.

#### Acceptance Criteria

1. THE WebAuthn_Service SHALL generate registration options and verify registration responses
   using a WebAuthn library.
2. THE WebAuthn_Service SHALL generate authentication options and verify authentication
   responses using a WebAuthn library.
3. WHEN a credential is stored, THE Passkey_Store SHALL associate the credential with exactly
   one owning user ID and that user's tenant ID.
4. THE Passkey_Store SHALL persist the credential ID, public key, signature counter, transports,
   and device label for every stored credential.
5. WHEN the WebAuthn_Service queries or updates a credential, THE Passkey_Store SHALL scope the
   query to the tenant that owns the credential.
6. WHEN an authentication assertion is verified, THE WebAuthn_Service SHALL update the stored
   signature counter to the value reported in the verified assertion.

### Requirement 5: Cross-Platform Support (Web, PWA, Native Android)

**User Story:** As a WiSkul user on any supported client, I want passkeys to work in the browser,
the installed PWA, and the native Android app, so that I can use the same method everywhere.

#### Acceptance Criteria

1. WHERE a ceremony originates from the web browser or the installed PWA, THE WebAuthn_Service
   SHALL accept the origin `https://www.wiskulsl.com` for challenge verification.
2. WHERE a ceremony originates from the native Android app, THE WebAuthn_Service SHALL accept the
   Android app origin derived from the app signing certificate for challenge verification.
3. THE WiSkul SHALL serve a Digital_Asset_Links file that binds the Android package `sl.wiskul.app`
   and its signing certificate to the RP_ID `www.wiskulsl.com`.
4. IF the requesting client does not support WebAuthn, THEN THE WiSkul SHALL hide or disable the
   passkey option and present the authenticator-app method instead.

### Requirement 6: Challenge, Origin, and Replay Security

**User Story:** As a WiSkul security stakeholder, I want passkey ceremonies to use server-issued,
single-use, time-limited challenges with origin and replay protection, so that authentication is
resistant to phishing and replay across tenants.

#### Acceptance Criteria

1. WHEN a ceremony challenge is generated, THE Challenge_Store SHALL persist a server-generated
   challenge value bound to the user and tenant.
2. WHEN a ceremony challenge is generated, THE Challenge_Store SHALL set an expiry no later than
   5 minutes after creation.
3. IF a challenge is presented after its expiry, THEN THE WebAuthn_Service SHALL reject the
   ceremony and return an expiry error.
4. WHEN a challenge is successfully verified, THE Challenge_Store SHALL invalidate that challenge
   so that it cannot be reused.
5. WHEN verifying any ceremony, THE WebAuthn_Service SHALL confirm the presented Origin matches
   one of the accepted origins (the web/PWA origin `https://www.wiskulsl.com` or the configured
   native Android app origin) and the RP_ID matches `www.wiskulsl.com`.
6. IF the presented Origin does not match an accepted origin or the RP_ID does not match
   `www.wiskulsl.com`, THEN THE WebAuthn_Service SHALL reject the ceremony and return an
   origin/RP-ID mismatch error, granting no access and storing no credential.
7. IF a verified assertion reports a signature counter less than or equal to the stored counter
   for a credential that previously reported a nonzero counter, THEN THE WebAuthn_Service SHALL
   reject the authentication as a suspected replay and return a replay error.
8. WHEN the WebAuthn_Service resolves a credential, THE WebAuthn_Service SHALL reject use of a
   credential whose owning tenant differs from the tenant of the authenticating context and
   return an authentication error.

### Requirement 7: Fallback and Lockout Prevention

**User Story:** As a WiSkul user, I want a reliable fallback when a passkey is unavailable and
protection against being locked out, so that I can always regain access to my account.

#### Acceptance Criteria

1. IF a passkey is unavailable at sign-in, THEN THE WiSkul SHALL allow the user to authenticate
   using the Base_Credential plus the authenticator-app TOTP code or a backup code.
2. WHEN a user has registered passkeys and also has authenticator-app 2FA enabled, THE WiSkul
   SHALL offer both the passkey option and the TOTP-or-backup-code option at the second-factor
   step.
3. IF a requested removal would remove the last remaining Auth_Method that prevents account
   lockout, THEN THE WiSkul SHALL reject the removal and return a message explaining that at least
   one usable method must remain.
4. THE WiSkul SHALL retain the Base_Credential (email + password) for every account in this
   release.

## Non-Goals (Out of Scope)

- **Offline login**: Passkeys require the WiSkul backend to issue and verify a challenge, so
  passkey authentication does not function without server connectivity. Offline access is not
  provided by this feature.
- **Passwordless-only accounts**: Removing the email + password Base_Credential so that an
  account authenticates solely with a passkey is out of scope for the first release; the password
  remains the base credential.
- **Non-Android native platforms**: Native passkey support for platforms other than the existing
  Android app is out of scope for this release.

## Assumptions and Constraints

- Reliable native passkeys on Android require a release-signed APK; debug-signed builds may not
  produce a signing certificate that matches the published Digital_Asset_Links.
- The Digital_Asset_Links (`assetlinks.json`) file must be published on `www.wiskulsl.com` and
  bound to the app signing certificate before native Android passkeys can be verified.
- The RP_ID is fixed to `www.wiskulsl.com`; passkeys registered under this RP_ID will not work if
  the app is served from a different domain.
- Passkey challenges reuse the existing single-use, time-limited, attempt-bounded challenge
  pattern already used for TOTP MFA challenges (5-minute TTL).
