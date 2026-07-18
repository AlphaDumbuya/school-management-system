import type { Knex } from 'knex';

/**
 * Migration: Add decided_by and decided_at to 'admission_applications' table
 */
export async function up(knex: Knex): Promise<void> {
  const hasDecidedBy = await knex.schema.hasColumn('admission_applications', 'decided_by');
  const hasDecidedAt = await knex.schema.hasColumn('admission_applications', 'decided_at');

  await knex.schema.alterTable('admission_applications', (table) => {
    if (!hasDecidedBy) {
      table.uuid('decided_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    }
    if (!hasDecidedAt) {
      table.timestamp('decided_at').nullable();
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  const hasDecidedBy = await knex.schema.hasColumn('admission_applications', 'decided_by');
  const hasDecidedAt = await knex.schema.hasColumn('admission_applications', 'decided_at');

  await knex.schema.alterTable('admission_applications', (table) => {
    if (hasDecidedBy) table.dropColumn('decided_by');
    if (hasDecidedAt) table.dropColumn('decided_at');
  });
}
