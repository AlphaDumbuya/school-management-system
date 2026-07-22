import knex from 'knex';
import knexConfig from '../knexfile.js';

const env = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[env] || knexConfig.development);

async function checkSchema() {
  try {
    const hasFees = await db.schema.hasTable('fees');
    console.log('fees table exists:', hasFees);
    if (hasFees) {
      const info = await db('fees').columnInfo();
      console.log('fees columns:', Object.keys(info));
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await db.destroy();
  }
}

checkSchema();
