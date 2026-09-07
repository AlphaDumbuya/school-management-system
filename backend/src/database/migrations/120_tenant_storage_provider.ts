import type { Knex } from 'knex';

/**
 * Per-tenant file storage (UploadThing) control — mirrors the email sender feature.
 *
 * A school can store uploads either:
 *   - via the platform's default UploadThing account (default), OR
 *   - fully from the school's own UploadThing account.
 *
 * The principal configures their own credentials in Settings (self-service,
 * assisted by the setup team). The super admin never sets these.
 *
 * storage_provider:
 *   'platform' — uploads use the platform's UploadThing token. (default)
 *   'own'      — uploads use the school's own UploadThing token.
 * storage_uploadthing_token — the school's UploadThing API token, ENCRYPTED at rest.
 * storage_uploadthing_app_id — optional app id / slug for the school's account.
 * storage_configured — true once the school has saved usable own-mode creds.
 */
export const config = { transaction: false };

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('schools', 'storage_provider'))) {
    await knex.schema.alterTable('schools', (t) => {
      t.string('storage_provider', 20).notNullable().defaultTo('platform');
    });
  }
  if (!(await knex.schema.hasColumn('schools', 'storage_uploadthing_token'))) {
    await knex.schema.alterTable('schools', (t) => {
      t.text('storage_uploadthing_token').nullable();
    });
  }
  if (!(await knex.schema.hasColumn('schools', 'storage_uploadthing_app_id'))) {
    await knex.schema.alterTable('schools', (t) => {
      t.string('storage_uploadthing_app_id', 255).nullable();
    });
  }
  if (!(await knex.schema.hasColumn('schools', 'storage_configured'))) {
    await knex.schema.alterTable('schools', (t) => {
      t.boolean('storage_configured').notNullable().defaultTo(false);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const c of ['storage_provider', 'storage_uploadthing_token', 'storage_uploadthing_app_id', 'storage_configured']) {
    if (await knex.schema.hasColumn('schools', c)) {
      await knex.schema.alterTable('schools', (t) => t.dropColumn(c));
    }
  }
}
