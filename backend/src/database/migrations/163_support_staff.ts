import type { Knex } from 'knex';

/**
 * support_staff — security, cleaners, cooks, drivers, gardeners, maintenance.
 *
 * Easy onboarding: a staff record with no login (they don't use the portal).
 * Professional staff (teachers, accountants, admissions officers) go through
 * the full staff onboarding in users + teachers instead.
 * Additive: new table only.
 */
export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('support_staff')) return;
  await knex.schema.createTable('support_staff', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('staff_id', 40).notNullable();
    t.string('first_name', 100).notNullable();
    t.string('last_name', 100).notNullable();
    // security | cleaner | cook | driver | gardener | maintenance | other
    t.string('job_type', 40).notNullable().defaultTo('other');
    t.string('job_title', 100).nullable();
    t.string('gender', 20).nullable();
    t.string('phone', 30).nullable();
    t.string('address', 255).nullable();
    t.text('photo_url').nullable();
    t.date('hire_date').nullable();
    t.string('employment_type', 30).notNullable().defaultTo('full_time');
    t.string('emergency_contact_name', 150).nullable();
    t.string('emergency_contact_phone', 30).nullable();
    t.string('status', 20).notNullable().defaultTo('active');
    t.text('notes').nullable();
    t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
    t.unique(['tenant_id', 'staff_id']);
    t.index(['tenant_id', 'status']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('support_staff');
}
