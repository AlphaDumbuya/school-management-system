import type { Knex } from 'knex';

/**
 * Teachers and houses (additive only):
 *  - house_staff: the teachers attached to a house. One may be the house
 *    master / mistress ('master'), the others are 'staff'. Being on a house
 *    lets that teacher see the house's student list (read only).
 *  - house_ballot_permissions: a teacher the principal / admissions officer
 *    has allowed to draw houses for the students of their own classes. Without
 *    a row here a teacher can never draw.
 */
const POLICY = 'tenant_isolation';

async function secure(knex: Knex, table: string): Promise<void> {
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
  if (!(await knex.schema.hasTable('house_staff'))) {
    await knex.schema.createTable('house_staff', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      t.uuid('house_id').notNullable().references('id').inTable('houses').onDelete('CASCADE');
      t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.string('position', 10).notNullable().defaultTo('staff'); // master | staff
      t.uuid('created_by').nullable();
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.unique(['house_id', 'user_id']);
      t.index(['tenant_id', 'user_id']);
    });
    // At most one house master / mistress per house.
    await knex.raw("CREATE UNIQUE INDEX house_staff_one_master ON house_staff (house_id) WHERE position = 'master'");
  }

  if (!(await knex.schema.hasTable('house_ballot_permissions'))) {
    await knex.schema.createTable('house_ballot_permissions', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.uuid('granted_by').nullable();
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.unique(['tenant_id', 'user_id']);
    });
  }

  for (const table of ['house_staff', 'house_ballot_permissions']) await secure(knex, table);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('house_ballot_permissions');
  await knex.schema.dropTableIfExists('house_staff');
}
