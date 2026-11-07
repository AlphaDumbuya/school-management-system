import type { Knex } from 'knex';

/**
 * sl_score_drafts: a teacher's work-in-progress Test 1 / Test 2 scores.
 *
 * Why a separate table: sl_subject_results feeds subject ranks, term summaries, report cards, rankings and
 * the student and parent views, and the principal may have scores lock the moment a teacher saves them
 * (Settings > Grading & Results). A draft must be safe to save and change as often as needed, so it never
 * touches that table: nothing that computes or shows results reads this one, and it is never locked.
 * Submitting writes the real scores (the existing /scores save, with the principal's lock rules) and
 * clears the draft.
 *
 * One draft row per student, subject, class, term and year. Additive only.
 */
const POLICY = 'tenant_isolation';

async function secure(knex: Knex, table: string): Promise<void> {
  // Same backward-compatible tenant policy migration 149 puts on every tenant table.
  await knex.raw('ALTER TABLE ?? ENABLE ROW LEVEL SECURITY', [table]);
  await knex.raw('ALTER TABLE ?? FORCE ROW LEVEL SECURITY', [table]);
  await knex.raw(`DROP POLICY IF EXISTS ${POLICY} ON ??`, [table]);
  await knex.raw(
    `CREATE POLICY ${POLICY} ON ??
     USING (
       current_setting('app.current_tenant', true) IS NULL
       OR current_setting('app.current_tenant', true) = ''
       OR tenant_id IS NULL
       OR tenant_id::text = current_setting('app.current_tenant', true)
     )
     WITH CHECK (
       current_setting('app.current_tenant', true) IS NULL
       OR current_setting('app.current_tenant', true) = ''
       OR tenant_id IS NULL
       OR tenant_id::text = current_setting('app.current_tenant', true)
     )`,
    [table],
  );
}

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('sl_score_drafts'))) {
    await knex.schema.createTable('sl_score_drafts', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      t.uuid('class_id').notNullable().references('id').inTable('classes').onDelete('CASCADE');
      t.uuid('subject_id').notNullable().references('id').inTable('subjects').onDelete('CASCADE');
      t.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      t.string('academic_year', 20).notNullable(); // e.g. 2026/2027
      t.string('term', 30).notNullable(); // first_term | second_term | third_term
      t.decimal('test1', 5, 2).nullable();
      t.decimal('test2', 5, 2).nullable();
      t.uuid('saved_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.unique(['student_id', 'subject_id', 'class_id', 'term', 'academic_year'], { indexName: 'sl_score_drafts_unique' });
    });
    await knex.raw('CREATE INDEX IF NOT EXISTS sl_score_drafts_cell_idx ON sl_score_drafts (tenant_id, class_id, subject_id, term, academic_year)');
  }
  await secure(knex, 'sl_score_drafts');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('sl_score_drafts');
}
