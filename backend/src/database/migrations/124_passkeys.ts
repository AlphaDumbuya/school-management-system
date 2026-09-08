import type { Knex } from 'knex';

/**
 * Passkey (WebAuthn/FIDO2) authentication.
 *
 * Two tenant-isolated tables:
 *   - user_passkeys: one row per registered credential (public key + counter +
 *     transports + device label). Tenant-scoped for isolation.
 *   - webauthn_challenges: server-issued, single-use, short-lived (120s) challenges
 *     for registration and authentication ceremonies (analogous to mfa_challenges
 *     but WebAuthn-specific).
 *
 * Idempotent (hasTable guards) so it's safe to re-run.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('user_passkeys'))) {
    await knex.schema.createTable('user_passkeys', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.uuid('tenant_id').notNullable();
      t.text('credential_id').notNullable().unique(); // base64url
      t.text('public_key').notNullable(); // base64url-encoded COSE key
      t.bigInteger('counter').notNullable().defaultTo(0);
      t.jsonb('transports').nullable(); // e.g. ["internal","hybrid"]
      t.string('device_label', 64).notNullable();
      t.integer('failed_attempts').notNullable().defaultTo(0);
      t.timestamp('locked_until').nullable();
      t.timestamp('last_used_at').nullable();
      t.timestamps(true, true); // created_at, updated_at (defaults to now)
      t.index(['user_id', 'tenant_id']);
    });
  }

  if (!(await knex.schema.hasTable('webauthn_challenges'))) {
    await knex.schema.createTable('webauthn_challenges', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('user_id').nullable(); // known for registration + 2FA auth
      t.uuid('tenant_id').nullable();
      t.text('challenge').notNullable(); // base64url
      t.string('type', 20).notNullable(); // 'registration' | 'authentication'
      t.timestamp('expires_at').notNullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.index(['user_id']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('webauthn_challenges');
  await knex.schema.dropTableIfExists('user_passkeys');
}
