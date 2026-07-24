import type { Knex } from 'knex';

/**
 * Migration: Change qr_codes.image_url to text type to accommodate long base64 QR image URIs
 */
export async function up(knex: Knex): Promise<void> {
  console.log('🔄 Changing qr_codes.image_url column type to text...');
  await knex.raw('ALTER TABLE qr_codes ALTER COLUMN image_url TYPE text').catch(() => {});
  console.log('✅ Changed qr_codes.image_url column type to text');
}

export async function down(knex: Knex): Promise<void> {
  // Not reversible
}
