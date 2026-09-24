import type { Knex } from 'knex';

/**
 * Marks each itemised structure expense (chalk, book, food, ID card, …) as
 * REQUIRED or OPTIONAL. Required charges must always be included when a family
 * pays "charges only"; optional charges the payer may choose to include or skip.
 * Also records the flag on the materialised fee rows so portals can honour it.
 */
export async function up(knex: Knex): Promise<void> {
  const hasExpCol = await knex.schema.hasColumn('fee_structure_expenses', 'required');
  if (!hasExpCol) {
    await knex.schema.alterTable('fee_structure_expenses', (t) => {
      t.boolean('required').notNullable().defaultTo(true);
    });
  }

  const hasFeeCol = await knex.schema.hasColumn('fees', 'required');
  if (!hasFeeCol) {
    await knex.schema.alterTable('fees', (t) => {
      // Nullable: only charge fees set this; tuition/other stay null (treated required).
      t.boolean('required').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('fee_structure_expenses', 'required')) {
    await knex.schema.alterTable('fee_structure_expenses', (t) => t.dropColumn('required'));
  }
  if (await knex.schema.hasColumn('fees', 'required')) {
    await knex.schema.alterTable('fees', (t) => t.dropColumn('required'));
  }
}
