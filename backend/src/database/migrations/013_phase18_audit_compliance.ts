import type { Knex } from 'knex';

/**
 * Phase 18: Audit Trail and Compliance
 * 
 * Creates tables for:
 * - Compliance reporting (audit trail generation, compliance metrics)
 * - Sensitive action logging (user changes, data deletion, system config)
 * - Action approval workflows (approve/reject sensitive actions)
 * - Audit retention policies (2+ year retention, archival)
 * - Archive metadata (archival tracking, restoration)
 */

export async function up(knex: Knex): Promise<void> {
  // Create compliance_reports table
  const hasComplianceReports = await knex.schema.hasTable('compliance_reports');
  if (!hasComplianceReports) {
    await knex.schema.createTable('compliance_reports', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('report_type', 100).notNullable(); // audit_trail, access_summary, incident_report, user_activity
    table.timestamp('start_date').notNullable();
    table.timestamp('end_date').notNullable();
    table.text('metrics').notNullable(); // JSON
    table.uuid('generated_by').notNullable().references('id').inTable('users');
    table.timestamp('generated_at').notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index(['tenant_id']);
    table.index(['report_type']);
    table.index(['generated_at']);
    table.index(['tenant_id', 'report_type', 'generated_at']);
  });
  }

  // Create sensitive_actions table
  const hasSensitiveActions = await knex.schema.hasTable('sensitive_actions');
  if (!hasSensitiveActions) {
    await knex.schema.createTable('sensitive_actions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('action_type', 100).notNullable(); // user_role_change, data_deletion, etc.
    table.string('entity_type', 100).notNullable();
    table.uuid('entity_id').notNullable();
    table.text('description').notNullable();
    table.text('reason').notNullable();
    table.boolean('requires_approval').defaultTo(true);
    table.enum('status', ['pending', 'approved', 'rejected', 'completed', 'cancelled']).defaultTo('pending');
    table.uuid('approved_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('approved_at').nullable();
    table.uuid('rejected_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('rejected_at').nullable();
    table.text('rejection_reason').nullable();
    table.uuid('completed_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('completed_at').nullable();
    table.text('execution_result').nullable(); // JSON
    table.uuid('cancelled_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('cancelled_at').nullable();
    table.text('cancellation_reason').nullable();
    table.text('metadata').nullable(); // JSON
    table.string('ip_address', 45).nullable();
    table.string('user_agent', 500).nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index(['tenant_id']);
    table.index(['user_id']);
    table.index(['action_type']);
    table.index(['status']);
    table.index(['requires_approval']);
    table.index(['created_at']);
    table.index(['tenant_id', 'status', 'created_at']);
  });
  }

  // Create action_approval_requests table
  const hasActionApprovalRequests = await knex.schema.hasTable('action_approval_requests');
  if (!hasActionApprovalRequests) {
    await knex.schema.createTable('action_approval_requests', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('action_id').notNullable().references('id').inTable('sensitive_actions').onDelete('CASCADE');
    table.uuid('assigned_to').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.enum('priority', ['low', 'medium', 'high', 'critical']).defaultTo('high');
    table.timestamp('deadline').nullable();
    table.enum('status', ['pending', 'approved', 'rejected', 'expired']).defaultTo('pending');
    table.timestamp('approved_at').nullable();
    table.timestamp('rejected_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index(['action_id']);
    table.index(['assigned_to']);
    table.index(['status']);
    table.index(['priority']);
    table.index(['deadline']);
    table.index(['assigned_to', 'status', 'priority']);
  });
  }

  // Create audit_retention_policies table
  const hasAuditRetentionPolicies = await knex.schema.hasTable('audit_retention_policies');
  if (!hasAuditRetentionPolicies) {
    await knex.schema.createTable('audit_retention_policies', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().unique().references('id').inTable('tenants').onDelete('CASCADE');
    table.integer('retention_days').defaultTo(730); // 2 years minimum
    table.integer('archival_days').defaultTo(365); // Archive after 1 year
    table.boolean('compress_archives').defaultTo(true);
    table.string('archive_location', 500).notNullable();
    table.timestamp('last_purge_date').nullable();
    table.timestamp('next_purge_date').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index(['tenant_id']);
    table.index(['next_purge_date']);
  });
  }

  // Create audit_archives table
  const hasAuditArchives = await knex.schema.hasTable('audit_archives');
  if (!hasAuditArchives) {
    await knex.schema.createTable('audit_archives', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('archive_name', 255).notNullable();
    table.timestamp('archive_date').notNullable();
    table.integer('logs_count').notNullable();
    table.timestamp('date_range_start').notNullable();
    table.timestamp('date_range_end').notNullable();
    table.integer('file_size').notNullable(); // in bytes
    table.string('file_location', 500).notNullable();
    table.boolean('compressed').defaultTo(false);
    table.string('checksum_sha256', 64).notNullable();
    table.timestamp('verified_at').nullable();
    table.timestamp('restored_at').nullable();
    table.string('created_by', 100).notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index(['tenant_id']);
    table.index(['archive_date']);
    table.index(['date_range_start']);
    table.index(['date_range_end']);
    table.index(['verified_at']);
    table.index(['tenant_id', 'archive_date']);
  });
  }

  // Create audit_compliance_status table (for tracking compliance verification)
  const hasAuditComplianceStatus = await knex.schema.hasTable('audit_compliance_status');
  if (!hasAuditComplianceStatus) {
    await knex.schema.createTable('audit_compliance_status', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().unique().references('id').inTable('tenants').onDelete('CASCADE');
    table.boolean('compliant').defaultTo(false);
    table.integer('active_logs_count').defaultTo(0);
    table.integer('archived_logs_count').defaultTo(0);
    table.timestamp('oldest_log_date').nullable();
    table.integer('oldest_log_age_days').defaultTo(0);
    table.text('violations').nullable(); // JSON array
    table.timestamp('last_verified_at').nullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index(['tenant_id']);
    table.index(['compliant']);
    table.index(['last_verified_at']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order
  await knex.schema.dropTableIfExists('audit_compliance_status');
  await knex.schema.dropTableIfExists('audit_archives');
  await knex.schema.dropTableIfExists('audit_retention_policies');
  await knex.schema.dropTableIfExists('action_approval_requests');
  await knex.schema.dropTableIfExists('sensitive_actions');
  await knex.schema.dropTableIfExists('compliance_reports');
}
