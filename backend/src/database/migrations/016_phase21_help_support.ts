import type { Knex } from 'knex';

/**
 * Phase 21: Help & Support System
 * 
 * Creates tables for:
 * - Help documentation
 * - FAQs
 * - Error handling and messages
 * - Support tickets and responses
 */

export async function up(knex: Knex): Promise<void> {
  // Create help_articles table
  const hasHelpArticles = await knex.schema.hasTable('help_articles');
  if (!hasHelpArticles) {
    await knex.schema.createTable('help_articles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('title', 255).notNullable();
    table.text('content').notNullable();
    table.string('category', 100).notNullable();
    table.json('tags').defaultTo(JSON.stringify([]));
    table.string('context_path', 255).nullable(); // For context-sensitive help
    table.string('video_url', 500).nullable();
    table.integer('view_count').defaultTo(0);
    table.integer('helpful_count').defaultTo(0);
    table.integer('unhelpful_count').defaultTo(0);
    table.boolean('is_published').defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['tenant_id']);
    table.index(['category']);
    table.index(['context_path']);
    table.index(['is_published']);
    table.index(['view_count']);
  });
  }

  // Create help_faqs table
  const hasHelpFaqs = await knex.schema.hasTable('help_faqs');
  if (!hasHelpFaqs) {
    await knex.schema.createTable('help_faqs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('question', 500).notNullable();
    table.text('answer').notNullable();
    table.string('category', 100).notNullable();
    table.integer('display_order').defaultTo(0);
    table.integer('view_count').defaultTo(0);
    table.integer('helpful_count').defaultTo(0);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['tenant_id']);
    table.index(['category']);
    table.index(['display_order']);
  });
  }

  // Create error_messages table
  const hasErrorMessages = await knex.schema.hasTable('error_messages');
  if (!hasErrorMessages) {
    await knex.schema.createTable('error_messages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('error_code', 100).notNullable();
    table.string('user_message', 500).notNullable();
    table.text('technical_message').nullable();
    table.json('suggestions').defaultTo(JSON.stringify([]));
    table.enum('severity', ['info', 'warning', 'error', 'critical']).defaultTo('error');
    table.uuid('help_article_id').nullable().references('id').inTable('help_articles').onDelete('SET NULL');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['tenant_id']);
    table.index(['error_code']);
    table.unique(['tenant_id', 'error_code']);
  });
  }

  // Create error_logs table
  const hasErrorLogs = await knex.schema.hasTable('error_logs');
  if (!hasErrorLogs) {
    await knex.schema.createTable('error_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('error_code', 100).notNullable();
    table.string('message', 500).notNullable();
    table.text('stack_trace').nullable();
    table.json('context').defaultTo(JSON.stringify({}));
    table.boolean('resolved').defaultTo(false);
    table.timestamp('resolved_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['tenant_id']);
    table.index(['error_code']);
    table.index(['user_id']);
    table.index(['resolved']);
    table.index(['created_at']);
    table.index(['tenant_id', 'error_code', 'created_at']);
  });
  }

  // Create support_tickets table
  const hasSupportTickets = await knex.schema.hasTable('support_tickets');
  if (!hasSupportTickets) {
    await knex.schema.createTable('support_tickets', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('subject', 255).notNullable();
    table.text('description').notNullable();
    table.enum('priority', ['low', 'medium', 'high', 'urgent']).defaultTo('medium');
    table.enum('status', ['open', 'in-progress', 'resolved', 'closed']).defaultTo('open');
    table.string('category', 100).notNullable();
    table.uuid('assigned_to').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.json('attachments').defaultTo(JSON.stringify([]));
    table.text('resolution').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('resolved_at').nullable();

    table.index(['tenant_id']);
    table.index(['user_id']);
    table.index(['status']);
    table.index(['priority']);
    table.index(['category']);
    table.index(['assigned_to']);
    table.index(['created_at']);
    table.index(['tenant_id', 'status', 'created_at']);
  });
  }

  // Create support_responses table
  const hasSupportResponses = await knex.schema.hasTable('support_responses');
  if (!hasSupportResponses) {
    await knex.schema.createTable('support_responses', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('ticket_id').notNullable().references('id').inTable('support_tickets').onDelete('CASCADE');
    table.uuid('responder_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('message').notNullable();
    table.json('attachments').defaultTo(JSON.stringify([]));
    table.boolean('is_public').defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['ticket_id']);
    table.index(['responder_id']);
    table.index(['created_at']);
  });
  }

  // Create help_tooltips table
  const hasHelpTooltips = await knex.schema.hasTable('help_tooltips');
  if (!hasHelpTooltips) {
    await knex.schema.createTable('help_tooltips', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('element_id', 255).notNullable();
    table.string('tooltip_text', 1000).notNullable();
    table.string('position', 50).defaultTo('top');
    table.boolean('is_enabled').defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['tenant_id']);
    table.index(['element_id']);
    table.unique(['tenant_id', 'element_id']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('help_tooltips');
  await knex.schema.dropTableIfExists('support_responses');
  await knex.schema.dropTableIfExists('support_tickets');
  await knex.schema.dropTableIfExists('error_logs');
  await knex.schema.dropTableIfExists('error_messages');
  await knex.schema.dropTableIfExists('help_faqs');
  await knex.schema.dropTableIfExists('help_articles');
}
