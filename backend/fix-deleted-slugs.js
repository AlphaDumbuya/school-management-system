import knex from 'knex';
import knexConfig from './knexfile.js';

const env = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[env]);

async function fixDeletedSlugs() {
  try {
    console.log('🧪 Renaming expired tenant slugs...');
    const expiredTenants = await db('tenants').where({ status: 'expired' });
    console.log(`Found ${expiredTenants.length} expired tenants.`);

    for (const tenant of expiredTenants) {
      if (!tenant.slug.includes('-deleted-')) {
        const newSlug = `${tenant.slug}-deleted-${Date.now()}`;
        await db('tenants').where({ id: tenant.id }).update({ slug: newSlug });
        console.log(`✅ Renamed slug "${tenant.slug}" to "${newSlug}" for tenant "${tenant.name}".`);
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

fixDeletedSlugs();
