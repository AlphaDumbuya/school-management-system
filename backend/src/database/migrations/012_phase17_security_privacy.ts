import type { Knex } from 'knex';

/**
 * Phase 17: Data Security and Privacy
 * 
 * Creates tables for:
 * - Audit logging (all data access and modifications)
 * - Access attempt tracking
 * - IP blocklist and allowlist
 * - Security alerts
 * - Encryption key management
 * - Data deletion/anonymization requests
 * - Export masking rules
 */

export async function up(knex: Knex): Promise<void> {
  // NOTE: audit_logs is created in migration 001
  // This migration adds additional security tables, not audit_logs

  // Create access_logs table for tracking access attempts
  const hasAccessLogs = await knex.schema.hasTable('access_logs');
  if (!hasAccessLogs) {
    await knex.schema.createTable('access_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('ip_address', 45).notNullable();
    table.string('action', 100).notNullable(); // login, logout, password_reset, etc.
    table.enum('status', ['success', 'failure']).notNullable();
    table.text('reason').nullable(); // Reason for failure
    table.string('user_agent', 500).nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index(['user_id']);
    table.index(['ip_address']);
    table.index(['action']);
    table.index(['created_at']);
    table.index(['user_id', 'created_at']);
    table.index(['ip_address', 'created_at']);
  });
  }

  // Create ip_blocklist table
  const hasIpBlocklist = await knex.schema.hasTable('ip_blocklist');
  if (!hasIpBlocklist) {
    await knex.schema.createTable('ip_blocklist', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('ip_address', 45).notNullable().unique();
    table.text('reason').notNullable();
    table.boolean('active').defaultTo(true);
    table.timestamp('expires_at').nullable(); // NULL = permanent
    table.uuid('created_by').nullable().references('id').inTable('users');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index(['ip_address']);
    table.index(['active']);
    table.index(['expires_at']);
  });
  }

  // Create ip_allowlist table (whitelist)
  const hasIpAllowlist = await knex.schema.hasTable('ip_allowlist');
  if (!hasIpAllowlist) {
    await knex.schema.createTable('ip_allowlist', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('ip_address', 45).notNullable().unique();
    table.text('description').nullable();
    table.boolean('active').defaultTo(true);
    table.uuid('created_by').nullable().references('id').inTable('users');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index(['ip_address']);
    table.index(['active']);
  });
  }

  // Create security_alerts table
  const hasSecurityAlerts = await knex.schema.hasTable('security_alerts');
  if (!hasSecurityAlerts) {
    await knex.schema.createTable('security_alerts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('ip_address', 45).notNullable();
    table.string('alert_type', 100).notNullable(); // too_many_failures, suspicious_activity, etc.
    table.text('description').notNullable();
    table.enum('severity', ['low', 'medium', 'high', 'critical']).notNullable();
    table.boolean('acknowledged').defaultTo(false);
    table.timestamp('acknowledged_at').nullable();
    table.uuid('acknowledged_by').nullable().references('id').inTable('users');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index(['user_id']);
    table.index(['ip_address']);
    table.index(['severity']);
    table.index(['acknowledged']);
    table.index(['created_at']);
  });
  }

  // Create encryption_keys table
  const hasEncryptionKeys = await knex.schema.hasTable('encryption_keys');
  if (!hasEncryptionKeys) {
    await knex.schema.createTable('encryption_keys', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.text('key_material').notNullable(); // Encrypted key material
    table.string('algorithm', 50).notNullable(); // aes-256-gcm, etc.
    table.boolean('is_active').defaultTo(false);
    table.timestamp('rotated_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index(['is_active']);
    table.index(['created_at']);
  });
  }

  // Create data_deletion_requests table
  const hasDataDeletionRequests = await knex.schema.hasTable('data_deletion_requests');
  if (!hasDataDeletionRequests) {
    await knex.schema.createTable('data_deletion_requests', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('reason', 255).notNullable();
    table.enum('status', ['pending', 'approved', 'rejected', 'completed']).defaultTo('pending');
    table.text('entities_to_delete').notNullable(); // JSON array
    table.boolean('anonymize').defaultTo(false);
    table.timestamp('requested_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('approved_at').nullable();
    table.uuid('approved_by').nullable().references('id').inTable('users');
    table.timestamp('completed_at').nullable();
    table.text('completion_notes').nullable();

    // Indexes
    table.index(['user_id']);
    table.index(['status']);
    table.index(['requested_at']);
  });
  }

  // Create export_masking_rules table
  const hasExportMaskingRules = await knex.schema.hasTable('export_masking_rules');
  if (!hasExportMaskingRules) {
    await knex.schema.createTable('export_masking_rules', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('entity_type', 100).notNullable(); // student, payment, etc.
    table.string('field_name', 100).notNullable();
    table.string('masking_type', 50).notNullable(); // full, partial, redact, hash
    table.string('masking_pattern', 255).nullable(); // For partial masking
    table.boolean('is_active').defaultTo(true);
    table.uuid('created_by').notNullable().references('id').inTable('users');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // Indexes and unique constraint
    table.unique(['tenant_id', 'entity_type', 'field_name']);
    table.index(['tenant_id']);
    table.index(['is_active']);
  });
  }

  // Create ssl_certificates table
  const hasSslCertificates = await knex.schema.hasTable('ssl_certificates');
  if (!hasSslCertificates) {
    await knex.schema.createTable('ssl_certificates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('domain', 255).notNullable().unique();
    table.text('certificate').notNullable();
    table.text('private_key').notNullable();
    table.timestamp('valid_from').notNullable();
    table.timestamp('valid_until').notNullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamp('last_renewed').nullable();
    table.uuid('created_by').notNullable().references('id').inTable('users');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index(['domain']);
    table.index(['is_active']);
    table.index(['valid_until']);
  });
  }

  // Create security_settings table
  const hasSecuritySettings = await knex.schema.hasTable('security_settings');
  if (!hasSecuritySettings) {
    await knex.schema.createTable('security_settings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().unique().references('id').inTable('tenants').onDelete('CASCADE');
    table.integer('session_timeout_minutes').defaultTo(30);
    table.integer('password_expiry_days').defaultTo(90);
    table.boolean('enable_two_factor').defaultTo(false);
    table.boolean('enable_encryption').defaultTo(true);
    table.integer('encryption_rotation_days').defaultTo(90);
    table.boolean('require_https').defaultTo(true);
    table.integer('max_login_attempts').defaultTo(5);
    table.integer('lockout_duration_minutes').defaultTo(30);
    table.boolean('enable_audit_logging').defaultTo(true);
    table.integer('audit_retention_days').defaultTo(730); // 2 years
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Index
    table.index(['tenant_id']);
  });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order
  // NOTE: audit_logs is created in migration 001, not dropped here
  await knex.schema.dropTableIfExists('security_settings');
  await knex.schema.dropTableIfExists('ssl_certificates');
  await knex.schema.dropTableIfExists('export_masking_rules');
  await knex.schema.dropTableIfExists('data_deletion_requests');
  await knex.schema.dropTableIfExists('encryption_keys');
  await knex.schema.dropTableIfExists('security_alerts');
  await knex.schema.dropTableIfExists('ip_allowlist');
  await knex.schema.dropTableIfExists('ip_blocklist');
  await knex.schema.dropTableIfExists('access_logs');
}
