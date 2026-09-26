# Row-Level Security (RLS) — Tenant Isolation

Defence-in-depth so a forgotten `WHERE tenant_id = ?` in application code can
never leak one school's data to another. The database itself enforces the
boundary.

## What ships in this change

1. **Migration `149_row_level_security.ts`** — enables + FORCEs RLS on every
   table that has a `tenant_id` column (discovered from the catalog, so the
   list never drifts) and installs a `tenant_isolation` policy.

2. **`src/db/tenantContext.ts`** — `withTenant(tenantId, fn)` runs DB work in a
   transaction that sets the `app.current_tenant` session variable via
   `SET LOCAL` (through `set_config(..., true)`). `withoutTenant(fn)` clears it
   for platform/cross-tenant work.

3. **`src/middleware/tenantContext.ts`** — attaches `req.withTenant(...)` to
   every request (bound lazily to the authenticated user's tenant).

## Why it's safe to deploy immediately (backward-compatible policy)

The initial policy allows access when `app.current_tenant` is **unset**:

```sql
USING (
  current_setting('app.current_tenant', true) IS NULL
  OR current_setting('app.current_tenant', true) = ''
  OR tenant_id IS NULL
  OR tenant_id::text = current_setting('app.current_tenant', true)
)
```

Every query that does NOT go through `withTenant` runs with the variable unset,
so its behaviour is unchanged. Isolation only *engages* for queries that set the
variable. This means you can adopt `withTenant` route-by-route with zero risk of
a query suddenly returning no rows.

## CRITICAL prerequisites before enabling on Neon

RLS is bypassed by table **owners** unless `FORCE ROW LEVEL SECURITY` is set
(migration 149 sets FORCE). But also confirm:

1. **The app connects as a role that is subject to RLS.** On Neon the default
   role usually owns the tables; FORCE covers that. Superuser/bypassrls roles
   are never subject to RLS — do NOT run the app as such a role.
2. **`set_config('app.current_tenant', ...)`** requires no special grant (it's a
   custom GUC), so no role changes needed for the variable itself.

## Validation on staging (do this before trusting it)

Run migration 149 on a **staging** copy, then:

1. **Sanity — nothing broke.** With no code using `withTenant` yet, the whole
   app should behave exactly as before (policy allows unset variable).

2. **Prove isolation works.** In a psql session against staging:
   ```sql
   -- pick two tenants + a students row from tenant B
   SELECT set_config('app.current_tenant', '<TENANT_A_UUID>', false);
   SELECT count(*) FROM students;                 -- only tenant A's students
   SELECT * FROM students WHERE id = '<TENANT_B_STUDENT_ID>';  -- 0 rows
   RESET app.current_tenant;
   SELECT count(*) FROM students;                 -- all students (unset = allow)
   ```
   If the scoped count excludes tenant B, RLS is enforcing correctly.

3. **Automated cross-tenant test** (`src/__tests__/tenantIsolation.test.ts`,
   skipped unless `RUN_DB_TESTS=1`) exercises the same via Knex.

## Rollout: adopting `withTenant` in routes

Convert hot, sensitive read/write paths to run through the wrapper:

```ts
// before
const student = await db('students').where({ id }).first();

// after (RLS now also enforces the boundary)
const student = await req.withTenant((trx) =>
  trx('students').where({ id }).first()
);
```

Prioritise: students, guardians, grades, attendance, fees, payments, invoices,
messages/announcements, id_cards. Keep application-layer `WHERE tenant_id = ?`
in place too — belt and braces.

## Final tightening (a later migration)

Once every hot path sets the variable, replace the policy's
`... IS NULL OR ... = ''` escape with hard enforcement so an unset variable
returns **no rows** instead of all rows. Do this only after you're confident no
production path issues tenant-scoped queries outside `withTenant`.
