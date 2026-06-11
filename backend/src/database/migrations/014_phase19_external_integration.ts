import type { Knex } from 'knex';

/**
 * Phase 19: External Systems Integration
 * 
 * Creates tables for:
 * - Email service configuration and message tracking
 * - SMS service configuration and message tracking
 * - Payment gateway configuration and transaction tracking
 * - Integration logging and monitoring
 * - Integration alerts and health metrics
 */

export async function up(knex: Knex): Promise<void> {
  // Email service tables
  const hasEmailConfigurations = await knex.schema.hasTable('email_configurations');
  if (!hasEmailConfigurations) {
    await knex.schema.createTable('email_configurations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().unique().references('id').inTable('tenants').onDelete('CASCADE');
    table.enum('provider', ['smtp', 'sendgrid', 'mailgun']).notNullable();
    table.string('from_address', 255).notNullable();
    table.string('smtp_host', 255).nullable();
    table.integer('smtp_port').nullable();
    table.string('smtp_user', 255).nullable();
    table.text('smtp_password').nullable();
    table.text('sendgrid_api_key').nullable();
    table.text('mailgun_api_key').nullable();
    table.string('mailgun_domain', 255).nullable();
    table.boolean('is_active').defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['tenant_id']);
    table.index(['is_active']);
  });
  }

  const hasEmailTemplates = await knex.schema.hasTable('email_templates');
  if (!hasEmailTemplates) {
    await knex.schema.createTable('email_templates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.string('subject', 500).notNullable();
    table.text('html_content').notNullable();
    table.text('text_content').nullable();
    table.text('variables').notNullable(); // JSON array
    table.string('category', 100).notNullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['tenant_id']);
    table.index(['category']);
    table.index(['is_active']);
  });
  }

  const hasEmailMessages = await knex.schema.hasTable('email_messages');
  if (!hasEmailMessages) {
    await knex.schema.createTable('email_messages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.text('to_addresses').notNullable(); // JSON array
    table.text('cc_addresses').nullable(); // JSON array
    table.text('bcc_addresses').nullable(); // JSON array
    table.string('subject', 500).notNullable();
    table.text('html_content').notNullable();
    table.text('text_content').nullable();
    table.uuid('template_id').nullable().references('id').inTable('email_templates').onDelete('SET NULL');
    table.text('template_variables').nullable(); // JSON
    table.enum('status', ['pending', 'sent', 'failed', 'bounced']).defaultTo('pending');
    table.text('failure_reason').nullable();
    table.integer('retry_count').defaultTo(0);
    table.integer('max_retries').defaultTo(3);
    table.timestamp('sent_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['tenant_id']);
    table.index(['status']);
    table.index(['created_at']);
  });
  }

  // SMS service tables
  const hasSmsConfigurations = await knex.schema.hasTable('sms_configurations');
  if (!hasSmsConfigurations) {
    await knex.schema.createTable('sms_configurations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().unique().references('id').inTable('tenants').onDelete('CASCADE');
    table.enum('provider', ['twilio', 'aws_sns', 'nexmo']).notNullable();
    table.string('from_number', 20).notNullable();
    table.string('account_sid', 255).nullable();
    table.text('auth_token').nullable();
    table.text('aws_access_key_id').nullable();
    table.text('aws_secret_access_key').nullable();
    table.string('aws_region', 50).nullable();
    table.text('nexmo_api_key').nullable();
    table.text('nexmo_api_secret').nullable();
    table.boolean('is_active').defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['tenant_id']);
    table.index(['is_active']);
  });
  }

  const hasSmsTemplates = await knex.schema.hasTable('sms_templates');
  if (!hasSmsTemplates) {
    await knex.schema.createTable('sms_templates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.text('message').notNullable();
    table.text('variables').notNullable(); // JSON array
    table.string('category', 100).notNullable();
    table.integer('character_limit').defaultTo(160);
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['tenant_id']);
    table.index(['category']);
    table.index(['is_active']);
  });
  }

  const hasSmsMessages = await knex.schema.hasTable('sms_messages');
  if (!hasSmsMessages) {
    await knex.schema.createTable('sms_messages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('phone_number', 20).notNullable();
    table.text('message').notNullable();
    table.uuid('template_id').nullable().references('id').inTable('sms_templates').onDelete('SET NULL');
    table.text('template_variables').nullable(); // JSON
    table.enum('status', ['pending', 'sent', 'delivered', 'failed']).defaultTo('pending');
    table.string('external_message_id', 255).nullable();
    table.text('failure_reason').nullable();
    table.integer('retry_count').defaultTo(0);
    table.integer('max_retries').defaultTo(3);
    table.timestamp('sent_at').nullable();
    table.timestamp('delivered_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['tenant_id']);
    table.index(['status']);
    table.index(['created_at']);
  });
  }

  // Payment gateway tables
  const hasPaymentGatewayConfigs = await knex.schema.hasTable('payment_gateway_configs');
  if (!hasPaymentGatewayConfigs) {
    await knex.schema.createTable('payment_gateway_configs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().unique().references('id').inTable('tenants').onDelete('CASCADE');
    table.enum('provider', ['stripe', 'paypal', 'razorpay', 'square']).notNullable();
    table.text('public_key').notNullable();
    table.text('secret_key').notNullable(); // Should be encrypted
    table.text('webhook_secret').nullable();
    table.string('currency', 3).defaultTo('USD');
    table.boolean('test_mode').defaultTo(true);
    table.boolean('is_active').defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['tenant_id']);
    table.index(['is_active']);
  });
  }

  const hasPaymentTransactions = await knex.schema.hasTable('payment_transactions');
  if (!hasPaymentTransactions) {
    await knex.schema.createTable('payment_transactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('student_id').nullable().references('id').inTable('students').onDelete('SET NULL');
    table.uuid('fee_id').nullable().references('id').inTable('fees').onDelete('SET NULL');
    table.decimal('amount', 10, 2).notNullable();
    table.string('currency', 3).notNullable();
    table.string('description', 500).notNullable();
    table.string('external_transaction_id', 255).nullable();
    table.string('payment_method', 100).nullable();
    table.enum('status', ['initiated', 'processing', 'completed', 'failed', 'refunded']).defaultTo('initiated');
    table.text('failure_reason').nullable();
    table.text('webhook_data').nullable(); // JSON
    table.timestamp('processed_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['tenant_id']);
    table.index(['student_id']);
    table.index(['status']);
    table.index(['created_at']);
  });
  }

  const hasRefundRequests = await knex.schema.hasTable('refund_requests');
  if (!hasRefundRequests) {
    await knex.schema.createTable('refund_requests', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('transaction_id').notNullable().references('id').inTable('payment_transactions').onDelete('CASCADE');
    table.decimal('amount', 10, 2).notNullable();
    table.string('reason', 500).notNullable();
    table.enum('status', ['pending', 'processed', 'failed']).defaultTo('pending');
    table.string('external_refund_id', 255).nullable();
    table.timestamp('processed_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['transaction_id']);
    table.index(['status']);
  });
  }

  // Integration logging and monitoring tables
  const hasIntegrationLogs = await knex.schema.hasTable('integration_logs');
  if (!hasIntegrationLogs) {
    await knex.schema.createTable('integration_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('integration_name', 100).notNullable();
    table.string('event_type', 100).notNullable();
    table.enum('status', ['success', 'failure', 'warning']).notNullable();
    table.string('endpoint', 500).nullable();
    table.text('request_data').nullable(); // JSON
    table.text('response_data').nullable(); // JSON
    table.text('error_message').nullable();
    table.integer('response_time').notNullable(); // milliseconds
    table.integer('status_code').nullable();
    table.text('metadata').nullable(); // JSON
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['tenant_id']);
    table.index(['integration_name']);
    table.index(['status']);
    table.index(['created_at']);
    table.index(['tenant_id', 'integration_name', 'created_at']);
  });
  }

  const hasIntegrationAlerts = await knex.schema.hasTable('integration_alerts');
  if (!hasIntegrationAlerts) {
    await knex.schema.createTable('integration_alerts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('integration_name', 100).notNullable();
    table.string('alert_type', 100).notNullable();
    table.enum('severity', ['low', 'medium', 'high', 'critical']).notNullable();
    table.string('title', 255).notNullable();
    table.text('description').notNullable();
    table.boolean('resolved').defaultTo(false);
    table.timestamp('resolved_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['tenant_id']);
    table.index(['integration_name']);
    table.index(['severity']);
    table.index(['resolved']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order
  await knex.schema.dropTableIfExists('integration_alerts');
  await knex.schema.dropTableIfExists('integration_logs');
  await knex.schema.dropTableIfExists('refund_requests');
  await knex.schema.dropTableIfExists('payment_transactions');
  await knex.schema.dropTableIfExists('payment_gateway_configs');
  await knex.schema.dropTableIfExists('sms_messages');
  await knex.schema.dropTableIfExists('sms_templates');
  await knex.schema.dropTableIfExists('sms_configurations');
  await knex.schema.dropTableIfExists('email_messages');
  await knex.schema.dropTableIfExists('email_templates');
  await knex.schema.dropTableIfExists('email_configurations');
}
