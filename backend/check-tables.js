import knex from 'knex';
import knexfile from './knexfile.js';

const db = knex(knexfile.production);

async function checkTables() {
  try {
    console.log('Checking database tables...\n');
    
    const tables = ['users', 'roles', 'permissions', 'role_permissions', 'tenants', 'students', 'teachers'];
    
    for (const table of tables) {
      try {
        const count = await db(table).count('* as count').first();
        console.log(`✅ ${table.padEnd(20)} - ${count.count} rows`);
      } catch (error) {
        console.log(`❌ ${table.padEnd(20)} - Error: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.destroy();
  }
}

checkTables();
