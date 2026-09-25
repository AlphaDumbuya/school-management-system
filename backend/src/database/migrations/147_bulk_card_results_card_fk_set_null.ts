import type { Knex } from 'knex';

/**
 * Make bulk_card_results.card_id release its reference when an id_card is
 * deleted, instead of blocking the delete.
 *
 * The original FK (migration 022) declared `card_id REFERENCES id_cards(id)`
 * with NO onDelete rule, so Postgres defaulted to NO ACTION. Deleting a card
 * that had ever been produced by a bulk job therefore failed with
 * `violates foreign key constraint "bulk_card_results_card_id_foreign"`.
 *
 * card_id is nullable and only records which card a bulk-job row produced, so
 * ON DELETE SET NULL is correct: we keep the historical result row (status,
 * error, timestamps) while letting the card be deleted.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE bulk_card_results
    DROP CONSTRAINT IF EXISTS bulk_card_results_card_id_foreign;
  `);
  await knex.raw(`
    ALTER TABLE bulk_card_results
    ADD CONSTRAINT bulk_card_results_card_id_foreign
    FOREIGN KEY (card_id) REFERENCES id_cards(id) ON DELETE SET NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Restore the original constraint (no cascade behaviour).
  await knex.raw(`
    ALTER TABLE bulk_card_results
    DROP CONSTRAINT IF EXISTS bulk_card_results_card_id_foreign;
  `);
  await knex.raw(`
    ALTER TABLE bulk_card_results
    ADD CONSTRAINT bulk_card_results_card_id_foreign
    FOREIGN KEY (card_id) REFERENCES id_cards(id);
  `);
}
