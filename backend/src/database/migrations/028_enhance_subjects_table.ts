import type { Knex } from 'knex';

/**
 * Migration: Enhance 'subjects' table for full curriculum management
 * 
 * Adds columns:
 * - category: core, science, arts, commercial, technical
 * - level: which education levels this subject applies to (all, jss, sss, primary)
 * - department: e.g. Sciences, Languages, Humanities, Business, Technical
 * - status: active/inactive for soft-delete
 * - is_elective: boolean flag
 * - created_by / updated_by: FK to users
 */
export async function up(knex: Knex): Promise<void> {
  const hasCategory = await knex.schema.hasColumn('subjects', 'category');
  const hasLevel = await knex.schema.hasColumn('subjects', 'level');
  const hasDepartment = await knex.schema.hasColumn('subjects', 'department');
  const hasStatus = await knex.schema.hasColumn('subjects', 'status');
  const hasIsElective = await knex.schema.hasColumn('subjects', 'is_elective');
  const hasCreatedBy = await knex.schema.hasColumn('subjects', 'created_by');
  const hasUpdatedBy = await knex.schema.hasColumn('subjects', 'updated_by');

  await knex.schema.alterTable('subjects', (table) => {
    if (!hasCategory) {
      table.string('category', 50).nullable();
    }
    if (!hasLevel) {
      table.string('level', 50).nullable().defaultTo('all');
    }
    if (!hasDepartment) {
      table.string('department', 100).nullable();
    }
    if (!hasStatus) {
      table.string('status', 20).notNullable().defaultTo('active');
    }
    if (!hasIsElective) {
      table.boolean('is_elective').notNullable().defaultTo(false);
    }
    if (!hasCreatedBy) {
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    }
    if (!hasUpdatedBy) {
      table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    }
  });

  // Add indexes for common filters
  if (!hasCategory) {
    await knex.schema.alterTable('subjects', (table) => {
      table.index('category');
    }).catch(() => { /* index may already exist */ });
  }
  if (!hasStatus) {
    await knex.schema.alterTable('subjects', (table) => {
      table.index('status');
    }).catch(() => { /* index may already exist */ });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasCategory = await knex.schema.hasColumn('subjects', 'category');
  const hasLevel = await knex.schema.hasColumn('subjects', 'level');
  const hasDepartment = await knex.schema.hasColumn('subjects', 'department');
  const hasStatus = await knex.schema.hasColumn('subjects', 'status');
  const hasIsElective = await knex.schema.hasColumn('subjects', 'is_elective');
  const hasCreatedBy = await knex.schema.hasColumn('subjects', 'created_by');
  const hasUpdatedBy = await knex.schema.hasColumn('subjects', 'updated_by');

  await knex.schema.alterTable('subjects', (table) => {
    if (hasCategory) table.dropColumn('category');
    if (hasLevel) table.dropColumn('level');
    if (hasDepartment) table.dropColumn('department');
    if (hasStatus) table.dropColumn('status');
    if (hasIsElective) table.dropColumn('is_elective');
    if (hasCreatedBy) table.dropColumn('created_by');
    if (hasUpdatedBy) table.dropColumn('updated_by');
  });
}
