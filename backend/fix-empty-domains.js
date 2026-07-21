import knex from 'knex';
import knexConfig from './knexfile.js';

const env = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[env]);

async function fixEmptyDomains() {
  try {
    console.log('🧪 Normalizing empty string domains to null...');
    const result = await db('tenants')
      .where({ domain: '' })
      .update({ domain: null });
    console.log(`✅ Normalized ${result} rows.`);
  } catch (error) {
    console.error('❌ Failed:', error);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

fixEmptyDomains();
