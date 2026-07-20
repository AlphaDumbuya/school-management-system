import { db } from './utils/database';

async function main() {
  const tenants = await db('tenants').select('*');
  console.log('--- Tenants ---');
  console.log(tenants);

  const schools = await db('schools').select('*');
  console.log('--- Schools ---');
  console.log(schools);

  const users = await db('users').select('id', 'email', 'tenant_id', 'role').limit(5);
  console.log('--- Users ---');
  console.log(users);
}

main().catch(console.error).finally(() => db.destroy());
