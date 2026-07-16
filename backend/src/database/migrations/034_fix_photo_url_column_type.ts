import type { Knex } from 'knex';

/**
 * Migration: Change photo_url to text type (needed for base64 data URLs)
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE students ALTER COLUMN photo_url TYPE text').catch(() => {});
  await knex.raw('ALTER TABLE admission_applications ALTER COLUMN child_photo_url TYPE text').catch(() => {});
}

export async function down(knex: Knex): Promise<void> {
  // Not reversible
}
