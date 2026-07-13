import type { Knex } from 'knex';

/**
 * Phase 2.4 - SMS & WhatsApp Integration Migration
 *
 * Creates tables for:
 * - SMS/WhatsApp provider configuration
 * - Message templates
 * - Sent messages tracking
 * - Message delivery status
 * - Phone number management
 * - Message scheduling
 * - Message delivery logs
 * - Cost tracking and analytics
 *
 * @param knex - Knex instance
 */
export async function up(knex: Knex): Promise<void> {
  // Create sms_whatsapp_providers table - Configure SMS/WhatsApp service providers
  await knex.schema.createTable('sms_whatsapp_providers', (table) => {
    table.uuid('provider_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('provider_name', 100).notNullable(); // 'twilio', 'brevo', 'messagebird', 'custom'
    table.string('provider_type', 50).notNullable(); // 'sms', 'whatsapp', 'both'
    table.text('api_key').notNullable(); // Encrypted
    table.text('api_secret').nullable(); // Encrypted
    table.string('account_sid', 100).nullable(); // For Twilio
    table.string('auth_token', 200).nullable(); // For Twilio (encrypted)
    table.string('phone_number', 20).notNullable(); // Sender/Business phone number
    table.string('business_account_id', 100).nullable(); // For WhatsApp Business API
    table.text('webhook_url').nullable(); // For delivery callbacks
    table.string('webhook_secret', 200).nullable();
    table.decimal('cost_per_sms', 8, 4).defaultTo(0.01);
    table.decimal('cost_per_whatsapp_message', 8, 4).defaultTo(0.02);
    table.boolean('is_primary').defaultTo(false);
    table.boolean('enabled').defaultTo(true);
    table.text('configuration').nullable(); // JSON: additional provider-specific config
    table.uuid('created_by').references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['tenant_id', 'provider_name']);
    table.index(['tenant_id', 'enabled']);
    table.index(['tenant_id', 'is_primary']);
  });

  // Create sms_whatsapp_templates table - Message templates for different notification types
  await knex.schema.createTable('sms_whatsapp_templates', (table) => {
    table.uuid('template_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('template_name', 150).notNullable();
    table.text('description');
    table.string('template_type', 100).notNullable(); // 'event_reminder', 'attendance_alert', 'grade_notification', 'payment_reminder', 'disciplinary_action', 'general'
    table.string('channel', 50).notNullable(); // 'sms', 'whatsapp'
    table.text('sms_content').notNullable(); // SMS body
    table.text('whatsapp_content').nullable(); // WhatsApp message body (can include media references)
    table.text('variables_required').nullable(); // JSON array of variable names like ['student_name', 'date']
    table.text('message_prefix').nullable(); // Optional prefix for templates
    table.integer('estimated_length').notNullable().defaultTo(0);
    table.integer('estimated_sms_parts').notNullable().defaultTo(1); // SMS parts for multi-part messages
    table.boolean('is_active').defaultTo(true);
    table.boolean('requires_approval').defaultTo(false);
    table.uuid('created_by').references('id').inTable('users');
    table.uuid('approved_by').references('id').inTable('users');
    table.timestamp('approved_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['tenant_id', 'template_name']);
    table.index(['tenant_id', 'template_type']);
    table.index(['tenant_id', 'channel']);
  });

  // Create sms_whatsapp_messages table - Track all sent messages
  await knex.schema.createTable('sms_whatsapp_messages', (table) => {
    table.uuid('message_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('provider_id').notNullable().references('provider_id').inTable('sms_whatsapp_providers');
    table.uuid('template_id').nullable().references('template_id').inTable('sms_whatsapp_templates');
    table.uuid('recipient_id').notNullable().references('id').inTable('users');
    table.string('recipient_phone_number', 20).notNullable();
    table.string('recipient_country_code', 5);
    table.string('channel', 50).notNullable(); // 'sms', 'whatsapp'
    table.text('message_content').notNullable();
    table.string('message_type', 100).notNullable(); // 'event_reminder', 'attendance_alert', etc.
    table.string('status', 50).defaultTo('pending'); // 'pending', 'sent', 'delivered', 'failed', 'bounced'
    table.string('provider_message_id', 150).nullable(); // External provider's message ID
    table.integer('message_parts').defaultTo(1); // For SMS multi-part tracking
    table.decimal('cost', 8, 4).nullable();
    table.text('error_message').nullable(); // If failed
    table.string('error_code', 50).nullable();
    table.timestamp('scheduled_at').nullable();
    table.timestamp('sent_at').nullable();
    table.timestamp('delivered_at').nullable();
    table.timestamp('read_at').nullable();
    table.uuid('source_id').nullable(); // Related entity (event_id, class_id, etc.)
    table.string('source_type').nullable(); // 'event', 'attendance', 'grade', 'discipline'
    table.text('metadata').nullable(); // JSON: additional context
    table.uuid('sent_by').references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['tenant_id', 'status']);
    table.index(['tenant_id', 'recipient_id']);
    table.index(['tenant_id', 'channel']);
    table.index(['tenant_id', 'created_at']);
    table.index(['provider_message_id']);
    table.index(['tenant_id', 'source_type', 'source_id']);
  });

  // Create sms_whatsapp_delivery_logs table - Detailed delivery tracking
  await knex.schema.createTable('sms_whatsapp_delivery_logs', (table) => {
    table.uuid('log_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('message_id').notNullable().references('message_id').inTable('sms_whatsapp_messages').onDelete('CASCADE');
    table.string('status', 50).notNullable(); // 'sent', 'delivered', 'failed', 'bounced', 'read'
    table.text('status_details').nullable(); // Provider-specific details
    table.string('error_code', 50).nullable();
    table.text('error_message').nullable();
    table.integer('retry_count').defaultTo(0);
    table.integer('attempt_number').defaultTo(1);
    table.timestamp('log_time').defaultTo(knex.fn.now());
    table.text('webhook_payload').nullable(); // Raw webhook data from provider

    table.index(['message_id']);
    table.index(['status']);
    table.index(['log_time']);
  });

  // Create phone_numbers table - User phone number management
  await knex.schema.createTable('phone_numbers', (table) => {
    table.uuid('phone_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('phone_number', 20).notNullable();
    table.string('country_code', 5).notNullable(); // e.g., 'NG', 'US', 'GB'
    table.string('phone_type', 50).notNullable(); // 'personal', 'home', 'work', 'emergency'
    table.boolean('is_primary').defaultTo(false);
    table.boolean('sms_enabled').defaultTo(true);
    table.boolean('whatsapp_enabled').defaultTo(false);
    table.boolean('verified').defaultTo(false);
    table.string('verification_code', 10).nullable();
    table.timestamp('verification_code_sent_at').nullable();
    table.timestamp('verified_at').nullable();
    table.integer('verification_attempts').defaultTo(0);
    table.boolean('active').defaultTo(true);
    table.text('metadata').nullable(); // JSON: additional info
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['tenant_id', 'user_id', 'phone_number']);
    table.index(['tenant_id', 'user_id', 'is_primary']);
    table.index(['tenant_id', 'verified']);
  });

  // Create message_schedules table - Schedule messages for future delivery
  await knex.schema.createTable('message_schedules', (table) => {
    table.uuid('schedule_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('template_id').nullable().references('template_id').inTable('sms_whatsapp_templates');
    table.uuid('recipient_id').notNullable().references('id').inTable('users');
    table.string('channel', 50).notNullable(); // 'sms', 'whatsapp'
    table.text('message_content').nullable(); // If not using template
    table.text('recipient_variables').nullable(); // JSON for template variables
    table.string('schedule_type', 50).notNullable(); // 'once', 'daily', 'weekly', 'monthly'
    table.timestamp('first_send_time').notNullable();
    table.timestamp('next_send_time').nullable();
    table.string('recurrence_pattern').nullable(); // e.g., 'daily', 'every_monday', 'monthly_on_15'
    table.integer('max_occurrences').nullable(); // NULL = infinite
    table.integer('occurrences_sent').defaultTo(0);
    table.timestamp('end_date').nullable();
    table.string('status', 50).defaultTo('active'); // 'active', 'paused', 'completed', 'cancelled'
    table.text('metadata').nullable(); // JSON: event_id, class_id, etc.
    table.uuid('created_by').references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['tenant_id', 'status']);
    table.index(['tenant_id', 'next_send_time']);
  });

  // Create sms_whatsapp_opt_outs table - User opt-out preferences
  await knex.schema.createTable('sms_whatsapp_opt_outs', (table) => {
    table.uuid('optout_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('channel', 50).notNullable(); // 'sms', 'whatsapp', 'both'
    table.string('reason', 100).nullable(); // 'user_request', 'spam', 'invalid_number'
    table.string('status', 50).notNullable(); // 'active', 'removed'
    table.text('notes').nullable();
    table.uuid('processed_by').references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['tenant_id', 'user_id', 'channel', 'status']);
    table.index(['tenant_id', 'status']);
  });

  // Create messaging_analytics table - Track messaging costs and usage
  await knex.schema.createTable('messaging_analytics', (table) => {
    table.uuid('analytics_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.date('analytics_date').notNullable();
    table.string('channel', 50).notNullable(); // 'sms', 'whatsapp'
    table.string('provider_name', 100).nullable();
    table.integer('messages_sent').defaultTo(0);
    table.integer('messages_delivered').defaultTo(0);
    table.integer('messages_failed').defaultTo(0);
    table.integer('messages_bounced').defaultTo(0);
    table.decimal('total_cost', 12, 4).defaultTo(0);
    table.decimal('average_delivery_time_seconds', 10, 2).nullable();
    table.integer('distinct_recipients').defaultTo(0);
    table.text('message_types_breakdown').nullable(); // JSON breakdown by type
    table.text('error_summary').nullable(); // JSON summary of common errors
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['tenant_id', 'analytics_date', 'channel']);
    table.index(['tenant_id', 'analytics_date']);
  });

  // Create messaging_user_stats table - Per-user messaging statistics
  await knex.schema.createTable('messaging_user_stats', (table) => {
    table.uuid('stat_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('total_sms_sent').defaultTo(0);
    table.integer('total_sms_delivered').defaultTo(0);
    table.integer('total_whatsapp_sent').defaultTo(0);
    table.integer('total_whatsapp_delivered').defaultTo(0);
    table.decimal('total_cost_sms', 10, 4).defaultTo(0);
    table.decimal('total_cost_whatsapp', 10, 4).defaultTo(0);
    table.timestamp('last_sms_sent_at').nullable();
    table.timestamp('last_whatsapp_sent_at').nullable();
    table.boolean('sms_opted_out').defaultTo(false);
    table.boolean('whatsapp_opted_out').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['tenant_id', 'user_id']);
    table.index(['tenant_id']);
  });

  // Add SMS/WhatsApp columns to notifications table if they don't exist
  if (!(await knex.schema.hasColumn('notifications', 'phone_number'))) {
    await knex.schema.table('notifications', (table) => {
      table.string('phone_number', 20).nullable();
      table.string('sms_message_id', 150).nullable();
      table.string('whatsapp_message_id', 150).nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order of creation
  await knex.schema.dropTableIfExists('messaging_user_stats');
  await knex.schema.dropTableIfExists('messaging_analytics');
  await knex.schema.dropTableIfExists('sms_whatsapp_opt_outs');
  await knex.schema.dropTableIfExists('message_schedules');
  await knex.schema.dropTableIfExists('sms_whatsapp_delivery_logs');
  await knex.schema.dropTableIfExists('sms_whatsapp_messages');
  await knex.schema.dropTableIfExists('phone_numbers');
  await knex.schema.dropTableIfExists('sms_whatsapp_templates');
  await knex.schema.dropTableIfExists('sms_whatsapp_providers');

  // Remove SMS/WhatsApp columns from notifications if they exist
  if (await knex.schema.hasColumn('notifications', 'phone_number')) {
    await knex.schema.table('notifications', (table) => {
      table.dropColumn('phone_number');
      table.dropColumn('sms_message_id');
      table.dropColumn('whatsapp_message_id');
    });
  }
}
