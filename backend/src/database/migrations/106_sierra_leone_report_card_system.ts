import type { Knex } from 'knex';

/**
 * Sierra Leone Report Card / Booklet System
 * ==========================================
 * Models the real SL secondary school terminal report booklet:
 *
 *  - COGNITIVE: per subject, per term → Test 1 + Test 2 → Mean → Subject Rank.
 *               3 terms aggregate to a Yearly Mean + Yearly Rank.
 *  - AFFECTIVE (12 traits) + PSYCHOMOTOR (12 skills): rated 1-5 per term.
 *  - TERM SUMMARY: combined score, percentage, class position, attendance
 *                  (on time / late / absent), conduct, teacher comment.
 *  - REPORT META: principal end-of-year comment, promotion status, average age.
 *
 * Grading (Method of Grading page):
 *   Excellent 85-100 (A) · Very Good 75-84 (B) · Good 60-74 (C)
 *   Satisfactory 50-59 (D) · Unsatisfactory below 50 (F, shown red)
 *
 * All tables are tenant-scoped. The legacy `results` table is left intact.
 */

export async function up(knex: Knex): Promise<void> {
  // ── Cognitive: per-subject term scores ──────────────────────────────────────
  const hasSubjectResults = await knex.schema.hasTable('sl_subject_results');
  if (!hasSubjectResults) {
    await knex.schema.createTable('sl_subject_results', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      table.uuid('subject_id').notNullable().references('id').inTable('subjects').onDelete('CASCADE');
      table.uuid('class_id').notNullable().references('id').inTable('classes').onDelete('CASCADE');
      table.string('academic_year', 20).notNullable();          // e.g. 2025/2026
      table.string('term', 30).notNullable();                    // first_term, second_term, third_term

      table.decimal('test1', 5, 2);                              // Test 1 (nullable — subject may not be taken)
      table.decimal('test2', 5, 2);                              // Test 2
      table.decimal('mean', 5, 2);                               // (test1 + test2) / 2  (auto)
      table.integer('subject_rank');                             // rank of this subject's mean among the student's subjects that term (auto)

      table.uuid('entered_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.unique(['student_id', 'subject_id', 'class_id', 'term', 'academic_year'], {
        indexName: 'sl_subject_results_unique',
      });
      table.index(['tenant_id']);
      table.index(['class_id', 'term', 'academic_year']);
      table.index(['student_id', 'academic_year']);
    });
  }

  // ── Affective + Psychomotor domain ratings ──────────────────────────────────
  const hasDomainRatings = await knex.schema.hasTable('sl_domain_ratings');
  if (!hasDomainRatings) {
    await knex.schema.createTable('sl_domain_ratings', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      table.uuid('class_id').notNullable().references('id').inTable('classes').onDelete('CASCADE');
      table.string('academic_year', 20).notNullable();
      table.string('term', 30).notNullable();

      table.string('domain', 20).notNullable();                  // 'affective' | 'psychomotor'
      table.integer('trait_index').notNullable();                // 1-12 (maps to the fixed legend on the back cover)
      table.integer('rating').notNullable();                     // 1-5

      table.uuid('entered_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.unique(['student_id', 'class_id', 'term', 'academic_year', 'domain', 'trait_index'], {
        indexName: 'sl_domain_ratings_unique',
      });
      table.index(['tenant_id']);
      table.index(['student_id', 'term', 'academic_year']);
    });
  }

  // ── Per-term summary: combined score, %, position, attendance, conduct ───────
  const hasTermSummaries = await knex.schema.hasTable('sl_term_summaries');
  if (!hasTermSummaries) {
    await knex.schema.createTable('sl_term_summaries', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      table.uuid('class_id').notNullable().references('id').inTable('classes').onDelete('CASCADE');
      table.string('academic_year', 20).notNullable();
      table.string('term', 30).notNullable();

      table.decimal('combined_score', 8, 2);                     // Σ subject means (auto)
      table.decimal('percentage', 5, 2);                         // combined / subjects counted (auto)
      table.integer('position');                                 // class position for the term (auto)
      table.integer('class_size');                               // total students ranked (auto)

      // Attendance (per term)
      table.integer('on_time').defaultTo(0);
      table.integer('late').defaultTo(0);
      table.integer('absent').defaultTo(0);

      // Conduct: V.G, G, S, PT, N, Abs
      table.string('conduct', 10);
      table.text('teacher_comment');                             // guidance & counselling comment
      table.uuid('teacher_signed_by').references('id').inTable('users').onDelete('SET NULL');

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.unique(['student_id', 'class_id', 'term', 'academic_year'], {
        indexName: 'sl_term_summaries_unique',
      });
      table.index(['tenant_id']);
      table.index(['class_id', 'term', 'academic_year']);
    });
  }

  // ── Report card meta: principal comment, promotion, average age ──────────────
  const hasReportMeta = await knex.schema.hasTable('sl_report_card_meta');
  if (!hasReportMeta) {
    await knex.schema.createTable('sl_report_card_meta', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      table.uuid('class_id').notNullable().references('id').inTable('classes').onDelete('CASCADE');
      table.string('academic_year', 20).notNullable();

      table.text('principal_comment');
      table.string('promotion_status', 100);                     // e.g. "PROMOTED TO FORM 2", "TO REPEAT"
      table.string('average_age', 20);                           // free-form as on booklet
      table.uuid('principal_signed_by').references('id').inTable('users').onDelete('SET NULL');

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.unique(['student_id', 'class_id', 'academic_year'], {
        indexName: 'sl_report_card_meta_unique',
      });
      table.index(['tenant_id']);
    });
  }

  // eslint-disable-next-line no-console
  console.log('✅ Sierra Leone report card system migration completed');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('sl_report_card_meta');
  await knex.schema.dropTableIfExists('sl_term_summaries');
  await knex.schema.dropTableIfExists('sl_domain_ratings');
  await knex.schema.dropTableIfExists('sl_subject_results');
  // eslint-disable-next-line no-console
  console.log('✅ Sierra Leone report card system migration rolled back');
}
