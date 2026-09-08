# Requirements — Offline-First Teacher App (PWA → Android)

## Introduction

Teachers use WiSkul every day, often where internet is unreliable. This feature
makes the teacher's daily workflow work offline, then packages the app for the
Play Store via Capacitor — reusing the existing React frontend, no rewrite.

Scope of offline is deliberately narrow and safe:
- **Offline (read + write, sync later):** Attendance, Grades/score entry, Assignments.
- **Offline (read-only, cached):** the teacher's classes, enrolled students,
  student profiles (basic), timetable, subjects.
- **Online-only (unchanged):** Admin, Admissions, Finance, ID cards, Reports/
  Analytics, Platform/super-admin, Communications. These show a clear
  "needs internet" state when offline.

The local store is IndexedDB (via Dexie) so a single codebase serves web PWA,
Android (Capacitor), and later Windows (Tauri). PostgreSQL/Neon remains the
source of truth; the device holds a teacher-scoped cache + a write queue.

## Glossary
- **Offline-capable module**: a feature usable without connectivity.
- **Write queue**: locally stored pending mutations, flushed to the API on reconnect.
- **Client id**: a client-generated UUID on each queued write for idempotent sync.
- **Sync manifest**: the teacher-scoped set of data a device is allowed to pull.
- **Pull/Push**: pull = fetch server changes since last sync; push = send queued local writes.

## Requirements

### Requirement 1: Installable, offline-opening app (PWA baseline)
**User Story:** As a teacher, I want the app to open and work without internet so a dropped connection never blocks me.

#### Acceptance Criteria
1. THE app SHALL be installable (Add to Home Screen / installable PWA) with icons, name, and theme.
2. WHEN there is no connectivity THE app SHALL still launch and render its shell (no white screen).
3. WHEN a network request fails due to being offline THE app SHALL show a clear offline state rather than an error crash.
4. THE app SHALL show a persistent connectivity/sync indicator (online / offline / syncing / pending changes).

### Requirement 2: Offline teacher reads
**User Story:** As a teacher, I want to see my classes, students, timetable, and subjects offline.

#### Acceptance Criteria
1. WHEN online THE app SHALL cache the teacher's classes, enrolled students, basic student profiles, timetable, and subjects to the local store.
2. WHEN offline THE app SHALL read those entities from the local store.
3. THE local cache SHALL contain only data the teacher is authorized to see (teacher-scoped).

### Requirement 3: Offline attendance (flagship write path)
**User Story:** As a teacher, I want to mark attendance offline and have it sync automatically when I reconnect.

#### Acceptance Criteria
1. WHEN offline THE teacher SHALL be able to mark attendance for their classes; the record is stored locally with a client id and a pending status.
2. WHEN connectivity returns THE app SHALL automatically push pending attendance to the server.
3. THE server SHALL treat a repeated (student, date, session) write idempotently — no duplicate records on retry.
4. WHEN a push succeeds THE local record SHALL be marked synced; WHEN it fails permanently THE app SHALL surface the error for that record.

### Requirement 4: Offline grades & assignments
**User Story:** As a teacher, I want to enter grades and create assignments offline for my classes.

#### Acceptance Criteria
1. WHEN offline THE teacher SHALL be able to enter grades/scores and create assignments for their assigned classes/subjects, stored locally with client ids.
2. WHERE a grade/result is locked on the server THE app SHALL treat it as read-only offline and reject the edit on sync with a clear message.
3. WHEN connectivity returns THE app SHALL push queued grades and assignments idempotently.

### Requirement 5: Sync engine correctness
**User Story:** As a teacher, I want syncing to be automatic and never lose or duplicate my work.

#### Acceptance Criteria
1. THE sync SHALL push queued local writes and pull server changes since the last successful sync, scoped to the teacher.
2. Each queued write SHALL carry a client id so retries are idempotent server-side.
3. Conflicts SHALL resolve per entity: attendance = last-write-wins per (student, date, session); grades = server lock wins; assignments = last-write-wins per client id.
4. A failed sync SHALL be retried automatically with backoff and SHALL not drop pending writes.

### Requirement 6: Online-only modules degrade gracefully
**User Story:** As a user, I want non-offline modules to clearly require internet rather than appear broken.

#### Acceptance Criteria
1. WHEN offline and opening Admin/Admissions/Finance/Reports/Communications/Platform THE app SHALL show a "requires internet" state.
2. THE app SHALL NOT queue or fake writes for online-only modules.

### Requirement 7: Android packaging (Capacitor)
**User Story:** As the platform owner, I want a real Android app for the Play Store that reuses the web frontend.

#### Acceptance Criteria
1. THE existing frontend SHALL be packaged with Capacitor into an Android app pointing at the production API.
2. THE offline features (1–5) SHALL function inside the Android webview identically to the PWA.
3. THE build SHALL produce a signed release artifact (AAB) suitable for Play Console upload.

### Requirement 8: Secure local data & logout wipe (privacy)
**User Story:** As a school, I want student data on a teacher's phone protected so a lost device does not leak children's information.

#### Acceptance Criteria
1. WHEN a user logs out THE app SHALL wipe all locally cached data and the write queue for that user.
2. WHEN the auth session cannot be refreshed after repeated attempts THE app SHALL clear local data and require re-login (pending writes are pushed first if connectivity allows, else preserved only until a successful re-login of the same user).
3. THE app SHALL scope local data to the currently authenticated user; switching users SHALL NOT expose the previous user's cache.
4. Sensitive local fields SHALL be stored using at-rest protection appropriate to the platform (e.g., obfuscation/encryption of the local store where supported).

### Requirement 9: Sync visibility & manual control
**User Story:** As a teacher, I want to see and control sync so I trust the app with my work.

#### Acceptance Criteria
1. THE app SHALL display the last successful sync time and a count of pending changes.
2. THE app SHALL provide a manual "Sync now" action.
3. Lists of offline records SHALL show each record's sync state (pending / synced / failed).
4. Cached read screens SHALL show a freshness/"data as of" indicator when showing cached data offline.

### Requirement 10: Conflict & rejection handling UI
**User Story:** As a teacher, I want to know when a change couldn't be saved and decide what to do.

#### Acceptance Criteria
1. WHEN the server rejects a synced change (e.g., locked grade, permission) THE app SHALL surface the specific record and reason.
2. THE app SHALL let the teacher retry or discard a rejected local change; it SHALL NOT silently drop it.

### Requirement 11: Cache & storage management
**User Story:** As a teacher on a low-end phone, I want control over how much space the app uses.

#### Acceptance Criteria
1. THE app SHALL provide a way to view offline storage usage and clear the offline cache (excluding un-synced pending writes, which require confirmation to discard).
2. THE app SHALL cap/evict stale cached read data per a defined policy.

### Requirement 12: Background sync & app updates
**User Story:** As a teacher, I want my work to sync without babysitting the app, and to know when a new version is available.

#### Acceptance Criteria
1. WHERE the platform supports it, THE app SHALL flush the pending write queue in the background when connectivity is available, even if the app is not in the foreground.
2. WHEN a new app build is deployed THE app SHALL detect it and prompt the user to reload/update.

### Requirement 13: Play Store publishing readiness (non-code prerequisites)
**User Story:** As the platform owner, I want the app to actually be downloadable on the Play Store, meeting Google's policies for an app handling minors' data.

#### Acceptance Criteria
1. THE project SHALL include a hosted **privacy policy** URL describing data collected, use, and retention.
2. THE project SHALL document the **Play Data Safety** answers (data types collected, purposes, sharing, security).
3. THE project SHALL provide store listing assets (app name, short/full description, icon, feature graphic, screenshots).
4. THE project SHALL document the steps to create the Play Console account ($25), complete content rating and Families policy compliance, and upload the signed AAB.
5. NOTE: creating the paid account and submitting for review are manual operator actions outside code; this requirement is satisfied by producing the AAB + assets + documented checklist.
