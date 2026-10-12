---
inclusion: always
---

# Database safety (read before running anything)

The `DATABASE_URL` in `.env` is the REAL, shared Neon database. It holds every school's data. It was wiped once by a test run (`TRUNCATE users CASCADE`) and had to be restored from Neon history (free plan: only 6 hours).

Rules for any agent working in this repo:

- NEVER run the backend test suite (`vitest`, `npm test`) or any script that deletes, truncates, drops, resets, rolls back or seeds against the real database.
- Tests may only use a local or throw-away database, set through `TEST_DATABASE_URL`. If it isn't set, database tests are blocked on purpose; do not work around the block.
- `knex migrate:rollback`, `knex migrate:down`, `knex seed:run` (`npm run db:seed`), `backend/scripts/resetDatabase.ts` and the `test-*.js` scripts are blocked on a remote database. Never set `ALLOW_DESTRUCTIVE_DB` yourself; only a person may, after confirming a Neon restore point exists.
- Read-only checks (counts, `SELECT`) and `migrate:latest` are fine. Temporary scripts that write must be limited to rows they create themselves and cleaned up afterwards.
- Verify builds with `bash scripts/vercel-build.sh` (use `VERCEL_ENV=preview` to skip migrations), `vite build --mode app` in `frontend`, and `tsc --noEmit`. Do not use the test suite as a build check.

The guard lives in `backend/src/utils/dbSafety.ts` (plus inline copies in `backend/knexfile.ts` and `backend/knexfile.js`). It has its own test: `backend/src/utils/__tests__/dbSafety.test.ts`.
