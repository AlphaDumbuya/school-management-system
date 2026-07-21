import knex from 'knex';
import knexConfig from './knexfile.js';

const env = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[env]);

async function fetchTenants() {
  try {
    console.log('🧪 Querying tenants table on database...');
    const tenants = await db('tenants').select('*');
    console.log('✅ Found', tenants.length, 'tenants:');
    console.dir(tenants, { depth: null, colors: true });
  } catch (error) {
    console.error('❌ Query failed:', error);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

fetchTenants();
