import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create reports table
  const hasReports = await knex.schema.hasTable('reports');
  if (!hasReports) {
    await knex.schema.createTable('reports', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.enum('type', [
      'grade',
      'attendance',
      'performance',
      'class_performance',
      'schedule_utilization',
      'custom',
    ]);
    table.string('name').notNullable();
    table.text('description');
    table.uuid('created_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.uuid('class_id').nullable().references('id').inTable('classes').onDelete('SET NULL');
    table.uuid('student_id').nullable().references('id').inTable('students').onDelete('SET NULL');
    table.uuid('teacher_id').nullable().references('id').inTable('teachers').onDelete('SET NULL');
    table.json('filters').nullable(); // Store report filters as JSON
    table.json('data').nullable(); // Store report data
    table.enum('status', ['pending', 'generated', 'exported', 'archived']).defaultTo('pending');
    table.timestamp('generated_at').nullable();
    table.timestamp('exported_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index('type');
    table.index('created_by');
    table.index('status');
    table.index('generated_at');
    table.index(['type', 'created_at']);
    table.index(['created_by', 'created_at']);
    });
  }

  // Create report_exports table
  const hasReportExports = await knex.schema.hasTable('report_exports');
  if (!hasReportExports) {
    await knex.schema.createTable('report_exports', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('report_id').notNullable().references('id').inTable('reports').onDelete('CASCADE');
    table.enum('format', ['json', 'csv', 'pdf', 'excel']).defaultTo('json');
    table.text('file_path').notNullable();
    table.bigInteger('file_size');
    table.uuid('exported_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.enum('status', ['pending', 'completed', 'failed']).defaultTo('pending');
    table.text('error_message').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('completed_at').nullable();
    
    table.index('report_id');
    table.index('status');
    });
  }

  // Create analytics_snapshots table
  const hasAnalyticsSnapshots = await knex.schema.hasTable('analytics_snapshots');
  if (!hasAnalyticsSnapshots) {
    await knex.schema.createTable('analytics_snapshots', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.enum('snapshot_type', [
      'dashboard',
      'student',
      'class',
      'department',
      'enrollment',
    ]);
    table.json('metrics').notNullable();
    table.json('insights').nullable();
    table.timestamp('captured_at').defaultTo(knex.fn.now());
    
    table.index('snapshot_type');
    table.index('captured_at');
    });
  }

  // Create report_schedules table
  const hasReportSchedules = await knex.schema.hasTable('report_schedules');
  if (!hasReportSchedules) {
    await knex.schema.createTable('report_schedules', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('report_name').notNullable();
    table.enum('report_type', [
      'grade',
      'attendance',
      'performance',
      'class_performance',
      'schedule_utilization',
    ]);
    table.enum('frequency', ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']);
    table.string('recipient_email').notNullable();
    table.json('filters').nullable();
    table.enum('format', ['json', 'csv', 'pdf']).defaultTo('pdf');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('next_generation_at').nullable();
    table.timestamp('last_generated_at').nullable();
    table.uuid('created_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index('report_type');
    table.index('is_active');
    table.index('next_generation_at');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order of creation (respecting foreign keys)
  await knex.schema.dropTableIfExists('report_schedules');
  await knex.schema.dropTableIfExists('report_exports');
  await knex.schema.dropTableIfExists('analytics_snapshots');
  await knex.schema.dropTableIfExists('reports');
}
