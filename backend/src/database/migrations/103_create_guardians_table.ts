import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('guardians');
  if (!exists) {
    await knex.schema.createTable('guardians', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      table.string('first_name', 100).notNullable();
      table.string('last_name', 100).notNullable();
      table.string('relationship', 50);          // Father, Mother, Uncle, etc.
      table.string('email', 255);
      table.string('phone_number', 30);
      table.string('occupation', 100);
      table.text('address');
      table.boolean('is_primary_guardian').defaultTo(false);
      table.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);
    });

    // Index for fast lookup by student
    await knex.schema.alterTable('guardians', (table) => {
      table.index(['student_id'], 'guardians_student_id_idx');
      table.index(['is_primary_guardian'], 'guardians_is_primary_idx');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('guardians');
}
