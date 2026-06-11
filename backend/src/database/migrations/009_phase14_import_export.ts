/**
 * Phase 14: Data Import/Export and Bulk Operations
 * 
 * Creates tables for tracking import jobs, validation errors, and export history
 */

import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create import_jobs table for tracking bulk import operations
  const hasImportJobs = await knex.schema.hasTable('import_jobs');
  if (!hasImportJobs) {
    await knex.schema.createTable('import_jobs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.enum('import_type', ['student', 'grade', 'attendance']).notNullable();
    table.string('file_name', 255).notNullable();
    table.enum('file_type', ['csv', 'excel']).notNullable();
    table.enum('status', ['pending', 'processing', 'completed', 'failed']).notNullable().defaultTo('pending');
    table.integer('total_rows').notNullable();
    table.integer('successful_rows').defaultTo(0);
    table.integer('failed_rows').defaultTo(0);
    table.json('result').nullable(); // Stores ImportResult JSON
    table.string('error_message', 500).nullable();
    table.uuid('created_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('started_at').nullable();
    table.timestamp('completed_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Indexes for performance
    table.index(['tenant_id', 'status']);
    table.index(['tenant_id', 'created_at']);
    table.index(['import_type', 'status']);
    table.index(['created_by']);
    });
  }

  // Create import_validation_errors table for detailed error tracking
  const hasImportValidationErrors = await knex.schema.hasTable('import_validation_errors');
  if (!hasImportValidationErrors) {
    await knex.schema.createTable('import_validation_errors', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('import_job_id').notNullable().references('id').inTable('import_jobs').onDelete('CASCADE');
    table.integer('row_number').notNullable();
    table.string('field', 100).notNullable();
    table.text('value').nullable();
    table.string('error_message', 500).notNullable();
    table.string('suggestion', 500).nullable();
    table.enum('error_type', ['required', 'format', 'validation', 'reference', 'unique', 'business_logic']).notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // Indexes for performance
    table.index(['import_job_id']);
    table.index(['import_job_id', 'row_number']);
    table.index(['error_type']);
    });
  }

  // Create import_duplicates table for tracking duplicate detection
  const hasImportDuplicates = await knex.schema.hasTable('import_duplicates');
  if (!hasImportDuplicates) {
    await knex.schema.createTable('import_duplicates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('import_job_id').notNullable().references('id').inTable('import_jobs').onDelete('CASCADE');
    table.integer('row_number').notNullable();
    table.uuid('matching_record_id').nullable(); // ID of existing record
    table.string('matching_table', 50).notNullable(); // 'students', 'grades', 'attendance'
    table.string('match_field', 100).notNullable(); // Which field was matched (email, etc)
    table.enum('handling_decision', ['skip', 'merge', 'error']).notNullable();
    table.json('matched_record_data').nullable(); // Store snapshot of matched record
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // Indexes for performance
    table.index(['import_job_id']);
    table.index(['import_job_id', 'row_number']);
    });
  }

  // Create export_jobs table for tracking bulk export operations
  const hasExportJobs = await knex.schema.hasTable('export_jobs');
  if (!hasExportJobs) {
    await knex.schema.createTable('export_jobs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.enum('export_type', ['student', 'grade', 'attendance']).notNullable();
    table.enum('format', ['csv', 'excel', 'pdf']).notNullable();
    table.json('fields').notNullable(); // Array of field names
    table.json('filters').nullable(); // Applied filters
    table.enum('status', ['pending', 'processing', 'completed', 'failed']).notNullable().defaultTo('pending');
    table.string('file_url', 500).nullable(); // URL to download file
    table.string('file_name', 255).nullable();
    table.integer('record_count').defaultTo(0);
    table.boolean('mask_sensitive').defaultTo(false);
    table.string('error_message', 500).nullable();
    table.uuid('requested_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.uuid('processed_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('started_at').nullable();
    table.timestamp('completed_at').nullable();
    table.timestamp('expires_at').nullable(); // For file cleanup
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Indexes for performance
    table.index(['tenant_id', 'status']);
    table.index(['tenant_id', 'created_at']);
    table.index(['export_type', 'format']);
    table.index(['requested_by']);
    });
  }

  // Create field_mappings table for storing reusable field mappings
  const hasFieldMappings = await knex.schema.hasTable('field_mappings');
  if (!hasFieldMappings) {
    await knex.schema.createTable('field_mappings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.enum('import_type', ['student', 'grade', 'attendance']).notNullable();
    table.string('name', 100).notNullable(); // e.g., "Standard Student CSV", "Grade Import v2"
    table.json('mapping').notNullable(); // { csvColumn: dbField }
    table.text('description').nullable();
    table.boolean('is_default').defaultTo(false);
    table.integer('usage_count').defaultTo(0);
    table.uuid('created_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Unique constraint
    table.unique(['tenant_id', 'import_type', 'name']);

    // Indexes
    table.index(['tenant_id', 'import_type']);
    table.index(['tenant_id', 'is_default']);
    });
  }

  // Create import_templates table for storing template configurations
  const hasImportTemplates = await knex.schema.hasTable('import_templates');
  if (!hasImportTemplates) {
    await knex.schema.createTable('import_templates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.enum('import_type', ['student', 'grade', 'attendance']).notNullable();
    table.string('name', 100).notNullable(); // e.g., "Bulk Student Upload"
    table.json('field_mapping').notNullable();
    table.enum('duplicate_handling', ['skip', 'merge', 'error']).defaultTo('skip');
    table.json('validation_rules').nullable(); // Additional validation rules
    table.text('description').nullable();
    table.boolean('is_active').defaultTo(true);
    table.integer('import_count').defaultTo(0);
    table.uuid('created_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index(['tenant_id', 'import_type']);
    table.index(['tenant_id', 'is_active']);
    });
  }

  // Create data_validation_audit table for audit trail
  const hasDataValidationAudit = await knex.schema.hasTable('data_validation_audit');
  if (!hasDataValidationAudit) {
    await knex.schema.createTable('data_validation_audit', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('entity_type', 50).notNullable(); // 'student', 'grade', etc
    table.uuid('entity_id').nullable();
    table.enum('validation_status', ['passed', 'failed', 'warning']).notNullable();
    table.json('validation_errors').nullable(); // Array of errors
    table.json('validation_warnings').nullable(); // Array of warnings
    table.string('source', 50).notNullable(); // 'manual', 'import', 'api', etc
    table.json('metadata').nullable(); // Additional context
    table.uuid('validated_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index(['tenant_id', 'entity_type']);
    table.index(['tenant_id', 'created_at']);
    table.index(['validation_status']);
    table.index(['source']);
    });
  }

  // Create bulk_operation_log table for tracking all bulk operations
  const hasBulkOperationLog = await knex.schema.hasTable('bulk_operation_log');
  if (!hasBulkOperationLog) {
    await knex.schema.createTable('bulk_operation_log', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.enum('operation_type', ['import', 'export', 'delete', 'update']).notNullable();
    table.string('entity_type', 50).notNullable();
    table.integer('record_count').notNullable();
    table.integer('success_count').defaultTo(0);
    table.integer('failure_count').defaultTo(0);
    table.enum('status', ['pending', 'in_progress', 'completed', 'failed', 'cancelled']).notNullable();
    table.string('status_message', 500).nullable();
    table.json('metadata').nullable(); // Operation-specific data
    table.uuid('initiated_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.uuid('processed_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.integer('duration_ms').nullable(); // Duration in milliseconds
    table.timestamp('started_at').nullable();
    table.timestamp('completed_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index(['tenant_id', 'operation_type']);
    table.index(['tenant_id', 'status']);
    table.index(['tenant_id', 'created_at']);
    table.index(['initiated_by']);
  });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order of creation (respecting foreign keys)
  await knex.schema.dropTableIfExists('bulk_operation_log');
  await knex.schema.dropTableIfExists('data_validation_audit');
  await knex.schema.dropTableIfExists('import_templates');
  await knex.schema.dropTableIfExists('field_mappings');
  await knex.schema.dropTableIfExists('export_jobs');
  await knex.schema.dropTableIfExists('import_duplicates');
  await knex.schema.dropTableIfExists('import_validation_errors');
  await knex.schema.dropTableIfExists('import_jobs');
}
