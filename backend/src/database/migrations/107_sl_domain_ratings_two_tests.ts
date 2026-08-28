import type { Knex } from 'knex';

/**
 * SL Domain Ratings — two ratings per test/term.
 *
 * The real booklet records TWO ratings per test column (headed "1" and "2")
 * for both Affective and Psychomotor, which produce a per-term Mean (Mn),
 * then a Yearly Mn + Rnk — exactly mirroring the cognitive Test 1 / Test 2 flow.
 *
 * This migration adds rating1 / rating2 and migrates any existing single
 * `rating` value into rating1. The old `rating` column is left in place
 * (nullable) for backward-compatibility; the service now uses rating1/rating2.
 */
export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('sl_domain_ratings');
  if (!hasTable) return;

  const hasRating1 = await knex.schema.hasColumn('sl_domain_ratings', 'rating1');
  const hasRating2 = await knex.schema.hasColumn('sl_domain_ratings', 'rating2');

  await knex.schema.alterTable('sl_domain_ratings', (table) => {
    if (!hasRating1) table.integer('rating1'); // first rating (1-5)
    if (!hasRating2) table.integer('rating2'); // second rating (1-5)
  });

  // Migrate any existing single rating into rating1
  const hasOldRating = await knex.schema.hasColumn('sl_domain_ratings', 'rating');
  if (hasOldRating && !hasRating1) {
    await knex('sl_domain_ratings').whereNotNull('rating').update({
      rating1: knex.ref('rating'),
    });
  }

  // Make the legacy `rating` column nullable so new inserts (rating1/rating2 only) succeed
  if (hasOldRating) {
    await knex.schema.alterTable('sl_domain_ratings', (table) => {
      table.integer('rating').nullable().alter();
    });
  }

  // eslint-disable-next-line no-console
  console.log('✅ sl_domain_ratings: added rating1 / rating2');
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('sl_domain_ratings');
  if (!hasTable) return;

  await knex.schema.alterTable('sl_domain_ratings', (table) => {
    table.dropColumn('rating1');
    table.dropColumn('rating2');
  });

  // eslint-disable-next-line no-console
  console.log('✅ sl_domain_ratings: removed rating1 / rating2');
}
