import type { Knex } from 'knex';

/**
 * Two-Factor Authentication (TOTP) support.
 *
 * users: adds 2FA columns
 *   - two_factor_enabled: whether the user has completed 2FA setup
 *   - two_factor_secret: the Base32 TOTP secret (encrypted at rest)
 *   - two_factor_backup_codes: JSON array of hashed one-time backup codes
 *   - two_factor_enabled_at: audit timestamp
 *
 * mfa_challenges: short-lived login challenges. After a valid password when 2FA
 *   is on, we issue an mfa_token here instead of full auth tokens; the client
 *   then exchanges a valid TOTP/backup code for real tokens.
 */
export const config = { transaction: false };

async function safeAddColumn(
  knex: Knex,
  table: string,
  column: string,
  build: (t: Knex.AlterTableBuilder) => void
) {
  const has = await knex.schema.hasColumn(table, column);
  if (!has) {
    await knex.schema.alterTable(table, build);
  }
}

export async function up(knex: Knex): Promise<void> {
  await safeAddColumn(knex, 'users', 'two_factor_enabled', (t) =>
    t.boolean('two_factor_enabled').notNullable().defaultTo(false)
  );
  await safeAddColumn(knex, 'users', 'two_factor_secret', (t) =>
    t.text('two_factor_secret').nullable()
  );
  await safeAddColumn(knex, 'users', 'two_factor_backup_codes', (t) =>
    t.jsonb('two_factor_backup_codes').nullable()
  );
  await safeAddColumn(knex, 'users', 'two_factor_enabled_at', (t) =>
    t.timestamp('two_factor_enabled_at').nullable()
  );

  if (!(await knex.schema.hasTable('mfa_challenges'))) {
    await knex.schema.createTable('mfa_challenges', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('user_id').notNullable();
      t.string('token', 128).notNullable().unique();
      t.integer('attempts').notNullable().defaultTo(0);
      t.timestamp('expires_at').notNullable();
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.index('user_id');
      t.index('token');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('mfa_challenges');
  const cols = ['two_factor_enabled', 'two_factor_secret', 'two_factor_backup_codes', 'two_factor_enabled_at'];
  for (const c of cols) {
    if (await knex.schema.hasColumn('users', c)) {
      await knex.schema.alterTable('users', (t) => t.dropColumn(c));
    }
  }
}
