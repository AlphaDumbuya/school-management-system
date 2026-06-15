import type { Knex } from 'knex';

/**
 * Phase 2.1: Identity Management Module
 * 
 * Creates tables for digital ID card generation, QR codes, barcodes, templates,
 * and lifecycle management. Supports secure ID cards with QR codes, customizable
 * templates, bulk operations, and complete audit trails.
 * 
 * Tables created:
 * - card_templates: Reusable card design templates with school branding
 * - id_cards: Digital ID cards with status tracking
 * - qr_codes: Secure QR codes with cryptographic hashes
 * - tenant_secrets: Tenant-specific secrets for QR code security
 * - card_audit_log: Complete audit trail of card lifecycle events
 * - qr_code_scans: Log of all QR code scan attempts
 * - bulk_card_jobs: Batch card generation job tracking
 * - bulk_card_results: Individual results for bulk card operations
 */

export async function up(knex: Knex): Promise<void> {
  // Helper function to create table if it doesn't exist
  const createIfNotExists = async (tableName: string, schema: (table: Knex.CreateTableBuilder) => void) => {
    const exists = await knex.schema.hasTable(tableName);
    if (!exists) {
      await knex.schema.createTable(tableName, schema);
    }
  };

  // Add photo_url column to users table if it doesn't exist
  const hasPhotoUrl = await knex.schema.hasColumn('users', 'photo_url');
  if (!hasPhotoUrl) {
    await knex.schema.alterTable('users', (table) => {
      table.string('photo_url', 500);
    });
  }

  // Create card_templates table
  await createIfNotExists('card_templates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.integer('version').notNullable().defaultTo(1);
    table.string('status', 50).notNullable().defaultTo('draft');
    table.string('format', 20).notNullable(); // 'pvc' or 'badge'
    table.jsonb('config').notNullable();
    table.string('logo_url', 500);
    table.boolean('is_default').defaultTo(false);
    table.specificType('default_for_roles', 'TEXT[]');
    table.uuid('created_by').notNullable().references('id').inTable('users');
    table.uuid('approved_by').references('id').inTable('users');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    // Note: CHECK constraints will be added via raw SQL after table creation
    
    // Indexes
    table.index('tenant_id', 'idx_card_templates_tenant');
    table.index('status', 'idx_card_templates_status');
    table.index(['is_default'], 'idx_card_templates_default');
  });

  // Create id_cards table
  await createIfNotExists('id_cards', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('template_id').notNullable().references('id').inTable('card_templates');
    table.string('card_number', 50).notNullable().unique();
    table.string('format', 20).notNullable(); // 'pvc' or 'badge'
    table.string('status', 50).notNullable().defaultTo('active');
    table.string('pdf_url', 500);
    table.date('issued_at').notNullable();
    table.date('expires_at').notNullable();
    table.uuid('issued_by').notNullable().references('id').inTable('users');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    // Note: CHECK constraints will be added via raw SQL after table creation
    
    // Indexes
    table.index('tenant_id', 'idx_id_cards_tenant');
    table.index('user_id', 'idx_id_cards_user');
    table.index('status', 'idx_id_cards_status');
    table.index('expires_at', 'idx_id_cards_expires');
    // Note: Partial unique index for active cards will be created via raw SQL
  });

  // Create qr_codes table
  await createIfNotExists('qr_codes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('card_id').notNullable().references('id').inTable('id_cards').onDelete('CASCADE');
    table.text('content').notNullable();
    table.string('security_hash', 64).notNullable();
    table.string('image_url', 500);
    table.date('expires_at').notNullable();
    table.boolean('is_valid').defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    
    // Indexes
    table.index('card_id', 'idx_qr_codes_card');
    table.index('is_valid', 'idx_qr_codes_valid');
    table.index('security_hash', 'idx_qr_codes_hash');
  });

  // Create tenant_secrets table
  await createIfNotExists('tenant_secrets', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('secret_key_hash', 255).notNullable();
    table.date('valid_from').notNullable();
    table.date('valid_until').notNullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    
    // Note: CHECK constraint will be added via raw SQL after table creation
    
    // Indexes
    table.index('tenant_id', 'idx_tenant_secrets_tenant');
    table.index('is_active', 'idx_tenant_secrets_active');
  });

  // Create card_audit_log table
  await createIfNotExists('card_audit_log', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('card_id').notNullable().references('id').inTable('id_cards').onDelete('CASCADE');
    table.string('action', 50).notNullable();
    table.string('previous_status', 50);
    table.string('new_status', 50);
    table.uuid('performed_by').notNullable().references('id').inTable('users');
    table.text('reason');
    table.timestamp('performed_at').notNullable().defaultTo(knex.fn.now());
    
    // Note: CHECK constraint will be added via raw SQL after table creation
    
    // Indexes
    table.index('card_id', 'idx_card_audit_card');
    table.index('performed_at', 'idx_card_audit_performed_at');
  });

  // Create qr_code_scans table
  await createIfNotExists('qr_code_scans', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('qr_code_id').references('id').inTable('qr_codes').onDelete('SET NULL');
    table.uuid('scanned_user_id').references('id').inTable('users');
    table.uuid('scanning_user_id').notNullable().references('id').inTable('users');
    table.string('scanning_device_id', 100).notNullable();
    table.string('result', 50).notNullable();
    table.text('failure_reason');
    table.timestamp('scanned_at').notNullable().defaultTo(knex.fn.now());
    
    // Note: CHECK constraint will be added via raw SQL after table creation
    
    // Indexes
    table.index(['scanning_device_id', 'scanned_at'], 'idx_qr_scans_device');
    table.index(['result', 'scanned_at'], 'idx_qr_scans_result');
  });

  // Create bulk_card_jobs table
  await createIfNotExists('bulk_card_jobs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('status', 50).notNullable().defaultTo('queued');
    table.integer('total_cards').notNullable().defaultTo(0);
    table.integer('processed_cards').notNullable().defaultTo(0);
    table.integer('successful_cards').notNullable().defaultTo(0);
    table.integer('failed_cards').notNullable().defaultTo(0);
    table.jsonb('request_params').notNullable();
    table.string('pdf_url', 500);
    table.uuid('requested_by').notNullable().references('id').inTable('users');
    table.timestamp('started_at');
    table.timestamp('completed_at');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    
    // Note: CHECK constraint will be added via raw SQL after table creation
    
    // Indexes
    table.index('tenant_id', 'idx_bulk_jobs_tenant');
    table.index('status', 'idx_bulk_jobs_status');
    table.index('requested_by', 'idx_bulk_jobs_requested_by');
  });

  // Create bulk_card_results table
  await createIfNotExists('bulk_card_results', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('job_id').notNullable().references('id').inTable('bulk_card_jobs').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users');
    table.uuid('card_id').references('id').inTable('id_cards');
    table.string('status', 50).notNullable();
    table.string('error_code', 100);
    table.text('error_message');
    table.timestamp('processed_at').notNullable().defaultTo(knex.fn.now());
    
    // Note: CHECK constraint will be added via raw SQL after table creation
    
    // Indexes
    table.index('job_id', 'idx_bulk_results_job');
    table.index('status', 'idx_bulk_results_status');
  });

  // Add CHECK constraints and partial unique index via raw SQL
  console.log('Adding CHECK constraints and partial unique index...');
  
  // Add CHECK constraints to card_templates
  await knex.raw(`
    ALTER TABLE card_templates 
    DROP CONSTRAINT IF EXISTS card_templates_status_check,
    ADD CONSTRAINT card_templates_status_check 
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'archived'))
  `);
  
  await knex.raw(`
    ALTER TABLE card_templates 
    DROP CONSTRAINT IF EXISTS card_templates_format_check,
    ADD CONSTRAINT card_templates_format_check 
    CHECK (format IN ('pvc', 'badge'))
  `);

  // Add CHECK constraints to id_cards
  await knex.raw(`
    ALTER TABLE id_cards 
    DROP CONSTRAINT IF EXISTS id_cards_status_check,
    ADD CONSTRAINT id_cards_status_check 
    CHECK (status IN ('active', 'expired', 'lost', 'revoked', 'suspended'))
  `);
  
  await knex.raw(`
    ALTER TABLE id_cards 
    DROP CONSTRAINT IF EXISTS id_cards_format_check,
    ADD CONSTRAINT id_cards_format_check 
    CHECK (format IN ('pvc', 'badge'))
  `);
  
  await knex.raw(`
    ALTER TABLE id_cards 
    DROP CONSTRAINT IF EXISTS id_cards_dates_check,
    ADD CONSTRAINT id_cards_dates_check 
    CHECK (expires_at > issued_at)
  `);

  // Add partial unique index for active cards per user
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_id_cards_active_per_user 
    ON id_cards(user_id) 
    WHERE status = 'active'
  `);

  // Add CHECK constraint to tenant_secrets
  await knex.raw(`
    ALTER TABLE tenant_secrets 
    DROP CONSTRAINT IF EXISTS tenant_secrets_dates_check,
    ADD CONSTRAINT tenant_secrets_dates_check 
    CHECK (valid_until > valid_from)
  `);

  // Add CHECK constraint to card_audit_log
  await knex.raw(`
    ALTER TABLE card_audit_log 
    DROP CONSTRAINT IF EXISTS card_audit_log_action_check,
    ADD CONSTRAINT card_audit_log_action_check 
    CHECK (action IN ('issued', 'lost', 'revoked', 'suspended', 'reactivated', 'expired', 'regenerated'))
  `);

  // Add CHECK constraint to qr_code_scans
  await knex.raw(`
    ALTER TABLE qr_code_scans 
    DROP CONSTRAINT IF EXISTS qr_code_scans_result_check,
    ADD CONSTRAINT qr_code_scans_result_check 
    CHECK (result IN ('success', 'invalid_hash', 'expired', 'revoked', 'not_found'))
  `);

  // Add CHECK constraint to bulk_card_jobs
  await knex.raw(`
    ALTER TABLE bulk_card_jobs 
    DROP CONSTRAINT IF EXISTS bulk_card_jobs_status_check,
    ADD CONSTRAINT bulk_card_jobs_status_check 
    CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled'))
  `);

  // Add CHECK constraint to bulk_card_results
  await knex.raw(`
    ALTER TABLE bulk_card_results 
    DROP CONSTRAINT IF EXISTS bulk_card_results_status_check,
    ADD CONSTRAINT bulk_card_results_status_check 
    CHECK (status IN ('success', 'failed'))
  `);

  console.log('✓ CHECK constraints and partial unique index added successfully');
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse dependency order
  await knex.schema.dropTableIfExists('bulk_card_results');
  await knex.schema.dropTableIfExists('bulk_card_jobs');
  await knex.schema.dropTableIfExists('qr_code_scans');
  await knex.schema.dropTableIfExists('card_audit_log');
  await knex.schema.dropTableIfExists('tenant_secrets');
  await knex.schema.dropTableIfExists('qr_codes');
  await knex.schema.dropTableIfExists('id_cards');
  await knex.schema.dropTableIfExists('card_templates');
  
  // Remove photo_url column from users table
  const hasPhotoUrl = await knex.schema.hasColumn('users', 'photo_url');
  if (hasPhotoUrl) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('photo_url');
    });
  }
}
