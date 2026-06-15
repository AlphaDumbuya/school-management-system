/**
 * Create Super Admin User Script
 * Phase 1.1: Add Super Admin Role
 * 
 * Creates a super admin user for testing platform management features
 */

import { db } from '../src/utils/database';
import bcryptjs from 'bcryptjs';

async function createSuperAdmin() {
  try {
    console.log('Creating Super Admin user...\n');

    // Check if super admin already exists
    const existingSuperAdmin = await db('users')
      .where({ email: 'superadmin@platform.com' })
      .first();

    if (existingSuperAdmin) {
      console.log('❌ Super Admin user already exists!');
      console.log('Email: superadmin@platform.com');
      process.exit(0);
    }

    // Get first tenant
    const tenant = await db('tenants').first();
    if (!tenant) {
      console.error('❌ No tenant found! Please run migrations first.');
      process.exit(1);
    }

    // Hash password
    const password = 'SuperAdmin123!';
    const passwordHash = await bcryptjs.hash(password, 10);

    // Create super admin user
    const [user] = await db('users')
      .insert({
        tenant_id: tenant.id,
        email: 'superadmin@platform.com',
        password_hash: passwordHash,
        first_name: 'Super',
        last_name: 'Admin',
        role: 'super_admin',
        is_platform_admin: true,
        status: 'active',
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
      .returning('*');

    console.log('✅ Super Admin user created successfully!\n');
    console.log('='.repeat(50));
    console.log('LOGIN CREDENTIALS');
    console.log('='.repeat(50));
    console.log('Email:    superadmin@platform.com');
    console.log('Password: SuperAdmin123!');
    console.log('Role:     super_admin');
    console.log('='.repeat(50));
    console.log('\n📌 IMPORTANT: Change this password after first login!\n');
    console.log(`User ID: ${user.id}`);
    console.log(`Tenant ID: ${user.tenant_id}`);
    console.log(`Created at: ${user.created_at}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating super admin:', error);
    process.exit(1);
  }
}

createSuperAdmin();
