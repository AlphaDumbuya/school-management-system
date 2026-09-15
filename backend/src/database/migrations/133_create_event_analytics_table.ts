/**
 * Migration 133 — Create `event_analytics` table.
 *
 * The Event Management analytics aggregation job (backend/src/jobs/eventManagementJobs.ts)
 * writes per-event analytics rows (total registrations, attendance, no-show count, rate),
 * but no migration had ever created this table, causing repeated errors:
 *
 *   error: [EVENT JOB] Analytics error for event <id>:
 *     relation "event_analytics" does not exist
 *
 * This migration creates the table with the exact columns the job writes.
 * The unique constraint on `event_id` supports the job's `.onConflict('event_id').ignore()`.
 */

import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Idempotent — skip if the table already exists from a manual CREATE.
  const exists = await knex.schema.hasTable('event_analytics');
  if (exists) return;

  await knex.schema.createTable('event_analytics', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('event_id').notNullable().references('event_id').inTable('events').onDelete('cascade');
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('cascade');
    table.integer('total_registrations').notNullable().defaultTo(0);
    table.integer('total_attendance').notNullable().defaultTo(0);
    table.integer('no_show_count').notNullable().defaultTo(0);
    table.decimal('attendance_rate', 5, 2).notNullable().defaultTo(0.00);
    table.timestamps(true, true); // created_at, updated_at

    // The job uses .onConflict('event_id').ignore() — needs a unique constraint.
    table.unique(['event_id'], { indexName: 'event_analytics_event_id_unique' });
    table.index(['tenant_id'], 'event_analytics_tenant_id_index');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('event_analytics');
}
