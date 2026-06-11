import type { Knex } from 'knex';

/**
 * Phase 4 Migration: Student Enrollment Workflows
 * Creates tables for:
 * - Enrollment requests (workflow)
 * - Bulk import tracking
 * - Audit trails for student records
 * - Import history
 */

export async function up(knex: Knex): Promise<void> {
  // Create enrollment_requests table for workflow
  await knex.schema.createTable('enrollment_requests', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
    table.uuid('class_id').notNullable().references('id').inTable('classes').onDelete('CASCADE');
    table.uuid('academic_session_id').notNullable().references('id').inTable('academic_sessions').onDelete('CASCADE');
    
    // Request metadata
    table.string('status', 50).defaultTo('pending'); // pending, approved, rejected, cancelled
    table.text('reason_for_request');
    table.text('rejection_reason');
    
    // Workflow tracking
    table.uuid('requested_by').notNullable().references('id').inTable('users').onDelete('SET NULL');
    table.uuid('reviewed_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('requested_at').defaultTo(knex.fn.now());
    table.timestamp('reviewed_at');
    
    // Notification tracking
    table.boolean('notification_sent').defaultTo(false);
    table.timestamp('notification_sent_at');
    
    // Audit
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes for performance
    table.index('student_id');
    table.index('class_id');
    table.index('status');
    table.index('requested_by');
    table.index('reviewed_by');
    table.index('academic_session_id');
    
    // Composite index for common queries
    table.unique(['student_id', 'class_id', 'academic_session_id', 'status']);
  });

  // Create student_imports table for bulk import tracking
  await knex.schema.createTable('student_imports', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('imported_by').notNullable().references('id').inTable('users').onDelete('SET NULL');
    
    // File metadata
    table.string('file_name', 255).notNullable();
    table.string('file_type', 50).notNullable(); // csv, xlsx, etc.
    table.bigInteger('file_size').notNullable();
    
    // Import statistics
    table.integer('total_records').defaultTo(0);
    table.integer('successful_imports').defaultTo(0);
    table.integer('failed_imports').defaultTo(0);
    table.integer('skipped_records').defaultTo(0);
    
    // Status tracking
    table.string('status', 50).defaultTo('pending'); // pending, in_progress, completed, failed
    table.text('error_message');
    
    // Timestamps
    table.timestamp('started_at');
    table.timestamp('completed_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index('imported_by');
    table.index('status');
    table.index('created_at');
  });

  // Create import_errors table for detailed error tracking
  await knex.schema.createTable('import_errors', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('import_id').notNullable().references('id').inTable('student_imports').onDelete('CASCADE');
    
    // Error details
    table.integer('row_number').notNullable();
    table.text('error_message').notNullable();
    table.jsonb('row_data').notNullable(); // The problematic row data
    table.string('error_type', 100); // validation_error, duplicate, missing_field, etc.
    
    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index('import_id');
    table.index('error_type');
    table.index('row_number');
  });

  // Audit logs table already created in migration 001, but enhance it with additional columns if needed
  if (await knex.schema.hasTable('audit_logs')) {
    // Add new columns to existing audit_logs table if they don't exist
    const hasPerformedByColumn = await knex.schema.hasColumn('audit_logs', 'performed_by');
    const hasPerformedByRoleColumn = await knex.schema.hasColumn('audit_logs', 'performed_by_role');
    const hasOldValuesColumn = await knex.schema.hasColumn('audit_logs', 'old_values');
    const hasNewValuesColumn = await knex.schema.hasColumn('audit_logs', 'new_values');
    const hasReasonColumn = await knex.schema.hasColumn('audit_logs', 'reason');
    const hasSourceColumn = await knex.schema.hasColumn('audit_logs', 'source');

    if (!hasPerformedByColumn || !hasPerformedByRoleColumn || !hasOldValuesColumn || !hasNewValuesColumn || !hasReasonColumn || !hasSourceColumn) {
      await knex.schema.table('audit_logs', (table) => {
        if (!hasPerformedByColumn) {
          table.uuid('performed_by').references('id').inTable('users').onDelete('SET NULL');
        }
        if (!hasPerformedByRoleColumn) {
          table.string('performed_by_role', 50);
        }
        if (!hasOldValuesColumn) {
          table.jsonb('old_values');
        }
        if (!hasNewValuesColumn) {
          table.jsonb('new_values');
        }
        if (!hasReasonColumn) {
          table.text('reason');
        }
        if (!hasSourceColumn) {
          table.string('source', 100).defaultTo('api');
        }
      });
    }
  }

  // Create export_jobs table is handled in migration 009 (phase 14)

  // Add enrollment_request_id to enrollments table (optional foreign key)
  if (await knex.schema.hasTable('enrollments')) {
    const hasColumn = await knex.schema.hasColumn('enrollments', 'enrollment_request_id');
    if (!hasColumn) {
      await knex.schema.table('enrollments', (table) => {
        table.uuid('enrollment_request_id').references('id').inTable('enrollment_requests').onDelete('SET NULL');
        table.index('enrollment_request_id');
      });
    }
  }

  // Add import_id to students table (optional tracking)
  if (await knex.schema.hasTable('students')) {
    const hasColumn = await knex.schema.hasColumn('students', 'import_id');
    if (!hasColumn) {
      await knex.schema.table('students', (table) => {
        table.uuid('import_id').references('id').inTable('student_imports').onDelete('SET NULL');
        table.index('import_id');
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order of creation
  
  // Remove columns added to existing tables
  if (await knex.schema.hasTable('students')) {
    const hasColumn = await knex.schema.hasColumn('students', 'import_id');
    if (hasColumn) {
      await knex.schema.table('students', (table) => {
        table.dropColumn('import_id');
      });
    }
  }

  if (await knex.schema.hasTable('enrollments')) {
    const hasColumn = await knex.schema.hasColumn('enrollments', 'enrollment_request_id');
    if (hasColumn) {
      await knex.schema.table('enrollments', (table) => {
        table.dropColumn('enrollment_request_id');
      });
    }
  }

  // Drop new tables
  await knex.schema.dropTableIfExists('import_errors');
  await knex.schema.dropTableIfExists('student_imports');
  await knex.schema.dropTableIfExists('enrollment_requests');
}
