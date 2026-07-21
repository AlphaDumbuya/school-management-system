import knex from 'knex';
import knexConfig from './knexfile.js';

const env = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[env]);

async function inspectSchema() {
  try {
    console.log('🧪 Inspecting database schemas...');
    
    const classesColumns = await db('classes').columnInfo();
    console.log('\n📋 classes columns:');
    console.log(Object.keys(classesColumns));

    const subjectsColumns = await db('subjects').columnInfo();
    console.log('\n📋 subjects columns:');
    console.log(Object.keys(subjectsColumns));

    const sessionsColumns = await db('academic_sessions').columnInfo();
    console.log('\n📋 academic_sessions columns:');
    console.log(Object.keys(sessionsColumns));

  } catch (error) {
    console.error('❌ Failed:', error);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

inspectSchema();
