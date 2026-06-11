import type { Knex } from 'knex';

/**
 * Phase 16: Backup and Disaster Recovery System
 * 
 * Creates tables for managing automated backups, verification, restoration, and monitoring.
 * Supports full and incremental backups with integrity verification and recovery capabilities.
 */

export async function up(knex: Knex): Promise<void> {
  // Create backups table
  const hasBackups = await knex.schema.hasTable('backups');
  if (!hasBackups) {
    await knex.schema.createTable('backups', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('backup_id', 255).notNullable();
    table.enum('type', ['full', 'incremental']).notNullable().defaultTo('full');
    table.enum('status', ['pending', 'in_progress', 'completed', 'failed', 'verified']).notNullable().defaultTo('pending');
    table.bigInteger('size').notNullable().defaultTo(0); // in bytes
    table.timestamp('started_at').nullable();
    table.timestamp('completed_at').nullable();
    table.timestamp('expires_at').nullable();
    table.text('storage_path').notNullable();
    table.text('error_message').nullable();
    table.json('metadata').nullable(); // Additional backup metadata
    table.uuid('created_by').notNullable().references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes for common queries
    table.index(['tenant_id']);
    table.index(['status']);
    table.index(['created_at']);
    table.index(['expires_at']);
    table.unique(['tenant_id', 'backup_id']);
  });
  }

  // Create backup_logs table for tracking backup operations
  const hasBackupLogs = await knex.schema.hasTable('backup_logs');
  if (!hasBackupLogs) {
    await knex.schema.createTable('backup_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('backup_id').notNullable().references('id').inTable('backups').onDelete('CASCADE');
    table.string('action', 100).notNullable(); // 'backup_started', 'backup_completed', 'backup_failed', etc.
    table.enum('status', ['pending', 'in_progress', 'success', 'failed', 'warning']).notNullable();
    table.text('message').notNullable();
    table.json('details').nullable(); // Additional details about the operation
    table.uuid('created_by').nullable().references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes for common queries
    table.index(['backup_id']);
    table.index(['action']);
    table.index(['status']);
    table.index(['created_at']);
  });
  }

  // Create backup_restores table for tracking restore operations
  const hasBackupRestores = await knex.schema.hasTable('backup_restores');
  if (!hasBackupRestores) {
    await knex.schema.createTable('backup_restores', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('backup_id').notNullable().references('id').inTable('backups').onDelete('CASCADE');
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('restore_id', 255).notNullable();
    table.enum('status', ['pending', 'in_progress', 'completed', 'failed', 'rolled_back']).notNullable().defaultTo('pending');
    table.timestamp('started_at').nullable();
    table.timestamp('completed_at').nullable();
    table.integer('records_restored').notNullable().defaultTo(0);
    table.integer('records_verified').notNullable().defaultTo(0);
    table.text('error_message').nullable();
    table.boolean('verified').notNullable().defaultTo(false);
    table.json('verification_details').nullable();
    table.uuid('created_by').notNullable().references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes for common queries
    table.index(['backup_id']);
    table.index(['tenant_id']);
    table.index(['status']);
    table.index(['created_at']);
    table.unique(['tenant_id', 'restore_id']);
  });
  }

  // Create backup_metadata table for storing backup integrity information
  const hasBackupMetadata = await knex.schema.hasTable('backup_metadata');
  if (!hasBackupMetadata) {
    await knex.schema.createTable('backup_metadata', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('backup_id').notNullable().references('id').inTable('backups').onDelete('CASCADE');
    table.string('data_checksum', 255).notNullable(); // SHA-256 checksum
    table.bigInteger('record_count').notNullable().defaultTo(0);
    table.string('version', 50).notNullable(); // Database version
    table.json('table_stats').nullable(); // Statistics per table
    table.text('compression_algorithm').nullable();
    table.boolean('encrypted').notNullable().defaultTo(false);
    table.timestamp('verified_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes for common queries
    table.index(['backup_id']);
    table.index(['verified_at']);
  });
  }

  // Create backup_schedule table for storing backup schedule configuration
  const hasBackupSchedule = await knex.schema.hasTable('backup_schedule');
  if (!hasBackupSchedule) {
    await knex.schema.createTable('backup_schedule', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('cron_expression', 255).notNullable().defaultTo('0 2 * * *'); // Daily at 2 AM
    table.enum('backup_type', ['full', 'incremental']).notNullable().defaultTo('full');
    table.integer('retention_days').notNullable().defaultTo(30); // Keep backups for 30 days
    table.integer('max_concurrent_backups').notNullable().defaultTo(1);
    table.boolean('enabled').notNullable().defaultTo(true);
    table.text('notes').nullable();
    table.uuid('created_by').notNullable().references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes for common queries
    table.index(['tenant_id']);
    table.unique(['tenant_id']);
  });
  }

  // Create backup_storage_stats table for tracking storage usage
  const hasBackupStorageStats = await knex.schema.hasTable('backup_storage_stats');
  if (!hasBackupStorageStats) {
    await knex.schema.createTable('backup_storage_stats', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.bigInteger('total_size').notNullable().defaultTo(0); // in bytes
    table.integer('backup_count').notNullable().defaultTo(0);
    table.bigInteger('oldest_backup_date').nullable();
    table.bigInteger('newest_backup_date').nullable();
    table.decimal('usage_percentage', 5, 2).notNullable().defaultTo(0);
    table.timestamp('calculated_at').defaultTo(knex.fn.now());

    // Indexes for common queries
    table.index(['tenant_id']);
    table.unique(['tenant_id']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order of creation (due to foreign key constraints)
  await knex.schema.dropTableIfExists('backup_storage_stats');
  await knex.schema.dropTableIfExists('backup_schedule');
  await knex.schema.dropTableIfExists('backup_metadata');
  await knex.schema.dropTableIfExists('backup_restores');
  await knex.schema.dropTableIfExists('backup_logs');
  await knex.schema.dropTableIfExists('backups');
}
