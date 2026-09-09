# Requirements Document

## Introduction

This feature lets a school's **account owner** (proprietor / principal) verify their school on
WiSkul through a simple, instant, entry-based flow — no document uploads, no third-party vendor,
no waiting for review. The owner enters the school's **EMIS code** (Ministry of Basic and Senior
Secondary Education / MBSSE Education Management Information System school code) plus their
government-ID details. WiSkul validates the **format** of each field and confirms the government-ID
name **matches** the name captured at registration. When both pass, the school is **verified
instantly**: a **Verified School** badge appears, the owner is prompted for a profile photo, and
high-impact features that were gated become available.

The flow clearly explains **why** verification matters (protecting the school's data and
community, building trust, preventing impersonation, unlocking full access). A pluggable slot is
left so a stronger confirmation tier (e.g. an EMIS lookup API or super-admin spot-check) can be
added later without reworking the flow.

Honest limitation (documented as an assumption): because there is no public EMIS/MBSSE lookup API,
instant verification confirms the entered code is **well-formatted** and the **name matches** — it
does not prove the school exists in a government registry. That stronger check is a future tier.

## Glossary

- **WiSkul**: The multi-tenant school-management platform (Node/Express/Knex on Postgres; React
  frontend). Multi-tenant — every query enforces tenant isolation.
- **Account_Owner**: The user who registered the school and owns the tenant (role `principal`,
  flagged as tenant owner). This feature targets the Account_Owner.
- **Owner_Identity**: The owner's legal name captured at registration, used to match their
  government ID; plus the government-ID type and number entered at verification.
- **EMIS_Code**: The MBSSE school identifier the owner enters as the primary school identifier.
- **School_Details**: Optional supporting fields the owner may enter — school level/category,
  district/chiefdom, year established.
- **Verification_Record**: A server record capturing the entered EMIS_Code, School_Details,
  government-ID details, the Name_Match result, the Verified_Status, and timestamps.
- **Name_Match**: The automated comparison of the entered government-ID name against the
  Owner_Identity name captured at registration.
- **Verified_Status**: The tenant/owner verification state: `unverified` or `verified`.
- **Verified_Badge**: The "Verified School" indicator shown on the tenant/owner profile.
- **Profile_Photo**: The photo the owner uploads or captures after verification, shown with the
  badge.
- **Gated_Feature**: A high-impact tenant capability restricted while the tenant is `unverified`.
- **Verification_Rationale**: The in-app explanation of why verification is required.

## Requirements

### Requirement 1: Capture Owner Name at Registration; Confirm at Verification

**User Story:** As WiSkul, I want the account owner's legal name captured at registration and
confirmed at verification, so that their government-ID name can be matched to it.

#### Acceptance Criteria

1. WHEN a school is registered, THE WiSkul SHALL capture the Account_Owner's full legal name and
   phone number (email already captured), labeled professionally (Proprietor / Principal).
2. THE WiSkul SHALL NOT require the Account_Owner's date of birth at registration.
3. WHEN the Account_Owner starts verification, THE WiSkul SHALL show the registration name pre-
   filled and allow confirming or correcting it before submission.
4. WHEN the name is confirmed, THE WiSkul SHALL persist it against the Account_Owner within that
   owner's tenant.

### Requirement 2: Explain Why Verification Matters

**User Story:** As an Account_Owner, I want to understand why verification is required, so that I
trust the process and complete it willingly.

#### Acceptance Criteria

1. WHEN the Account_Owner opens the verification flow, THE WiSkul SHALL present the
   Verification_Rationale explaining that verification protects the school's data and community,
   builds trust, prevents impersonation, and unlocks full access.
2. WHILE the Account_Owner enters details, THE WiSkul SHALL explain what the EMIS_Code is and why
   each requested field is needed.
3. THE WiSkul SHALL clearly communicate the resulting Verified_Status after submission.

### Requirement 3: Enter Details with Format Validation

**User Story:** As an Account_Owner, I want to enter my EMIS code and government-ID details with
helpful validation, so submissions are strong but I am not blocked by overly rigid rules.

#### Acceptance Criteria

1. THE WiSkul SHALL require the EMIS_Code and the owner's government-ID type (national ID,
   passport, or driver's licence), ID number, and name exactly as printed on the ID.
2. THE WiSkul SHALL accept the optional School_Details (level/category, district/chiefdom, year
   established).
3. WHEN validating the EMIS_Code, THE WiSkul SHALL require alphanumeric characters within a
   sensible length range (4–20 characters), trim surrounding whitespace, and SHALL NOT impose a
   single rigid fixed length that could reject valid codes.
4. WHEN validating the government-ID number, THE WiSkul SHALL apply a per-ID-type character and
   length-range rule (e.g. passport: letters and digits, ~6–12 characters; national ID / driver's
   licence: alphanumeric within a tolerant range), rejecting empty, whitespace-only, too-short, or
   wrong-character input.
5. WHEN a year established is provided, THE WiSkul SHALL require a 4-digit year within a plausible
   range (1900 to the current year).
6. IF a required field is missing or fails its format rule, THEN THE WiSkul SHALL reject the
   submission with a specific validation error identifying the field and the expected format, and
   SHALL NOT verify the tenant.
7. THE WiSkul SHALL allow only the owning Account_Owner (authenticated) to submit verification for
   their own tenant.

### Requirement 4: Automated Name Match

**User Story:** As WiSkul, I want the entered government-ID name to match the registration name,
so that the account owner is the real, named individual tied to the account.

#### Acceptance Criteria

1. WHEN the government-ID name is submitted, THE WiSkul SHALL compare it against the stored
   Owner_Identity name.
2. WHEN comparing names, THE WiSkul SHALL apply case-insensitive, accent- and whitespace-tolerant
   normalization and account for common name-order and middle-name variations.
3. IF the government-ID name does not match the Owner_Identity name under those rules, THEN THE
   WiSkul SHALL NOT verify the tenant and SHALL return a clear name-mismatch message.
4. THE WiSkul SHALL record the Name_Match result on the Verification_Record.

### Requirement 5: Instant Verification

**User Story:** As an Account_Owner, I want verification to take effect immediately when my
details are valid, so I get access right away.

#### Acceptance Criteria

1. WHEN a submission passes all format validations AND the Name_Match succeeds, THE WiSkul SHALL
   set Verified_Status to `verified` immediately, record the timestamp, and unlock the
   Gated_Features for that tenant.
2. WHEN a submission fails any format validation or the Name_Match, THE WiSkul SHALL keep
   Verified_Status `unverified` and return the specific reason.
3. WHEN verification succeeds or fails, THE WiSkul SHALL record the event in the platform audit
   trail with the acting user and tenant.
4. THE WiSkul SHALL persist the Verification_Record scoped to the owning tenant.

### Requirement 6: Feature Gating Until Verified

**User Story:** As the WiSkul platform, I want high-impact tenant features restricted until the
school is verified, so unverified tenants cannot perform sensitive actions.

#### Acceptance Criteria

1. WHILE the tenant's Verified_Status is `unverified`, THE WiSkul SHALL block the defined set of
   Gated_Features for that tenant.
2. WHEN an unverified owner attempts a Gated_Feature, THE WiSkul SHALL deny the action and return
   a message explaining that school verification is required, with a path to start it.
3. WHEN the tenant becomes `verified`, THE WiSkul SHALL grant access to the previously
   Gated_Features without further action.
4. THE WiSkul SHALL enforce gating on the backend for every Gated_Feature action, not only by
   hiding controls in the UI.
5. THE WiSkul SHALL allow non-gated, day-to-day features to be used while unverified, so the
   school is not fully blocked before verification.

### Requirement 7: Verified Badge and Profile Photo

**User Story:** As a verified Account_Owner, I want a "Verified School" badge and my photo shown,
so verified status is visible.

#### Acceptance Criteria

1. WHEN the tenant becomes `verified`, THE WiSkul SHALL prompt the Account_Owner to upload or
   capture a Profile_Photo.
2. WHEN a Profile_Photo is provided, THE WiSkul SHALL store it via the existing storage provider
   and associate it with the owner within their tenant.
3. WHERE the tenant is `verified`, THE WiSkul SHALL display the Verified_Badge together with the
   Profile_Photo on the owner/tenant profile.
4. WHERE the tenant is not `verified`, THE WiSkul SHALL NOT display the Verified_Badge.
5. IF a Profile_Photo upload fails, THEN THE WiSkul SHALL keep the tenant `verified` and prompt
   again later, and SHALL NOT block gated-feature access on the missing photo.

### Requirement 8: Status Visibility and Extensibility

**User Story:** As an Account_Owner, I want to see my verification status; as WiSkul, I want room
to add a stronger confirmation tier later.

#### Acceptance Criteria

1. THE WiSkul SHALL show the Account_Owner their current Verified_Status and, when unverified, a
   path to verify (or the last failure reason).
2. THE WiSkul SHALL restrict all Verification_Record data to the owning tenant.
3. THE WiSkul SHALL provide a pluggable slot so a stronger confirmation tier (EMIS lookup API or
   super-admin spot-check) can be added later without changing the instant entry flow.
4. THE WiSkul SHALL store only the entered identifiers, the Name_Match result, the Verified_Status,
   and the Profile_Photo — no biometric data.

## Non-Goals (Out of Scope)

- **Government registry / EMIS lookup** to prove the school exists (no public API assumed); left
  as a pluggable future tier.
- **Document file uploads** and **super-admin review** for this release — verification is instant,
  based on format validation + name match.
- **Biometric liveness / face-match.**
- **Verifying non-owner users** (teachers, students, parents).

## Assumptions and Constraints

- Instant verification confirms format + name match only; it does not prove the school exists in a
  government registry. A stronger tier can be added later via the pluggable slot.
- Government-ID name is entered as printed; the Name_Match rule applies to that entry.
- Only the account owner (tenant owner / principal) is in scope this release.
- Entered identifiers are sensitive; access is limited to the owning tenant.
