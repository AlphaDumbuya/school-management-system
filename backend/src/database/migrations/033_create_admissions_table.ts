import type { Knex } from 'knex';

/**
 * Migration: Create admissions table
 * Full Sierra Leone school admission application structure
 */
export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('admission_applications');
  if (!exists) {
    await knex.schema.createTable('admission_applications', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('application_id', 30).unique().notNullable(); // Auto-generated: ADM-YEAR-XXXXX
      table.string('academic_year', 20).notNullable(); // 2026/2027

      // 1. Child's Personal Information
      table.string('child_first_name', 100).notNullable();
      table.string('child_middle_name', 100).nullable();
      table.string('child_last_name', 100).notNullable();
      table.date('child_dob').notNullable();
      table.string('child_gender', 10).notNullable(); // male, female
      table.string('child_nationality', 100).nullable();
      table.string('child_religion', 50).nullable();
      table.string('child_place_of_birth', 100).nullable();
      table.uuid('class_applying_for').nullable().references('id').inTable('classes').onDelete('SET NULL');
      table.text('child_address').nullable();
      table.string('previous_school', 200).nullable();
      table.string('last_grade_attained', 50).nullable();
      table.string('child_photo_url', 500).nullable();

      // 2. Parent / Guardian Information
      table.string('guardian_first_name', 100).notNullable();
      table.string('guardian_middle_name', 100).nullable();
      table.string('guardian_last_name', 100).notNullable();
      table.string('guardian_relationship', 50).notNullable(); // Father, Mother, Guardian
      table.string('guardian_phone', 20).notNullable();
      table.string('guardian_alt_phone', 20).nullable();
      table.string('guardian_email', 255).nullable();
      table.string('guardian_occupation', 100).nullable();
      table.text('guardian_address').nullable();
      table.string('guardian_nationality', 100).nullable();
      table.string('guardian_religion', 50).nullable();
      table.string('guardian_national_id', 50).nullable();

      // 3. Medical Information
      table.boolean('takes_medication').defaultTo(false);
      table.text('medication_details').nullable();
      table.boolean('has_allergies').defaultTo(false);
      table.text('allergy_details').nullable();
      table.boolean('has_chronic_illness').defaultTo(false);
      table.text('chronic_illness_details').nullable();
      table.boolean('allow_first_aid').defaultTo(true);

      // 4. Emergency Contact
      table.string('emergency_contact_name', 200).nullable();
      table.string('emergency_contact_relationship', 50).nullable();
      table.string('emergency_contact_phone', 20).nullable();

      // 5. Documents checklist (stored as JSON)
      table.text('documents_submitted').nullable(); // JSON array of submitted document names

      // 6. Office Use
      table.string('status', 30).notNullable().defaultTo('pending'); // pending, under_review, interview_scheduled, approved, rejected, enrolled
      table.date('date_received').nullable();
      table.string('received_by', 200).nullable();
      table.boolean('registration_fee_paid').defaultTo(false);
      table.date('interview_date').nullable();
      table.integer('assessment_score').nullable();
      table.text('decision_notes').nullable();
      table.uuid('decided_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('decided_at').nullable();

      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('status');
      table.index('academic_year');
      table.index('class_applying_for');
      table.index('created_at');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('admission_applications');
}
