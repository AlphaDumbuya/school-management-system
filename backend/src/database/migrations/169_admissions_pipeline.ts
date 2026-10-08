import type { Knex } from 'knex';

/**
 * Admissions pipeline (additive only):
 *  - admission_applications: interview (date, location), assessment score,
 *    documents checklist, the student it became (student_id, one student per
 *    application), the class they were enrolled into, withdrawal reason and
 *    which decision emails were already sent (so one is never sent twice).
 *  - admission_application_events: the application's timeline (status moves,
 *    notes, emails, edits, enrolment), newest first in the UI.
 */
export async function up(knex: Knex): Promise<void> {
  const cols: Array<[string, (t: Knex.AlterTableBuilder) => void]> = [
    ['interview_date', (t) => { t.timestamp('interview_date', { useTz: true }).nullable(); }],
    ['interview_location', (t) => { t.string('interview_location', 200).nullable(); }],
    ['assessment_score', (t) => { t.decimal('assessment_score', 6, 2).nullable(); }],
    ['documents', (t) => { t.jsonb('documents').notNullable().defaultTo('{}'); }],
    ['student_id', (t) => { t.uuid('student_id').nullable(); }],
    ['enrolled_class_id', (t) => { t.uuid('enrolled_class_id').nullable(); }],
    ['enrolled_at', (t) => { t.timestamp('enrolled_at', { useTz: true }).nullable(); }],
    ['withdrawn_reason', (t) => { t.string('withdrawn_reason', 500).nullable(); }],
    ['emailed_decisions', (t) => { t.jsonb('emailed_decisions').notNullable().defaultTo('[]'); }],
  ];
  for (const [c, fn] of cols) {
    if (!(await knex.schema.hasColumn('admission_applications', c))) await knex.schema.alterTable('admission_applications', fn);
  }
  // One application → at most one student.
  await knex.raw('CREATE UNIQUE INDEX IF NOT EXISTS admission_applications_student_id_unique ON admission_applications (student_id) WHERE student_id IS NOT NULL');
  await knex.raw('CREATE INDEX IF NOT EXISTS admission_applications_tenant_year_status ON admission_applications (tenant_id, academic_year, status)');

  if (!(await knex.schema.hasTable('admission_application_events'))) {
    await knex.schema.createTable('admission_application_events', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable();
      t.uuid('application_id').notNullable().references('id').inTable('admission_applications').onDelete('CASCADE');
      t.string('kind', 30).notNullable(); // status | note | email | edit | enrolled | created | documents
      t.string('from_status', 30).nullable();
      t.string('to_status', 30).nullable();
      t.text('note').nullable();
      t.uuid('created_by').nullable();
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.index(['application_id', 'created_at']);
    });
  }

  // Applications that already became students: link them by the enrolment
  // that was created from them (same tenant, same child name and date of birth).
  await knex.raw(`
    UPDATE admission_applications a SET student_id = s.id
    FROM students s
    WHERE a.student_id IS NULL AND a.status = 'enrolled' AND s.tenant_id = a.tenant_id
      AND LOWER(TRIM(s.first_name)) = LOWER(TRIM(COALESCE(a.child_first_name, a.first_name)))
      AND LOWER(TRIM(s.last_name)) = LOWER(TRIM(COALESCE(a.child_last_name, a.last_name)))
      AND (s.date_of_birth IS NULL OR COALESCE(a.child_dob, a.date_of_birth) IS NULL OR s.date_of_birth::date = COALESCE(a.child_dob, a.date_of_birth)::date)
      AND NOT EXISTS (SELECT 1 FROM admission_applications x WHERE x.student_id = s.id)
      AND s.id = (SELECT s2.id FROM students s2 WHERE s2.tenant_id = a.tenant_id
        AND LOWER(TRIM(s2.first_name)) = LOWER(TRIM(COALESCE(a.child_first_name, a.first_name)))
        AND LOWER(TRIM(s2.last_name)) = LOWER(TRIM(COALESCE(a.child_last_name, a.last_name)))
        ORDER BY ABS(EXTRACT(EPOCH FROM (s2.created_at - a.created_at))) LIMIT 1)
  `).catch(() => null);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('admission_application_events');
  await knex.raw('DROP INDEX IF EXISTS admission_applications_student_id_unique');
  await knex.raw('DROP INDEX IF EXISTS admission_applications_tenant_year_status');
  for (const c of ['interview_date', 'interview_location', 'assessment_score', 'documents', 'student_id', 'enrolled_class_id', 'enrolled_at', 'withdrawn_reason', 'emailed_decisions']) {
    if (await knex.schema.hasColumn('admission_applications', c)) await knex.schema.alterTable('admission_applications', (t) => t.dropColumn(c));
  }
}
