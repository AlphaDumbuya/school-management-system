import type { Knex } from 'knex';

/** Teacher attendance is separate from the student/class register. */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('teacher_attendance', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('teacher_id').notNullable().references('id').inTable('teachers').onDelete('RESTRICT');
    table.date('attendance_date').notNullable();
    table.string('status', 20).notNullable();
    table.text('remarks');
    table.uuid('marked_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('marked_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamps(true, true);

    table.unique(['tenant_id', 'teacher_id', 'attendance_date'], 'teacher_attendance_one_per_day');
    table.index(['tenant_id', 'attendance_date'], 'teacher_attendance_tenant_date_idx');
    table.check("status in ('present', 'late', 'absent', 'excused')", [], 'teacher_attendance_status_check');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('teacher_attendance');
}
