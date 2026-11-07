import type { Knex } from 'knex';
/**
 * One link for the whole school (posted once in the parents' WhatsApp group), next to the personal links of 186.
 * Additive only:
 *  - student_record_shared_links: the school's current shared link. Unlike a personal link it is meant to be
 *    broadcast and shown to staff again, so the secret is kept as it is; the table is staff-only and tenant-scoped.
 *  - student_record_updates: a submission through the shared link does not know which student it is for, so
 *    student_id may be empty until the officer (or the name match) fills it, and the parent's own words about
 *    who the child is are kept.
 */
const POLICY = 'tenant_isolation';
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('student_record_shared_links'))) {
    await knex.schema.createTable('student_record_shared_links', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      t.string('token', 64).notNullable().unique();
      t.timestamp('expires_at', { useTz: true }).nullable();
      t.timestamp('closed_at', { useTz: true }).nullable();
      t.uuid('created_by').nullable();
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.index(['tenant_id', 'closed_at']);
    });
    await knex.raw('ALTER TABLE ?? ENABLE ROW LEVEL SECURITY', ['student_record_shared_links']);
    await knex.raw('ALTER TABLE ?? FORCE ROW LEVEL SECURITY', ['student_record_shared_links']);
    await knex.raw(`DROP POLICY IF EXISTS ${POLICY} ON ??`, ['student_record_shared_links']);
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
      ['student_record_shared_links'],
    );
  }
  await knex.raw('ALTER TABLE student_record_updates ALTER COLUMN student_id DROP NOT NULL');
  const add = async (col: string, fn: (t: Knex.AlterTableBuilder) => void) => {
    if (!(await knex.schema.hasColumn('student_record_updates', col))) await knex.schema.alterTable('student_record_updates', fn);
  };
  await add('source', (t) => { t.string('source', 20).notNullable().defaultTo('personal'); }); // personal | shared | office
  await add('claimed_name', (t) => { t.string('claimed_name', 200).nullable(); });
  await add('claimed_class_id', (t) => { t.uuid('claimed_class_id').nullable(); });
  await add('claimed_class_name', (t) => { t.string('claimed_class_name', 120).nullable(); });
}
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('student_record_shared_links');
  // The student_record_updates columns are left in place: they may hold data by now.
}
