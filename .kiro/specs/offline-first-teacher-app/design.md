# Design — Offline-First Teacher App (PWA → Android)

## Overview

Add an offline layer to the existing React frontend for the teacher's daily
workflow, then wrap it with Capacitor for the Play Store. No UI rewrite:
the same components render in the browser PWA, the Capacitor Android webview,
and (later) a Tauri Windows shell. Postgres/Neon stays the source of truth.

Guiding principles:
- **Local-first for the 3 write modules** (attendance, grades, assignments) and
  read-cache for the teacher's supporting data; everything else stays online-only.
- **Single local store**: IndexedDB via **Dexie** (works in every webview).
- **Idempotent sync** via client-generated UUIDs so retries never duplicate.
- **Teacher-scoped** pull manifests mirror existing backend scoping.

## Architecture

```
React UI (unchanged components)
        │
   Data access layer (NEW)
   ┌────┴─────────────────────────┐
   │ repositories: read local →   │   online-only modules → apiClient (as today)
   │ fall back to network;        │
   │ write local + enqueue        │
   └────┬─────────────────────────┘
        │
   Dexie (IndexedDB): cache tables + outbox (write queue) + sync_meta
        │
   Sync engine (NEW): push outbox → pull changes, on reconnect / interval
        │
   apiClient → /api/v1/... (+ new /sync endpoints)
        │
   Express API → Postgres/Neon
```

## Frontend components

### Local store — `frontend/src/offline/db.ts` (Dexie)
Tables (all keyed by server id where known, plus `clientId`):
- Cache (read): `classes`, `students`, `subjects`, `timetable`.
- Writes: `attendance`, `grades`, `assignments` — each row has
  `{ clientId, serverId?, ...fields, syncStatus: 'pending'|'synced'|'error', updatedAt, error? }`.
- `outbox`: ordered queue of mutations `{ id, entity, op, clientId, payload, attempts, createdAt }`.
- `sync_meta`: `{ key, lastPulledAt }` per entity.

### Data layer — `frontend/src/offline/repositories/*`
- `attendanceRepo`, `gradesRepo`, `assignmentsRepo`: read-through + write-behind.
- `rosterRepo` (classes/students/subjects/timetable): read-through cache, network refresh when online.
- Each write generates a `clientId` (uuid), writes to Dexie as `pending`, and enqueues to `outbox`.

### Sync engine — `frontend/src/offline/sync.ts`
- Triggers: on app start (if online), on `online` event, on a periodic timer, and after each local write (debounced).
- **Push**: drain `outbox` in order; POST to `/api/v1/sync/push` (batch) or existing endpoints with `clientId`; mark rows synced / error.
- **Pull**: GET `/api/v1/sync/pull?since=<ts>` scoped to the teacher; upsert into cache tables; advance `sync_meta`.
- Backoff on failure; never drop pending items.

### Connectivity + UI
- `useOnlineStatus` hook (navigator.onLine + heartbeat ping).
- `SyncStatusIndicator` in the layout: online / offline / syncing / "N pending".
- `OfflineGate` wrapper for online-only routes → renders a "requires internet" panel when offline.
- Service worker (existing `vite-plugin-pwa`) upgraded: precache app shell, runtime-cache GET APIs (stale-while-revalidate), offline fallback.

## Backend components

Reuse existing endpoints where possible; add idempotency + a sync pair.

### Idempotency
- Accept an optional `client_id` on attendance/grade/assignment create. Store it
  (add nullable `client_id` columns via a migration) and dedupe on it so a retried
  push is a no-op that returns the existing record.
- Attendance already guards duplicate `(student, date, session)` — extend to also
  match on `client_id` for clean idempotency.

### Sync endpoints — `backend/src/routes/syncRoutes.ts`
- `GET  /api/v1/sync/pull?since=` → teacher-scoped changed rows for
  classes/students/subjects/timetable/attendance/grades/assignments since `since`.
- `POST /api/v1/sync/push` → batch of `{ entity, op, clientId, payload }`; applies
  each idempotently, returns per-item result (`applied` | `duplicate` | `rejected`
  with reason, e.g. grade locked).
- Both `authenticate + authorize(TEACHER, ...)` and scoped to the teacher's classes.

### Migration
- `123_sync_metadata.ts`: add nullable `client_id` (+ index) to `attendance`,
  `sl_subject_results`/grades, `assignments`; ensure `updated_at` exists for pull.

## Data / conflict policy per entity
- **attendance**: key = (student_id, date, session_type); last-write-wins; client_id dedupe.
- **grades**: server `is_locked` wins → locked rows reject offline edits on push.
- **assignments**: keyed by client_id; last-write-wins on update.
- **roster/timetable/subjects/students**: server-authoritative, pull only (read cache).

## Android packaging (Capacitor)
- Add Capacitor to the frontend, `webDir` = Vite build output.
- Android platform; app id e.g. `sl.wiskul.app`; icons/splash from brand assets.
- Point the webview at the production build (bundled) with API base = production URL.
- Release: generate keystore, build signed AAB for Play Console.
- Verify offline features work identically inside the webview.

## Additional offline capabilities

### Secure local data & logout wipe (Req 8)
- Local store is namespaced by `userId`; on login, if the stored namespace differs, the previous namespace is cleared.
- `wipeLocalData(userId)` drops all Dexie tables for that user; called on logout and on unrecoverable auth failure.
- On logout with pending writes + connectivity: attempt a final push, then wipe.
- At-rest protection: store a per-install key in secure storage (Capacitor Secure Storage on Android; best-effort in browser) and encrypt sensitive fields, or at minimum avoid persisting secrets/tokens in plaintext. (Full field encryption is a stretch goal; namespacing + wipe are mandatory.)

### Sync visibility & manual control (Req 9)
- `sync_meta` already tracks `lastPulledAt`; add `lastPushedAt` and a derived `pendingCount` (outbox length).
- `SyncStatusIndicator` shows: online/offline, "Synced Xm ago", "N pending", and a **Sync now** button that triggers the engine.
- List rows read `syncStatus` from the local row to render pending/synced/failed chips.
- Cached read screens render a "Data as of <lastPulledAt>" badge when `!online`.

### Conflict & rejection handling (Req 10)
- `/sync/push` returns per-item `{ clientId, result: 'applied'|'duplicate'|'rejected', reason? }`.
- Rejected items set the local row `syncStatus='error'` + `error=reason`; a **Sync issues** view lists them with Retry / Discard actions.

### Cache & storage management (Req 11)
- `offline/storage.ts`: estimate usage via `navigator.storage.estimate()`; `clearCache()` truncates read tables but preserves `outbox`/pending writes (discard requires explicit confirm).
- Eviction: read tables carry `cachedAt`; entries older than a TTL are evicted on refresh.

### Background sync & updates (Req 12)
- Web: service-worker Background Sync (where supported) to flush outbox; Android: Capacitor Background Task / periodic check on resume + connectivity change.
- App update: vite-plugin-pwa `registerType: 'prompt'` — on new SW waiting, show an "Update available — reload" toast that calls `skipWaiting` + reload.

### Play Store publishing (Req 13, non-code)
- Add `docs/PLAY_STORE_CHECKLIST.md`: privacy policy URL, Data Safety answers, listing copy, icon/feature-graphic/screenshot specs, content rating + Families policy notes, and the Console upload steps ($25 account, signed AAB from Task 12).
- Add a routed **Privacy Policy** page (public) so the required URL is hosted by the app itself.

## Error Handling
- Sync failures: per-item error captured on the local row; batch continues.
- Locked-grade rejection: clear message + local row marked `error` (not lost).
- Online-only modules never enqueue writes.
- Auth: handle token expiry offline by keeping the session and refreshing on reconnect; if refresh fails, prompt re-login (writes remain queued).

## Testing Strategy
- Unit: repositories (read-through/write-behind), sync push/pull, idempotency.
- Integration: mark attendance offline → reconnect → single server row; retry → no duplicate; locked grade rejected.
- Manual: airplane-mode walkthrough of attendance/grades/assignments; Android webview smoke test.
- Builds: frontend + backend green; migration applied.

## Correctness Properties
1. A queued write is never lost: it stays `pending` until it is `synced` or explicitly `error`.
2. Re-pushing the same `client_id` never creates a duplicate server record (idempotent).
3. Offline data is teacher-scoped — a device only ever caches data the teacher may access.
4. A locked grade cannot be modified from an offline edit.
5. Online-only modules perform no offline writes.
