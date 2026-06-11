import dotenv from 'dotenv';
import { db } from '@utils/database';
import bcryptjs from 'bcryptjs';

// Load environment variables
dotenv.config();

async function insertTestUser() {
  try {
    // Hash the password
    const hashedPassword = await bcryptjs.hash('Demo@123456', 10);

    // Insert admin user
    await db('users').insert({
      email: 'admin@school.com',
      password_hash: hashedPassword,
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin',
      status: 'active',
    }).onConflict('email').ignore();

    console.log('✓ Admin user inserted successfully');
    console.log('  Email: admin@school.com');
    console.log('  Password: Demo@123456');

    process.exit(0);
  } catch (error) {
    console.error('Error inserting test user:', error);
    process.exit(1);
  }
}

insertTestUser();
