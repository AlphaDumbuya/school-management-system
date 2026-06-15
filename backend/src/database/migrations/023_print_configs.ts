import type { Knex } from 'knex';

/**
 * Migration: Print Configuration Storage
 * 
 * Creates table for storing user print configuration profiles
 * for ID card printing (paper size, margins, printer settings)
 * 
 * Requirements: 11.1, 11.2, 11.5
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('print_configs', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    
    // Foreign keys
    table.uuid('user_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.uuid('tenant_id').notNullable()
      .references('id').inTable('tenants').onDelete('CASCADE');
    
    // Configuration data
    table.string('name', 100).notNullable();
    table.jsonb('config').notNullable();
    table.boolean('is_default').notNullable().defaultTo(false);
    
    // Timestamps
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    // Indexes
    table.index('user_id', 'idx_print_configs_user');
    table.index('tenant_id', 'idx_print_configs_tenant');
    table.index(['user_id', 'is_default'], 'idx_print_configs_user_default');
    
    // Constraint: Only one default config per user
    table.unique(['user_id', 'tenant_id', 'is_default'], {
      indexName: 'uq_print_configs_user_default',
      predicate: knex.whereRaw('is_default = true')
    });
  });

  console.log('✅ Created print_configs table');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('print_configs');
  console.log('✅ Dropped print_configs table');
}
