import type { Knex } from 'knex';

/**
 * Migration: Phase 1.3 - Admissions Enhancement
 * 
 * Adds comprehensive admissions workflow tables
 */

export async function up(knex: Knex): Promise<void> {
  console.log('Starting Phase 1.3: Admissions Enhancement Migration');

  // 1. admission_applications table
  await knex.schema.createTable('admission_applications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('application_number').unique().notNullable();
    
    // Applicant information
    table.string('first_name').notNullable();
    table.string('last_name').notNullable();
    table.date('date_of_birth');
    table.string('gender');
    table.string('email');
    table.string('phone_number');
    
    // Parent/Guardian info
    table.string('parent_name');
    table.string('parent_email');
    table.string('parent_phone').notNullable();
    table.text('address');
    
    // Application details
    table.uuid('grade_id').references('id').inTable('classes').onDelete('SET NULL');
    table.string('academic_year');
    table.enum('status', [
      'submitted',
      'under_review',
      'interview_scheduled',
      'interviewed',
      'accepted',
      'rejected',
      'waitlist',
      'enrolled'
    ]).defaultTo('submitted');
    
    table.enum('application_source', ['online', 'walk_in', 'referral', 'agent', 'other']);
    table.string('referral_source');
    
    // Assignment and tracking
    table.uuid('assigned_to').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('application_date').defaultTo(knex.fn.now());
    table.timestamp('decision_date');
    table.text('decision_notes');
    table.integer('application_score');
    
    // Timestamps
    table.timestamps(true, true);
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.uuid('updated_by').references('id').inTable('users').onDelete('SET NULL');
  });

  console.log('✓ Created admission_applications table');

  // 2. application_documents table
  await knex.schema.createTable('application_documents', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('application_id').references('id').inTable('admission_applications').onDelete('CASCADE');
    
    table.enum('document_type', [
      'birth_certificate',
      'report_card',
      'transfer_certificate',
      'medical_certificate',
      'parent_id',
      'photo',
      'proof_of_residence',
      'other'
    ]).notNullable();
    
    table.string('file_name');
    table.string('file_path');
    table.string('file_size');
    table.string('mime_type');
    
    table.enum('verification_status', ['pending', 'verified', 'rejected']).defaultTo('pending');
    table.uuid('verified_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('verified_at');
    table.text('verification_notes');
    
    table.timestamps(true, true);
    table.uuid('uploaded_by').references('id').inTable('users').onDelete('SET NULL');
  });

  console.log('✓ Created application_documents table');

  // 3. application_interviews table
  await knex.schema.createTable('application_interviews', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('application_id').references('id').inTable('admission_applications').onDelete('CASCADE');
    
    table.timestamp('interview_date').notNullable();
    table.string('interview_time');
    table.string('interview_location');
    table.enum('interview_mode', ['in_person', 'video_call', 'phone']).defaultTo('in_person');
    table.string('interview_link');
    
    table.uuid('interviewer_id').references('id').inTable('users').onDelete('SET NULL');
    table.text('interview_notes');
    table.integer('interview_score');
    table.enum('recommendation', ['strongly_recommend', 'recommend', 'neutral', 'not_recommend']);
    
    table.enum('status', ['scheduled', 'completed', 'cancelled', 'rescheduled']).defaultTo('scheduled');
    table.timestamp('completed_at');
    
    table.timestamps(true, true);
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
  });

  console.log('✓ Created application_interviews table');

  // 4. admission_requirements table
  await knex.schema.createTable('admission_requirements', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('grade_id').references('id').inTable('classes').onDelete('CASCADE');
    
    table.integer('min_age');
    table.integer('max_age');
    table.jsonb('required_documents').defaultTo('[]');
    table.text('prerequisites');
    table.text('special_requirements');
    table.boolean('interview_required').defaultTo(true);
    table.integer('application_fee');
    
    table.timestamps(true, true);
  });

  console.log('✓ Created admission_requirements table');

  // 5. application_timeline table
  await knex.schema.createTable('application_timeline', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('application_id').references('id').inTable('admission_applications').onDelete('CASCADE');
    
    table.string('status_from');
    table.string('status_to').notNullable();
    table.text('notes');
    table.uuid('changed_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('changed_at').defaultTo(knex.fn.now());
  });

  console.log('✓ Created application_timeline table');

  // Create indexes for performance
  await knex.schema.alterTable('admission_applications', (table) => {
    table.index('status');
    table.index('assigned_to');
    table.index('application_date');
    table.index('grade_id');
  });

  await knex.schema.alterTable('application_documents', (table) => {
    table.index('application_id');
    table.index('verification_status');
  });

  await knex.schema.alterTable('application_interviews', (table) => {
    table.index('application_id');
    table.index('interview_date');
    table.index('interviewer_id');
  });

  console.log('✓ Created indexes');
  console.log('Phase 1.3 Migration Completed Successfully!');
}

export async function down(knex: Knex): Promise<void> {
  console.log('Rolling back Phase 1.3: Admissions Enhancement Migration');

  await knex.schema.dropTableIfExists('application_timeline');
  await knex.schema.dropTableIfExists('admission_requirements');
  await knex.schema.dropTableIfExists('application_interviews');
  await knex.schema.dropTableIfExists('application_documents');
  await knex.schema.dropTableIfExists('admission_applications');

  console.log('Phase 1.3 Rollback Completed');
}
