import type { Knex } from 'knex';

/**
 * 132_add_tenant_scoping_to_grading_scales.ts
 *
 * The grading_scales table was created in migration 003 without tenant
 * scoping or the columns the Phase 15 GradingConfigService expects.
 * This migration adds the missing columns so the Settings page grading
 * config tab can actually save and retrieve tenant-scoped grading scales.
 *
 * After this migration, the Results page and Report Cards can query the
 * tenant's default grading scale to compute letter grades dynamically
 * instead of using hardcoded SL defaults.
 */
export async function up(knex: Knex): Promise<void> {
  // Add tenant scoping and missing columns to grading_scales
  const hasTenantId = await knex.schema.hasColumn('grading_scales', 'tenant_id');
  if (!hasTenantId) {
    await knex.schema.table('grading_scales', (table) => {
      table.uuid('tenant_id').nullable();
      table.string('scale_id', 36).nullable();
      table.string('scale_type', 20).defaultTo('letter');
      table.decimal('min_value', 5, 2).defaultTo(0);
      table.decimal('max_value', 5, 2).defaultTo(100);
      table.boolean('is_active').defaultTo(true);
      table.uuid('created_by').nullable();
      table.uuid('updated_by').nullable();
      table.jsonb('grades_json').nullable();

      table.index(['tenant_id', 'is_active']);
    });

    // Migrate existing grades JSONB data to grades_json if needed
    await knex.raw(`
      UPDATE grading_scales
      SET grades_json = grades
      WHERE grades_json IS NULL AND grades IS NOT NULL
    `);
  }

  // Seed a default SL grading scale for each tenant that doesn't have one
  const tenants = await knex('tenants').select('id');
  for (const t of tenants) {
    const existing = await knex('grading_scales')
      .where({ tenant_id: t.id, is_default: true })
      .first();

    if (!existing) {
      await knex('grading_scales').insert({
        tenant_id: t.id,
        scale_id: knex.raw('gen_random_uuid()'),
        name: 'Sierra Leone Standard',
        description: 'Default SL grading scale (A-F)',
        scale_type: 'letter',
        min_value: 0,
        max_value: 100,
        is_default: true,
        is_active: true,
        grades_json: JSON.stringify([
          { grade: 'A', min_score: 85, max_score: 100, grade_points: 4.0, description: 'Excellent' },
          { grade: 'B', min_score: 75, max_score: 84, grade_points: 3.0, description: 'Very Good' },
          { grade: 'C', min_score: 60, max_score: 74, grade_points: 2.0, description: 'Good' },
          { grade: 'D', min_score: 50, max_score: 59, grade_points: 1.0, description: 'Satisfactory' },
          { grade: 'F', min_score: 0, max_score: 49, grade_points: 0.0, description: 'Unsatisfactory' },
        ]),
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTenantId = await knex.schema.hasColumn('grading_scales', 'tenant_id');
  if (hasTenantId) {
    await knex.schema.table('grading_scales', (table) => {
      table.dropColumn('tenant_id');
      table.dropColumn('scale_id');
      table.dropColumn('scale_type');
      table.dropColumn('min_value');
      table.dropColumn('max_value');
      table.dropColumn('is_active');
      table.dropColumn('created_by');
      table.dropColumn('updated_by');
      table.dropColumn('grades_json');
    });
  }
}
