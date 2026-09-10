import type { Knex } from 'knex';

/**
 * Add users.onboarded_at — a server-side, device-independent record that a user
 * has completed the first-login welcome guide. Previously this was tracked only
 * in localStorage, so the guide re-appeared on every new device / browser / app
 * WebView. Persisting it on the user makes it truly one-time per account.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('users', 'onboarded_at'))) {
    await knex.schema.alterTable('users', (t) => {
      t.timestamp('onboarded_at').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('users', 'onboarded_at')) {
    await knex.schema.alterTable('users', (t) => t.dropColumn('onboarded_at'));
  }
}
