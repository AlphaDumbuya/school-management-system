import type { Knex } from 'knex';

/**
 * Weekly student reviews. Additive only (one new table, nothing existing changes).
 *
 * Once a week (usually Friday) a teacher rates each student in their class and
 * may add a short comment. The review is combined with the weekly attendance
 * digest parents already get, so a family can follow their child week by week.
 *
 *  - One review per student per school week: UNIQUE (tenant_id, student_id, week_start).
 *    week_start is always the MONDAY of the school week.
 *  - academic_year / term are stamped when the review is written, so history
 *    can be filtered by year and term without re-deriving them.
 *  - performance_rating / behaviour_rating are 1 to 5
 *    (5 Excellent, 4 Very good, 3 Good, 2 Needs support, 1 Concern).
 *  - class_id is the class the review was written for. No foreign key on
 *    purpose: a review is history and must survive a class being tidied up.
 *  - author_user_id is set null if the teacher's account is removed.
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
  if (!(await knex.schema.hasTable('weekly_student_reviews'))) {
    await knex.schema.createTable('weekly_student_reviews', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      t.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      t.uuid('class_id').nullable();
      t.date('week_start').notNullable(); // the Monday of the school week
      t.string('academic_year', 20).nullable();
      t.string('term', 20).nullable(); // first_term | second_term | third_term
      t.smallint('performance_rating').notNullable();
      t.smallint('behaviour_rating').nullable();
      t.text('comment').nullable(); // plain text, max 600 characters (enforced in the service)
      t.uuid('author_user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.unique(['tenant_id', 'student_id', 'week_start'], { indexName: 'weekly_student_reviews_student_week_unique' });
    });
    await knex.raw(
      'ALTER TABLE weekly_student_reviews ADD CONSTRAINT weekly_student_reviews_performance_chk CHECK (performance_rating BETWEEN 1 AND 5)',
    );
    await knex.raw(
      'ALTER TABLE weekly_student_reviews ADD CONSTRAINT weekly_student_reviews_behaviour_chk CHECK (behaviour_rating IS NULL OR behaviour_rating BETWEEN 1 AND 5)',
    );
    await knex.raw('CREATE INDEX IF NOT EXISTS weekly_student_reviews_class_week_idx ON weekly_student_reviews (tenant_id, class_id, week_start)');
    await knex.raw('CREATE INDEX IF NOT EXISTS weekly_student_reviews_student_week_idx ON weekly_student_reviews (tenant_id, student_id, week_start DESC)');
  }

  await secure(knex, 'weekly_student_reviews');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('weekly_student_reviews');
}
