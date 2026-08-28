import type { Knex } from 'knex';

/**
 * Relax the foreign key on bulk_card_results.user_id.
 *
 * A bulk card target can be a `students` row that has no linked `users`
 * record (student-only accounts). The original FK to users(id) rejected such
 * ids, breaking bulk generation for students. We drop the FK constraint so a
 * result row can reference either a user or a student id. The column stays
 * NOT NULL and indexed.
 */
export async function up(knex: Knex): Promise<void> {
  // Drop the FK constraint if it exists (Postgres default name convention).
  await knex.raw(`
    ALTER TABLE bulk_card_results
    DROP CONSTRAINT IF EXISTS bulk_card_results_user_id_foreign;
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Re-add the FK (best effort). Existing student-only ids would block this,
  // so guard with NOT VALID to avoid failing on legacy data.
  await knex.raw(`
    ALTER TABLE bulk_card_results
    ADD CONSTRAINT bulk_card_results_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES users(id) NOT VALID;
  `);
}
