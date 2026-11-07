import type { Knex } from 'knex';
/**
 * Completing the records of students who were enrolled before the system. Additive only:
 *  - student_update_links: a personal, expiring link per student. Only the SHA-256 of the secret is stored, so
 *    a database read never reveals a working link.
 *  - student_record_updates: what a parent submitted through a link, waiting for the officer to approve.
 *  - students.emergency_contact_name / emergency_contact_relationship: the existing emergency_contact column
 *    holds only a phone number.
 */
const POLICY = 'tenant_isolation';
async function secure(knex: Knex, table: string): Promise<void> {
  // Same backward-compatible tenant policy migration 149 puts on every tenant table.
  await knex.raw('ALTER TABLE ?? ENABLE ROW LEVEL SECURITY', [table]);
  await knex.raw('ALTER TABLE ?? FORCE ROW LEVEL SECURITY', [table]);
  await knex.raw(`DROP POLICY IF EXISTS ${POLICY} ON ??`, [table]);
  await knex.raw(
    `CREATE POLICY ${POLICY} ON ??
     USING (
       current_setting('app.current_tenant', true) IS NULL
       OR current_setting('app.current_tenant', true) = ''
       OR tenant_id IS NULL
       OR tenant_id::text = current_setting('app.current_tenant', true)
     )
     WITH CHECK (
       current_setting('app.current_tenant', true) IS NULL
       OR current_setting('app.current_tenant', true) = ''
       OR tenant_id IS NULL
       OR tenant_id::text = current_setting('app.current_tenant', true)
     )`,
    [table],
  );
}
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('students', 'emergency_contact_name'))) {
    await knex.schema.alterTable('students', (t) => { t.string('emergency_contact_name', 200).nullable(); });
  }
  if (!(await knex.schema.hasColumn('students', 'emergency_contact_relationship'))) {
    await knex.schema.alterTable('students', (t) => { t.string('emergency_contact_relationship', 50).nullable(); });
  }
  if (!(await knex.schema.hasTable('student_update_links'))) {
    await knex.schema.createTable('student_update_links', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      t.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      t.string('token_hash', 64).notNullable().unique();
      t.timestamp('expires_at', { useTz: true }).notNullable();
      t.timestamp('revoked_at', { useTz: true }).nullable();
      t.timestamp('last_opened_at', { useTz: true }).nullable();
      t.uuid('created_by').nullable();
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.index(['tenant_id', 'student_id']);
    });
    await secure(knex, 'student_update_links');
  }
  if (!(await knex.schema.hasTable('student_record_updates'))) {
    await knex.schema.createTable('student_record_updates', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      t.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      t.uuid('link_id').nullable().references('id').inTable('student_update_links').onDelete('SET NULL');
      t.string('status', 20).notNullable().defaultTo('pending'); // pending | approved | rejected | superseded
      t.jsonb('payload').notNullable().defaultTo('{}');
      t.text('review_note').nullable();
      t.uuid('reviewed_by').nullable();
      t.timestamp('reviewed_at', { useTz: true }).nullable();
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.index(['tenant_id', 'status', 'created_at']);
      t.index(['student_id']);
    });
    await secure(knex, 'student_record_updates');
  }
}
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('student_record_updates');
  await knex.schema.dropTableIfExists('student_update_links');
  // The two students columns are left in place: they may hold data by now.
}
