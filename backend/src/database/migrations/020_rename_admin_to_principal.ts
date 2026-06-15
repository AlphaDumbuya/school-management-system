/**
 * Migration: Rename Admin Role to Principal
 * Phase 1.2: Role System Enhancement
 * 
 * This migration renames the 'admin' role to 'principal' throughout the system.
 * The 'admin' role is being deprecated in favor of 'principal' to better reflect
 * the hierarchical structure of the school management system.
 * 
 * Changes:
 * 1. Update users table role enum
 * 2. Update all existing 'admin' users to 'principal'
 * 3. Update role_permissions mappings
 * 4. Update audit_logs references
 */

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  console.log('Starting migration: Rename Admin to Principal');

  try {
    // Step 1: Add new 'principal' value to role enum if not exists
    console.log('Step 1: Updating role enum...');
    await knex.raw(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'principal' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
        ) THEN
          ALTER TYPE user_role ADD VALUE 'principal';
        END IF;
      END $$;
    `);
    console.log('✓ Role enum updated');

    // Step 2: Update all existing 'admin' users to 'principal'
    console.log('Step 2: Migrating existing admin users to principal...');
    const updatedUsers = await knex('users')
      .where({ role: 'admin' })
      .update({ role: 'principal' })
      .returning('id');
    console.log(`✓ Updated ${updatedUsers.length} users from admin to principal`);

    // Step 3: Update role_permissions table
    console.log('Step 3: Updating role_permissions...');
    const updatedPermissions = await knex('role_permissions')
      .where({ role_name: 'admin' })
      .update({ role_name: 'principal' })
      .returning('id');
    console.log(`✓ Updated ${updatedPermissions.length} role_permissions from admin to principal`);

    // Step 4: Update audit_logs if they reference roles
    console.log('Step 4: Updating audit_logs...');
    await knex.raw(`
      UPDATE audit_logs 
      SET details = jsonb_set(
        details::jsonb,
        '{role}',
        '"principal"'::jsonb
      )
      WHERE details::text LIKE '%"role":"admin"%'
    `);
    console.log('✓ Audit logs updated');

    // Step 5: Create a note in the database about this migration
    console.log('Step 5: Creating migration record...');
    await knex('system_settings').insert({
      key: 'role_migration_admin_to_principal',
      value: JSON.stringify({
        migrated_at: new Date().toISOString(),
        affected_users: updatedUsers.length,
        affected_permissions: updatedPermissions.length,
        note: 'Admin role renamed to Principal as part of Phase 1.2 refactoring'
      }),
      category: 'system',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }).onConflict('key').merge();
    console.log('✓ Migration record created');

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
    const updatedUsers = await knex('users')
      .where({ role: 'principal' })
      .whereNot({ is_platform_admin: true }) // Don't touch super_admin
      .update({ role: 'admin' })
      .returning('id');
    console.log(`✓ Rolled back ${updatedUsers.length} users from principal to admin`);

    // Step 2: Update role_permissions table
    console.log('Step 2: Rolling back role_permissions...');
    const updatedPermissions = await knex('role_permissions')
      .where({ role_name: 'principal' })
      .update({ role_name: 'admin' })
      .returning('id');
    console.log(`✓ Rolled back ${updatedPermissions.length} role_permissions from principal to admin`);

    // Step 3: Update audit_logs
    console.log('Step 3: Rolling back audit_logs...');
    await knex.raw(`
      UPDATE audit_logs 
      SET details = jsonb_set(
        details::jsonb,
        '{role}',
        '"admin"'::jsonb
      )
      WHERE details::text LIKE '%"role":"principal"%'
    `);
    console.log('✓ Audit logs rolled back');

    // Step 4: Remove migration record
    console.log('Step 4: Removing migration record...');
    await knex('system_settings')
      .where({ key: 'role_migration_admin_to_principal' })
      .delete();
    console.log('✓ Migration record removed');

    console.log('Rollback completed successfully: Principal renamed back to Admin');
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
}
