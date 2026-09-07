import type { Knex } from 'knex';

/**
 * Per-tenant email sender control.
 *
 * A school can send transactional emails either:
 *   - via the platform's verified sender (default — works immediately), OR
 *   - fully from the school's own verified email address.
 *
 * The switch is per-tenant and controlled by the setup team AFTER they verify
 * the school's domain/email in the email provider (Brevo). Until then we keep
 * the school's DISPLAY NAME on emails but send from the platform address with
 * the school as reply-to (deliverable), then flip to the school's own address.
 *
 * email_sender_mode:
 *   'platform'  — From platform address (name = school). Reply-To = school. (default)
 *   'own'       — From the school's own verified email address.
 * email_sender_verified — set true by the setup team once the school's sender
 *   is verified in the provider; guards accidental switches to 'own'.
 */
export const config = { transaction: false };

export async function up(knex: Knex): Promise<void> {
  const hasMode = await knex.schema.hasColumn('schools', 'email_sender_mode');
  if (!hasMode) {
    await knex.schema.alterTable('schools', (t) => {
      t.string('email_sender_mode', 20).notNullable().defaultTo('platform');
    });
  }
  const hasVerified = await knex.schema.hasColumn('schools', 'email_sender_verified');
  if (!hasVerified) {
    await knex.schema.alterTable('schools', (t) => {
      t.boolean('email_sender_verified').notNullable().defaultTo(false);
    });
  }
  // Optional dedicated "from" email that may differ from the public contact
  // email (e.g. noreply@school.edu). Falls back to the school's contact email.
  const hasFrom = await knex.schema.hasColumn('schools', 'email_from_address');
  if (!hasFrom) {
    await knex.schema.alterTable('schools', (t) => {
      t.string('email_from_address', 255).nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const c of ['email_sender_mode', 'email_sender_verified', 'email_from_address']) {
    if (await knex.schema.hasColumn('schools', c)) {
      await knex.schema.alterTable('schools', (t) => t.dropColumn(c));
    }
  }
}
