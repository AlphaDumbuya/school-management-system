import type { Knex } from 'knex';

/**
 * app_stats — a tiny platform-level key/value counter table.
 *
 * Currently used to track mobile-app (APK) downloads, which weren't
 * instrumented before. Idempotent + additive.
 */
export async function up(knex: Knex): Promise<void> {
  const has = await knex.schema.hasTable('app_stats');
  if (!has) {
    await knex.schema.createTable('app_stats', (table) => {
      table.string('key').primary();
      table.bigInteger('value').notNullable().defaultTo(0);
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
    await knex('app_stats').insert({ key: 'apk_downloads', value: 0 });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('app_stats');
}
