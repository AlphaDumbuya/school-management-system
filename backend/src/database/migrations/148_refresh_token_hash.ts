import type { Knex } from 'knex';

/**
 * Store refresh tokens HASHED at rest.
 *
 * Previously refresh_tokens.token held the raw JWT. A DB dump (SQL injection,
 * leaked backup, compromised Neon creds) would hand an attacker every live
 * session. We now store only a SHA-256 hash and look up by hash, so a dump
 * yields nothing usable.
 *
 * - Add nullable `token_hash` (SHA-256 hex = 64 chars) + index it.
 * - Make the legacy `token` column nullable so new inserts can omit the raw
 *   value entirely.
 * - Invalidate all existing sessions (raw tokens can't be re-hashed after the
 *   fact and this is pre-launch): everyone simply logs in again.
 */
export async function up(knex: Knex): Promise<void> {
  const hasHash = await knex.schema.hasColumn('refresh_tokens', 'token_hash');
  if (!hasHash) {
    await knex.schema.alterTable('refresh_tokens', (t) => {
      t.string('token_hash', 64).nullable();
      t.index('token_hash', 'idx_refresh_tokens_token_hash');
    });
  }

  // Legacy raw-token column becomes optional (we stop writing it).
  await knex.raw('ALTER TABLE refresh_tokens ALTER COLUMN token DROP NOT NULL;').catch(() => {});

  // Wipe existing rows — old raw tokens can't be migrated to hashes, and
  // leaving them would keep plaintext at rest. Users re-authenticate.
  await knex('refresh_tokens').del().catch(() => {});
}

export async function down(knex: Knex): Promise<void> {
  const hasHash = await knex.schema.hasColumn('refresh_tokens', 'token_hash');
  if (hasHash) {
    await knex.schema.alterTable('refresh_tokens', (t) => {
      t.dropIndex('token_hash', 'idx_refresh_tokens_token_hash');
      t.dropColumn('token_hash');
    });
  }
  // Note: we do NOT restore NOT NULL on `token` — existing rows may have null.
}
