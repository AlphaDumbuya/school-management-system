import knex from 'knex';
import knexfile from './knexfile.js';
import bcryptjs from 'bcryptjs';

const db = knex(knexfile.production);

async function seedUsers() {
  try {
    console.log('Seeding users...\n');
    
    // Get tenant
    let tenant = await db('tenants').where({ slug: 'demo-school' }).first();
    
    if (!tenant) {
      console.log('Creating tenant...');
      const [newTenant] = await db('tenants').insert({
        name: 'Demo School',
        slug: 'demo-school',
        domain: 'demo.school.local',
        status: 'active',
      }).returning('*');
      tenant = newTenant;
    }
    
    const tenantId = tenant.id;
    console.log(`Using tenant: ${tenant.name} (ID: ${tenantId})\n`);
    
    // Hash password
    const hashedPassword = await bcryptjs.hash('password123', 10);
    console.log('Password hashed successfully\n');
    
    // Check if users already exist
    const existingUsers = await db('users').count('* as count').first();
    
    if (parseInt(existingUsers.count) > 0) {
      console.log('⚠️  Users already exist. Skipping user creation.');
      
      // Show existing users
      const users = await db('users').select('email', 'role', 'status');
      console.log('\nExisting users:');
      users.forEach(u => console.log(`  - ${u.email} (${u.role})`));
      
      return;
    }
    
    // Create academic session
    let session = await db('academic_sessions').where({ name: '2024-2025' }).first();
    
    if (!session) {
      console.log('Creating academic session...');
      const [newSession] = await db('academic_sessions').insert({
        tenant_id: tenantId,
        name: '2024-2025',
        start_date: '2024-04-01',
        end_date: '2025-03-31',
        is_active: true,
      }).returning('*');
      session = newSession;
    }
    
    // Insert users
    console.log('Creating users...\n');
    
    const users = [
      { email: 'admin@school.com', first_name: 'Principal', last_name: 'Admin', role: 'principal' },
      { email: 'principal@school.com', first_name: 'School', last_name: 'Principal', role: 'principal' },
      { email: 'teacher1@school.com', first_name: 'John', last_name: 'Doe', role: 'teacher' },
      { email: 'teacher2@school.com', first_name: 'Jane', last_name: 'Smith', role: 'teacher' },
      { email: 'student1@school.com', first_name: 'Alice', last_name: 'Johnson', role: 'student' },
      { email: 'student2@school.com', first_name: 'Bob', last_name: 'Williams', role: 'student' },
      { email: 'parent@school.com', first_name: 'Parent', last_name: 'User', role: 'parent' },
      { email: 'accountant@school.com', first_name: 'Accountant', last_name: 'User', role: 'accountant' },
      { email: 'admissions@school.com', first_name: 'Admissions', last_name: 'Officer', role: 'admissions_officer' },
    ];
    
    for (const userData of users) {
      const [user] = await db('users').insert({
        tenant_id: tenantId,
        email: userData.email,
        password_hash: hashedPassword,
        first_name: userData.first_name,
        last_name: userData.last_name,
        role: userData.role,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      }).returning('*');
      
      console.log(`✅ Created: ${userData.email} (${userData.role})`);
    }
    
    console.log('\n✨ All users created successfully!');
    console.log('\nLogin with any of these accounts:');
    console.log('  Email: admin@school.com (or any email above)');
    console.log('  Password: password123\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await db.destroy();
  }
}

seedUsers();
