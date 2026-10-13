import type { Knex } from 'knex';

/**
 * School houses (sports teams) and the house ballot. Additive only:
 *  - houses: the school's houses (name, colour, motto). Managed by the
 *    principal and the admissions officer.
 *  - house_settings: one row per school, how the ballot balances the houses.
 *  - house_draws: audit trail of every ballot / assignment / change.
 *  - students.house_id: the student's house (null until drawn).
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
  if (!(await knex.schema.hasTable('houses'))) {
    await knex.schema.createTable('houses', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      t.string('name', 60).notNullable();
      t.string('color', 7).notNullable().defaultTo('#2563eb'); // #RRGGBB
      t.string('motto', 160).nullable();
      t.integer('sort_order').notNullable().defaultTo(0);
      t.boolean('is_active').notNullable().defaultTo(true);
      t.uuid('created_by').nullable();
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.index(['tenant_id', 'is_active']);
    });
    await knex.raw('CREATE UNIQUE INDEX houses_tenant_name_unique ON houses (tenant_id, LOWER(name))');
  }

  if (!(await knex.schema.hasTable('house_settings'))) {
    await knex.schema.createTable('house_settings', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable().unique().references('id').inTable('tenants').onDelete('CASCADE');
      t.string('balance_scope', 10).notNullable().defaultTo('school'); // school | class
      t.boolean('balance_gender').notNullable().defaultTo(true);
      t.boolean('keep_siblings').notNullable().defaultTo(true);
      t.boolean('auto_assign_on_enrol').notNullable().defaultTo(false);
      t.uuid('updated_by').nullable();
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
  }

  if (!(await knex.schema.hasTable('house_draws'))) {
    await knex.schema.createTable('house_draws', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      t.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      t.uuid('house_id').nullable().references('id').inTable('houses').onDelete('SET NULL');
      t.uuid('previous_house_id').nullable().references('id').inTable('houses').onDelete('SET NULL');
      t.string('method', 20).notNullable(); // ballot | auto | sibling | manual | removed
      t.string('reason', 300).nullable();
      t.uuid('drawn_by').nullable();
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.index(['tenant_id', 'created_at']);
      t.index(['student_id', 'created_at']);
    });
  }

  if (!(await knex.schema.hasColumn('students', 'house_id'))) {
    await knex.schema.alterTable('students', (t) => {
      t.uuid('house_id').nullable().references('id').inTable('houses').onDelete('SET NULL');
      t.index(['house_id']);
    });
  }

  for (const table of ['houses', 'house_settings', 'house_draws']) await secure(knex, table);
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('students', 'house_id')) {
    await knex.schema.alterTable('students', (t) => { t.dropColumn('house_id'); });
  }
  await knex.schema.dropTableIfExists('house_draws');
  await knex.schema.dropTableIfExists('house_settings');
  await knex.schema.dropTableIfExists('houses');
}
