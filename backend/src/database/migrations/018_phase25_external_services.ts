import type { Knex } from 'knex';

/**
 * Phase 25: External Services Integration
 * 
 * Creates tables for:
 * - UploadThing File Upload Service metadata and access control
 * - Neon Database Service connection metrics
 * - Brevo Email Service tracking (tracking only, templates in 014)
 * - Integration logging and monitoring
 * 
 * NOTE: email_templates is created in migration 014 to avoid conflicts
 * This migration adds Brevo-specific tracking without duplicating email_templates
 */

export async function up(knex: Knex): Promise<void> {
  // ============================================================================
  // BREVO EMAIL SERVICE - TRACKING ONLY (no duplicate email_templates)
  // ============================================================================

  // Brevo-specific tracking table for sent messages
  const hasBrevoEmailTracking = await knex.schema.hasTable('brevo_email_tracking');
  if (!hasBrevoEmailTracking) {
    await knex.schema.createTable('brevo_email_tracking', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('email_message_id').notNullable().references('id').inTable('email_messages').onDelete('CASCADE');
    table.integer('brevo_message_id').nullable(); // Brevo's message ID from API
    table.enum('brevo_status', ['queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'blocked', 'unsubscribed']).defaultTo('queued');
    table.timestamp('brevo_sent_at').nullable();
    table.timestamp('brevo_delivered_at').nullable();
    table.timestamp('brevo_opened_at').nullable();
    table.timestamp('brevo_clicked_at').nullable();
    table.json('brevo_metadata').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.index(['email_message_id']);
    table.index(['brevo_status']);
    table.index(['created_at']);
  });
  }

  // ============================================================================
  // UPLOADTHING FILE UPLOAD SERVICE TABLES
  // ============================================================================

  // File uploads tracking
  const hasFileUploads = await knex.schema.hasTable('file_uploads');
  if (!hasFileUploads) {
    await knex.schema.createTable('file_uploads', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('file_id', 255).notNullable().unique(); // UploadThing file ID
    table.string('filename', 255).notNullable();
    table.string('original_filename', 255).notNullable();
    table.string('url', 500).notNullable();
    table.bigInteger('size_bytes').notNullable();
    table.string('mime_type', 100).notNullable();
    table.string('entity_type', 50).notNullable(); // 'student', 'teacher', 'admission', 'school'
    table.uuid('entity_id').notNullable();
    table.string('file_category', 50).notNullable(); // 'document', 'photo', 'certificate', 'qualification', 'resource'
    table.uuid('uploaded_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.string('access_control', 50).defaultTo('private'); // 'public', 'private', 'restricted'
    table.json('access_restrictions').nullable(); // List of user IDs with access
    table.json('metadata').nullable();
    table.timestamp('uploaded_at').notNullable();
    table.timestamp('deleted_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    table.index(['entity_type', 'entity_id']);
    table.index(['file_category']);
    table.index(['uploaded_by']);
    table.index(['access_control']);
    table.index(['uploaded_at']);
  });
  }

  // File access audit log
  const hasFileAccessLogs = await knex.schema.hasTable('file_access_logs');
  if (!hasFileAccessLogs) {
    await knex.schema.createTable('file_access_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('file_id').notNullable().references('id').inTable('file_uploads').onDelete('CASCADE');
    table.uuid('accessed_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.string('access_type', 50).notNullable(); // 'view', 'download', 'delete', 'share'
    table.string('ip_address', 45).nullable();
    table.string('user_agent', 500).nullable();
    table.string('status', 50).defaultTo('success'); // 'success', 'denied', 'failed'
    table.text('reason').nullable(); // Reason if denied/failed
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    table.index(['file_id', 'accessed_by']);
    table.index(['created_at']);
  });
  }

  // File storage configuration
  const hasFileStorageConfig = await knex.schema.hasTable('file_storage_config');
  if (!hasFileStorageConfig) {
    await knex.schema.createTable('file_storage_config', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('entity_type', 50).notNullable();
    table.string('file_category', 50).notNullable();
    table.integer('max_file_size_bytes').notNullable();
    table.json('allowed_mime_types').notNullable();
    table.integer('retention_days').nullable(); // Days to retain file before auto-delete
    table.boolean('is_active').defaultTo(true);
    table.json('metadata').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    table.unique(['entity_type', 'file_category']);
  });
  }

  // ============================================================================
  // NEON DATABASE SERVICE TABLES
  // ============================================================================

  // Database connection metrics
  const hasDatabaseConnectionMetrics = await knex.schema.hasTable('database_connection_metrics');
  if (!hasDatabaseConnectionMetrics) {
    await knex.schema.createTable('database_connection_metrics', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('active_connections').notNullable();
    table.integer('idle_connections').notNullable();
    table.integer('total_connections').notNullable();
    table.integer('waiting_requests').notNullable().defaultTo(0);
    table.integer('connection_time_ms').notNullable();
    table.string('health_status', 50).notNullable(); // 'healthy', 'degraded', 'unhealthy'
    table.decimal('response_time_ms', 10, 2).notNullable();
    table.json('details').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    table.index(['created_at']);
    table.index(['health_status']);
  });
  }

  // Database query performance logs
  const hasDatabaseQueryLogs = await knex.schema.hasTable('database_query_logs');
  if (!hasDatabaseQueryLogs) {
    await knex.schema.createTable('database_query_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.text('query').notNullable();
    table.integer('duration_ms').notNullable();
    table.integer('rows_affected').notNullable().defaultTo(0);
    table.string('status', 50).defaultTo('success'); // 'success', 'error'
    table.text('error_message').nullable();
    table.string('query_type', 50); // 'SELECT', 'INSERT', 'UPDATE', 'DELETE'
    table.json('parameters').nullable();
    table.uuid('executed_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    table.index(['duration_ms']);
    table.index(['created_at']);
    table.index(['status']);
  });
  }

  // Database backup records
  const hasDatabaseBackups = await knex.schema.hasTable('database_backups');
  if (!hasDatabaseBackups) {
    await knex.schema.createTable('database_backups', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('backup_id', 255).notNullable().unique();
    table.string('backup_name', 255).notNullable();
    table.bigInteger('size_bytes').notNullable();
    table.string('status', 50).defaultTo('completed'); // 'pending', 'in_progress', 'completed', 'failed'
    table.timestamp('backup_start_time').notNullable();
    table.timestamp('backup_end_time').nullable();
    table.integer('duration_seconds').nullable();
    table.string('location', 500); // Backup location/path
    table.integer('retention_days').defaultTo(7);
    table.timestamp('expires_at').nullable();
    table.text('notes').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    table.index(['status']);
    table.index(['backup_start_time']);
  });
  }

  // Database configuration
  const hasDatabaseConfiguration = await knex.schema.hasTable('database_configuration');
  if (!hasDatabaseConfiguration) {
    await knex.schema.createTable('database_configuration', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('pool_size', 50).notNullable();
    table.integer('idle_timeout_ms').notNullable();
    table.integer('connection_timeout_ms').notNullable();
    table.integer('max_retries').notNullable();
    table.string('database_url', 500).notNullable();
    table.string('environment', 50).notNullable(); // 'development', 'staging', 'production'
    table.boolean('is_active').defaultTo(true);
    table.json('settings').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
  }

  // ============================================================================
  // INTEGRATION AUDIT LOG
  // ============================================================================

  // General external service audit log
  const hasExternalServiceAuditLogs = await knex.schema.hasTable('external_service_audit_logs');
  if (!hasExternalServiceAuditLogs) {
    await knex.schema.createTable('external_service_audit_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('service_name', 100).notNullable(); // 'brevo', 'uploadthing', 'neon'
    table.string('action', 100).notNullable();
    table.string('resource_id', 255).nullable();
    table.string('status', 50).notNullable(); // 'success', 'failure', 'warning'
    table.text('details').nullable();
    table.uuid('performed_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('ip_address', 45).nullable();
    table.json('metadata').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    table.index(['service_name', 'created_at']);
    table.index(['status']);
    table.index(['created_at']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order of dependencies
  await knex.schema.dropTableIfExists('external_service_audit_logs');
  await knex.schema.dropTableIfExists('database_configuration');
  await knex.schema.dropTableIfExists('database_backups');
  await knex.schema.dropTableIfExists('database_query_logs');
  await knex.schema.dropTableIfExists('database_connection_metrics');
  await knex.schema.dropTableIfExists('file_storage_config');
  await knex.schema.dropTableIfExists('file_access_logs');
  await knex.schema.dropTableIfExists('file_uploads');
  await knex.schema.dropTableIfExists('brevo_email_tracking');
}
