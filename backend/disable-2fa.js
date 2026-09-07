/**
 * disable-2fa.js — emergency helper to turn OFF two-factor auth for a user.
 *
 * Use when a user is locked out (e.g. lost authenticator + backup codes broken
 * by the pre-fix hashing bug). Clears the 2FA secret and backup codes so the
 * user can sign in with just their password, then re-enable 2FA cleanly.
 *
 * Usage:
 *   node disable-2fa.js user@example.com
 */
import knex from 'knex';
import knexfile from './knexfile.js';

const email = process.argv[2];
const envName = process.env.NODE_ENV || 'development';
const db = knex(knexfile[envName] || knexfile.development);

async function run() {
  if (!email) {
    console.error('❌ Please pass an email:  node disable-2fa.js user@example.com');
    process.exit(1);
  }
  try {
    const user = await db('users').where({ email }).first();
    if (!user) {
      console.log(`❌ No user found with email ${email}`);
      return;
    }
    await db('users').where({ id: user.id }).update({
      two_factor_enabled: false,
      two_factor_secret: null,
      two_factor_backup_codes: null,
      two_factor_enabled_at: null,
      updated_at: new Date(),
    });
    // Also clear any pending MFA challenges for this user.
    try {
      await db('mfa_challenges').where({ user_id: user.id }).del();
    } catch { /* table may not exist in some envs */ }

    console.log(`✅ 2FA disabled for ${email}. You can now sign in with your password and re-enable it.`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await db.destroy();
  }
}

run();
