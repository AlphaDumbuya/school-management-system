import type { Knex } from 'knex';

/**
 * Migration: Change users.photo_url to text type to accommodate long base64 image URIs
 */
export async function up(knex: Knex): Promise<void> {
  console.log('🔄 Changing users.photo_url column type to text...');
  await knex.raw('ALTER TABLE users ALTER COLUMN photo_url TYPE text').catch(() => {});
  console.log('✅ Changed users.photo_url column type to text');
}

export async function down(knex: Knex): Promise<void> {
  // Not reversible
}
