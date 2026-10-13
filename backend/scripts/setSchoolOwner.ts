/**
 * Name a school owner.
 *
 * A school owner is a principal account flagged `users.is_owner`. This script is
 * run by a person, on purpose. It changes nothing unless you pass --apply.
 *
 *   Make an existing principal an owner (preview, then apply):
 *     npm run set:owner -- --email owner@example.com
 *     npm run set:owner -- --email owner@example.com --apply
 *
 *   Create a brand-new owner account in a school (password from the environment,
 *   never from the command line, so it stays out of shell history and the repo):
 *     OWNER_PASSWORD='...' npm run set:owner -- --create --email owner@example.com \
 *       --first Ada --last Kamara --tenant <tenant-id> --apply
 *
 * Rules it enforces:
 *   - an existing account must already be an active principal (it will NOT turn a
 *     student, parent or teacher login into an owner: their records are tied to
 *     that login);
 *   - --create refuses an email that is already used by any account;
 *   - the school's current principals are left as they are.
 */
import { db } from '../src/utils/database';
import { PasswordService } from '../src/services/passwordService';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const email = (arg('email') || '').trim().toLowerCase();
  const apply = flag('apply');
  const create = flag('create');
  if (!email) throw new Error('Pass --email <address>.');

  const existing = await db('users').whereRaw('lower(email) = ?', [email]).first();

  if (create) {
    if (existing) {
      throw new Error(`An account with ${email} already exists (role: ${existing.role}). Use a different email, or free this one first.`);
    }
    const tenantId = arg('tenant');
    const first = (arg('first') || '').trim();
    const last = (arg('last') || '').trim();
    const password = process.env.OWNER_PASSWORD || '';
    if (!tenantId || !first || !last) throw new Error('--create needs --tenant, --first and --last.');
    if (!password) throw new Error('Set OWNER_PASSWORD in the environment for --create.');
    const policy = PasswordService.validatePasswordPolicy(password);
    if (!policy.valid) throw new Error(`Password is too weak: ${policy.errors.join(', ')}`);
    const tenant = await db('tenants').where({ id: tenantId }).first('id', 'name');
    if (!tenant) throw new Error(`No school with id ${tenantId}.`);

    console.log(`Will create owner ${first} ${last} <${email}> in "${tenant.name}".`);
    if (!apply) return console.log('Preview only. Add --apply to do it.');
    await db('users').insert({
      tenant_id: tenant.id,
      email,
      password_hash: await PasswordService.hashPassword(password),
      first_name: first,
      last_name: last,
      role: 'principal',
      is_owner: true,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });
    return console.log('Done. The owner account is created.');
  }

  if (!existing) throw new Error(`No account with ${email}. Use --create to make one.`);
  if (existing.role !== 'principal') {
    throw new Error(
      `${email} is a "${existing.role}" account, not a principal. ` +
      'This script will not turn it into an owner, because that login is tied to its own records. ' +
      'Use a different email with --create, or ask for the account to be moved first.'
    );
  }
  if (String(existing.status).toLowerCase() !== 'active') throw new Error(`${email} is ${existing.status}. Only an active account can be an owner.`);
  if (existing.is_owner) return console.log(`${email} is already an owner. Nothing to do.`);

  const principals = await db('users').where({ tenant_id: existing.tenant_id, role: 'principal' }).select('email', 'is_owner');
  console.log(`Will make ${email} a school owner. Other principals in this school stay principals:`);
  principals.filter((p: any) => p.email !== existing.email).forEach((p: any) => console.log(`  - ${p.email}${p.is_owner ? ' (owner)' : ''}`));
  if (!apply) return console.log('Preview only. Add --apply to do it.');
  await db('users').where({ id: existing.id }).update({ is_owner: true, updated_at: new Date() });
  console.log('Done.');
}

main()
  .catch((e) => { console.error(`\n${e.message || e}`); process.exitCode = 1; })
  .finally(() => db.destroy());
