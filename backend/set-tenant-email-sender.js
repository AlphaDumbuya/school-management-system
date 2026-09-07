/**
 * set-tenant-email-sender.js — setup-team helper to switch a school's
 * transactional email sender mode AFTER verifying its sender/domain in Brevo.
 *
 * Usage:
 *   node set-tenant-email-sender.js <tenantId> own   [from@school.edu]
 *   node set-tenant-email-sender.js <tenantId> platform
 *
 * 'own'      → emails sent fully from the school's own (verified) address.
 * 'platform' → emails sent from the platform address with the school's name
 *              and the school as reply-to (default; works without verification).
 *
 * Switching to 'own' sets email_sender_verified = true (you are asserting the
 * sender is verified in the provider). Switching to 'platform' clears it.
 */
import knex from 'knex';
import knexfile from './knexfile.js';

const [tenantId, mode, fromAddress] = process.argv.slice(2);
const envName = process.env.NODE_ENV || 'development';
const db = knex(knexfile[envName] || knexfile.development);

async function run() {
  if (!tenantId || !['own', 'platform'].includes(mode)) {
    console.error('Usage: node set-tenant-email-sender.js <tenantId> <own|platform> [from@school.edu]');
    process.exit(1);
  }
  try {
    const school = await db('schools').where({ tenant_id: tenantId }).first();
    if (!school) {
      console.log(`❌ No school found for tenant ${tenantId}`);
      return;
    }
    const patch = {
      email_sender_mode: mode,
      email_sender_verified: mode === 'own',
      updated_at: new Date(),
    };
    if (mode === 'own' && fromAddress) patch.email_from_address = fromAddress;
    if (mode === 'platform') patch.email_from_address = null;

    await db('schools').where({ tenant_id: tenantId }).update(patch);
    const updated = await db('schools').where({ tenant_id: tenantId }).first();
    console.log(`✅ ${school.name}: sender mode = ${updated.email_sender_mode}` +
      (updated.email_from_address ? `, from = ${updated.email_from_address}` : '') +
      `, verified = ${updated.email_sender_verified}`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await db.destroy();
  }
}

run();
