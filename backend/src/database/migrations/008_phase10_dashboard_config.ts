import type { Knex } from 'knex';

/**
 * Phase 10: Admin Dashboard Configuration
 *
 * Tables:
 * 1. dashboard_configurations - Dashboard layout and widget settings
 * 2. user_dashboard_preferences - Per-user dashboard customizations
 * 3. kpi_thresholds - KPI alert thresholds
 * 4. dashboard_widgets - Available widgets catalog
 * 5. dashboard_analytics - Analytics data for dashboards
 *
 * Total Tables: 5
 * Indexes: 15+
 */

export async function up(knex: Knex): Promise<void> {
  // ========================================================================
  // 1. DASHBOARD CONFIGURATIONS TABLE
  // ========================================================================
  const hasDashboardConfigurations = await knex.schema.hasTable('dashboard_configurations');
  if (!hasDashboardConfigurations) {
    await knex.schema.createTable('dashboard_configurations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable().unique();
    table.enum('role', [
      'admin',
      'principal',
      'teacher',
      'student',
      'parent',
      'guardian',
      'accountant',
      'admissionsOfficer',
      'staff',
    ]).notNullable();
    table.text('description');

    // Layout configuration
    table.jsonb('defaultLayout').notNullable().defaultTo('{}');
    table.jsonb('widgetConfiguration').notNullable().defaultTo('{}');
    table.jsonb('chartConfiguration').notNullable().defaultTo('{}');

    // Display settings
    table.string('theme', 50).defaultTo('light');
    table.integer('refreshInterval').defaultTo(300000).comment('milliseconds');
    table.boolean('showAlerts').defaultTo(true);
    table.boolean('showCharts').defaultTo(true);
    table.boolean('showMetrics').defaultTo(true);

    // Status
    table.enum('status', ['active', 'inactive', 'archived']).defaultTo('active');
    table.boolean('isDefault').defaultTo(false);

    // Metadata
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.timestamp('updatedAt').defaultTo(knex.fn.now());
    table.uuid('createdBy');
    table.uuid('updatedBy');

    // Indexes
    table.index('role');
    table.index('status');
    table.index('isDefault');
    });
  }

  // ========================================================================
  // 2. USER DASHBOARD PREFERENCES TABLE
  // ========================================================================
  const hasUserDashboardPreferences = await knex.schema.hasTable('user_dashboard_preferences');
  if (!hasUserDashboardPreferences) {
    await knex.schema.createTable('user_dashboard_preferences', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('userId').notNullable();
    table.uuid('dashboardConfigId').notNullable();

    // Customizations
    table.jsonb('customLayout');
    table.jsonb('widgetState').comment('Widget visibility, position, size');
    table.jsonb('favoriteFilters');
    table.string('defaultChartType', 50).defaultTo('line');

    // Display preferences
    table.string('theme', 50).defaultTo('system');
    table.string('language', 20).defaultTo('en');
    table.string('timezone', 50);
    table.string('dateFormat', 20).defaultTo('MMM DD, YYYY');
    table.string('timeFormat', 20).defaultTo('hh:mm A');

    // Notification preferences
    table.boolean('emailNotifications').defaultTo(true);
    table.boolean('pushNotifications').defaultTo(true);
    table.boolean('inAppNotifications').defaultTo(true);
    table.jsonb('notificationPreferences');

    // Status
    table.boolean('isActive').defaultTo(true);

    // Metadata
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.timestamp('updatedAt').defaultTo(knex.fn.now());
    table.timestamp('lastAccessedAt');

    // Constraints
    table.foreign('userId').references('users.id').onDelete('CASCADE');
    table.foreign('dashboardConfigId').references('dashboard_configurations.id').onDelete('RESTRICT');
    table.unique(['userId', 'dashboardConfigId']);

    // Indexes
    table.index('userId');
    table.index('isActive');
    table.index('lastAccessedAt');
    });
  }

  // ========================================================================
  // 3. KPI THRESHOLDS TABLE
  // ========================================================================
  const hasKpiThresholds = await knex.schema.hasTable('kpi_thresholds');
  if (!hasKpiThresholds) {
    await knex.schema.createTable('kpi_thresholds', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('kpiName', 100).notNullable();
    table.string('displayName', 150).notNullable();
    table.text('description');

    // Threshold values
    table.decimal('warningThreshold', 10, 2);
    table.decimal('criticalThreshold', 10, 2);
    table.decimal('targetValue', 10, 2);
    table.enum('thresholdType', ['minimum', 'maximum', 'percentage', 'count']).notNullable();

    // Configuration
    table.string('dataSource', 100).notNullable();
    table.string('calculationMethod', 100);
    table.string('unit', 50);
    table.jsonb('configuration');

    // Notification settings
    table.boolean('notifyOnWarning').defaultTo(true);
    table.boolean('notifyOnCritical').defaultTo(true);
    table.string('notificationChannel', 50).defaultTo('email');

    // Status
    table.enum('status', ['active', 'inactive']).defaultTo('active');

    // Metadata
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.timestamp('updatedAt').defaultTo(knex.fn.now());

    // Indexes
    table.index('kpiName');
    table.index('status');
    });
  }

  // ========================================================================
  // 4. DASHBOARD WIDGETS TABLE
  // ========================================================================
  const hasDashboardWidgets = await knex.schema.hasTable('dashboard_widgets');
  if (!hasDashboardWidgets) {
    await knex.schema.createTable('dashboard_widgets', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('widgetName', 100).notNullable().unique();
    table.string('displayName', 150).notNullable();
    table.text('description');
    table.string('category', 50).notNullable();

    // Widget configuration
    table.enum('widgetType', [
      'metric-card',
      'chart',
      'table',
      'alert',
      'activity-feed',
      'form',
      'custom',
    ]).notNullable();
    table.string('componentPath', 255);
    table.integer('defaultWidth').defaultTo(4);
    table.integer('defaultHeight').defaultTo(3);

    // Data configuration
    table.string('dataSource', 100);
    table.integer('refreshIntervalMs').defaultTo(300000);
    table.jsonb('queryConfiguration');
    table.jsonb('chartConfiguration');
    table.jsonb('permissions');

    // Visual configuration
    table.string('icon', 50);
    table.string('color', 20);
    table.jsonb('styling');

    // Status
    table.enum('status', ['active', 'inactive', 'beta']).defaultTo('active');
    table.boolean('isPublic').defaultTo(true);

    // Metadata
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.timestamp('updatedAt').defaultTo(knex.fn.now());

    // Indexes
    table.index('category');
    table.index('widgetType');
    table.index('status');
    });
  }

  // ========================================================================
  // 5. DASHBOARD ANALYTICS TABLE
  // ========================================================================
  const hasDashboardAnalytics = await knex.schema.hasTable('dashboard_analytics');
  if (!hasDashboardAnalytics) {
    await knex.schema.createTable('dashboard_analytics', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('userId');
    table.string('dashboardType', 50).notNullable();
    table.enum('action', [
      'view',
      'widget-open',
      'widget-close',
      'filter-applied',
      'export',
      'refresh',
      'navigate',
    ]).notNullable();

    // Event details
    table.string('widgetName', 100);
    table.jsonb('metadata');
    table.integer('loadTimeMs');
    table.string('userAgent');
    table.string('ipAddress');

    // Session info
    table.string('sessionId', 100);
    table.integer('sequenceNumber');

    // Status
    table.enum('status', ['success', 'error', 'partial']).defaultTo('success');
    table.text('errorMessage');

    // Timestamp
    table.timestamp('timestamp').defaultTo(knex.fn.now());

    // Constraints
    table.foreign('userId').references('users.id').onDelete('SET NULL');

    // Indexes
    table.index('userId');
    table.index('dashboardType');
    table.index('action');
    table.index('timestamp');
    table.index(['userId', 'dashboardType', 'timestamp']);
    });
  }

  // ========================================================================
  // ADDITIONAL INDEXES FOR OPTIMIZATION
  // ========================================================================

  // Dashboard configurations indexes
  await knex.schema.raw(`
    CREATE INDEX idx_dashboard_config_role_status
    ON dashboard_configurations(role, status);
  `);

  // User preferences indexes
  await knex.schema.raw(`
    CREATE INDEX idx_user_prefs_active_access
    ON user_dashboard_preferences("userId", "isActive", "lastAccessedAt");
  `);

  // Analytics performance indexes
  await knex.schema.raw(`
    CREATE INDEX idx_analytics_user_time
    ON dashboard_analytics("userId", timestamp DESC);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_analytics_dashboard_action
    ON dashboard_analytics("dashboardType", action, timestamp DESC);
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop in reverse order of creation
  await knex.schema.dropTable('dashboard_analytics');
  await knex.schema.dropTable('dashboard_widgets');
  await knex.schema.dropTable('kpi_thresholds');
  await knex.schema.dropTable('user_dashboard_preferences');
  await knex.schema.dropTable('dashboard_configurations');
}
