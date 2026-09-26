import type { Knex } from 'knex';

/**
 * Per-tenant Monime payment credentials.
 *
 * MONEY ROUTING (critical): student/parent FEE payments must settle into the
 * SCHOOL's OWN Monime account — not the platform's. Each school therefore
 * stores its own Monime access token + space id here. The platform's env creds
 * (MONIME_ACCESS_TOKEN / MONIME_SPACE_ID) are used ONLY for platform revenue:
 * subscription/plan payments and the public "restore access" flow (schools
 * paying WiSkul).
 *
 *   monime_access_token — the school's Monime API access token, ENCRYPTED at rest.
 *   monime_space_id     — the school's Monime Space id (not secret).
 *   monime_configured   — true once the school has saved usable creds.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('schools', 'monime_access_token'))) {
    await knex.schema.alterTable('schools', (t) => {
      t.text('monime_access_token').nullable();
    });
  }
  if (!(await knex.schema.hasColumn('schools', 'monime_space_id'))) {
    await knex.schema.alterTable('schools', (t) => {
      t.string('monime_space_id', 120).nullable();
    });
  }
  if (!(await knex.schema.hasColumn('schools', 'monime_configured'))) {
    await knex.schema.alterTable('schools', (t) => {
      t.boolean('monime_configured').notNullable().defaultTo(false);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const c of ['monime_access_token', 'monime_space_id', 'monime_configured']) {
    if (await knex.schema.hasColumn('schools', c)) {
      await knex.schema.alterTable('schools', (t) => t.dropColumn(c));
    }
  }
}
