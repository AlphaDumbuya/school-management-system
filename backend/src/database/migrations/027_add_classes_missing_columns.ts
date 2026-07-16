import type { Knex } from 'knex';

/**
 * Migration: Add missing columns to 'classes' and 'enrollments' tables
 * 
 * Classes table needs:
 * - section: Stream/section (e.g. "Science", "Arts", "A", "B")
 * - status: active/inactive for soft-delete
 * - floor: Physical location floor
 * - building: Physical location building
 * - created_by: User who created the class
 * 
 * Enrollments table needs:
 * - roll_number: Student's roll number within the class
 */
export async function up(knex: Knex): Promise<void> {
  // ── Classes table ───────────────────────────────────────────────────────────
  const hasSection = await knex.schema.hasColumn('classes', 'section');
  const hasStatus = await knex.schema.hasColumn('classes', 'status');
  const hasFloor = await knex.schema.hasColumn('classes', 'floor');
  const hasBuilding = await knex.schema.hasColumn('classes', 'building');
  const hasCreatedBy = await knex.schema.hasColumn('classes', 'created_by');
  const hasUpdatedBy = await knex.schema.hasColumn('classes', 'updated_by');

  await knex.schema.alterTable('classes', (table) => {
    if (!hasSection) {
      table.string('section', 50).nullable();
    }
    if (!hasStatus) {
      table.string('status', 20).notNullable().defaultTo('active');
    }
    if (!hasFloor) {
      table.string('floor', 50).nullable();
    }
    if (!hasBuilding) {
      table.string('building', 100).nullable();
    }
    if (!hasCreatedBy) {
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    }
    if (!hasUpdatedBy) {
      table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    }
  });

  // Add index on status for filtering
  if (!hasStatus) {
    await knex.schema.alterTable('classes', (table) => {
      table.index('status');
    }).catch(() => { /* index may already exist */ });
  }

  // ── Enrollments table ───────────────────────────────────────────────────────
  const hasRollNumber = await knex.schema.hasColumn('enrollments', 'roll_number');

  if (!hasRollNumber) {
    await knex.schema.alterTable('enrollments', (table) => {
      table.string('roll_number', 20).nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('classes', (table) => {
    table.dropColumn('section');
    table.dropColumn('status');
    table.dropColumn('floor');
    table.dropColumn('building');
    table.dropColumn('created_by');
    table.dropColumn('updated_by');
  });

  const hasRollNumber = await knex.schema.hasColumn('enrollments', 'roll_number');
  if (hasRollNumber) {
    await knex.schema.alterTable('enrollments', (table) => {
      table.dropColumn('roll_number');
    });
  }
}
