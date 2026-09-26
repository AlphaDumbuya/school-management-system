/**
 * Tenant context for Postgres Row-Level Security (RLS).
 *
 * RLS policies (see migration 149) key off the session variable
 * `app.current_tenant`. Because Knex pools connections, a plain `SET` would
 * leak across requests — so we use `SET LOCAL` inside a transaction, which
 * auto-resets on commit/rollback. Every tenant-scoped DB access should run
 * through `withTenant()` so the DB itself enforces isolation even if an
 * application-layer `WHERE tenant_id = ?` is ever forgotten.
 *
 * ROLLOUT NOTE: the initial RLS policies are intentionally BACKWARD-COMPATIBLE
 * — when `app.current_tenant` is unset (as it is for every query not yet routed
 * through withTenant), the policy allows access. So adopting withTenant can be
 * done incrementally, route by route, with zero risk of a query suddenly
 * returning nothing. A later migration can tighten the policy to REQUIRE the
 * variable once all hot paths are migrated.
 */
import type { Knex } from 'knex';
import { db } from '@utils/database';

/**
 * Run `fn` inside a transaction with `app.current_tenant` set to `tenantId`.
 * All queries issued on the provided trx are RLS-scoped to that tenant.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (trx: Knex.Transaction) => Promise<T>
): Promise<T> {
  if (!tenantId) throw new Error('withTenant requires a tenantId');
  return db.transaction(async (trx) => {
    // set_config(setting, value, is_local=true) === SET LOCAL, but accepts a
    // bound parameter (SET LOCAL does not), so no interpolation.
    await trx.raw(`SELECT set_config('app.current_tenant', ?, true)`, [tenantId]);
    return fn(trx);
  });
}

/**
 * Run `fn` as a platform-level (cross-tenant) operation — explicitly clears the
 * tenant so super-admin reads span all tenants. Use sparingly and only for
 * genuinely platform-scoped work.
 */
export async function withoutTenant<T>(fn: (trx: Knex.Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (trx) => {
    await trx.raw(`SELECT set_config('app.current_tenant', '', true)`);
    return fn(trx);
  });
}
