import type { Knex } from 'knex';

/**
 * users.staff_duties — extra duties for a TEACHER who also works as the school's
 * Accountant (Bursar) and/or Admissions Officer, e.g. a form teacher who also
 * keeps the fees. Their main role stays 'teacher' (their classes, registers and
 * scores keep working); a duty adds that portal's access on top.
 *
 * JSON array of roles: [] | ['accountant'] | ['admissions_officer'] | both.
 * Additive and nullable-safe (defaults to []), no data changed.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('users', 'staff_duties'))) {
    await knex.schema.alterTable('users', (t) => {
      t.jsonb('staff_duties').notNullable().defaultTo(knex.raw("'[]'::jsonb"));
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('users', 'staff_duties')) {
    await knex.schema.alterTable('users', (t) => {
      t.dropColumn('staff_duties');
    });
  }
}
