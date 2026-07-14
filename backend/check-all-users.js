import knex from 'knex';
import knexfile from './knexfile.js';

const db = knex(knexfile.production);

async function checkAllUsers() {
  try {
    console.log('Checking all users in database...\n');
    
    // Count users
    const count = await db('users').count('* as count').first();
    console.log('Total users in database:', count.count);
    
    if (parseInt(count.count) === 0) {
      console.log('\n❌ No users found in database!');
      console.log('\n💡 You need to run the seed script:');
      console.log('   npm run seed\n');
      return;
    }
    
    // Get all users
    const users = await db('users').select('id', 'email', 'role', 'status', 'tenant_id').limit(20);
    
    console.log('\n✅ Users found:');
    users.forEach(user => {
      console.log(`  - ${user.email} (${user.role}) [status: ${user.status}, tenant: ${user.tenant_id}]`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.destroy();
  }
}

checkAllUsers();
