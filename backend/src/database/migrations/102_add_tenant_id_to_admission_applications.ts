import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTenantId = await knex.schema.hasColumn('admission_applications', 'tenant_id');
  if (!hasTenantId) {
    await knex.schema.table('admission_applications', (table) => {
      table.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTenantId = await knex.schema.hasColumn('admission_applications', 'tenant_id');
  if (hasTenantId) {
    await knex.schema.table('admission_applications', (table) => {
      table.dropColumn('tenant_id');
    });
  }
}
