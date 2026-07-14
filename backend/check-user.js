import knex from 'knex';
import knexfile from './knexfile.js';
import bcryptjs from 'bcryptjs';

const db = knex(knexfile.production);

async function checkUser() {
  try {
    console.log('Checking user in database...');
    
    // Get user
    const user = await db('users').where({ email: 'admin@school.com' }).first();
    
    if (!user) {
      console.log('❌ User not found in database');
      return;
    }
    
    console.log('✅ User found:');
    console.log('  Email:', user.email);
    console.log('  Role:', user.role);
    console.log('  Status:', user.status);
    console.log('  Password hash length:', user.password_hash?.length || 0);
    console.log('  Password hash (first 20 chars):', user.password_hash?.substring(0, 20));
    
    // Test password comparison
    console.log('\nTesting password "password123"...');
    const testPassword = 'password123';
    const isMatch = await bcryptjs.compare(testPassword, user.password_hash);
    console.log('  Password match:', isMatch ? '✅ YES' : '❌ NO');
    
    // Test generating a new hash and comparing
    console.log('\nGenerating fresh hash of "password123"...');
    const newHash = await bcryptjs.hash(testPassword, 10);
    console.log('  New hash (first 20 chars):', newHash.substring(0, 20));
    const freshMatch = await bcryptjs.compare(testPassword, newHash);
    console.log('  Fresh hash match:', freshMatch ? '✅ YES' : '❌ NO');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.destroy();
  }
}

checkUser();
