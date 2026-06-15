import type { Knex } from 'knex';
import bcryptjs from 'bcryptjs';

export async function seed(knex: Knex): Promise<void> {
  // Delete existing entries in correct order (foreign keys first)
  await knex('role_permissions').del();
  await knex('permissions').del();
  await knex('roles').del();
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
  await knex('refresh_tokens').del();
  await knex('password_resets').del();
  await knex('users').del();

  // Hash password for demo users
  const hashedPassword = await bcryptjs.hash('password123', 10);

  // ===== TENANT SETUP =====
  // Create a default tenant first (required for academic_sessions)
  // Check if tenant already exists
  let tenant = await knex('tenants').where({ slug: 'demo-school' }).first();
  
  if (!tenant) {
    const newTenant = await knex('tenants').insert({
      name: 'Demo School',
      slug: 'demo-school',
      domain: 'demo.school.local',
      status: 'active',
    }).returning('*');
    tenant = newTenant[0];
  }

  const tenantId = tenant.id;

  // ===== RBAC SETUP =====

  // Create predefined permissions
  const permissions = await knex('permissions').insert([
    // User management
    { name: 'user:create', resource: 'users', action: 'create' },
    { name: 'user:read', resource: 'users', action: 'read' },
    { name: 'user:update', resource: 'users', action: 'update' },
    { name: 'user:delete', resource: 'users', action: 'delete' },

    // Student management
    { name: 'student:create', resource: 'students', action: 'create' },
    { name: 'student:read', resource: 'students', action: 'read' },
    { name: 'student:update', resource: 'students', action: 'update' },
    { name: 'student:delete', resource: 'students', action: 'delete' },
    { name: 'student:suspend', resource: 'students', action: 'suspend' },
    { name: 'student:expel', resource: 'students', action: 'expel' },
    { name: 'student:transfer', resource: 'students', action: 'transfer' },
    { name: 'student:promote', resource: 'students', action: 'promote' },
    { name: 'student:admit', resource: 'students', action: 'admit' },

    // Grade management
    { name: 'grade:create', resource: 'grades', action: 'create' },
    { name: 'grade:read', resource: 'grades', action: 'read' },
    { name: 'grade:update', resource: 'grades', action: 'update' },
    { name: 'grade:delete', resource: 'grades', action: 'delete' },

    // Attendance management
    { name: 'attendance:create', resource: 'attendance', action: 'create' },
    { name: 'attendance:read', resource: 'attendance', action: 'read' },
    { name: 'attendance:update', resource: 'attendance', action: 'update' },
    { name: 'attendance:delete', resource: 'attendance', action: 'delete' },

    // Class management
    { name: 'class:create', resource: 'classes', action: 'create' },
    { name: 'class:read', resource: 'classes', action: 'read' },
    { name: 'class:update', resource: 'classes', action: 'update' },
    { name: 'class:delete', resource: 'classes', action: 'delete' },
    { name: 'class:assign_teacher', resource: 'classes', action: 'assign_teacher' },
    { name: 'class:assign_student', resource: 'classes', action: 'assign_student' },

    // Subject management
    { name: 'subject:create', resource: 'subjects', action: 'create' },
    { name: 'subject:read', resource: 'subjects', action: 'read' },
    { name: 'subject:update', resource: 'subjects', action: 'update' },
    { name: 'subject:delete', resource: 'subjects', action: 'delete' },
    { name: 'subject:assign_teacher', resource: 'subjects', action: 'assign_teacher' },

    // Timetable management
    { name: 'timetable:create', resource: 'timetables', action: 'create' },
    { name: 'timetable:read', resource: 'timetables', action: 'read' },
    { name: 'timetable:update', resource: 'timetables', action: 'update' },
    { name: 'timetable:approve', resource: 'timetables', action: 'approve' },
    { name: 'timetable:delete', resource: 'timetables', action: 'delete' },

    // Staff management (teachers & non-teaching)
    { name: 'staff:create', resource: 'staff', action: 'create' },
    { name: 'staff:read', resource: 'staff', action: 'read' },
    { name: 'staff:update', resource: 'staff', action: 'update' },
    { name: 'staff:delete', resource: 'staff', action: 'delete' },
    { name: 'staff:assign', resource: 'staff', action: 'assign' },
    { name: 'staff:approve_leave', resource: 'staff', action: 'approve_leave' },
    { name: 'staff:evaluate', resource: 'staff', action: 'evaluate' },

    // Examination management
    { name: 'exam:create', resource: 'exams', action: 'create' },
    { name: 'exam:read', resource: 'exams', action: 'read' },
    { name: 'exam:update', resource: 'exams', action: 'update' },
    { name: 'exam:approve', resource: 'exams', action: 'approve' },
    { name: 'exam:lock_results', resource: 'exams', action: 'lock_results' },
    { name: 'exam:publish_results', resource: 'exams', action: 'publish_results' },
    { name: 'exam:publish_report_cards', resource: 'exams', action: 'publish_report_cards' },

    // Communication
    { name: 'announcement:create', resource: 'announcements', action: 'create' },
    { name: 'announcement:read', resource: 'announcements', action: 'read' },
    { name: 'announcement:update', resource: 'announcements', action: 'update' },
    { name: 'announcement:delete', resource: 'announcements', action: 'delete' },
    { name: 'message:send', resource: 'messages', action: 'send' },
    { name: 'message:read', resource: 'messages', action: 'read' },

    // Fee management
    { name: 'fee:create', resource: 'fees', action: 'create' },
    { name: 'fee:read', resource: 'fees', action: 'read' },
    { name: 'fee:update', resource: 'fees', action: 'update' },
    { name: 'fee:delete', resource: 'fees', action: 'delete' },
    { name: 'fee:approve_structure', resource: 'fees', action: 'approve_structure' },
    { name: 'payment:create', resource: 'payments', action: 'create' },
    { name: 'payment:read', resource: 'payments', action: 'read' },

    // Budget
    { name: 'budget:read', resource: 'budget', action: 'read' },
    { name: 'budget:approve', resource: 'budget', action: 'approve' },

    // Report management
    { name: 'report:create', resource: 'reports', action: 'create' },
    { name: 'report:read', resource: 'reports', action: 'read' },

    // RBAC management
    { name: 'role:create', resource: 'roles', action: 'create' },
    { name: 'role:read', resource: 'roles', action: 'read' },
    { name: 'role:update', resource: 'roles', action: 'update' },
    { name: 'role:delete', resource: 'roles', action: 'delete' },
    { name: 'permission:read', resource: 'permissions', action: 'read' },
  ]).returning('*');

  // Create permission map for easier reference
  const permMap: { [key: string]: string } = {};
  permissions.forEach((p: any) => {
    permMap[p.name] = p.id;
  });

  // Create predefined roles
  const roles = await knex('roles').insert([
    {
      name: 'admin',
      description: 'System Administrator - Full access to all features',
      is_predefined: true,
    },
    {
      name: 'principal',
      description: 'School Principal - Academic management and oversight',
      is_predefined: true,
    },
    {
      name: 'teacher',
      description: 'Teacher - Grade entry and attendance marking',
      is_predefined: true,
    },
    {
      name: 'student',
      description: 'Student - View own grades, attendance, and schedule',
      is_predefined: true,
    },
    {
      name: 'parent',
      description: 'Parent/Guardian - View child academic information',
      is_predefined: true,
    },
    {
      name: 'accountant',
      description: 'Accountant - Fee and payment management',
      is_predefined: true,
    },
    {
      name: 'admissions_officer',
      description: 'Admissions Officer - Student enrollment management',
      is_predefined: true,
    },
  ]).returning('*');

  // Create role map for easier reference
  const roleMap: { [key: string]: string } = {};
  roles.forEach((r: any) => {
    roleMap[r.name] = r.id;
  });

  // Assign permissions to Principal role (all permissions including admin-level access)
  const principalPerms = permissions.map((p: any) => ({
    role_id: roleMap.principal,
    permission_id: p.id,
    created_at: new Date(),
  }));
  await knex('role_permissions').insert(principalPerms);

  // Assign permissions to Principal role (Head of School - full academic authority)
  const principalPerms = [
    // User management (read + create + update; no delete — that's admin)
    'user:read', 'user:update', 'user:create',
    // Student management (full authority including discipline)
    'student:read', 'student:update', 'student:create',
    'student:suspend', 'student:expel', 'student:transfer',
    'student:promote', 'student:admit',
    // Class management
    'class:read', 'class:create', 'class:update', 'class:delete',
    'class:assign_teacher', 'class:assign_student',
    // Subject management
    'subject:read', 'subject:create', 'subject:update', 'subject:delete',
    'subject:assign_teacher',
    // Timetable management
    'timetable:read', 'timetable:create', 'timetable:update',
    'timetable:approve', 'timetable:delete',
    // Staff management
    'staff:read', 'staff:create', 'staff:update',
    'staff:assign', 'staff:approve_leave', 'staff:evaluate',
    // Grades
    'grade:read', 'grade:update', 'grade:create',
    // Attendance
    'attendance:read', 'attendance:update', 'attendance:create',
    // Examination management
    'exam:read', 'exam:create', 'exam:update', 'exam:approve',
    'exam:lock_results', 'exam:publish_results', 'exam:publish_report_cards',
    // Communication
    'announcement:read', 'announcement:create', 'announcement:update', 'announcement:delete',
    'message:send', 'message:read',
    // Financial oversight (read + approve; no create/delete — that's accountant/admin)
    'fee:read', 'fee:approve_structure',
    'payment:read',
    'budget:read', 'budget:approve',
    // Reports
    'report:read', 'report:create',
    // RBAC (read only)
    'role:read', 'permission:read',
  ].map((pname) => ({
    role_id: roleMap.principal,
    permission_id: permMap[pname],
    created_at: new Date(),
  }));
  await knex('role_permissions').insert(principalPerms);

  // Assign permissions to Teacher role
  const teacherPerms = [
    'student:read',
    'grade:create', 'grade:read', 'grade:update',
    'attendance:create', 'attendance:read', 'attendance:update',
    'class:read',
  ].map((pname) => ({
    role_id: roleMap.teacher,
    permission_id: permMap[pname],
    created_at: new Date(),
  }));
  await knex('role_permissions').insert(teacherPerms);

  // Assign permissions to Student role
  const studentPerms = [
    'student:read',
    'grade:read',
    'attendance:read',
    'class:read',
    'fee:read',
  ].map((pname) => ({
    role_id: roleMap.student,
    permission_id: permMap[pname],
    created_at: new Date(),
  }));
  await knex('role_permissions').insert(studentPerms);

  // Assign permissions to Parent role
  const parentPerms = [
    'student:read',
    'grade:read',
    'attendance:read',
    'class:read',
    'fee:read',
  ].map((pname) => ({
    role_id: roleMap.parent,
    permission_id: permMap[pname],
    created_at: new Date(),
  }));
  await knex('role_permissions').insert(parentPerms);

  // Assign permissions to Accountant role
  const accountantPerms = [
    'fee:read', 'fee:create', 'fee:update',
    'payment:read', 'payment:create',
    'student:read',
    'report:read', 'report:create',
  ].map((pname) => ({
    role_id: roleMap.accountant,
    permission_id: permMap[pname],
    created_at: new Date(),
  }));
  await knex('role_permissions').insert(accountantPerms);

  // Assign permissions to Admissions Officer role
  const admissionsPerms = [
    'student:create', 'student:read', 'student:update',
    'class:read',
    'report:read',
  ].map((pname) => ({
    role_id: roleMap.admissions_officer,
    permission_id: permMap[pname],
    created_at: new Date(),
  }));
  await knex('role_permissions').insert(admissionsPerms);

  // ===== USER SETUP =====

  // Insert academic sessions
  const sessions = await knex('academic_sessions').insert([
    {
      tenant_id: tenantId,
      name: '2024-2025',
      start_date: '2024-04-01',
      end_date: '2025-03-31',
      is_active: true,
    },
    {
      tenant_id: tenantId,
      name: '2023-2024',
      start_date: '2023-04-01',
      end_date: '2024-03-31',
      is_active: false,
    },
  ]).returning('*');

  // Insert admin user
  const principalAdminUser = await knex('users').insert({
    tenant_id: tenantId,
    email: 'admin@school.com',
    password_hash: hashedPassword,
    first_name: 'Principal',
    last_name: 'Admin',
    role: 'principal',
    status: 'active',
  }).returning('*');

  // Insert another principal user for testing
  const principalUser = await knex('users').insert({
    tenant_id: tenantId,
    email: 'principal@school.com',
    password_hash: hashedPassword,
    first_name: 'School',
    last_name: 'Principal',
    role: 'principal',
    status: 'active',
  }).returning('*');

  // Insert teacher users
  const teacherUsers = await knex('users').insert([
    {
      tenant_id: tenantId,
      email: 'teacher1@school.com',
      password_hash: hashedPassword,
      first_name: 'John',
      last_name: 'Doe',
      role: 'teacher',
      status: 'active',
    },
    {
      tenant_id: tenantId,
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
      tenant_id: tenantId,
      email: 'student1@school.com',
      password_hash: hashedPassword,
      first_name: 'Alice',
      last_name: 'Johnson',
      role: 'student',
      status: 'active',
    },
    {
      tenant_id: tenantId,
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
    tenant_id: tenantId,
    email: 'parent@school.com',
    password_hash: hashedPassword,
    first_name: 'Parent',
    last_name: 'User',
    role: 'parent',
    status: 'active',
  }).returning('*');

  // Insert accountant user
  const accountantUser = await knex('users').insert({
    tenant_id: tenantId,
    email: 'accountant@school.com',
    password_hash: hashedPassword,
    first_name: 'Accountant',
    last_name: 'User',
    role: 'accountant',
    status: 'active',
  }).returning('*');

  // Insert admissions officer user
  const admissionsUser = await knex('users').insert({
    tenant_id: tenantId,
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

  console.log('Seed data inserted successfully with RBAC setup');
}
