import type { Knex } from 'knex';

/**
 * Migration: align the `notifications` table with the columns the app actually
 * uses for in-app notifications (report-card releases, discipline, payments…).
 *
 * The live table (from the SMS/phase-9 lineage) is snake_case with:
 *   id, user_id, type, subject, message, status, sent_at, read_at, created_at,
 *   phone_number, sms_message_id, whatsapp_message_id
 *
 * The notification service additionally needs to store a JSON `data` payload
 * (used by the frontend to route + render the one-time result popup), the
 * delivery `channels`, a source reference, the creator, and an updated_at
 * timestamp. Add them if missing (all nullable → safe, additive).
 */
export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('notifications');
  if (!hasTable) return;

  const add: Array<[string, (t: Knex.AlterTableBuilder) => void]> = [
    ['data', (t) => t.jsonb('data').nullable()],
    ['channels', (t) => t.jsonb('channels').nullable()],
    ['source_type', (t) => t.string('source_type', 100).nullable()],
    ['source_id', (t) => t.uuid('source_id').nullable()],
    ['created_by', (t) => t.uuid('created_by').nullable()],
    ['updated_at', (t) => t.timestamp('updated_at', { useTz: true }).nullable()],
  ];

  for (const [col, builder] of add) {
    const has = await knex.schema.hasColumn('notifications', col);
    if (!has) {
      await knex.schema.alterTable('notifications', (t) => builder(t));
    }
  }

  // Helpful index for the bell feed (user's unread, newest first).
  await knex.raw('CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications (user_id, created_at DESC)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS notifications_user_created_idx');
  for (const col of ['data', 'channels', 'source_type', 'source_id', 'created_by', 'updated_at']) {
    const has = await knex.schema.hasColumn('notifications', col);
    if (has) {
      await knex.schema.alterTable('notifications', (t) => t.dropColumn(col));
    }
  }
}
