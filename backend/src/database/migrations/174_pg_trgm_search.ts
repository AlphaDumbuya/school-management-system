import type { Knex } from 'knex';

/**
 * Makes the pg_trgm extension available for similarity queries. The header
 * search's "did you mean" currently checks typos in code (so it works without
 * this), and nothing depends on the extension being present.
 */
export async function up(knex: Knex): Promise<void> {
  // Only when the server offers it (a failed CREATE would abort the migration's
  // transaction, so check first rather than catch).
  const offered = await knex.raw("SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm'");
  if (offered.rows?.length) await knex.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm');
}

export async function down(): Promise<void> {
  // Left in place: other objects may use the extension.
}
