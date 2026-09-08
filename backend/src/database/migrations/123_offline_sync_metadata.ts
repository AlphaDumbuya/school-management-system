import type { Knex } from 'knex';

/**
 * Offline sync metadata for the teacher offline-first app.
 *
 * Adds to attendance / grades / assignments:
 *   - client_id (nullable, unique when present): the client-generated UUID that
 *     makes an offline write idempotent — re-pushing the same client_id must not
 *     create a duplicate row.
 *   - updated_at (if missing): lets the sync engine pull "changes since <ts>".
 *
 * All guarded with hasColumn so the migration is safe to re-run.
 */
export const config = { transaction: false };

const TABLES = ['attendance', 'grades', 'assignments'];

export async function up(knex: Knex): Promise<void> {
  for (const table of TABLES) {
    if (!(await knex.schema.hasTable(table))) continue;

    if (!(await knex.schema.hasColumn(table, 'client_id'))) {
      await knex.schema.alterTable(table, (t) => {
        t.string('client_id', 64).nullable();
      });
      // Partial unique index: uniqueness only enforced when client_id is present,
      // so existing rows (NULL) are unaffected.
      await knex.raw(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${table}_client_id_unique ON ${table} (client_id) WHERE client_id IS NOT NULL`
      );
    }

    if (!(await knex.schema.hasColumn(table, 'updated_at'))) {
      await knex.schema.alterTable(table, (t) => {
        t.timestamp('updated_at').defaultTo(knex.fn.now());
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const table of TABLES) {
    if (!(await knex.schema.hasTable(table))) continue;
    await knex.raw(`DROP INDEX IF EXISTS ${table}_client_id_unique`);
    if (await knex.schema.hasColumn(table, 'client_id')) {
      await knex.schema.alterTable(table, (t) => t.dropColumn('client_id'));
    }
  }
}
