import knex from 'knex';
import knexfile from './knexfile.js';

const db = knex(knexfile.production);

async function verifyComplete() {
  try {
    console.log('🔍 Verifying complete database setup...\n');
    
    // Test users with credentials
    console.log('👥 Available Test Accounts:');
    console.log('═══════════════════════════════════════════');
    
    const testAccounts = [
      { email: 'admin@school.com', role: 'principal', label: 'Principal' },
      { email: 'principal@school.com', role: 'principal', label: 'Principal' },
      { email: 'teacher1@school.com', role: 'teacher', label: 'Teacher' },
      { email: 'student1@school.com', role: 'student', label: 'Student' },
      { email: 'parent@school.com', role: 'parent', label: 'Parent' },
      { email: 'accountant@school.com', role: 'accountant', label: 'Accountant' },
    ];
    
    for (const account of testAccounts) {
      const user = await db('users')
        .where({ email: account.email })
        .select('email', 'role', 'status', 'first_name', 'last_name')
        .first();
      
      if (user) {
        console.log(`✅ ${account.label}:`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Name: ${user.first_name} ${user.last_name}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Status: ${user.status}`);
        console.log(`   Password: password123`);
        console.log();
      } else {
        console.log(`❌ ${account.label}: NOT FOUND`);
        console.log();
      }
    }
    
    // Check related data
    console.log('📊 Database Summary:');
    console.log('═══════════════════════════════════════════');
    
    const counts = {
      users: await db('users').count('* as count').first(),
      teachers: await db('teachers').count('* as count').first(),
      students: await db('students').count('* as count').first(),
      subjects: await db('subjects').count('* as count').first(),
      classes: await db('classes').count('* as count').first(),
      enrollments: await db('enrollments').count('* as count').first(),
      teacher_assignments: await db('teacher_assignments').count('* as count').first(),
      fee_types: await db('fee_types').count('* as count').first(),
      fees: await db('fees').count('* as count').first(),
    };
    
    console.log(`Users:               ${counts.users.count}`);
    console.log(`Teachers:            ${counts.teachers.count}`);
    console.log(`Students:            ${counts.students.count}`);
    console.log(`Subjects:            ${counts.subjects.count}`);
    console.log(`Classes:             ${counts.classes.count}`);
    console.log(`Enrollments:         ${counts.enrollments.count}`);
    console.log(`Teacher Assignments: ${counts.teacher_assignments.count}`);
    console.log(`Fee Types:           ${counts.fee_types.count}`);
    console.log(`Fees:                ${counts.fees.count}`);
    
    console.log('\n═══════════════════════════════════════════');
    console.log('✨ Database is ready!');
    console.log('🌐 You can now login at: http://localhost:5173');
    console.log('🔑 Use any email above with password: password123\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.destroy();
  }
}

verifyComplete();
