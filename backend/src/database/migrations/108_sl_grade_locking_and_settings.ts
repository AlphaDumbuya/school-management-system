import type { Knex } from 'knex';

/**
 * SL Grade Locking + Report Settings
 * ==================================
 * Professional grade-entry controls:
 *
 *  1. Locking columns on sl_subject_results — once a teacher submits scores,
 *     they can be locked to prevent manipulation. Only staff with unlock
 *     authority (principal) can reopen them.
 *
 *  2. sl_report_settings — per-tenant configuration the principal manages:
 *       - auto_lock_on_entry: lock scores immediately after a teacher saves
 *       - allow_teacher_edit_after_lock: whether teachers may edit locked scores
 *       - results_published: master gate for parent/student visibility
 *     (published state is handled per class+year in sl_report_publications)
 *
 *  3. sl_report_publications — principal publishes results per class + year;
 *     parents/students can only view PUBLISHED results.
 */

export async function up(knex: Knex): Promise<void> {
  // 1. Locking columns on subject results
  const hasSubjectResults = await knex.schema.hasTable('sl_subject_results');
  if (hasSubjectResults) {
    const hasLocked = await knex.schema.hasColumn('sl_subject_results', 'is_locked');
    if (!hasLocked) {
      await knex.schema.alterTable('sl_subject_results', (table) => {
        table.boolean('is_locked').defaultTo(false);
        table.timestamp('locked_at');
        table.uuid('locked_by').references('id').inTable('users').onDelete('SET NULL');
      });
    }
  }

  // 2. Per-tenant report settings
  const hasSettings = await knex.schema.hasTable('sl_report_settings');
  if (!hasSettings) {
    await knex.schema.createTable('sl_report_settings', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().unique().references('id').inTable('tenants').onDelete('CASCADE');

      // When true, scores lock the moment a teacher saves them.
      table.boolean('auto_lock_on_entry').defaultTo(false);
      // When false, teachers cannot edit a score once it is locked.
      table.boolean('allow_teacher_edit_after_lock').defaultTo(false);
      // When true, teachers may view report cards for their assigned classes.
      table.boolean('allow_teacher_view_results').defaultTo(true);

      table.uuid('updated_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }

  // 3. Published results per class + academic year (gate for parents/students)
  const hasPublications = await knex.schema.hasTable('sl_report_publications');
  if (!hasPublications) {
    await knex.schema.createTable('sl_report_publications', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.uuid('class_id').notNullable().references('id').inTable('classes').onDelete('CASCADE');
      table.string('academic_year', 20).notNullable();
      table.string('term', 30); // null = whole year; otherwise a specific term

      table.boolean('is_published').defaultTo(false);
      table.timestamp('published_at');
      table.uuid('published_by').references('id').inTable('users').onDelete('SET NULL');

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.unique(['tenant_id', 'class_id', 'academic_year', 'term'], {
        indexName: 'sl_report_publications_unique',
      });
      table.index(['tenant_id', 'class_id', 'academic_year']);
    });
  }

  // eslint-disable-next-line no-console
  console.log('✅ SL grade locking + report settings migration completed');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('sl_report_publications');
  await knex.schema.dropTableIfExists('sl_report_settings');

  const hasSubjectResults = await knex.schema.hasTable('sl_subject_results');
  if (hasSubjectResults) {
    const hasLocked = await knex.schema.hasColumn('sl_subject_results', 'is_locked');
    if (hasLocked) {
      await knex.schema.alterTable('sl_subject_results', (table) => {
        table.dropColumn('is_locked');
        table.dropColumn('locked_at');
        table.dropColumn('locked_by');
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log('✅ SL grade locking + report settings migration rolled back');
}
