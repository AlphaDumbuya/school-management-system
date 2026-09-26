import type { Knex } from 'knex';

/**
 * Complimentary (comp) subscription grants — platform-owner controlled.
 *
 * The superadmin can GIVE a school a plan for free (e.g. an enterprise offer, or
 * relief for a struggling school) without any payment. A comp grant can be:
 *   - open-ended (end_date = NULL) → never expires, never swept; or
 *   - time-boxed (end_date set)    → when it ends it gracefully downgrades to
 *     Freetong (never a lockout), same as a trial.
 * The superadmin can REVOKE a comp at any time to make the school start paying.
 *
 *   is_comp     — true when the platform owner granted this plan for free.
 *   comp_reason — optional note (why it was granted), shown in platform admin.
 *
 * A comp is distinct from a trial (is_trial): trials are automatic on signup;
 * comps are deliberate platform-owner gifts and are unrenewable by the tenant
 * (the tenant cannot pay to renew a comp — only the superadmin manages it).
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('subscriptions', 'is_comp'))) {
    await knex.schema.alterTable('subscriptions', (t) => {
      t.boolean('is_comp').notNullable().defaultTo(false);
    });
  }
  if (!(await knex.schema.hasColumn('subscriptions', 'comp_reason'))) {
    await knex.schema.alterTable('subscriptions', (t) => {
      t.string('comp_reason', 300).nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const c of ['is_comp', 'comp_reason']) {
    if (await knex.schema.hasColumn('subscriptions', c)) {
      await knex.schema.alterTable('subscriptions', (t) => t.dropColumn(c));
    }
  }
}
