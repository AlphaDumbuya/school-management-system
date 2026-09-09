import type { Knex } from 'knex';

/**
 * School verification (simple instant, entry-based).
 *
 * - users: verification_status ('unverified' | 'verified'), verified_at, profile_photo_url
 *   (only the account owner uses these).
 * - verification_records: the entered EMIS code + school details + government-ID details +
 *   name-match result + status, one row per tenant (latest kept / upserted), tenant-isolated.
 *
 * No document files, no biometric data. Idempotent (guards) so it's safe to re-run.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('users', 'verification_status'))) {
    await knex.schema.alterTable('users', (t) => {
      t.string('verification_status', 20).notNullable().defaultTo('unverified');
    });
  }
  if (!(await knex.schema.hasColumn('users', 'verified_at'))) {
    await knex.schema.alterTable('users', (t) => {
      t.timestamp('verified_at').nullable();
    });
  }
  if (!(await knex.schema.hasColumn('users', 'profile_photo_url'))) {
    await knex.schema.alterTable('users', (t) => {
      t.text('profile_photo_url').nullable();
    });
  }

  if (!(await knex.schema.hasTable('verification_records'))) {
    await knex.schema.createTable('verification_records', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.uuid('tenant_id').notNullable();
      t.string('emis_code', 20).notNullable();
      t.string('school_level', 40).nullable();
      t.string('district', 80).nullable();
      t.integer('year_established').nullable();
      t.string('id_type', 20).notNullable(); // national_id | passport | drivers_license
      t.string('id_number', 40).notNullable();
      t.string('id_name', 160).notNullable();
      t.boolean('name_match').notNullable().defaultTo(false);
      t.string('status', 20).notNullable().defaultTo('unverified'); // unverified | verified
      t.text('last_reason').nullable();
      t.timestamps(true, true); // created_at, updated_at
      t.index(['tenant_id']);
      t.unique(['tenant_id']); // one canonical record per tenant (upsert)
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('verification_records');
  for (const col of ['profile_photo_url', 'verified_at', 'verification_status']) {
    if (await knex.schema.hasColumn('users', col)) {
      await knex.schema.alterTable('users', (t) => t.dropColumn(col));
    }
  }
}
