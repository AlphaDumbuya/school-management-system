import type { Knex } from 'knex';

/**
 * Repair: the admission form's columns on admission_applications.
 *
 * Migration 033 only creates admission_applications when the table does not exist. On databases where migration 021
 * had already created it (an older, thinner table), 033 added none of the child / guardian / medical / emergency
 * columns, so saving an application from the admission form failed with a database error. This adds every column the
 * form saves, only where it is missing. It also drops two old CHECK constraints from that older table: they only
 * allowed the old status words and sources, but the admissions pipeline (migration 169) writes 'pending',
 * 'approved', 'withdrawn' ... and the source 'office'; the pipeline's own rules (TRANSITIONS) guard the status now.
 *
 * Safe to run twice and on a database that is already right (it checks before it adds). Additive: nothing is
 * removed except the two outdated CHECK constraints.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('admission_applications'))) return;

  const cols: Array<[string, (t: Knex.AlterTableBuilder) => void]> = [
    ['child_first_name', (t) => { t.string('child_first_name', 100).nullable(); }],
    ['child_middle_name', (t) => { t.string('child_middle_name', 100).nullable(); }],
    ['child_last_name', (t) => { t.string('child_last_name', 100).nullable(); }],
    ['child_dob', (t) => { t.date('child_dob').nullable(); }],
    ['child_gender', (t) => { t.string('child_gender', 10).nullable(); }],
    ['child_nationality', (t) => { t.string('child_nationality', 100).nullable(); }],
    ['child_religion', (t) => { t.string('child_religion', 50).nullable(); }],
    ['child_place_of_birth', (t) => { t.string('child_place_of_birth', 100).nullable(); }],
    ['class_applying_for', (t) => { t.uuid('class_applying_for').nullable(); }],
    ['child_address', (t) => { t.text('child_address').nullable(); }],
    ['previous_school', (t) => { t.string('previous_school', 200).nullable(); }],
    ['last_grade_attained', (t) => { t.string('last_grade_attained', 50).nullable(); }],
    ['child_photo_url', (t) => { t.text('child_photo_url').nullable(); }],
    ['guardian_first_name', (t) => { t.string('guardian_first_name', 100).nullable(); }],
    ['guardian_middle_name', (t) => { t.string('guardian_middle_name', 100).nullable(); }],
    ['guardian_last_name', (t) => { t.string('guardian_last_name', 100).nullable(); }],
    ['guardian_relationship', (t) => { t.string('guardian_relationship', 50).nullable(); }],
    ['guardian_phone', (t) => { t.string('guardian_phone', 20).nullable(); }],
    ['guardian_alt_phone', (t) => { t.string('guardian_alt_phone', 20).nullable(); }],
    ['guardian_email', (t) => { t.string('guardian_email', 255).nullable(); }],
    ['guardian_occupation', (t) => { t.string('guardian_occupation', 100).nullable(); }],
    ['guardian_address', (t) => { t.text('guardian_address').nullable(); }],
    ['guardian_nationality', (t) => { t.string('guardian_nationality', 100).nullable(); }],
    ['guardian_national_id', (t) => { t.string('guardian_national_id', 50).nullable(); }],
    ['takes_medication', (t) => { t.boolean('takes_medication').nullable().defaultTo(false); }],
    ['medication_details', (t) => { t.text('medication_details').nullable(); }],
    ['has_allergies', (t) => { t.boolean('has_allergies').nullable().defaultTo(false); }],
    ['allergy_details', (t) => { t.text('allergy_details').nullable(); }],
    ['has_chronic_illness', (t) => { t.boolean('has_chronic_illness').nullable().defaultTo(false); }],
    ['chronic_illness_details', (t) => { t.text('chronic_illness_details').nullable(); }],
    ['allow_first_aid', (t) => { t.boolean('allow_first_aid').nullable().defaultTo(true); }],
    ['emergency_contact_name', (t) => { t.string('emergency_contact_name', 200).nullable(); }],
    ['emergency_contact_relationship', (t) => { t.string('emergency_contact_relationship', 50).nullable(); }],
    ['emergency_contact_phone', (t) => { t.string('emergency_contact_phone', 20).nullable(); }],
  ];
  for (const [c, fn] of cols) {
    if (!(await knex.schema.hasColumn('admission_applications', c))) await knex.schema.alterTable('admission_applications', fn);
  }

  // Outdated word lists from the thin 021 table (the pipeline writes other statuses and the source 'office').
  await knex.raw('ALTER TABLE admission_applications DROP CONSTRAINT IF EXISTS admission_applications_status_check');
  await knex.raw('ALTER TABLE admission_applications DROP CONSTRAINT IF EXISTS admission_applications_application_source_check');
}

export async function down(): Promise<void> {
  // Nothing to undo: it only completes a table that migration 033 should have completed.
}
