import type { Knex } from 'knex';

/**
 * Staff who both manage and teach have the managing job as their MAIN role:
 * Accountant + Teaching → Accountant, Admissions Officer + Teaching →
 * Admissions Officer (Accountant first when they hold both). Earlier these
 * people were saved as main role Teacher with the managing job on top, so they
 * signed in as "teacher".
 *
 * For every active-or-not staff user whose main role is 'teacher' and who holds
 * the Accountant or Admissions Officer job, move the managing job to users.role
 * and keep Teaching (plus any other job) in users.staff_duties. Their classes,
 * subjects and staff ID are untouched; teaching keeps working as an extra job.
 * Principals and everyone else are left alone. Safe to run more than once.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('users', 'staff_duties'))) return;

  // Accountant wins: main → accountant, accountant leaves the extras, teacher joins them.
  await knex.raw(`
    UPDATE users
       SET role = 'accountant',
           staff_duties = ((COALESCE(staff_duties, '[]'::jsonb) - 'accountant') - 'teacher') || '["teacher"]'::jsonb,
           updated_at = NOW()
     WHERE role = 'teacher'
       AND COALESCE(staff_duties, '[]'::jsonb) @> '["accountant"]'::jsonb
  `);

  // Then Admissions Officer, for teachers who hold only that job.
  await knex.raw(`
    UPDATE users
       SET role = 'admissions_officer',
           staff_duties = ((COALESCE(staff_duties, '[]'::jsonb) - 'admissions_officer') - 'teacher') || '["teacher"]'::jsonb,
           updated_at = NOW()
     WHERE role = 'teacher'
       AND COALESCE(staff_duties, '[]'::jsonb) @> '["admissions_officer"]'::jsonb
  `);
}

export async function down(): Promise<void> {
  // Not reversed: which of their jobs a person treats as "main" is a choice
  // the principal can change on the Staff page at any time.
}
