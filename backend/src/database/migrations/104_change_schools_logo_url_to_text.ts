import type { Knex } from 'knex';

/**
 * Migration: Change schools.logo_url column type to text to accommodate long base64 image URIs
 */
export async function up(knex: Knex): Promise<void> {
  console.log('🔄 Changing schools.logo_url column type to text...');
  const hasSchools = await knex.schema.hasTable('schools');
  if (hasSchools) {
    await knex.raw('ALTER TABLE schools ALTER COLUMN logo_url TYPE text').catch(() => {});
  }
  const hasSchoolInfo = await knex.schema.hasTable('school_info');
  if (hasSchoolInfo) {
    await knex.raw('ALTER TABLE school_info ALTER COLUMN logo_url TYPE text').catch(() => {});
  }
  const hasTenants = await knex.schema.hasTable('tenants');
  if (hasTenants && await knex.schema.hasColumn('tenants', 'logo_url')) {
    await knex.raw('ALTER TABLE tenants ALTER COLUMN logo_url TYPE text').catch(() => {});
  }
  console.log('✅ Changed logo_url column type to text');
}

export async function down(knex: Knex): Promise<void> {
  // Not reversible
}
