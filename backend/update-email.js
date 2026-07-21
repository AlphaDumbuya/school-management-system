import knex from 'knex';
import knexConfig from './knexfile.js';

const db = knex(knexConfig.development);

async function run() {
  try {
    const updatedCount = await db('users')
      .where({ email: 'superadmin@platform.com' })
      .update({ email: 'alphadumbuya7@gmail.com' });
      
    if (updatedCount > 0) {
      console.log('✅ Super admin email updated to: alphadumbuya7@gmail.com');
    } else {
      console.log('❌ Super admin user with email superadmin@platform.com not found.');
    }
  } catch (error) {
    console.error('Error updating email:', error);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

run();
