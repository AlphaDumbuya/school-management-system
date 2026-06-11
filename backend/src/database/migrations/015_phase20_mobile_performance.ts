import type { Knex } from 'knex';

/**
 * Phase 20: Mobile Responsiveness and Performance
 * 
 * Creates tables for:
 * - Performance monitoring (page load times, Core Web Vitals)
 * - Caching management
 * - Performance alerts
 */

export async function up(knex: Knex): Promise<void> {
  // Create performance_metrics table
  const hasPerformanceMetrics = await knex.schema.hasTable('performance_metrics');
  if (!hasPerformanceMetrics) {
    await knex.schema.createTable('performance_metrics', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('page_url', 500).notNullable();
    table.string('metric_type', 50).notNullable(); // FCP, LCP, FID, CLS, TTFB, page_load_time
    table.decimal('value', 12, 2).notNullable();
    table.string('unit', 20).notNullable(); // ms, score, etc.
    table.string('user_agent', 500).nullable();
    table.string('device_type', 50).nullable(); // mobile, tablet, desktop
    table.timestamp('timestamp').notNullable().defaultTo(knex.fn.now());

    table.index(['tenant_id']);
    table.index(['metric_type']);
    table.index(['page_url']);
    table.index(['timestamp']);
    table.index(['tenant_id', 'metric_type', 'timestamp']);
  });
  }

  // Create performance_alerts table
  const hasPerformanceAlerts = await knex.schema.hasTable('performance_alerts');
  if (!hasPerformanceAlerts) {
    await knex.schema.createTable('performance_alerts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('page_url', 500).notNullable();
    table.string('alert_type', 100).notNullable(); // slow_metric, high_error_rate, etc.
    table.enum('severity', ['low', 'medium', 'high', 'critical']).notNullable();
    table.decimal('threshold', 12, 2).notNullable();
    table.decimal('actual_value', 12, 2).notNullable();
    table.string('title', 255).notNullable();
    table.text('description').notNullable();
    table.boolean('resolved').defaultTo(false);
    table.timestamp('resolved_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['tenant_id']);
    table.index(['severity']);
    table.index(['resolved']);
    table.index(['created_at']);
  });
  }

  // Create cache_entries table
  const hasCacheEntries = await knex.schema.hasTable('cache_entries');
  if (!hasCacheEntries) {
    await knex.schema.createTable('cache_entries', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('key', 500).notNullable();
    table.text('value').notNullable(); // JSON cached data
    table.integer('ttl').notNullable(); // Time to live in seconds
    table.timestamp('expires_at').notNullable();
    table.integer('hits').defaultTo(0);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['tenant_id', 'key']);
    table.index(['tenant_id']);
    table.index(['expires_at']);
    table.index(['hits']);
  });
  }

  // Create offline_data_sync table for offline support
  const hasOfflineDataSync = await knex.schema.hasTable('offline_data_sync');
  if (!hasOfflineDataSync) {
    await knex.schema.createTable('offline_data_sync', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('entity_type', 100).notNullable(); // student, grade, attendance, etc.
    table.text('data').notNullable(); // JSON cached entity data
    table.timestamp('synced_at').notNullable().defaultTo(knex.fn.now());
    table.boolean('needs_sync').defaultTo(false);
    table.timestamp('last_sync_attempt').nullable();
    table.text('sync_error').nullable();

    table.index(['tenant_id']);
    table.index(['user_id']);
    table.index(['entity_type']);
    table.index(['needs_sync']);
    table.unique(['tenant_id', 'user_id', 'entity_type']);
  });
  }

  // Create resource_optimization table
  const hasResourceOptimization = await knex.schema.hasTable('resource_optimization');
  if (!hasResourceOptimization) {
    await knex.schema.createTable('resource_optimization', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().unique().references('id').inTable('tenants').onDelete('CASCADE');
    table.boolean('enable_code_splitting').defaultTo(true);
    table.boolean('enable_lazy_loading').defaultTo(true);
    table.boolean('enable_image_optimization').defaultTo(true);
    table.integer('image_max_width').defaultTo(1920);
    table.integer('image_quality').defaultTo(80); // 0-100
    table.boolean('enable_compression').defaultTo(true);
    table.boolean('enable_caching').defaultTo(true);
    table.integer('cache_ttl_seconds').defaultTo(3600);
    table.integer('max_bundle_size_kb').defaultTo(500);
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['tenant_id']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order
  await knex.schema.dropTableIfExists('resource_optimization');
  await knex.schema.dropTableIfExists('offline_data_sync');
  await knex.schema.dropTableIfExists('cache_entries');
  await knex.schema.dropTableIfExists('performance_alerts');
  await knex.schema.dropTableIfExists('performance_metrics');
}
