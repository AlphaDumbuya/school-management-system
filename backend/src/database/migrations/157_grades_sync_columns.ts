import type { Knex } from 'knex';

/**
 * Align the `grades` table with what the app + offline sync expect.
 *
 * WHY: `grades` was originally created in migration 001 with a minimal shape
 * (student_id, subject_id, teacher_id, grade_value, …). Migration 003 has a
 * fuller definition, but its createTable was skipped because the table already
 * existed — so columns like `class_id` were never added on existing databases.
 * That made `/api/v1/sync/pull` crash with:
 *   error 42703: column "class_id" does not exist
 * and offline grade PUSH insert columns that didn't exist.
 *
 * This migration adds every missing column the code references, guarded by
 * hasColumn so it's safe to run on any database (fresh or legacy).
 */
export async function up(knex: Knex): Promise<void> {
  const hasGrades = await knex.schema.hasTable('grades');
  if (!hasGrades) return; // nothing to patch

  const add = async (
    column: string,
    build: (t: Knex.AlterTableBuilder) => void,
  ) => {
    const exists = await knex.schema.hasColumn('grades', column);
    if (!exists) {
      await knex.schema.alterTable('grades', build);
    }
  };

  // Class scope — used by sync pull/push and grade filtering.
  await add('class_id', (t) => {
    t.uuid('class_id').references('id').inTable('classes').onDelete('CASCADE');
    t.index('class_id');
  });

  // Academic session (used by migration 003's fuller schema + reporting).
  await add('academic_session_id', (t) => {
    t.uuid('academic_session_id').references('id').inTable('academic_sessions').onDelete('SET NULL');
    t.index('academic_session_id');
  });

  // Offline-sync score fields written by syncService.push.
  await add('marks_obtained', (t) => t.decimal('marks_obtained', 6, 2));
  await add('total_marks', (t) => t.decimal('total_marks', 6, 2));
  await add('percentage', (t) => t.decimal('percentage', 5, 2));
  await add('grade', (t) => t.string('grade', 5));
  await add('remarks', (t) => t.text('remarks'));

  // Provenance / tracking.
  await add('recorded_by', (t) => t.uuid('recorded_by').references('id').inTable('users').onDelete('SET NULL'));
  await add('recorded_date', (t) => t.timestamp('recorded_date'));

  // Idempotency key for offline push (dedupe by client_id).
  await add('client_id', (t) => {
    t.string('client_id');
    t.index('client_id');
  });
}

export async function down(_knex: Knex): Promise<void> {
  // No-op: these columns are additive and safe to keep. Dropping them could
  // lose data on databases where migration 003 also intended them.
}
