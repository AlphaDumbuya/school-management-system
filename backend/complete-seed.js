import knex from 'knex';
import knexfile from './knexfile.js';
import bcryptjs from 'bcryptjs';

const db = knex(knexfile.production);

async function completeSeed() {
  try {
    console.log('🌱 Starting complete database seeding...\n');
    
    // Get tenant
    let tenant = await db('tenants').first();
    const tenantId = tenant.id;
    console.log(`Using tenant: ${tenant.name} (ID: ${tenantId})\n`);
    
    // Get academic session
    let session = await db('academic_sessions').where({ is_active: true }).first();
    console.log(`Using academic session: ${session.name}\n`);
    
    // Check existing data
    const userCount = await db('users').count('* as count').first();
    const studentCount = await db('students').count('* as count').first();
    const teacherCount = await db('teachers').count('* as count').first();
    const subjectCount = await db('subjects').count('* as count').first();
    const classCount = await db('classes').count('* as count').first();
    
    console.log('📊 Current database state:');
    console.log(`  Users: ${userCount.count}`);
    console.log(`  Students: ${studentCount.count}`);
    console.log(`  Teachers: ${teacherCount.count}`);
    console.log(`  Subjects: ${subjectCount.count}`);
    console.log(`  Classes: ${classCount.count}\n`);
    
    // Get user IDs for reference
    const users = await db('users').select('id', 'email', 'role');
    const userMap = {};
    users.forEach(u => {
      userMap[u.email] = u;
    });
    
    // Seed Teachers (if missing)
    if (parseInt(teacherCount.count) === 0) {
      console.log('👨‍🏫 Creating teacher profiles...');
      
      const teacherEmails = ['teacher1@school.com', 'teacher2@school.com'];
      const teacherData = [
        {
          user_id: userMap['teacher1@school.com']?.id,
          teacher_id: 'TCH-2024-001',
          qualifications: 'B.Sc Mathematics, M.Ed',
          experience_years: 5,
          specialization: 'Mathematics',
          phone: '+1234567890',
          office_location: 'Room 101',
          status: 'active',
          hire_date: '2019-04-01',
        },
        {
          user_id: userMap['teacher2@school.com']?.id,
          teacher_id: 'TCH-2024-002',
          qualifications: 'B.A English, M.Ed',
          experience_years: 3,
          specialization: 'English',
          phone: '+1234567891',
          office_location: 'Room 102',
          status: 'active',
          hire_date: '2021-04-01',
        },
      ];
      
      for (const teacher of teacherData) {
        if (teacher.user_id) {
          await db('teachers').insert(teacher);
          console.log(`  ✅ Created teacher: ${teacher.teacher_id}`);
        }
      }
      console.log();
    }
    
    // Seed Students (if missing)
    if (parseInt(studentCount.count) === 0) {
      console.log('👨‍🎓 Creating student profiles...');
      
      const studentData = [
        {
          user_id: userMap['student1@school.com']?.id,
          student_id: 'STU-2024-001',
          date_of_birth: '2008-05-15',
          gender: 'Female',
          phone: '+1234567892',
          address: '123 Main St',
          city: 'New York',
          state: 'NY',
          postal_code: '10001',
          country: 'USA',
          status: 'active',
          enrollment_date: '2024-04-01',
        },
        {
          user_id: userMap['student2@school.com']?.id,
          student_id: 'STU-2024-002',
          date_of_birth: '2008-06-20',
          gender: 'Male',
          phone: '+1234567893',
          address: '456 Oak Ave',
          city: 'New York',
          state: 'NY',
          postal_code: '10002',
          country: 'USA',
          status: 'active',
          enrollment_date: '2024-04-01',
        },
      ];
      
      for (const student of studentData) {
        if (student.user_id) {
          await db('students').insert(student);
          console.log(`  ✅ Created student: ${student.student_id}`);
        }
      }
      console.log();
    }
    
    // Seed Subjects (if missing)
    if (parseInt(subjectCount.count) === 0) {
      console.log('📚 Creating subjects...');
      
      const subjects = await db('subjects').insert([
        {
          code: 'MATH101',
          name: 'Mathematics',
          description: 'Basic Mathematics',
          credits: 4,
        },
        {
          code: 'ENG101',
          name: 'English',
          description: 'English Language and Literature',
          credits: 3,
        },
        {
          code: 'SCI101',
          name: 'Science',
          description: 'General Science',
          credits: 4,
        },
      ]).returning('*');
      
      subjects.forEach(s => {
        console.log(`  ✅ Created subject: ${s.code} - ${s.name}`);
      });
      console.log();
    }
    
    // Get teachers and subjects for class creation
    const teachers = await db('teachers').select('*');
    const subjects = await db('subjects').select('*');
    
    // Seed Classes (if missing)
    if (parseInt(classCount.count) === 0 && teachers.length > 0) {
      console.log('🏫 Creating classes...');
      
      const classes = await db('classes').insert([
        {
          name: '10-A',
          level: '10',
          capacity: 40,
          academic_session_id: session.id,
          class_teacher_id: teachers[0]?.id,
          room_number: '101',
        },
        {
          name: '10-B',
          level: '10',
          capacity: 40,
          academic_session_id: session.id,
          class_teacher_id: teachers[1]?.id,
          room_number: '102',
        },
      ]).returning('*');
      
      classes.forEach(c => {
        console.log(`  ✅ Created class: ${c.name}`);
      });
      console.log();
      
      // Create class subjects
      console.log('📝 Linking subjects to classes...');
      for (const cls of classes) {
        for (const subject of subjects) {
          await db('class_subjects').insert({
            class_id: cls.id,
            subject_id: subject.id,
          });
          console.log(`  ✅ Linked ${subject.code} to ${cls.name}`);
        }
      }
      console.log();
      
      // Create teacher assignments
      console.log('👨‍🏫 Creating teacher assignments...');
      if (teachers.length >= 2 && subjects.length >= 2) {
        const assignments = [
          {
            teacher_id: teachers[0].id,
            subject_id: subjects[0].id,
            class_id: classes[0].id,
            start_date: '2024-04-01',
            end_date: '2025-03-31',
          },
          {
            teacher_id: teachers[1].id,
            subject_id: subjects[1].id,
            class_id: classes[0].id,
            start_date: '2024-04-01',
            end_date: '2025-03-31',
          },
        ];
        
        for (const assignment of assignments) {
          await db('teacher_assignments').insert(assignment);
          const teacher = teachers.find(t => t.id === assignment.teacher_id);
          const subject = subjects.find(s => s.id === assignment.subject_id);
          const cls = classes.find(c => c.id === assignment.class_id);
          console.log(`  ✅ Assigned ${teacher.teacher_id} to teach ${subject.code} in ${cls.name}`);
        }
        console.log();
      }
      
      // Create enrollments
      console.log('📋 Enrolling students in classes...');
      const students = await db('students').select('*');
      
      if (students.length > 0 && classes.length > 0) {
        for (const student of students) {
          await db('enrollments').insert({
            student_id: student.id,
            class_id: classes[0].id,
            academic_session_id: session.id,
            enrollment_date: '2024-04-01',
            status: 'active',
          });
          console.log(`  ✅ Enrolled ${student.student_id} in ${classes[0].name}`);
        }
        console.log();
      }
    }
    
    // Seed Fee Types (if missing)
    const feeTypeCount = await db('fee_types').count('* as count').first();
    if (parseInt(feeTypeCount.count) === 0) {
      console.log('💰 Creating fee types...');
      
      const feeTypes = await db('fee_types').insert([
        {
          name: 'Tuition Fee',
          description: 'Monthly tuition fee',
          amount: 5000,
          is_active: true,
        },
        {
          name: 'Lab Fee',
          description: 'Laboratory fee',
          amount: 500,
          is_active: true,
        },
        {
          name: 'Activity Fee',
          description: 'Activity and sports fee',
          amount: 300,
          is_active: true,
        },
      ]).returning('*');
      
      feeTypes.forEach(ft => {
        console.log(`  ✅ Created fee type: ${ft.name} - $${ft.amount}`);
      });
      console.log();
      
      // Create fees for students
      console.log('📝 Assigning fees to students...');
      const students = await db('students').select('*');
      
      if (students.length > 0 && feeTypes.length > 0) {
        for (const student of students) {
          await db('fees').insert({
            student_id: student.id,
            fee_type_id: feeTypes[0].id,
            amount: 5000,
            due_date: '2024-05-01',
            status: 'pending',
            academic_session_id: session.id,
          });
          console.log(`  ✅ Assigned tuition fee to ${student.student_id}`);
        }
        console.log();
      }
    }
    
    // Final summary
    console.log('✨ Seeding complete!\n');
    console.log('📊 Final database state:');
    
    const finalCounts = {
      users: await db('users').count('* as count').first(),
      students: await db('students').count('* as count').first(),
      teachers: await db('teachers').count('* as count').first(),
      subjects: await db('subjects').count('* as count').first(),
      classes: await db('classes').count('* as count').first(),
      enrollments: await db('enrollments').count('* as count').first(),
      feeTypes: await db('fee_types').count('* as count').first(),
      fees: await db('fees').count('* as count').first(),
    };
    
    console.log(`  Users: ${finalCounts.users.count}`);
    console.log(`  Students: ${finalCounts.students.count}`);
    console.log(`  Teachers: ${finalCounts.teachers.count}`);
    console.log(`  Subjects: ${finalCounts.subjects.count}`);
    console.log(`  Classes: ${finalCounts.classes.count}`);
    console.log(`  Enrollments: ${finalCounts.enrollments.count}`);
    console.log(`  Fee Types: ${finalCounts.feeTypes.count}`);
    console.log(`  Fees: ${finalCounts.fees.count}`);
    
    console.log('\n🎉 Database is fully seeded and ready to use!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await db.destroy();
  }
}

completeSeed();
