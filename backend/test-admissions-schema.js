import knex from 'knex';
import knexConfig from './knexfile.js';

const env = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[env]);

async function checkAdmissions() {
  try {
    const columns = await db('admission_applications').columnInfo();
    console.log('📋 admission_applications columns:', Object.keys(columns));
  } catch (error) {
    console.error(error);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

checkAdmissions();
