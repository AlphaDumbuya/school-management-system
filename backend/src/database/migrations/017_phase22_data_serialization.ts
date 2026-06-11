import type { Knex } from 'knex';

/**
 * Phase 22: Data Serialization & Parsing
 * 
 * Creates tables for:
 * - Academic record templates
 * - Serialization configurations
 * - Import/export history
 */

export async function up(knex: Knex): Promise<void> {
  // Create academic_record_templates table
  const hasAcademicRecordTemplates = await knex.schema.hasTable('academic_record_templates');
  if (!hasAcademicRecordTemplates) {
    await knex.schema.createTable('academic_record_templates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.text('description').nullable();
    table.json('schema').notNullable(); // JSON schema definition
    table.json('field_mappings').defaultTo(JSON.stringify({}));
    table.boolean('is_active').defaultTo(true);
    table.uuid('created_by_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['tenant_id']);
    table.index(['is_active']);
    table.unique(['tenant_id', 'name']);
  });
  }

  // Create serialization_configs table
  const hasSerializationConfigs = await knex.schema.hasTable('serialization_configs');
  if (!hasSerializationConfigs) {
    await knex.schema.createTable('serialization_configs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('format', 50).notNullable(); // json, csv, xml, compact
    table.json('options').defaultTo(JSON.stringify({})); // Include, exclude, date format, etc.
    table.enum('date_format', ['iso', 'local', 'timestamp']).defaultTo('iso');
    table.integer('indent_size').defaultTo(2);
    table.boolean('pretty_print').defaultTo(true);
    table.boolean('include_metadata').defaultTo(false);
    table.string('name', 255).notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['tenant_id']);
    table.index(['format']);
    table.unique(['tenant_id', 'name']);
  });
  }

  // Create import_export_history table
  const hasImportExportHistory = await knex.schema.hasTable('import_export_history');
  if (!hasImportExportHistory) {
    await knex.schema.createTable('import_export_history', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.enum('operation', ['import', 'export']).notNullable();
    table.string('format', 50).notNullable();
    table.integer('record_count').notNullable();
    table.enum('status', ['pending', 'in-progress', 'completed', 'failed']).defaultTo('pending');
    table.text('file_path').nullable();
    table.text('error_message').nullable();
    table.json('summary').defaultTo(JSON.stringify({})); // Statistics
    table.timestamp('started_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('completed_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['tenant_id']);
    table.index(['user_id']);
    table.index(['operation']);
    table.index(['status']);
    table.index(['created_at']);
  });
  }

  // Create parse_validation_cache table
  const hasParseValidationCache = await knex.schema.hasTable('parse_validation_cache');
  if (!hasParseValidationCache) {
    await knex.schema.createTable('parse_validation_cache', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('file_hash', 255).notNullable();
    table.json('validation_result').notNullable();
    table.integer('record_count').notNullable();
    table.boolean('is_valid').notNullable();
    table.timestamp('cached_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('expires_at').notNullable();

    table.index(['tenant_id']);
    table.index(['file_hash']);
    table.index(['expires_at']);
    table.unique(['tenant_id', 'file_hash']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('parse_validation_cache');
  await knex.schema.dropTableIfExists('import_export_history');
  await knex.schema.dropTableIfExists('serialization_configs');
  await knex.schema.dropTableIfExists('academic_record_templates');
}
