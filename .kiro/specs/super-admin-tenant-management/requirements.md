# Requirements — Comprehensive Super Admin Tenant Management

## Introduction

The super admin console can create, edit, suspend, activate, soft-delete, change
plans, and set per-tenant email senders. This feature closes the remaining gaps
so the platform operator can fully run schools in production — billing, user
support, impersonation, branding, audit, and usage visibility — without ever
touching a school's academic data or setting a tenant's own storage credentials.
Separately, tenant principals gain self-service UploadThing storage credential
configuration in Settings, mirroring the existing email-sender feature.

## Glossary

- **Super admin**: platform operator; role `super_admin`; not a member of any tenant.
- **Tenant**: a school; row in `tenants`, with a paired `schools` profile row.
- **Impersonation**: a super admin operating a scoped session as a tenant user, for support.
- **Own mode**: tenant uses its own provider credentials (email or storage) instead of the platform default.

## Requirements

### Requirement 1: Real, manageable billing

**User Story:** As a super admin, I want to view and control each tenant's billing so that plan changes and renewals take real effect.

#### Acceptance Criteria
1. WHEN a super admin opens a tenant's Billing tab THE system SHALL display billing history in SLE currency and the current subscription period.
2. WHEN a super admin changes a tenant's plan THE system SHALL update the tenant's feature access and limits immediately (enforced on the tenant's next request).
3. WHEN a super admin renews a subscription THE system SHALL extend the end date and record a paid billing entry.
4. WHEN a super admin extends or expires a subscription THE system SHALL update the end date / status accordingly and reflect it in enforcement.
5. WHERE a subscription was expired or suspended, WHEN the super admin changes or renews the plan THE system SHALL restore the tenant to active.

### Requirement 2: Tenant user management

**User Story:** As a super admin, I want to manage users inside a tenant so that I can resolve access problems without logging in as the school.

#### Acceptance Criteria
1. WHEN a super admin opens a tenant's Users tab THE system SHALL list that tenant's users only.
2. WHEN a super admin resets a user's password THE system SHALL generate a temporary password and reveal it once.
3. WHEN a super admin unlocks or activates/deactivates a user THE system SHALL update that user's status within the tenant.
4. WHEN a super admin disables a user's two-factor authentication THE system SHALL clear the 2FA configuration for that user.
5. THE system SHALL never allow a user action to affect a different tenant.

### Requirement 3: Impersonation

**User Story:** As a super admin, I want to enter a school as a support session so that I can troubleshoot in context.

#### Acceptance Criteria
1. WHEN a super admin starts impersonation THE system SHALL create a scoped session as the chosen tenant user and record an audit entry attributing it to the super admin.
2. WHILE impersonating THE system SHALL display a persistent banner identifying the school and offering an exit.
3. WHEN the super admin exits impersonation THE system SHALL restore the super admin session.

### Requirement 4: Tenant branding & profile

**User Story:** As a super admin, I want to edit a tenant's branding and profile so that onboarding is complete.

#### Acceptance Criteria
1. WHEN a super admin edits a tenant's profile THE system SHALL persist logo, short name, principal details, website, locale to the school record.
2. THE system SHALL keep these edits scoped to the target tenant.

### Requirement 5: Audit trail

**User Story:** As a super admin, I want an audit trail of platform actions so that operations are accountable.

#### Acceptance Criteria
1. WHEN a super admin performs suspend, activate, delete, restore, plan change, renew, extend, expire, impersonate, or a user action THE system SHALL record an audit entry with actor, action, tenant, and timestamp.
2. WHEN a super admin views a tenant's Audit tab THE system SHALL display that tenant's audit entries.

### Requirement 6: Usage vs limits visibility

**User Story:** As a super admin, I want to see each tenant's usage against its limits so that I can advise upgrades.

#### Acceptance Criteria
1. WHEN a super admin views a tenant THE system SHALL display current students, staff, and users against their plan maximums.
2. WHERE usage is at or above 80% of a limit THE system SHALL visually warn.

### Requirement 7: Restore archived tenant

**User Story:** As a super admin, I want to restore a soft-deleted tenant so that accidental deletions are recoverable.

#### Acceptance Criteria
1. WHEN a super admin filters by archived/expired THE system SHALL list soft-deleted tenants.
2. WHEN a super admin restores an archived tenant THE system SHALL return it to active with its original name and slug.

### Requirement 8: Tenant self-service storage credentials (Principal Settings)

**User Story:** As a principal, I want to configure my school's own UploadThing credentials so that our file uploads use our own account.

#### Acceptance Criteria
1. WHEN a principal opens Storage settings THE system SHALL show the current provider (platform or own) and whether it is configured, with any stored token masked.
2. WHEN a principal saves own-mode UploadThing credentials THE system SHALL store them for the tenant and mark storage configured.
3. WHERE a tenant is in own mode and configured, WHEN files are uploaded THE system SHALL use the tenant's credentials; otherwise it SHALL use the platform default.
4. THE system SHALL never return a stored storage secret in unmasked form, and the super admin SHALL NOT set a tenant's storage credentials.
