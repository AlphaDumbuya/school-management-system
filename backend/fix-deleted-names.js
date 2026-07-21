import knex from 'knex';
import knexConfig from './knexfile.js';

const env = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[env]);

async function fixDeletedNames() {
  try {
    console.log('🧪 Renaming expired tenant names...');
    const expiredTenants = await db('tenants').where({ status: 'expired' });
    console.log(`Found ${expiredTenants.length} expired tenants.`);

    for (const tenant of expiredTenants) {
      if (!tenant.name.includes('(Archived-')) {
        const newName = `${tenant.name} (Archived-${Date.now()})`;
        await db('tenants').where({ id: tenant.id }).update({ name: newName });
        console.log(`✅ Renamed name "${tenant.name}" to "${newName}" for tenant ID "${tenant.id}".`);
      }
    }
    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Failed:', error);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

fixDeletedNames();
