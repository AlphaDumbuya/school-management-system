import type { Knex } from 'knex';

/**
 * Phase 2.3 - Discipline & Conduct Module Migration
 *
 * Creates tables for:
 * - Conduct rules and policies
 * - Student infractions and violations
 * - Discipline actions (warnings, suspensions, etc.)
 * - Detention and consequence tracking
 * - Behavioral notes and observations
 * - Parent notifications
 * - Discipline appeals process
 * - Conduct reports and analytics
 *
 * @param knex - Knex instance
 */
export async function up(knex: Knex): Promise<void> {
  // Create conduct_rules table - Define school conduct policies
  await knex.schema.createTable('conduct_rules', (table) => {
    table.uuid('rule_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('name', 200).notNullable();
    table.text('description');
    table.string('category', 100).notNullable(); // 'attendance', 'academic', 'behavior', 'respect', 'safety'
    table.string('severity_level', 50).notNullable(); // 'minor', 'moderate', 'serious', 'critical'
    table.integer('points_value').notNullable().defaultTo(0); // Points towards suspension
    table.text('consequences'); // JSON string with tiered consequences
    table.boolean('requires_parent_notification').defaultTo(true);
    table.boolean('requires_documentation').defaultTo(true);
    table.boolean('active').defaultTo(true);
    table.uuid('created_by').references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['tenant_id', 'name']);
    table.index(['tenant_id', 'severity_level']);
    table.index(['tenant_id', 'category']);
  });

  // Create infraction_types table - Specific types of infractions
  await knex.schema.createTable('infraction_types', (table) => {
    table.uuid('infraction_type_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('rule_id').notNullable().references('rule_id').inTable('conduct_rules').onDelete('CASCADE');
    table.string('name', 150).notNullable();
    table.text('description');
    table.string('code', 50);
    table.integer('default_points').notNullable().defaultTo(1);
    table.boolean('is_repeatable').defaultTo(true);
    table.integer('max_occurrences_before_escalation').defaultTo(3);
    table.boolean('active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['tenant_id', 'code']);
    table.index(['tenant_id', 'rule_id']);
  });

  // Create student_infractions table - Record individual infractions
  await knex.schema.createTable('student_infractions', (table) => {
    table.uuid('infraction_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('student_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('infraction_type_id').notNullable().references('infraction_type_id').inTable('infraction_types');
    table.uuid('recorded_by').notNullable().references('id').inTable('users'); // Teacher/admin who recorded
    table.timestamp('incident_date').notNullable();
    table.text('incident_description');
    table.string('incident_location', 200);
    table.string('status', 50).defaultTo('recorded'); // 'recorded', 'acknowledged', 'resolved', 'appealed'
    table.integer('severity_override'); // Can override infraction type severity if needed
    table.text('notes');
    table.boolean('parent_notified').defaultTo(false);
    table.timestamp('parent_notification_date');
    table.string('evidence_type'); // 'photo', 'video', 'document', 'none'
    table.json('evidence_urls'); // URLs to evidence files
    table.boolean('is_confidential').defaultTo(false);
    table.uuid('class_id').references('id').inTable('classes');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['tenant_id', 'student_id']);
    table.index(['tenant_id', 'incident_date']);
    table.index(['tenant_id', 'status']);
    table.index(['tenant_id', 'recorded_by']);
  });

  // Create discipline_actions table - Actions taken in response to infractions
  await knex.schema.createTable('discipline_actions', (table) => {
    table.uuid('action_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('student_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('infraction_id').notNullable().references('infraction_id').inTable('student_infractions');
    table.string('action_type', 100).notNullable(); // 'warning', 'detention', 'suspension', 'expulsion', 'counseling'
    table.string('action_subtype', 100); // e.g., 'in_school_suspension', 'out_of_school_suspension'
    table.uuid('assigned_by').notNullable().references('id').inTable('users');
    table.text('action_description');
    table.timestamp('action_date').notNullable();
    table.timestamp('start_date');
    table.timestamp('end_date');
    table.integer('duration_days');
    table.string('status', 50).defaultTo('active'); // 'active', 'completed', 'appealed', 'cancelled'
    table.boolean('parent_notified').defaultTo(false);
    table.timestamp('parent_notification_date');
    table.text('conditions'); // Special conditions or requirements for the discipline action
    table.boolean('requires_follow_up').defaultTo(false);
    table.timestamp('follow_up_date');
    table.uuid('follow_up_assigned_to').references('id').inTable('users');
    table.text('notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['tenant_id', 'student_id']);
    table.index(['tenant_id', 'action_type']);
    table.index(['tenant_id', 'status']);
    table.index(['tenant_id', 'start_date', 'end_date']);
  });

  // Create detention_records table - Specific detention tracking
  await knex.schema.createTable('detention_records', (table) => {
    table.uuid('detention_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('action_id').notNullable().references('action_id').inTable('discipline_actions');
    table.uuid('student_id').notNullable().references('id').inTable('users');
    table.string('detention_type', 50).notNullable(); // 'after_school', 'weekend', 'lunch', 'before_school'
    table.timestamp('scheduled_date').notNullable();
    table.time('start_time');
    table.time('end_time');
    table.string('location', 200);
    table.uuid('supervised_by').references('id').inTable('users');
    table.string('status', 50).defaultTo('scheduled'); // 'scheduled', 'attended', 'absent', 'incomplete', 'rescheduled'
    table.timestamp('attended_date');
    table.text('supervisor_notes');
    table.boolean('parent_notified').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['tenant_id', 'student_id']);
    table.index(['tenant_id', 'status']);
    table.index(['tenant_id', 'scheduled_date']);
  });

  // Create behavioral_notes table - Teacher observations and positive/negative notes
  await knex.schema.createTable('behavioral_notes', (table) => {
    table.uuid('note_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('student_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('recorded_by').notNullable().references('id').inTable('users');
    table.string('note_type', 50).notNullable(); // 'positive', 'concern', 'observation', 'commendation'
    table.text('content');
    table.string('category', 100); // 'academic', 'social', 'emotional', 'behavioral'
    table.integer('rating'); // 1-5 rating for the behavior
    table.uuid('class_id').references('id').inTable('classes');
    table.timestamp('note_date').notNullable();
    table.boolean('parent_notified').defaultTo(false);
    table.boolean('is_shared_with_student').defaultTo(false);
    table.boolean('is_confidential').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['tenant_id', 'student_id']);
    table.index(['tenant_id', 'note_type']);
    table.index(['tenant_id', 'recorded_by']);
    table.index(['tenant_id', 'note_date']);
  });

  // Create discipline_appeals table - Student/parent appeals of discipline actions
  await knex.schema.createTable('discipline_appeals', (table) => {
    table.uuid('appeal_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('action_id').notNullable().references('action_id').inTable('discipline_actions');
    table.uuid('student_id').notNullable().references('id').inTable('users');
    table.uuid('submitted_by').notNullable().references('id').inTable('users'); // Student or parent
    table.string('submitted_by_type', 50).notNullable(); // 'student', 'parent', 'guardian'
    table.text('appeal_reason');
    table.string('status', 50).defaultTo('pending'); // 'pending', 'under_review', 'approved', 'rejected', 'escalated'
    table.text('evidence'); // JSON with evidence files
    table.timestamp('submitted_date').notNullable();
    table.uuid('reviewed_by').references('id').inTable('users');
    table.text('review_notes');
    table.timestamp('review_date');
    table.text('appeal_decision'); // Decision and reasoning
    table.string('decision_type'); // 'upheld', 'reduced', 'overturned'
    table.text('modified_action'); // If action was modified
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['tenant_id', 'student_id']);
    table.index(['tenant_id', 'status']);
    table.index(['tenant_id', 'submitted_date']);
  });

  // Create conduct_reports table - Periodic conduct reports for students
  await knex.schema.createTable('conduct_reports', (table) => {
    table.uuid('report_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('student_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('generated_by').references('id').inTable('users');
    table.string('report_period', 50).notNullable(); // 'term', 'semester', 'year', 'custom'
    table.date('period_start_date');
    table.date('period_end_date');
    table.integer('total_infractions').defaultTo(0);
    table.integer('total_points').defaultTo(0);
    table.integer('behavioral_rating'); // 1-10
    table.text('strengths');
    table.text('areas_for_improvement');
    table.text('teacher_comments');
    table.text('overall_assessment');
    table.boolean('parent_shared').defaultTo(false);
    table.timestamp('parent_share_date');
    table.boolean('parent_acknowledged').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['tenant_id', 'student_id']);
    table.index(['tenant_id', 'period_start_date']);
  });

  // Create conduct_analytics table - Aggregate analytics
  await knex.schema.createTable('conduct_analytics', (table) => {
    table.uuid('analytics_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('class_id').references('id').inTable('classes');
    table.date('analytics_date').notNullable();
    table.integer('total_students').defaultTo(0);
    table.integer('students_with_infractions').defaultTo(0);
    table.integer('total_infractions').defaultTo(0);
    table.integer('total_detentions').defaultTo(0);
    table.integer('total_suspensions').defaultTo(0);
    table.json('infractions_by_type'); // JSON object with counts
    table.json('infractions_by_severity'); // JSON object with counts
    table.decimal('average_behavior_rating', 5, 2);
    table.integer('pending_appeals').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['tenant_id', 'class_id', 'analytics_date']);
    table.index(['tenant_id', 'analytics_date']);
  });

  // Create discipline_audit_logs table - Audit trail for discipline actions
  await knex.schema.createTable('discipline_audit_logs', (table) => {
    table.uuid('log_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('entity_type', 100).notNullable(); // infraction, action, appeal, etc
    table.uuid('entity_id');
    table.uuid('user_id').references('id').inTable('users');
    table.string('action', 100).notNullable(); // 'created', 'updated', 'deleted', 'approved'
    table.json('changes'); // What changed
    table.string('ip_address', 45);
    table.string('user_agent', 500);
    table.timestamp('timestamp').defaultTo(knex.fn.now());

    table.index(['tenant_id', 'entity_type', 'entity_id']);
    table.index(['tenant_id', 'timestamp']);
  });
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order due to foreign key constraints
  await knex.schema.dropTableIfExists('discipline_audit_logs');
  await knex.schema.dropTableIfExists('conduct_analytics');
  await knex.schema.dropTableIfExists('conduct_reports');
  await knex.schema.dropTableIfExists('discipline_appeals');
  await knex.schema.dropTableIfExists('behavioral_notes');
  await knex.schema.dropTableIfExists('detention_records');
  await knex.schema.dropTableIfExists('discipline_actions');
  await knex.schema.dropTableIfExists('student_infractions');
  await knex.schema.dropTableIfExists('infraction_types');
  await knex.schema.dropTableIfExists('conduct_rules');
}
