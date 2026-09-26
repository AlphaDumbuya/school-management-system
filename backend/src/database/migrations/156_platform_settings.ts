import type { Knex } from 'knex';

/**
 * platform_settings — global, platform-OWNER-controlled settings (superadmin).
 *
 * A tiny JSON key/value store for settings the platform owner manages from the
 * admin portal (not per-tenant). First use: the new-school promotional TRIAL
 * config (which plan new signups start on, for how many days, and whether the
 * promo is active at all).
 *
 * Distinct from per-tenant `school_config_settings` and from the numeric
 * `app_stats` counter table.
 */
export async function up(knex: Knex): Promise<void> {
  const has = await knex.schema.hasTable('platform_settings');
  if (!has) {
    await knex.schema.createTable('platform_settings', (t) => {
      t.string('key').primary();
      t.jsonb('value').notNullable();
      t.uuid('updated_by').nullable();
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('platform_settings');
}
