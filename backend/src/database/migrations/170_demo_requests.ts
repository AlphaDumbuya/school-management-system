import type { Knex } from 'knex';
/**
 * Demo access requests (marketing site → "Book a live demo"), additive only:
 *  - demo_requests: one row per tester (unique email). Their personal sign-in
 *    links carry a token whose SHA-256 is stored here; usage counters show the
 *    super admin who tried the demo and which portals.
 *  - demo_request_events: timeline (requested, link sent, portal opened,
 *    follow-up emailed), newest first in the super admin page.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('demo_requests'))) {
    await knex.schema.createTable('demo_requests', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.string('full_name', 150).notNullable();
      t.string('email', 255).notNullable();
      t.string('phone', 40).notNullable();
      t.string('school_name', 200).notNullable();
      t.string('role', 40).notNullable(); // owner | principal | teacher | bursar | other
      t.string('student_count', 20).nullable(); // range label, e.g. "200-600"
      t.boolean('consent_followup').notNullable().defaultTo(false);
      t.string('token_hash', 64).notNullable();
      t.timestamp('expires_at', { useTz: true }).notNullable();
      t.integer('request_count').notNullable().defaultTo(1);
      t.integer('open_count').notNullable().defaultTo(0);
      t.jsonb('portals_opened').notNullable().defaultTo('{}'); // { principal: 3, teacher: 1 }
      t.timestamp('first_opened_at', { useTz: true }).nullable();
      t.timestamp('last_opened_at', { useTz: true }).nullable();
      t.integer('followups_sent').notNullable().defaultTo(0);
      t.timestamp('last_followup_at', { useTz: true }).nullable();
      t.text('notes').nullable();
      t.string('ip', 64).nullable();
      t.string('user_agent', 300).nullable();
      t.timestamps(true, true);
    });
    await knex.raw('CREATE UNIQUE INDEX IF NOT EXISTS demo_requests_email_unique ON demo_requests (LOWER(email))');
    await knex.raw('CREATE UNIQUE INDEX IF NOT EXISTS demo_requests_token_unique ON demo_requests (token_hash)');
    await knex.raw('CREATE INDEX IF NOT EXISTS demo_requests_created ON demo_requests (created_at DESC)');
  }
  if (!(await knex.schema.hasTable('demo_request_events'))) {
    await knex.schema.createTable('demo_request_events', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('request_id').notNullable().references('id').inTable('demo_requests').onDelete('CASCADE');
      t.string('kind', 30).notNullable(); // requested | link_sent | opened | followup | note
      t.string('portal', 30).nullable();
      t.text('note').nullable();
      t.uuid('created_by').nullable();
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
    await knex.raw('CREATE INDEX IF NOT EXISTS demo_request_events_request ON demo_request_events (request_id, created_at DESC)');
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('demo_request_events');
  await knex.schema.dropTableIfExists('demo_requests');
}
