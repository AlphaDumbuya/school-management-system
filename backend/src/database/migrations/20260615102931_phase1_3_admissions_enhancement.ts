import type { Knex } from "knex";

/**
 * Migration: Phase 1.3 - Admissions Enhancement
 * 
 * Creates comprehensive admissions workflow tables:
 * - admission_applications: Track student applications
 * - application_documents: Manage application documents  
 * - application_interviews: Schedule and track interviews
 * - admission_requirements: Configurable admission criteria
 * - application_timeline: Status change history
 */

export async function up(knex: Knex): Promise<void> {
  console.log('Starting migration: Phase 1.3 - Admissions Enhancement');

  // 1. Create admission_applications table
  await knex.schema.createTable('admission_applications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('application_id').unique().notNullable(); // APP-2026-00001 format
    
    // Applicant Information
    table.string('first_name').notNullable();
    table.string('last_name').notNullable();
    table.date('date_of_birth').notNullable();
    table.enum('gender', ['male', 'female', 'other']);
    table.string('email');
    table.string('phone_number');
    table.text('address');
    table.string('city');
    table.string('state');
    table.string('postal_code');
    table.string('country').defaultTo('Nigeria');
    
    // Application Details
    table.string('applying_for_grade').notNullable(); // e.g., 'Grade 1', 'JSS 1'
    table.string('previous_school');
    table.string('previous_grade');
    table.text('special_needs');
    table.text('medical_conditions');
    
    // Parent/Guardian Information
    table.string('parent_name').notNullable();
    table.string('parent_email').notNullable();
    table.string('parent_phone').notNullable();
    table.string('parent_relationship').notNullable(); // father, mother, guardian
    table.text('parent_address');
    table.string('parent_occupation');
    
    // Application Status
    table.enum('status', [
      'submitted',
      'under_review',
      'interview_scheduled',
      'interviewed',
      'accepted',
      'rejected',
      'waitlist',
      'enrolled',
      'withdrawn'
    ]).defaultTo('submitted');
    
    // Processing
    table.uuid('assigned_to'); // Admissions officer
    table.foreign('assigned_to').references('id').inTable('users').onDelete('SET NULL');
    table.date('application_date').defaultTo(knex.fn.now());
    table.date('decision_date');
    table.text('decision_notes');
    table.text('reviewer_notes');
    table.integer('application_score'); // 0-100 score
    
    // Application Source
    table.string('application_source'); // website, referral, walk-in, agent
    table.string('referral_source'); // specific person/organization if referred
    
    // Metadata
    table.uuid('created_by');
    table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.uuid('updated_by');
    table.foreign('updated_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
    
    // Indexes
    table.index('status');
    table.index('application_date');
    table.index('assigned_to');
    table.index(['applying_for_grade', 'status']);
  });
  
  console.log('✓ Created admission_applications table');

  // 2. Create application_documents table
  await knex.schema.createTable('application_documents', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('application_id').notNullable();
    table.foreign('application_id').references('id').inTable('admission_applications').onDelete('CASCADE');
    
    // Document Info
    table.enum('document_type', [
      'birth_certificate',
      'previous_report_card',
      'transfer_certificate',
      'medical_certificate',
      'parent_id',
      'passport_photo',
      'proof_of_residence',
      'immunization_record',
      'other'
    ]).notNullable();
    
    table.string('file_name').notNullable();
    table.string('file_path').notNullable();
    table.string('file_type'); // mime type
    table.integer('file_size'); // in bytes
    table.text('description');
    
    // Verification
    table.enum('verification_status', ['pending', 'verified', 'rejected']).defaultTo('pending');
    table.uuid('verified_by');
    table.foreign('verified_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('verified_at');
    table.text('verification_notes');
    
    // Metadata
    table.uuid('uploaded_by').notNullable();
    table.foreign('uploaded_by').references('id').inTable('users').onDelete('CASCADE');
    table.timestamps(true, true);
    
    // Indexes
    table.index('application_id');
    table.index('document_type');
    table.index('verification_status');
  });
  
  console.log('✓ Created application_documents table');

  // 3. Create application_interviews table
  await knex.schema.createTable('application_interviews', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('application_id').notNullable().unique();
    table.foreign('application_id').references('id').inTable('admission_applications').onDelete('CASCADE');
    
    // Interview Details
    table.timestamp('scheduled_date').notNullable();
    table.integer('duration_minutes').defaultTo(30);
    table.string('location'); // Room 201, Online (Zoom), etc.
    table.string('meeting_link'); // For virtual interviews
    table.enum('interview_type', ['in_person', 'virtual', 'phone']).defaultTo('in_person');
    
    // Interviewers
    table.uuid('primary_interviewer').notNullable();
    table.foreign('primary_interviewer').references('id').inTable('users').onDelete('CASCADE');
    table.specificType('additional_interviewers', 'uuid[]'); // Array of user IDs
    
    // Interview Results
    table.enum('status', ['scheduled', 'completed', 'cancelled', 'no_show']).defaultTo('scheduled');
    table.text('interview_notes');
    table.integer('interview_score'); // 0-100
    table.enum('recommendation', ['highly_recommend', 'recommend', 'neutral', 'not_recommend']).defaultTo('neutral');
    table.text('strengths');
    table.text('concerns');
    
    // Notifications
    table.boolean('reminder_sent').defaultTo(false);
    table.timestamp('reminder_sent_at');
    
    // Metadata
    table.uuid('scheduled_by').notNullable();
    table.foreign('scheduled_by').references('id').inTable('users').onDelete('CASCADE');
    table.uuid('updated_by');
    table.foreign('updated_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
    
    // Indexes
    table.index('scheduled_date');
    table.index('primary_interviewer');
    table.index('status');
  });
  
  console.log('✓ Created application_interviews table');

  // 4. Create admission_requirements table
  await knex.schema.createTable('admission_requirements', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    
    // Grade/Class Level
    table.string('grade_level').notNullable().unique(); // 'Grade 1', 'JSS 1', etc.
    table.integer('min_age_years');
    table.integer('max_age_years');
    
    // Required Documents (JSON array of document types)
    table.jsonb('required_documents').notNullable().defaultTo('[]');
    // Example: ["birth_certificate", "previous_report_card", "passport_photo"]
    
    // Academic Requirements
    table.decimal('min_grade_average'); // Previous school average (if applicable)
    table.text('academic_prerequisites');
    
    // Other Requirements
    table.text('special_requirements');
    table.boolean('interview_required').defaultTo(true);
    table.boolean('entrance_exam_required').defaultTo(false);
    
    // Capacity
    table.integer('available_slots');
    table.integer('waitlist_slots').defaultTo(0);
    
    // Application Period
    table.date('application_start_date');
    table.date('application_end_date');
    
    // Fees
    table.decimal('application_fee', 10, 2).defaultTo(0);
    
    // Status
    table.boolean('is_active').defaultTo(true);
    
    // Metadata
    table.uuid('created_by');
    table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.uuid('updated_by');
    table.foreign('updated_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
    
    // Index
    table.index('grade_level');
    table.index('is_active');
  });
  
  console.log('✓ Created admission_requirements table');

  // 5. Create application_timeline table (audit trail)
  await knex.schema.createTable('application_timeline', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('application_id').notNullable();
    table.foreign('application_id').references('id').inTable('admission_applications').onDelete('CASCADE');
    
    // Event Details
    table.string('event_type').notNullable(); // status_change, document_uploaded, interview_scheduled, etc.
    table.string('from_status');
    table.string('to_status');
    table.text('description').notNullable();
    table.jsonb('metadata'); // Additional data about the event
    
    // Actor
    table.uuid('performed_by');
    table.foreign('performed_by').references('id').inTable('users').onDelete('SET NULL');
    table.string('performed_by_name'); // Store name in case user is deleted
    
    // Timestamp
    table.timestamp('occurred_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index('application_id');
    table.index('event_type');
    table.index('occurred_at');
  });
  
  console.log('✓ Created application_timeline table');

  console.log('Migration completed successfully: Phase 1.3 - Admissions Enhancement');
}

export async function down(knex: Knex): Promise<void> {
  console.log('Rolling back migration: Phase 1.3 - Admissions Enhancement');
  
  // Drop tables in reverse order (respecting foreign key constraints)
  await knex.schema.dropTableIfExists('application_timeline');
  console.log('✓ Dropped application_timeline table');
  
  await knex.schema.dropTableIfExists('admission_requirements');
  console.log('✓ Dropped admission_requirements table');
  
  await knex.schema.dropTableIfExists('application_interviews');
  console.log('✓ Dropped application_interviews table');
  
  await knex.schema.dropTableIfExists('application_documents');
  console.log('✓ Dropped application_documents table');
  
  await knex.schema.dropTableIfExists('admission_applications');
  console.log('✓ Dropped admission_applications table');
  
  console.log('Rollback completed: Phase 1.3 - Admissions Enhancement');
}

