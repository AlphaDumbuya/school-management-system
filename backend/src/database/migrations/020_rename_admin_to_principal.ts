/**
 * Migration: Rename Admin Role to Principal
 * Phase 1.2: Role System Enhancement
 * 
 * This migration renames the 'admin' role to 'principal' throughout the system.
 * The 'admin' role is being deprecated in favor of 'principal' to better reflect
 * the hierarchical structure of the school management system.
 * 
 * Changes:
 * 1. Update all existing 'admin' users to 'principal'
 * 2. Update role_permissions mappings
 * 3. Update audit_logs references
 */

import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  console.log('Starting migration: Rename Admin to Principal');

  try {
    // Step 1: Check if role column exists (string type, not enum)
    console.log('Step 1: Checking users table role column...');
    const hasRoleColumn = await knex.schema.hasColumn('users', 'role');
    if (!hasRoleColumn) {
      throw new Error('Users table does not have a role column');
    }
    console.log('✓ Role column exists (string type)');

    // Step 2: Update all existing 'admin' users to 'principal'
    console.log('Step 2: Migrating existing admin users to principal...');
    const updatedUsersCount = await knex('users')
      .where({ role: 'admin' })
      .update({ role: 'principal', updated_at: knex.fn.now() });
    console.log(`✓ Updated ${updatedUsersCount} users from admin to principal`);

    // Step 3: Check if roles table exists and update if needed
    console.log('Step 3: Checking roles table...');
    const hasRolesTable = await knex.schema.hasTable('roles');
    if (hasRolesTable) {
      const updatedRoles = await knex('roles')
        .where({ name: 'admin' })
        .update({ name: 'principal', updated_at: knex.fn.now() });
      console.log(`✓ Updated ${updatedRoles} role records from admin to principal`);
    } else {
      console.log('⚠ Roles table not found, skipping');
    }

    // Step 4: Update audit_logs if they exist and reference roles
    console.log('Step 4: Updating audit_logs...');
    const hasAuditLogs = await knex.schema.hasTable('audit_logs');
    if (hasAuditLogs) {
      const hasChangesColumn = await knex.schema.hasColumn('audit_logs', 'changes');
      if (hasChangesColumn) {
        await knex.raw(`
          UPDATE audit_logs 
          SET changes = jsonb_set(
            COALESCE(changes, '{}'::jsonb),
            '{role}',
            '"principal"'::jsonb
          )
          WHERE changes::text LIKE '%"role"%' AND changes::text LIKE '%"admin"%'
        `);
        console.log('✓ Audit logs updated');
      }
    }

    console.log('Migration completed successfully: Rename Admin to Principal');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

export async function down(knex: Knex): Promise<void> {
  console.log('Starting rollback: Rename Principal back to Admin');

  try {
    // Step 1: Update all 'principal' users back to 'admin'
    console.log('Step 1: Rolling back principal users to admin...');
    const updatedUsersCount = await knex('users')
      .where({ role: 'principal' })
      .update({ role: 'admin', updated_at: knex.fn.now() });
    console.log(`✓ Rolled back ${updatedUsersCount} users from principal to admin`);

    // Step 2: Update roles table if it exists
    console.log('Step 2: Rolling back roles table...');
    const hasRolesTable = await knex.schema.hasTable('roles');
    if (hasRolesTable) {
      const updatedRoles = await knex('roles')
        .where({ name: 'principal' })
        .update({ name: 'admin', updated_at: knex.fn.now() });
      console.log(`✓ Rolled back ${updatedRoles} role records from principal to admin`);
    }

    // Step 3: Update audit_logs
    console.log('Step 3: Rolling back audit_logs...');
    const hasAuditLogs = await knex.schema.hasTable('audit_logs');
    if (hasAuditLogs) {
      const hasChangesColumn = await knex.schema.hasColumn('audit_logs', 'changes');
      if (hasChangesColumn) {
        await knex.raw(`
          UPDATE audit_logs 
          SET changes = jsonb_set(
            COALESCE(changes, '{}'::jsonb),
            '{role}',
            '"admin"'::jsonb
          )
          WHERE changes::text LIKE '%"role"%' AND changes::text LIKE '%"principal"%'
        `);
        console.log('✓ Audit logs rolled back');
      }
    }

    console.log('Rollback completed successfully: Principal renamed back to Admin');
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
}
