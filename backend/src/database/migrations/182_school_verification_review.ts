import type { Knex } from 'knex';

/**
 * School verification is now reviewed by WiSkul (the platform super admin)
 * instead of being approved instantly. Additive only: no existing row changes,
 * so schools that are already verified stay verified.
 *
 * verification_records.status (plain string, no enum):
 *   'unverified'  nothing submitted yet, a submission failed the format/name/EMIS
 *                 checks, or WiSkul revoked an earlier approval (last_reason says why)
 *   'pending'     the owner submitted; waiting for WiSkul to review it
 *   'verified'    approved by WiSkul (only this status passes the gates and badges)
 *   'rejected'    WiSkul did not approve it (last_reason says why); the owner may resubmit
 * users.verification_status (on the school owner) carries the same values.
 *
 * New columns on verification_records:
 *   submitted_at   when the owner last submitted for review
 *   reviewed_by    the super admin who approved / rejected / revoked (set null if removed)
 *   reviewed_at    when that review happened
 *   review_notes   the reviewer's optional notes
 * Plus an index on status (the review queue filters by it).
 *
 * emis_code is widened from varchar(20) to varchar(40): the form accepts codes
 * up to 30 characters, which a 20-character column rejected. Widening a varchar
 * keeps every value and is not undone by down().
 */
const TABLE = 'verification_records';
const STATUS_INDEX = 'verification_records_status_idx';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(TABLE))) return;

  if (!(await knex.schema.hasColumn(TABLE, 'submitted_at'))) {
    await knex.schema.alterTable(TABLE, (t) => {
      t.timestamp('submitted_at', { useTz: true }).nullable();
    });
  }
  if (!(await knex.schema.hasColumn(TABLE, 'reviewed_by'))) {
    await knex.schema.alterTable(TABLE, (t) => {
      t.uuid('reviewed_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    });
  }
  if (!(await knex.schema.hasColumn(TABLE, 'reviewed_at'))) {
    await knex.schema.alterTable(TABLE, (t) => {
      t.timestamp('reviewed_at', { useTz: true }).nullable();
    });
  }
  if (!(await knex.schema.hasColumn(TABLE, 'review_notes'))) {
    await knex.schema.alterTable(TABLE, (t) => {
      t.text('review_notes').nullable();
    });
  }

  await knex.raw(`CREATE INDEX IF NOT EXISTS ${STATUS_INDEX} ON ${TABLE} (status)`);

  // Widen only (never shrink): a no-op if the column is already 40+ characters.
  const col = await knex('information_schema.columns')
    .whereRaw('table_schema = current_schema()')
    .where({ table_name: TABLE, column_name: 'emis_code' })
    .first('character_maximum_length');
  if (col && col.character_maximum_length != null && Number(col.character_maximum_length) < 40) {
    await knex.raw(`ALTER TABLE ${TABLE} ALTER COLUMN emis_code TYPE varchar(40)`);
  }
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(TABLE))) return;
  await knex.raw(`DROP INDEX IF EXISTS ${STATUS_INDEX}`);
  for (const c of ['review_notes', 'reviewed_at', 'reviewed_by', 'submitted_at']) {
    if (await knex.schema.hasColumn(TABLE, c)) {
      await knex.schema.alterTable(TABLE, (t) => t.dropColumn(c));
    }
  }
}
