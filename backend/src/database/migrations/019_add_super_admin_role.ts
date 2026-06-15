import type { Knex } from 'knex';

/**
 * Migration: Add Super Admin Role
 * Phase 1.1: Role System Enhancement
 * 
 * This migration adds the super_admin role to the system and creates
 * platform-level tables for multi-tenant management.
 */

export async function up(knex: Knex): Promise<void> {
  console.log('Starting migration: Add Super Admin Role');

  // 1. Add super_admin role to the roles table if it doesn't exist
  const superAdminRoleExists = await knex('roles')
    .where({ name: 'super_admin' })
    .first();

  if (!superAdminRoleExists) {
    await knex('roles').insert({
      name: 'super_admin',
      description: 'Platform Owner - Manages all tenants and platform-wide settings',
      is_predefined: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });
    console.log('✓ Created super_admin role');
  }

  // 2. Create subscriptions table for platform management
  const hasSubscriptionsTable = await knex.schema.hasTable('subscriptions');
  if (!hasSubscriptionsTable) {
    await knex.schema.createTable('subscriptions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.string('plan_type', 50).notNullable(); // free, basic, premium, enterprise
      table.string('status', 50).notNullable().defaultTo('active'); // active, suspended, expired, cancelled
      table.date('start_date').notNullable();
      table.date('end_date');
      table.decimal('monthly_price', 10, 2).defaultTo(0);
      table.integer('max_users').defaultTo(100);
      table.integer('max_students').defaultTo(1000);
      table.integer('max_storage_gb').defaultTo(10);
      table.jsonb('features').defaultTo('{}'); // JSON object of enabled features
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.uuid('created_by').references('id').inTable('users');
      
      table.index('tenant_id');
      table.index('status');
      table.index('plan_type');
      table.index('end_date');
    });
    console.log('✓ Created subscriptions table');
  }

  // 3. Create billing_history table
  const hasBillingTable = await knex.schema.hasTable('billing_history');
  if (!hasBillingTable) {
    await knex.schema.createTable('billing_history', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.uuid('subscription_id').references('id').inTable('subscriptions');
      table.decimal('amount', 10, 2).notNullable();
      table.string('currency', 10).defaultTo('USD');
      table.string('payment_method', 50);
      table.string('transaction_id', 255);
      table.string('status', 50).notNullable(); // paid, pending, failed, refunded
      table.date('billing_date').notNullable();
      table.date('due_date').notNullable();
      table.date('paid_date');
      table.text('notes');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      table.index('tenant_id');
      table.index('subscription_id');
      table.index('status');
      table.index('billing_date');
    });
    console.log('✓ Created billing_history table');
  }

  // 4. Create platform_analytics table
  const hasPlatformAnalytics = await knex.schema.hasTable('platform_analytics');
  if (!hasPlatformAnalytics) {
    await knex.schema.createTable('platform_analytics', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.date('date').notNullable();
      table.integer('total_tenants').defaultTo(0);
      table.integer('active_tenants').defaultTo(0);
      table.integer('total_users').defaultTo(0);
      table.integer('active_users').defaultTo(0);
      table.integer('total_students').defaultTo(0);
      table.decimal('total_revenue', 12, 2).defaultTo(0);
      table.integer('new_signups').defaultTo(0);
      table.integer('cancellations').defaultTo(0);
      table.jsonb('metrics').defaultTo('{}'); // Additional metrics
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      table.unique('date');
      table.index('date');
    });
    console.log('✓ Created platform_analytics table');
  }

  // 5. Add is_platform_admin flag to users table
  const hasIsPlatformAdmin = await knex.schema.hasColumn('users', 'is_platform_admin');
  if (!hasIsPlatformAdmin) {
    await knex.schema.alterTable('users', (table) => {
      table.boolean('is_platform_admin').defaultTo(false);
      table.index('is_platform_admin');
    });
    console.log('✓ Added is_platform_admin column to users table');
  }

  // 6. Add subscription_id to tenants table
  const hasSubscriptionId = await knex.schema.hasColumn('tenants', 'subscription_id');
  if (!hasSubscriptionId) {
    await knex.schema.alterTable('tenants', (table) => {
      table.uuid('subscription_id').references('id').inTable('subscriptions');
      table.index('subscription_id');
    });
    console.log('✓ Added subscription_id to tenants table');
  }

  // 7. Create super admin permissions
  const superAdminPermissions = [
    // Tenant Management
    { name: 'tenant:create', description: 'Create new tenants', resource: 'tenant', action: 'create' },
    { name: 'tenant:read', description: 'View tenant information', resource: 'tenant', action: 'read' },
    { name: 'tenant:update', description: 'Update tenant information', resource: 'tenant', action: 'update' },
    { name: 'tenant:delete', description: 'Delete tenants', resource: 'tenant', action: 'delete' },
    { name: 'tenant:activate', description: 'Activate tenants', resource: 'tenant', action: 'activate' },
    { name: 'tenant:suspend', description: 'Suspend tenants', resource: 'tenant', action: 'suspend' },
    
    // Subscription Management
    { name: 'subscription:create', description: 'Create subscriptions', resource: 'subscription', action: 'create' },
    { name: 'subscription:read', description: 'View subscriptions', resource: 'subscription', action: 'read' },
    { name: 'subscription:update', description: 'Update subscriptions', resource: 'subscription', action: 'update' },
    { name: 'subscription:cancel', description: 'Cancel subscriptions', resource: 'subscription', action: 'cancel' },
    
    // Platform Analytics
    { name: 'platform:analytics', description: 'View platform analytics', resource: 'platform', action: 'analytics' },
    { name: 'platform:settings', description: 'Manage platform settings', resource: 'platform', action: 'settings' },
    
    // Gateway Management
    { name: 'gateway:configure', description: 'Configure communication gateways', resource: 'gateway', action: 'configure' },
    { name: 'gateway:read', description: 'View gateway configuration', resource: 'gateway', action: 'read' },
  ];

  // Insert permissions if they don't exist
  for (const permission of superAdminPermissions) {
    const exists = await knex('permissions').where({ name: permission.name }).first();
    if (!exists) {
      await knex('permissions').insert({
        ...permission,
        created_at: knex.fn.now(),
      });
    }
  }
  console.log('✓ Created super admin permissions');

  // 8. Assign all super admin permissions to super_admin role
  const superAdminRole = await knex('roles').where({ name: 'super_admin' }).first();
  if (superAdminRole) {
    const permissionIds = await knex('permissions')
      .whereIn('name', superAdminPermissions.map(p => p.name))
      .select('id');
    
    for (const permission of permissionIds) {
      const exists = await knex('role_permissions')
        .where({ role_id: superAdminRole.id, permission_id: permission.id })
        .first();
      
      if (!exists) {
        await knex('role_permissions').insert({
          role_id: superAdminRole.id,
          permission_id: permission.id,
          created_at: knex.fn.now(),
        });
      }
    }
    console.log('✓ Assigned permissions to super_admin role');
  }

  // 9. Update tenants table to add more metadata
  const hasTenantMetadata = await knex.schema.hasColumn('tenants', 'contact_email');
  if (!hasTenantMetadata) {
    await knex.schema.alterTable('tenants', (table) => {
      table.string('contact_email', 255);
      table.string('contact_phone', 20);
      table.text('address');
      table.string('timezone', 50).defaultTo('UTC');
      table.string('currency', 10).defaultTo('USD');
      table.string('language', 10).defaultTo('en');
      
      table.index('contact_email');
    });
    console.log('✓ Added metadata columns to tenants table');
  }

  console.log('Migration completed successfully: Add Super Admin Role');
}

export async function down(knex: Knex): Promise<void> {
  console.log('Rolling back migration: Add Super Admin Role');

  // Remove metadata columns from tenants
  const hasTenantMetadata = await knex.schema.hasColumn('tenants', 'contact_email');
  if (hasTenantMetadata) {
    await knex.schema.alterTable('tenants', (table) => {
      table.dropColumn('contact_email');
      table.dropColumn('contact_phone');
      table.dropColumn('address');
      table.dropColumn('timezone');
      table.dropColumn('currency');
      table.dropColumn('language');
    });
  }

  // Remove subscription_id from tenants
  const hasSubscriptionId = await knex.schema.hasColumn('tenants', 'subscription_id');
  if (hasSubscriptionId) {
    await knex.schema.alterTable('tenants', (table) => {
      table.dropColumn('subscription_id');
    });
  }

  // Remove is_platform_admin from users
  const hasIsPlatformAdmin = await knex.schema.hasColumn('users', 'is_platform_admin');
  if (hasIsPlatformAdmin) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('is_platform_admin');
    });
  }

  // Drop tables
  await knex.schema.dropTableIfExists('platform_analytics');
  await knex.schema.dropTableIfExists('billing_history');
  await knex.schema.dropTableIfExists('subscriptions');

  // Remove super admin role permissions
  const superAdminRole = await knex('roles').where({ name: 'super_admin' }).first();
  if (superAdminRole) {
    await knex('role_permissions').where({ role_id: superAdminRole.id }).del();
  }

  // Remove super admin permissions
  await knex('permissions').whereIn('resource', ['tenant', 'subscription', 'platform', 'gateway']).del();

  // Remove super admin role
  await knex('roles').where({ name: 'super_admin' }).del();

  console.log('Rollback completed: Add Super Admin Role');
}
