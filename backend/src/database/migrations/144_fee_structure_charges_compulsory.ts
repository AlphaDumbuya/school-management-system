import type { Knex } from 'knex';

/**
 * Adds an admin-configurable flag to fee structures controlling whether the
 * itemised charges/expenses (chalk, book, food, ID card, …) are COMPULSORY in
 * the First Term. When true, a First-Term / full-outstanding payment must cover
 * any unpaid charges before it is accepted. When false (default), charges are
 * still billed with Term 1 but families may pay them at their own pace.
 */
export async function up(knex: Knex): Promise<void> {
  const has = await knex.schema.hasColumn('fee_structures', 'charges_compulsory_first_term');
  if (!has) {
    await knex.schema.alterTable('fee_structures', (t) => {
      t.boolean('charges_compulsory_first_term').notNullable().defaultTo(false);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const has = await knex.schema.hasColumn('fee_structures', 'charges_compulsory_first_term');
  if (has) {
    await knex.schema.alterTable('fee_structures', (t) => {
      t.dropColumn('charges_compulsory_first_term');
    });
  }
}
