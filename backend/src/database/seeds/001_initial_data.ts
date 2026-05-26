import { Knex } from 'knex';
import bcryptjs from 'bcryptjs';

export async function seed(knex: Knex): Promise<void> {
  // Delete existing entries
  await knex('notifications').del();
  await knex('audit_logs').del();
  await knex('payments').del();
  await knex('fees').del();
  await knex('fee_types').del();
  await knex('schedules').del();
  await knex('attendance').del();
  await knex('grades').del();
  await knex('enrollments').del();
  await knex('teacher_assignments').del();
  await knex('class_subjects').del();
  await knex('classes').del();
  await knex('subjects').del();
  await knex('teachers').del();
  await knex('students').del();
  await knex('academic_sessions').del();
  await knex('users').del();

  // Hash password for demo users
  const hashedPassword = await bcryptjs.hash('Demo@123456', 10);

  // Insert academic sessions
  const sessions = await knex('academic_sessions').insert([
    {
      name: '2024-2025',
      start_date: '2024-04-01',
      end_date: '2025-03-31',
      is_active: true,
    },
    {
      name: '2023-2024',
      start_date: '2023-04-01',
      end_date: '2024-03-31',
      is_active: false,
    },
  ]).returning('*');

  // Insert admin user
  const adminUser = await knex('users').insert({
    email: 'admin@school.com',
    password_hash: hashedPassword,
    first_name: 'Admin',
    last_name: 'User',
    role: 'admin',
    status: 'active',
  }).returning('*');

  // Insert principal user
  const principalUser = await knex('users').insert({
    email: 'principal@school.com',
    password_hash: hashedPassword,
    first_name: 'Principal',
    last_name: 'User',
    role: 'principal',
    status: 'active',
  }).returning('*');

  // Insert teacher users
  const teacherUsers = await knex('users').insert([
    {
      email: 'teacher1@school.com',
      password_hash: hashedPassword,
      first_name: 'John',
      last_name: 'Doe',
      role: 'teacher',
      status: 'active',
    },
    {
      email: 'teacher2@school.com',
      password_hash: hashedPassword,
      first_name: 'Jane',
      last_name: 'Smith',
      role: 'teacher',
      status: 'active',
    },
  ]).returning('*');

  // Insert student users
  const studentUsers = await knex('users').insert([
    {
      email: 'student1@school.com',
      password_hash: hashedPassword,
      first_name: 'Alice',
      last_name: 'Johnson',
      role: 'student',
      status: 'active',
    },
    {
      email: 'student2@school.com',
      password_hash: hashedPassword,
      first_name: 'Bob',
      last_name: 'Williams',
      role: 'student',
      status: 'active',
    },
  ]).returning('*');

  // Insert parent user
  const parentUser = await knex('users').insert({
    email: 'parent@school.com',
    password_hash: hashedPassword,
    first_name: 'Parent',
    last_name: 'User',
    role: 'parent',
    status: 'active',
  }).returning('*');

  // Insert accountant user
  const accountantUser = await knex('users').insert({
    email: 'accountant@school.com',
    password_hash: hashedPassword,
    first_name: 'Accountant',
    last_name: 'User',
    role: 'accountant',
    status: 'active',
  }).returning('*');

  // Insert admissions officer user
  const admissionsUser = await knex('users').insert({
    email: 'admissions@school.com',
    password_hash: hashedPassword,
    first_name: 'Admissions',
    last_name: 'Officer',
    role: 'admissions_officer',
    status: 'active',
  }).returning('*');

  // Insert teachers
  const teachers = await knex('teachers').insert([
    {
      user_id: teacherUsers[0].id,
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
      user_id: teacherUsers[1].id,
      teacher_id: 'TCH-2024-002',
      qualifications: 'B.A English, M.Ed',
      experience_years: 3,
      specialization: 'English',
      phone: '+1234567891',
      office_location: 'Room 102',
      status: 'active',
      hire_date: '2021-04-01',
    },
  ]).returning('*');

  // Insert students
  const students = await knex('students').insert([
    {
      user_id: studentUsers[0].id,
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
      user_id: studentUsers[1].id,
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
  ]).returning('*');

  // Insert subjects
  const subjects = await knex('subjects').insert([
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

  // Insert classes
  const classes = await knex('classes').insert([
    {
      name: '10-A',
      level: '10',
      capacity: 40,
      academic_session_id: sessions[0].id,
      class_teacher_id: teachers[0].id,
      room_number: '101',
    },
    {
      name: '10-B',
      level: '10',
      capacity: 40,
      academic_session_id: sessions[0].id,
      class_teacher_id: teachers[1].id,
      room_number: '102',
    },
  ]).returning('*');

  // Insert class subjects
  await knex('class_subjects').insert([
    { class_id: classes[0].id, subject_id: subjects[0].id },
    { class_id: classes[0].id, subject_id: subjects[1].id },
    { class_id: classes[0].id, subject_id: subjects[2].id },
    { class_id: classes[1].id, subject_id: subjects[0].id },
    { class_id: classes[1].id, subject_id: subjects[1].id },
    { class_id: classes[1].id, subject_id: subjects[2].id },
  ]);

  // Insert teacher assignments
  await knex('teacher_assignments').insert([
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
  ]);

  // Insert enrollments
  await knex('enrollments').insert([
    {
      student_id: students[0].id,
      class_id: classes[0].id,
      academic_session_id: sessions[0].id,
      enrollment_date: '2024-04-01',
      status: 'active',
    },
    {
      student_id: students[1].id,
      class_id: classes[0].id,
      academic_session_id: sessions[0].id,
      enrollment_date: '2024-04-01',
      status: 'active',
    },
  ]);

  // Insert fee types
  const feeTypes = await knex('fee_types').insert([
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

  // Insert fees
  await knex('fees').insert([
    {
      student_id: students[0].id,
      fee_type_id: feeTypes[0].id,
      amount: 5000,
      due_date: '2024-05-01',
      status: 'pending',
      academic_session_id: sessions[0].id,
    },
    {
      student_id: students[1].id,
      fee_type_id: feeTypes[0].id,
      amount: 5000,
      due_date: '2024-05-01',
      status: 'pending',
      academic_session_id: sessions[0].id,
    },
  ]);

  console.log('Seed data inserted successfully');
}
