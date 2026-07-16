import type { Knex } from 'knex';

/**
 * Migration: Add comprehensive student profile fields
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('students', (table) => {
    // These may already exist from earlier ad-hoc additions
    table.string('religion', 100).nullable();
    table.string('nationality', 100).nullable();
    table.string('place_of_birth', 100).nullable();
    table.string('guardian_name', 200).nullable();
    table.string('guardian_phone', 20).nullable();
    table.string('guardian_relationship', 50).nullable();
    table.string('guardian_occupation', 100).nullable();
    table.string('emergency_contact', 20).nullable();
    table.string('previous_school', 200).nullable();
    table.text('medical_conditions').nullable();
  }).catch(() => {
    // Columns may already exist
  });
}

export async function down(knex: Knex): Promise<void> {
  // Not reversible safely
}
