import type { Knex } from 'knex';

/**
 * One-time, idempotent reconciliation of the student-identity inconsistency in
 * the finance tables (financial-management spec §1, Req 10.4/10.5).
 *
 * The canonical charge subject is `students.id`. Historically some `fees` /
 * `payments` / `invoices` rows were written with `student_id` set to a
 * `users.id` (role student) instead of the linked `students.id`. Because
 * `students.user_id` is UNIQUE, the mapping users.id → students.id is always
 * unambiguous when a matching student exists, so we can safely rewrite those
 * rows. Rows that do not match a user (already correct) are left untouched, and
 * no rows are ever deleted.
 *
 * Ambiguity guard: we only rewrite a row when its current `student_id`
 *   (a) does NOT already match a students.id, AND
 *   (b) DOES match exactly one students.user_id.
 * Anything else is logged and skipped.
 */
export const config = { transaction: false };

async function reconcileTable(knex: Knex, table: string): Promise<{ rewritten: number; skipped: number }> {
  const hasTable = await knex.schema.hasTable(table);
  if (!hasTable) return { rewritten: 0, skipped: 0 };

  // Candidate rows: student_id points at a users.id (role student) with a
  // linked students row, and does NOT already point at a valid students.id.
  const candidates: Array<{ id: string; student_id: string; mapped_student_id: string }> = await knex
    .from(`${table} as f`)
    .join('students as s', 's.user_id', 'f.student_id')
    .leftJoin('students as direct', 'direct.id', 'f.student_id')
    .whereNull('direct.id') // not already a valid students.id
    .select('f.id as id', 'f.student_id as student_id', 's.id as mapped_student_id');

  let rewritten = 0;
  for (const row of candidates) {
    // Safety: confirm exactly one student maps to this user id.
    const matches = await knex('students').where('user_id', row.student_id).count('id as n').first();
    if (Number(matches?.n) !== 1) {
      // eslint-disable-next-line no-console
      console.warn(`[141_reconcile] ${table} row ${row.id}: ambiguous user→student mapping for ${row.student_id}, skipped`);
      continue;
    }
    await knex(table).where('id', row.id).update({ student_id: row.mapped_student_id });
    rewritten++;
  }
  const skipped = candidates.length - rewritten;
  // eslint-disable-next-line no-console
  console.log(`[141_reconcile] ${table}: rewritten ${rewritten}, skipped ${skipped}`);
  return { rewritten, skipped };
}

export async function up(knex: Knex): Promise<void> {
  for (const table of ['fees', 'payments', 'invoices', 'payment_sessions']) {
    await reconcileTable(knex, table);
  }
}

export async function down(): Promise<void> {
  // Non-reversible data reconciliation — intentionally a no-op. No rows were
  // deleted; a down-migration cannot know the original (incorrect) ids.
}
