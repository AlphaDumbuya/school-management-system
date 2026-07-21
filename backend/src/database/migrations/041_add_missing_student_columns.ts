import type { Knex } from 'knex';

/**
 * Migration: Add missing columns to students table
 * 
 * The original schema lacked: first_name, last_name, email, tenant_id, photo_url
 * The user_id was also originally NOT NULL but the admission flow sets it to null.
 * This migration:
 *  1. Adds missing columns safely (using raw ALTER IF NOT EXISTS)
 *  2. Backfills tenant_id from users where user_id is set
 *  3. Makes user_id nullable
 */
export async function up(knex: Knex): Promise<void> {
  // Add columns only if they don't exist
  const hasFirstName = await knex.schema.hasColumn('students', 'first_name');
  const hasLastName = await knex.schema.hasColumn('students', 'last_name');
  const hasEmail = await knex.schema.hasColumn('students', 'email');
  const hasTenantId = await knex.schema.hasColumn('students', 'tenant_id');
  const hasPhotoUrl = await knex.schema.hasColumn('students', 'photo_url');

  await knex.schema.alterTable('students', (table) => {
    if (!hasFirstName) table.string('first_name', 100).nullable();
    if (!hasLastName) table.string('last_name', 100).nullable();
    if (!hasEmail) table.string('email', 255).nullable();
    if (!hasTenantId) table.uuid('tenant_id').nullable().references('id').inTable('tenants').onDelete('CASCADE');
    if (!hasPhotoUrl) table.text('photo_url').nullable();
  });

  // Make user_id nullable if it isn't already
  await knex.raw(`
    ALTER TABLE students ALTER COLUMN user_id DROP NOT NULL
  `).catch(() => {
    // Already nullable, ignore
  });

  // Remove unique constraint on user_id so multiple students can have null user_id
  await knex.raw(`
    ALTER TABLE students DROP CONSTRAINT IF EXISTS students_user_id_unique
  `).catch(() => {});

  // Backfill tenant_id from users table where user_id is set
  if (!hasTenantId) {
    await knex.raw(`
      UPDATE students
      SET tenant_id = users.tenant_id
      FROM users
      WHERE students.user_id = users.id
        AND students.tenant_id IS NULL
    `).catch(() => {});

    // For students linked via admissions (user_id = null), try to infer tenant from
    // enrollments → classes → academic_sessions → tenant_id
    await knex.raw(`
      UPDATE students s
      SET tenant_id = sub.tenant_id
      FROM (
        SELECT DISTINCT ON (e.student_id) e.student_id, ast.tenant_id
        FROM enrollments e
        JOIN classes c ON c.id = e.class_id
        JOIN academic_sessions ast ON ast.id = c.academic_session_id
        WHERE ast.tenant_id IS NOT NULL
        ORDER BY e.student_id, e.created_at DESC
      ) sub
      WHERE s.id = sub.student_id
        AND s.tenant_id IS NULL
    `).catch(() => {});
  }

  // Add index for performance
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_students_tenant_id ON students(tenant_id)
  `).catch(() => {});

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_students_email ON students(email)
  `).catch(() => {});
}

export async function down(knex: Knex): Promise<void> {
  // Reversing this would be destructive; skip for safety
}
