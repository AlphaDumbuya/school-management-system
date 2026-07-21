import knex from 'knex';
import knexConfig from './knexfile.js';

const env = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[env]);

async function checkExams() {
  try {
    const examColumns = await db('examinations').columnInfo();
    console.log('📋 examinations columns:', Object.keys(examColumns));
  } catch (error) {
    console.error(error);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

checkExams();
