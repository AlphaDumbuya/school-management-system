import type { Knex } from 'knex';
import crypto from 'crypto';
/**
 * School verification: the owner's government ID number is encrypted at rest
 * (AES-256-GCM, same scheme and key as utils/encryption.encryptSecret) and
 * only its last 4 characters are kept readable for support ("ID ending 4821").
 * Existing plaintext rows are encrypted here.
 */
function encrypt(plain: string): string {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'wiskul-default-dev-encryption-key-change-me';
  const key = crypto.scryptSync(secret, 'wiskul-enc-salt', 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${enc.toString('base64')}`;
}

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('verification_records'))) return;
  await knex.raw('ALTER TABLE verification_records ALTER COLUMN id_number TYPE text');
  if (!(await knex.schema.hasColumn('verification_records', 'id_last4'))) {
    await knex.schema.alterTable('verification_records', (t) => { t.string('id_last4', 8).nullable(); });
  }
  const rows = await knex('verification_records').select('id', 'id_number', 'id_last4');
  for (const r of rows) {
    const v = String(r.id_number || '');
    // Already encrypted rows look like iv.tag.data (three base64 parts).
    if (!v || v.split('.').length === 3) continue;
    await knex('verification_records').where({ id: r.id }).update({ id_number: encrypt(v), id_last4: v.slice(-4) });
  }
}

export async function down(): Promise<void> {
  // Irreversible by design: the plaintext is not restored.
}
