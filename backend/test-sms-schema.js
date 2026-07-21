import knex from 'knex';
import knexConfig from './knexfile.js';

const env = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[env]);

async function checkAdmission() {
  try {
    const cols = await db('admission_applications').columnInfo();
    console.log('📋 admission_applications columns:', Object.keys(cols));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

checkAdmission();
