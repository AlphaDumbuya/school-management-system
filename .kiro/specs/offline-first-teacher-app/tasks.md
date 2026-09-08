# Implementation Plan — Offline-First Teacher App (PWA → Android)

- [x] 1. PWA baseline: installable manifest + service worker (app-shell precache, runtime GET caching, offline fallback)
  - Existing SW already precaches shell, network-first API cache, SPA fallback, bg-sync queue, push. Fixed manifest theme→brand blue, start_url→/dashboard. Added OfflineBanner (offline strip + update-available prompt).
  - _Requirements: 1_

- [x] 2. Connectivity + sync UI primitives
  - Existing `useOfflineStatus` (online/pending/syncing/flush). Added `SyncStatusIndicator` in Header. `OfflineGate` for online-only routes → Task 10.
  - _Requirements: 1, 6_

- [x] 3. Local store: Dexie schema (cache tables, writes, outbox, sync_meta) + client-id util
  - `src/offline/db.ts`: per-user namespaced DB, cache tables (classes/students/subjects/timetable), write tables (attendance/grades/assignments) with clientId+syncStatus, outbox, sync_meta; getOfflineDb/wipeOfflineDb/newClientId. Separate from the existing generic offlineQueue.
  - _Requirements: 2, 3, 4, 5_

- [x] 4. Backend: migration 123 (client_id + updated_at) and idempotent create on attendance/grades/assignments
  - Migration 123 adds nullable client_id (+ partial unique index) and updated_at to attendance/grades/assignments. Create endpoints accept client_id and return the existing row (200) on repeat — no duplicates on retry.
  - _Requirements: 3, 4, 5_

- [x] 5. Backend: sync routes — GET /sync/pull (teacher-scoped) + POST /sync/push (batch, per-item result)
  - `syncService` resolves teacher scope (assigned + led classes → enrolled students); pull returns changed classes/students/subjects/schedules/attendance/grades/assignments since a timestamp; push applies items idempotently by client_id (attendance last-write-wins per key, grades reject when locked, assignments by client_id) with per-item result. Mounted at /api/v1/sync (teacher-only).
  - _Requirements: 5_

- [x] 6. Frontend read cache: rosterRepo (classes/students/subjects/timetable) read-through + refresh; useRoster hook
  - `syncClient` (pull/push wrappers); `rosterRepo` read-through cache into Dexie with incremental refresh + freshness bookmark; `useRoster` hook (serves cache first, refreshes when online, exposes fromCache + lastSyncedAt). Wiring specific teacher pages to useRoster happens alongside the attendance page in Task 8.
  - _Requirements: 2_

- [x] 7. Frontend sync engine: push outbox + pull changes, triggers (start/online/interval/after-write), backoff
  - `syncEngine`: drains Dexie outbox to /sync/push, maps per-item results to local syncStatus (applied/duplicate→synced, rejected→error, MAX_ATTEMPTS cap), then pulls via rosterRepo; serialized + backoff. `useSyncEngine` hook mounted in MainLayout triggers on start/online/interval/after-write (requestSync event); teacher-only.
  - _Requirements: 5_

- [ ] 8. Offline Attendance: attendanceRepo write-behind; page works offline; verify single row + no-duplicate on retry
  - _Requirements: 3_

- [ ] 9. Offline Grades + Assignments: repos + pages; locked-grade rejected on sync with clear message
  - _Requirements: 4_

- [ ] 10. Online-only gating: wrap Admin/Admissions/Finance/Reports/Communications/Platform routes with OfflineGate
  - _Requirements: 6_

- [ ] 11. Secure local data: user-namespaced store + wipe on logout/unrecoverable auth; final-push-then-wipe
  - _Requirements: 8_

- [ ] 12. Sync visibility: last-synced + pending count + "Sync now"; per-row sync chips; "data as of" freshness badge
  - _Requirements: 9_

- [ ] 13. Conflict/rejection: per-item push results; "Sync issues" view with Retry/Discard
  - _Requirements: 10_

- [ ] 14. Cache & storage: usage estimate + clear-cache (preserve pending); TTL eviction on refresh
  - _Requirements: 11_

- [ ] 15. Background sync + app-update prompt (SW background sync / Capacitor resume; prompt-to-reload)
  - _Requirements: 12_

- [ ] 16. Capacitor Android: add Capacitor, Android platform, app id/icons/splash, production API base
  - _Requirements: 7_

- [ ] 17. Android release: keystore + signed AAB; verify offline features in webview
  - _Requirements: 7_

- [ ] 18. Play Store readiness: public Privacy Policy page + docs/PLAY_STORE_CHECKLIST.md (Data Safety, listing assets, content rating, Families policy, upload steps)
  - _Requirements: 13_

- [ ] 19. Build backend + frontend green; run migration; commit + push
  - _Requirements: all_
```
```
