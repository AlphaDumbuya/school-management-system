
/**
 * Phase 15: System Configuration and Customization
 * 
 * Creates tables for:
 * - School configuration and settings
 * - Grading scale definitions (NEW - not in 001)
 * - Grade conversion rules (NEW - not in 001)
 * - Fee configuration (NEW - not in 001)
 * - Notification configuration (NEW - not in 001)
 * - Custom field definitions (NEW - not in 001)
 * - System settings (NEW - not in 001)
 * - Grading weights (NEW - not in 001)
 * 
 * NOTE: academic_sessions, grading_scales, notification_preferences are created in migration 001
 * This migration adds NEW configuration tables, NOT duplicates
 */

import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create schools table for school information
  const hasSchools = await knex.schema.hasTable('schools');
  if (!hasSchools) {
    await knex.schema.createTable('schools', (table) => {
    table.uuid('school_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().unique().index();
    table.string('name', 200).notNullable();
    table.string('short_name', 50).nullable();
    table.string('email', 150).nullable();
    table.string('phone', 20).nullable();
    table.string('website', 255).nullable();
    table.text('address').nullable();
    table.string('city', 100).nullable();
    table.string('state', 100).nullable();
    table.string('postal_code', 20).nullable();
    table.string('country', 100).nullable();
    table.string('logo_url', 500).nullable();
    table.integer('founded_year').nullable();
    table.string('principal_name', 150).nullable();
    table.string('principal_email', 150).nullable();
    table.string('school_registration_number', 100).nullable().unique();
    table.enum('accreditation_status', ['pending', 'accredited', 'expired']).defaultTo('pending');
    table.string('timezone', 50).defaultTo('UTC');
    table.string('language_preference', 10).defaultTo('en');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').nullable();
    table.uuid('updated_by').nullable();

    // Foreign key
    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    });
  }

  // Create school_config_settings table
  const hasSchoolConfigSettings = await knex.schema.hasTable('school_config_settings');
  if (!hasSchoolConfigSettings) {
    await knex.schema.createTable('school_config_settings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('school_id').notNullable();
    table.uuid('tenant_id').notNullable().index();
    table.string('setting_key', 100).notNullable();
    table.text('setting_value').nullable();
    table.enum('data_type', ['string', 'number', 'boolean', 'json']).defaultTo('string');
    table.boolean('is_public').defaultTo(false);
    table.uuid('created_by').notNullable();
    table.uuid('updated_by').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Unique constraint
    table.unique(['school_id', 'setting_key']);

    // Indexes
    table.index(['tenant_id', 'setting_key']);
    table.index(['tenant_id', 'is_public']);

    // Foreign keys
    table.foreign('school_id').references('school_id').inTable('schools').onDelete('CASCADE');
    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    });
  }

  // NOTE: grading_scales and grade_conversion_rules are created in migration 003
  // This migration does not recreate them to avoid conflicts

  // Create fee_configurations table
  const hasFeeConfigurations = await knex.schema.hasTable('fee_configurations');
  if (!hasFeeConfigurations) {
    await knex.schema.createTable('fee_configurations', (table) => {
    table.uuid('config_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().index();
    table.string('fee_type', 100).notNullable();
    table.string('description', 255).nullable();
    table.decimal('amount', 12, 2).notNullable();
    table.string('currency', 10).defaultTo('USD');
    table.string('frequency', 20).nullable(); // 'once', 'monthly', 'semester', 'yearly'
    table.boolean('is_mandatory').defaultTo(true);
    table.boolean('is_active').defaultTo(true);
    table.date('effective_from').nullable();
    table.date('effective_to').nullable();
    table.uuid('created_by').notNullable();
    table.uuid('updated_by').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index(['tenant_id', 'fee_type']);
    table.index(['tenant_id', 'is_active']);

    // Foreign key
    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    });
  }

  // Create notification_configurations table
  const hasNotificationConfigurations = await knex.schema.hasTable('notification_configurations');
  if (!hasNotificationConfigurations) {
    await knex.schema.createTable('notification_configurations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().index();
    table.string('notification_type', 100).notNullable();
    table.string('description', 255).nullable();
    table.boolean('email_enabled').defaultTo(true);
    table.boolean('sms_enabled').defaultTo(false);
    table.boolean('in_app_enabled').defaultTo(true);
    table.json('recipient_roles').nullable(); // Array of roles to notify
    table.json('template_variables').nullable(); // Available template variables
    table.boolean('is_active').defaultTo(true);
    table.uuid('created_by').notNullable();
    table.uuid('updated_by').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Unique constraint
    table.unique(['tenant_id', 'notification_type']);

    // Index
    table.index(['tenant_id', 'is_active']);

    // Foreign key
    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    });
  }

  // Create custom_fields table for custom field management
  const hasCustomFields = await knex.schema.hasTable('custom_fields');
  if (!hasCustomFields) {
    await knex.schema.createTable('custom_fields', (table) => {
    table.uuid('field_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().index();
    table.string('entity_type', 50).notNullable(); // 'student', 'class', 'teacher', etc
    table.string('field_name', 100).notNullable();
    table.string('field_label', 150).notNullable();
    table.enum('field_type', ['text', 'number', 'date', 'select', 'checkbox', 'textarea']).notNullable();
    table.boolean('is_required').defaultTo(false);
    table.json('field_options').nullable(); // For select type
    table.string('validation_pattern', 255).nullable(); // Regex for validation
    table.integer('display_order').defaultTo(0);
    table.boolean('is_active').defaultTo(true);
    table.uuid('created_by').notNullable();
    table.uuid('updated_by').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index(['tenant_id', 'entity_type']);
    table.index(['tenant_id', 'is_active']);
    table.unique(['tenant_id', 'entity_type', 'field_name']);

    // Foreign key
    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    });
  }

  // Create system_settings table for global system configuration
  const hasSystemSettings = await knex.schema.hasTable('system_settings');
  if (!hasSystemSettings) {
    await knex.schema.createTable('system_settings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().unique();
    table.integer('attendance_threshold').defaultTo(75); // % threshold for alerts
    table.integer('session_timeout_minutes').defaultTo(30); // Session timeout
    table.string('password_min_length', 50).defaultTo('8');
    table.boolean('password_require_uppercase').defaultTo(true);
    table.boolean('password_require_numbers').defaultTo(true);
    table.boolean('password_require_special').defaultTo(false);
    table.integer('password_expiry_days').defaultTo(90);
    table.integer('max_login_attempts').defaultTo(5);
    table.integer('lockout_duration_minutes').defaultTo(15);
    table.boolean('enable_two_factor').defaultTo(false);
    table.string('timezone', 50).defaultTo('UTC');
    table.string('date_format', 20).defaultTo('YYYY-MM-DD');
    table.string('time_format', 20).defaultTo('HH:MM:SS');
    table.boolean('maintenance_mode').defaultTo(false);
    table.text('maintenance_message').nullable();
    table.uuid('updated_by').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Foreign key
    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
  });
  }

  // Create grading_weights table for weighted grade calculations
  const hasGradingWeights = await knex.schema.hasTable('grading_weights');
  if (!hasGradingWeights) {
    await knex.schema.createTable('grading_weights', (table) => {
    table.uuid('weight_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().index();
    table.string('name', 100).notNullable();
    table.json('components').notNullable(); // Array of {name, weight, description}
    table.decimal('total_weight', 10, 2).notNullable();
    table.boolean('is_default').defaultTo(false);
    table.boolean('is_active').defaultTo(true);
    table.uuid('created_by').notNullable();
    table.uuid('updated_by').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index(['tenant_id', 'is_default']);
    table.index(['tenant_id', 'is_active']);
    table.unique(['tenant_id', 'name']);

    // Foreign key
    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order
  await knex.schema.dropTableIfExists('grading_weights');
  await knex.schema.dropTableIfExists('system_settings');
  await knex.schema.dropTableIfExists('custom_fields');
  await knex.schema.dropTableIfExists('notification_configurations');
  await knex.schema.dropTableIfExists('fee_configurations');
  await knex.schema.dropTableIfExists('school_config_settings');
  await knex.schema.dropTableIfExists('schools');
}
