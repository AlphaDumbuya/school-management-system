import type { Knex } from 'knex';

/**
 * Student Promotions
 * ==================
 * Tracks end-of-year promotion decisions per student and enables bulk
 * promotion of a whole class to a target (next) class. Also adds an
 * auto-promote-on-publish flag to the SL report settings so promoted
 * students can be moved automatically when final-year results are released.
 */
export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('student_promotions');
  if (!hasTable) {
    await knex.schema.createTable('student_promotions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      table.uuid('from_class_id').references('id').inTable('classes');
      table.uuid('to_class_id').references('id').inTable('classes');
      table.string('academic_year', 20).notNullable();
      // 'promoted' | 'promoted_effort' | 'repeated' | 'graduated'
      table.string('outcome', 30).notNullable();
      table.decimal('yearly_percentage', 5, 2);
      table.integer('yearly_position');
      table.string('source', 20).notNullable().defaultTo('manual'); // 'manual' | 'auto'
      table.uuid('decided_by').references('id').inTable('users');
      table.text('notes');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index(['tenant_id', 'academic_year']);
      table.index(['tenant_id', 'from_class_id']);
      table.unique(['tenant_id', 'student_id', 'academic_year']);
    });
  }

  // Add an enrollment status we can transition to on promotion, plus the
  // auto-promote setting flag on sl_report_settings (created in migration 108).
  const hasSettings = await knex.schema.hasTable('sl_report_settings');
  if (hasSettings) {
    const hasCol = await knex.schema.hasColumn('sl_report_settings', 'auto_promote_on_publish');
    if (!hasCol) {
      await knex.schema.alterTable('sl_report_settings', (table) => {
        table.boolean('auto_promote_on_publish').notNullable().defaultTo(false);
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasSettings = await knex.schema.hasTable('sl_report_settings');
  if (hasSettings) {
    const hasCol = await knex.schema.hasColumn('sl_report_settings', 'auto_promote_on_publish');
    if (hasCol) {
      await knex.schema.alterTable('sl_report_settings', (table) => {
        table.dropColumn('auto_promote_on_publish');
      });
    }
  }
  await knex.schema.dropTableIfExists('student_promotions');
}
