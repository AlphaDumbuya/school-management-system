import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Notifications table - skip if already exists from migration 001
  const hasNotificationsTable = await knex.schema.hasTable('notifications');
  if (!hasNotificationsTable) {
    await knex.schema.createTable('notifications', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('notificationType', 50).notNullable(); // 'grade', 'attendance', 'payment', 'schedule', 'enrollment'
      table.uuid('recipientId').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('subject', 200).nullable();
      table.text('message').notNullable();
      table.json('data').nullable(); // Additional context data
      table.specificType('channels', 'varchar(20)[]').defaultTo(['in_app']); // ['email', 'sms', 'in_app']
      table.timestamp('readAt').nullable();
      table.string('status', 20).defaultTo('pending'); // 'pending', 'sent', 'failed', 'read'
      table.string('sourceType', 50).nullable(); // Entity type that triggered notification
      table.uuid('sourceId').nullable(); // Entity ID that triggered notification
      table.uuid('createdBy').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('updatedAt').defaultTo(knex.fn.now());
      
      // Indexes for common queries
      table.index('recipientId');
      table.index('notificationType');
      table.index('status');
      table.index('createdAt');
      table.index(['recipientId', 'readAt']);
    });
  }

  // In-app notifications - specific in-app notification records
  const hasInAppNotificationsTable = await knex.schema.hasTable('in_app_notifications');
  if (!hasInAppNotificationsTable) {
    await knex.schema.createTable('in_app_notifications', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('notificationId').notNullable().references('id').inTable('notifications').onDelete('CASCADE');
      table.uuid('recipientId').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('title', 200).notNullable();
      table.text('message').notNullable();
      table.string('icon', 500).nullable();
      table.string('actionUrl', 500).nullable();
      table.string('priority', 20).defaultTo('medium'); // 'low', 'medium', 'high'
      table.boolean('isRead').defaultTo(false);
      table.timestamp('readAt').nullable();
      table.timestamp('expiresAt').nullable(); // Auto-expire after this time
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('updatedAt').defaultTo(knex.fn.now());
      
      // Indexes for common queries
      table.index('recipientId');
      table.index('priority');
      table.index('isRead');
      table.index('expiresAt');
      table.index('createdAt');
      table.index(['recipientId', 'isRead']);
    });
  }

  // Notification templates - reusable templates
  const hasNotificationTemplatesTable = await knex.schema.hasTable('notification_templates');
  if (!hasNotificationTemplatesTable) {
    await knex.schema.createTable('notification_templates', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('templateName', 100).unique().notNullable();
      table.string('notificationType', 50).notNullable(); // 'grade', 'attendance', 'payment', etc.
      table.string('channel', 20).notNullable(); // 'email', 'sms', 'in_app'
      table.string('subject', 200).nullable(); // For email templates
      table.text('body').notNullable(); // Template with placeholders
      table.json('variables').nullable(); // {name, email, grade, etc}
      table.boolean('isActive').defaultTo(true);
      table.uuid('createdBy').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      
      // Indexes
      table.index('notificationType');
      table.index('channel');
      table.index('isActive');
    });
  }

  // Notification preferences - user settings
  const hasNotificationPreferencesTable = await knex.schema.hasTable('notification_preferences');
  if (!hasNotificationPreferencesTable) {
    await knex.schema.createTable('notification_preferences', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('userId').unique().notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.boolean('gradeNotifications').defaultTo(true);
      table.boolean('attendanceNotifications').defaultTo(true);
      table.boolean('paymentNotifications').defaultTo(true);
      table.boolean('scheduleNotifications').defaultTo(true);
      table.boolean('enrollmentNotifications').defaultTo(true);
      table.boolean('emailPreference').defaultTo(true);
      table.boolean('smsPreference').defaultTo(true);
      table.boolean('inAppPreference').defaultTo(true);
      table.string('frequencyPreference', 20).defaultTo('real_time'); // 'real_time', 'daily', 'weekly'
      table.timestamp('unsubscribedAt').nullable();
      table.timestamp('updatedAt').defaultTo(knex.fn.now());
      
      // Indexes
      table.index('userId');
    });
  }

  // Notification deliveries - tracking delivery status
  const hasNotificationDeliveriesTable = await knex.schema.hasTable('notification_deliveries');
  if (!hasNotificationDeliveriesTable) {
    await knex.schema.createTable('notification_deliveries', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('notificationId').notNullable().references('id').inTable('notifications').onDelete('CASCADE');
      table.string('channel', 20).notNullable(); // 'email', 'sms', 'in_app'
      table.string('deliveryStatus', 20).defaultTo('pending'); // 'pending', 'sent', 'delivered', 'failed'
      table.json('deliveryDetails').nullable(); // Provider-specific details
      table.integer('deliveryAttempts').defaultTo(1);
      table.timestamp('lastAttemptAt').nullable();
      table.timestamp('nextRetryAt').nullable();
      table.text('failureReason').nullable();
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      
      // Indexes
      table.index('notificationId');
      table.index('channel');
      table.index('deliveryStatus');
      table.index('nextRetryAt');
    });
  }

  // Notification triggers - system event configuration
  const hasNotificationTriggersTable = await knex.schema.hasTable('notification_triggers');
  if (!hasNotificationTriggersTable) {
    await knex.schema.createTable('notification_triggers', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('triggerName', 100).unique().notNullable();
      table.string('triggerType', 50).notNullable(); // 'grade', 'attendance', 'payment', 'schedule', 'enrollment'
      table.boolean('isActive').defaultTo(true);
      table.json('config').notNullable(); // Configuration for the trigger
      table.uuid('createdBy').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('updatedAt').defaultTo(knex.fn.now());
      
      // Indexes
      table.index('triggerType');
      table.index('isActive');
    });
  }

  // Notification queue - for reliable delivery
  const hasNotificationQueueTable = await knex.schema.hasTable('notification_queue');
  if (!hasNotificationQueueTable) {
    await knex.schema.createTable('notification_queue', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('notificationId').notNullable().references('id').inTable('notifications').onDelete('CASCADE');
      table.string('channel', 20).notNullable();
      table.string('status', 20).defaultTo('pending'); // 'pending', 'processing', 'completed', 'failed'
      table.integer('retryCount').defaultTo(0);
      table.integer('maxRetries').defaultTo(3);
      table.timestamp('scheduledFor').defaultTo(knex.fn.now());
      table.timestamp('processedAt').nullable();
      table.text('errorMessage').nullable();
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      
      // Indexes
      table.index('status');
      table.index('scheduledFor');
      table.index(['status', 'scheduledFor']);
    });
  }

  // Notification history/analytics
  const hasNotificationAnalyticsTable = await knex.schema.hasTable('notification_analytics');
  if (!hasNotificationAnalyticsTable) {
    await knex.schema.createTable('notification_analytics', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('notificationId').notNullable().references('id').inTable('notifications').onDelete('CASCADE');
      table.string('channel', 20).notNullable();
      table.string('event', 50).notNullable(); // 'sent', 'delivered', 'failed', 'read', 'clicked'
      table.json('metadata').nullable(); // Additional event metadata
      table.timestamp('eventTime').defaultTo(knex.fn.now());
      
      // Indexes
      table.index('notificationId');
      table.index('channel');
      table.index('event');
      table.index('eventTime');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order due to foreign keys
  // NOTE: Only drop tables created by this migration, not 'notifications' which is from migration 001
  await knex.schema.dropTableIfExists('notification_analytics');
  await knex.schema.dropTableIfExists('notification_queue');
  await knex.schema.dropTableIfExists('notification_triggers');
  await knex.schema.dropTableIfExists('notification_deliveries');
  await knex.schema.dropTableIfExists('notification_preferences');
  await knex.schema.dropTableIfExists('notification_templates');
  await knex.schema.dropTableIfExists('in_app_notifications');
  // notifications table is created in migration 001, keep it
}
