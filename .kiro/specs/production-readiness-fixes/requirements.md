# Requirements — Production Readiness Fixes

## Introduction

A set of eight issues found during final pre-merge testing of WiSkul. These are
correctness, completeness, and polish gaps that block a confident production
launch. Each is tracked as its own requirement so we can implement and verify
them one at a time. The system is a multi-tenant school management platform, so
every fix MUST preserve strict tenant isolation.

Legend for status found during triage:
- Newsletter welcome email: code EXISTS and is wired; the failure is a runtime /
  config / delivery issue to diagnose, not missing code.
- Import/Export: partially scaffolded (a Phase 22 serialization route exists in
  tests) but not surfaced/implemented as a usable feature.

---

## Requirement 1 — Newsletter welcome email delivery

**User Story:** As a newsletter subscriber, I want to receive a welcome/
confirmation email when I subscribe, so that I know my subscription worked.

#### Acceptance Criteria
1. WHEN a visitor subscribes via the public newsletter form AND they are newly
   opted-in THEN the system SHALL deliver a welcome email to their address.
2. WHEN email delivery fails THEN the system SHALL log the specific provider
   error (not swallow it silently) and SHALL NOT fail the subscribe request.
3. WHEN the "sales" sender identity or Brevo API key is misconfigured THEN the
   diagnosis SHALL identify the exact cause and the fix SHALL make delivery work
   in production.
4. WHEN a subscriber is already subscribed THEN the system SHALL NOT re-send the
   welcome email.

## Requirement 2 — Data import feature

**User Story:** As a school admin, I want to import students (and other key
records) from a spreadsheet, so that I can onboard quickly without manual entry.

#### Acceptance Criteria
1. WHEN an admin uploads a CSV/XLSX of students THEN the system SHALL validate
   rows, report per-row errors, and import only valid rows within the tenant.
2. WHEN the import would exceed the tenant's plan student limit THEN the system
   SHALL block the import with a clear limit message.
3. WHEN an import completes THEN the system SHALL show a summary (imported,
   skipped, failed with reasons).
4. WHEN a template is needed THEN the system SHALL provide a downloadable import
   template with the expected columns.
5. The import SHALL be tenant-scoped — imported records belong only to the
   acting tenant.

## Requirement 3 — Data backups

**User Story:** As a platform operator, I want tenant data backups, so that data
can be restored after loss or corruption.

#### Acceptance Criteria
1. WHEN a backup runs THEN the system SHALL produce a restorable snapshot of a
   tenant's data (or a documented platform-level DB backup strategy).
2. WHEN a super admin requests it THEN the system SHALL allow an on-demand
   backup/export of a tenant.
3. The backup process SHALL be documented (schedule, retention, restore steps).
4. Backups SHALL NOT expose one tenant's data to another.

## Requirement 4 — Data export

**User Story:** As a school admin, I want to export my data (students, finance,
attendance, etc.) to CSV/PDF, so that I can report and keep records offline.

#### Acceptance Criteria
1. WHEN an admin requests an export on a data page THEN the system SHALL produce
   a CSV (and PDF where appropriate) of the currently scoped, tenant-isolated
   data.
2. WHEN a large dataset is exported THEN the system SHALL stream or paginate to
   avoid timeouts.
3. Exports SHALL respect the acting user's role/permissions and tenant scope.
4. Exported files SHALL use Leone (Le) for currency.

## Requirement 5 — Refresh functionality across pages

**User Story:** As a user, I want a reliable refresh control on data pages, so
that I can reload the latest data without a full page reload.

#### Acceptance Criteria
1. WHEN a user clicks refresh on a data page THEN the system SHALL refetch that
   page's queries and show a loading indicator.
2. Refresh SHALL be available consistently across the main data pages.
3. WHEN a refetch fails THEN the system SHALL surface an error state and keep the
   last good data.

## Requirement 6 — Offline modules return no data (attendance + others)

**User Story:** As a teacher offline, I want the attendance page (and other
offline modules) to show my students, so that I can work without internet.

#### Acceptance Criteria
1. WHEN a teacher opens the attendance page offline THEN the system SHALL show
   the students that were cached while online.
2. WHEN online THEN the system SHALL cache the data needed for offline use
   (students per class, etc.) so it is available later offline.
3. The root cause of "no students returned offline" SHALL be identified (missing
   pre-cache, wrong cache key, sync scope, or IndexedDB read path) and fixed.
4. Other offline-capable modules SHALL be checked for the same defect and fixed.

## Requirement 7 — Update badge dismissal bug

**User Story:** As a user, I want the "new version available" badge to disappear
after I apply the update, so that I'm not shown a stale prompt.

#### Acceptance Criteria
1. WHEN a new version is available THEN the system SHALL show the update badge.
2. WHEN the user applies the update THEN the badge SHALL disappear on the FIRST
   toggle/action, not require a second toggle.
3. After update the badge SHALL NOT reappear until a genuinely newer version is
   available.

## Requirement 8 — Professional support with tickets

**User Story:** As a school user, I want to raise support tickets and track their
status, so that support is handled professionally and traceably.

#### Acceptance Criteria
1. WHEN a user submits a support ticket THEN the system SHALL store it with a
   reference number, subject, body, category, priority, and status.
2. WHEN a super admin/support agent views tickets THEN the system SHALL list
   tickets across tenants with filters; a tenant user SHALL only see their own
   tenant's tickets.
3. WHEN a ticket is updated (reply/status change) THEN the system SHALL notify
   the relevant party by email and reflect status in-app.
4. Ticket data SHALL be tenant-scoped for tenant users; super admin/support has
   platform-wide visibility.
5. The support entry point SHALL be reachable from the app (e.g. a Support page
   / help menu).
