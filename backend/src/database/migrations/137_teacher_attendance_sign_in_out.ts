import type { Knex } from 'knex';

/** Add arrival/departure timestamps and teacher comments without altering student attendance. */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('teacher_attendance', (table) => {
    table.timestamp('signed_in_at', { useTz: true }).nullable();
    table.timestamp('signed_out_at', { useTz: true }).nullable();
    table.string('sign_in_comment', 500).nullable();
    table.string('sign_out_comment', 500).nullable();
  });

  // The first version recorded teacher self check-ins in marked_at. Preserve
  // those as sign-ins; principal-entered marks remain administrative marks.
  await knex.raw(`
    UPDATE teacher_attendance AS ta
    SET signed_in_at = ta.marked_at
    FROM teachers AS t
    WHERE ta.teacher_id = t.id
      AND ta.marked_by = t.user_id
      AND ta.status IN ('present', 'late')
      AND ta.signed_in_at IS NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('teacher_attendance', (table) => {
    table.dropColumn('signed_in_at');
    table.dropColumn('signed_out_at');
    table.dropColumn('sign_in_comment');
    table.dropColumn('sign_out_comment');
  });
}
