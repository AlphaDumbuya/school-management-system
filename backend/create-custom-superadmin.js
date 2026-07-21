import knex from 'knex';
import knexConfig from './knexfile.js';
import bcryptjs from 'bcryptjs';

const env = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[env]);

async function createCustomSuperAdmin() {
  try {
    console.log('🧪 Creating custom super admin...');
    
    const tenant = await db('tenants').first();
    if (!tenant) {
      console.error('❌ No tenant found!');
      process.exit(1);
    }

    const email = 'alphadumbuya7@gmail.com';
    const password = 'Dumbuya123@';
    const passwordHash = await bcryptjs.hash(password, 10);

    // Clean any conflicting email rows first
    await db('users').where({ email }).delete();

    const [user] = await db('users')
      .insert({
        tenant_id: tenant.id,
        email: email,
        password_hash: passwordHash,
        first_name: 'Alpha',
        last_name: 'Dumbuya',
        role: 'super_admin',
        is_platform_admin: true,
        status: 'active',
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
      .returning('*');

    console.log(`✅ Super Admin created successfully: ${email}`);
  } catch (error) {
    console.error('❌ Failed:', error);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

createCustomSuperAdmin();
