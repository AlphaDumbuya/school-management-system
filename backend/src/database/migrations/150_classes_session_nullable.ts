import type { Knex } from 'knex';

/**
 * Make classes.academic_session_id NULLABLE.
 *
 * The original schema (migration 001) declared it NOT NULL, but the class API
 * and tenant-scoping logic were built to support classes with NO academic
 * session (the list/get/update/delete handlers all have an explicit
 * `whereNull('classes.academic_session_id')` fallback path, and the create
 * route inserts `academic_session_id: sessionId || null`).
 *
 * The result was a broken-CRUD bug: a tenant with no ACTIVE academic session
 * couldn't create a class at all — the insert hit a NOT NULL violation. This
 * aligns the schema with the intended behaviour.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE classes ALTER COLUMN academic_session_id DROP NOT NULL;').catch(() => {});
}

export async function down(knex: Knex): Promise<void> {
  // Only restore NOT NULL if there are no null rows (avoid failing the down).
  const [{ count }] = await knex('classes').whereNull('academic_session_id').count('* as count');
  if (Number(count) === 0) {
    await knex.raw('ALTER TABLE classes ALTER COLUMN academic_session_id SET NOT NULL;').catch(() => {});
  }
}
