import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create users table
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email', 255).unique().notNullable();
    table.string('password_hash', 255).notNullable();
    table.string('first_name', 100).notNullable();
    table.string('last_name', 100).notNullable();
    table.string('role', 50).notNullable(); // admin, principal, teacher, student, parent, accountant, admissions_officer
    table.string('status', 50).defaultTo('active'); // active, inactive, suspended
    table.timestamp('last_login');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.uuid('created_by').references('id').inTable('users');
    table.uuid('updated_by').references('id').inTable('users');
    
    table.index('email');
    table.index('role');
    table.index('status');
  });

  // Create academic_sessions table
  await knex.schema.createTable('academic_sessions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable();
    table.date('start_date').notNullable();
    table.date('end_date').notNullable();
    table.boolean('is_active').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index('is_active');
  });

  // Create students table
  await knex.schema.createTable('students', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').unique().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('student_id', 50).unique().notNullable();
    table.date('date_of_birth').notNullable();
    table.string('gender', 20);
    table.string('phone', 20);
    table.text('address');
    table.string('city', 100);
    table.string('state', 100);
    table.string('postal_code', 20);
    table.string('country', 100);
    table.string('status', 50).defaultTo('active');
    table.date('enrollment_date');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index('student_id');
    table.index('status');
    table.index('user_id');
  });

  // Create teachers table
  await knex.schema.createTable('teachers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').unique().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('teacher_id', 50).unique().notNullable();
    table.text('qualifications');
    table.integer('experience_years');
    table.string('specialization', 100);
    table.string('phone', 20);
    table.string('office_location', 100);
    table.string('status', 50).defaultTo('active');
    table.date('hire_date');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index('teacher_id');
    table.index('status');
    table.index('user_id');
  });

  // Create subjects table
  await knex.schema.createTable('subjects', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('code', 50).unique().notNullable();
    table.string('name', 100).notNullable();
    table.text('description');
    table.integer('credits');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index('code');
  });

  // Create classes table
  await knex.schema.createTable('classes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable();
    table.string('level', 50).notNullable();
    table.integer('capacity').notNullable();
    table.uuid('academic_session_id').notNullable().references('id').inTable('academic_sessions');
    table.uuid('class_teacher_id').references('id').inTable('teachers');
    table.string('room_number', 50);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index('academic_session_id');
    table.index('level');
  });

  // Create class_subjects table
  await knex.schema.createTable('class_subjects', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('class_id').notNullable().references('id').inTable('classes').onDelete('CASCADE');
    table.uuid('subject_id').notNullable().references('id').inTable('subjects').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.unique(['class_id', 'subject_id']);
    table.index('class_id');
    table.index('subject_id');
  });

  // Create teacher_assignments table
  await knex.schema.createTable('teacher_assignments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('teacher_id').notNullable().references('id').inTable('teachers').onDelete('CASCADE');
    table.uuid('subject_id').notNullable().references('id').inTable('subjects');
    table.uuid('class_id').notNullable().references('id').inTable('classes');
    table.date('start_date').notNullable();
    table.date('end_date');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index('teacher_id');
    table.index('class_id');
  });

  // Create enrollments table
  await knex.schema.createTable('enrollments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
    table.uuid('class_id').notNullable().references('id').inTable('classes');
    table.uuid('academic_session_id').notNullable().references('id').inTable('academic_sessions');
    table.date('enrollment_date').notNullable();
    table.string('status', 50).defaultTo('active');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.unique(['student_id', 'class_id', 'academic_session_id']);
    table.index('student_id');
    table.index('class_id');
    table.index('status');
  });

  // Create grades table
  await knex.schema.createTable('grades', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
    table.uuid('subject_id').notNullable().references('id').inTable('subjects');
    table.uuid('teacher_id').notNullable().references('id').inTable('teachers');
    table.decimal('grade_value', 5, 2).notNullable();
    table.string('grade_letter', 2);
    table.date('exam_date').notNullable();
    table.string('status', 50).defaultTo('draft');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index('student_id');
    table.index('subject_id');
    table.index('status');
  });

  // Create attendance table
  await knex.schema.createTable('attendance', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
    table.uuid('class_id').notNullable().references('id').inTable('classes');
    table.date('attendance_date').notNullable();
    table.string('status', 50).notNullable();
    table.uuid('marked_by').references('id').inTable('teachers');
    table.text('remarks');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index('student_id');
    table.index('class_id');
    table.index('attendance_date');
    table.index('status');
  });

  // Create schedules table
  await knex.schema.createTable('schedules', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('class_id').notNullable().references('id').inTable('classes');
    table.uuid('subject_id').notNullable().references('id').inTable('subjects');
    table.uuid('teacher_id').notNullable().references('id').inTable('teachers');
    table.string('day_of_week', 20).notNullable();
    table.time('start_time').notNullable();
    table.time('end_time').notNullable();
    table.string('room_number', 50);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index('class_id');
    table.index('teacher_id');
  });

  // Create fee_types table
  await knex.schema.createTable('fee_types', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable();
    table.text('description');
    table.decimal('amount', 10, 2).notNullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index('is_active');
  });

  // Create fees table
  await knex.schema.createTable('fees', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
    table.uuid('fee_type_id').notNullable().references('id').inTable('fee_types');
    table.decimal('amount', 10, 2).notNullable();
    table.date('due_date').notNullable();
    table.string('status', 50).defaultTo('pending');
    table.uuid('academic_session_id').references('id').inTable('academic_sessions');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index('student_id');
    table.index('status');
    table.index('due_date');
  });

  // Create payments table
  await knex.schema.createTable('payments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
    table.decimal('amount', 10, 2).notNullable();
    table.date('payment_date').notNullable();
    table.string('payment_method', 50).notNullable();
    table.string('reference_number', 100);
    table.string('status', 50).defaultTo('completed');
    table.uuid('recorded_by').references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index('student_id');
    table.index('payment_date');
    table.index('status');
  });

  // Create audit_logs table
  await knex.schema.createTable('audit_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users');
    table.string('action', 100).notNullable();
    table.string('entity_type', 100).notNullable();
    table.uuid('entity_id');
    table.jsonb('changes');
    table.string('ip_address', 45);
    table.text('user_agent');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index('user_id');
    table.index('entity_type');
    table.index('created_at');
  });

  // Create notifications table
  await knex.schema.createTable('notifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('type', 50).notNullable();
    table.string('subject', 255);
    table.text('message').notNullable();
    table.string('status', 50).defaultTo('pending');
    table.timestamp('sent_at');
    table.timestamp('read_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index('user_id');
    table.index('status');
  });
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order of creation
  await knex.schema.dropTableIfExists('notifications');
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('payments');
  await knex.schema.dropTableIfExists('fees');
  await knex.schema.dropTableIfExists('fee_types');
  await knex.schema.dropTableIfExists('schedules');
  await knex.schema.dropTableIfExists('attendance');
  await knex.schema.dropTableIfExists('grades');
  await knex.schema.dropTableIfExists('enrollments');
  await knex.schema.dropTableIfExists('teacher_assignments');
  await knex.schema.dropTableIfExists('class_subjects');
  await knex.schema.dropTableIfExists('classes');
  await knex.schema.dropTableIfExists('subjects');
  await knex.schema.dropTableIfExists('teachers');
  await knex.schema.dropTableIfExists('students');
  await knex.schema.dropTableIfExists('academic_sessions');
  await knex.schema.dropTableIfExists('users');
}
