import type { Knex } from 'knex';

/**
 * Report Card Verification Codes
 * ==============================
 * Each report card generation triggers a NEW unique verification code (random
 * 32-char hex token). The code is stored here and looked up by the public
 * verification endpoint when a QR code is scanned.
 *
 * This replaces the old deterministic-hash approach
 * (sha256(tenant:student:class:year)[:24]) which always produced the same
 * QR for the same student/class/year — making it impossible to distinguish
 * between different print runs of the same report card.
 *
 * The latest code for a (tenant, student, class, academic_year) is the
 * "active" one; older codes are retained for audit history.
 */
export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('sl_report_card_verification_codes');
  if (!hasTable) {
    await knex.schema.createTable('sl_report_card_verification_codes', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      table.uuid('class_id').notNullable().references('id').inTable('classes').onDelete('CASCADE');
      table.string('academic_year', 20).notNullable();

      // The unique verification code embedded in the QR URL
      table.string('verification_code', 64).notNullable();

      // Who triggered the generation (nullable for system/auto-generated)
      table.uuid('generated_by').references('id').inTable('users').onDelete('SET NULL');

      table.timestamp('created_at').defaultTo(knex.fn.now());

      // Unique index on the code itself — one code maps to exactly one report card instance
      table.unique(['verification_code'], { indexName: 'sl_rcvc_code_unique' });
      // Composite index for looking up the latest code for a student/class/year
      table.index(['tenant_id', 'student_id', 'class_id', 'academic_year'], 'sl_rcvc_lookup_idx');
      table.index(['tenant_id']);
    });
  }

  // ── Migrate existing deterministic hashes to the new table ──────────────
  // For each (tenant, student, class, academic_year) that already has a report
  // card meta entry, seed a verification code matching the old deterministic
  // hash so existing printed QRs continue to work.
  try {
    const existing = await knex('sl_report_card_meta')
      .select('tenant_id', 'student_id', 'class_id', 'academic_year')
      .groupBy('tenant_id', 'student_id', 'class_id', 'academic_year');

    for (const row of existing) {
      // Compute old deterministic hash: sha256(tenant:student:class:year)[:24]
      // so existing printed QRs continue to work under the new DB-based lookup.
      const hashInput = `${row.tenant_id}:${row.student_id}:${row.class_id}:${row.academic_year}`;
      const { createHash } = await import('crypto');
      const oldHash = createHash('sha256').update(hashInput).digest('hex').slice(0, 24);
      const alreadyHas = await knex('sl_report_card_verification_codes')
        .where({
          tenant_id: row.tenant_id,
          student_id: row.student_id,
          class_id: row.class_id,
          academic_year: row.academic_year,
        })
        .first();
      if (!alreadyHas) {
        await knex('sl_report_card_verification_codes').insert({
          tenant_id: row.tenant_id,
          student_id: row.student_id,
          class_id: row.class_id,
          academic_year: row.academic_year,
          verification_code: oldHash,
        });
      }
    }
  } catch {
    // sl_report_card_meta may not exist yet — no-op
  }

  // eslint-disable-next-line no-console
  console.log('✅ sl_report_card_verification_codes migration completed');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('sl_report_card_verification_codes');
  // eslint-disable-next-line no-console
  console.log('✅ sl_report_card_verification_codes migration rolled back');
}
