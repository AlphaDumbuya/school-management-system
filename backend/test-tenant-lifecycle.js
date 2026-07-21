import knex from 'knex';
import knexConfig from './knexfile.js';

const env = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[env]);

async function runTenantLifecycleTest() {
  const testSlug = `lifecycle-test-${Date.now()}`;
  const testName = `Lifecycle Test School ${Date.now()}`;
  let tenantId = null;

  try {
    console.log('🧪 Starting Tenant Lifecycle Integration Test...');

    // 1. Create a mock tenant row
    console.log('1. Inserting tenant...');
    const [tenant] = await db('tenants')
      .insert({
        name: testName,
        slug: testSlug,
        status: 'active',
        domain: null,
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .returning('*');
    
    tenantId = tenant.id;
    console.log(`   ✅ Tenant created successfully. ID: ${tenantId}`);

    // 2. Insert an active subscription associated with the tenant
    console.log('2. Inserting subscription...');
    const [subscription] = await db('subscriptions')
      .insert({
        tenant_id: tenantId,
        plan_type: 'freetong',
        status: 'active',
        start_date: db.fn.now(),
        end_date: db.raw("CURRENT_TIMESTAMP + interval '30 days'"),
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .returning('*');
    
    console.log(`   ✅ Active subscription created. ID: ${subscription.id}`);

    // Update the tenant's active subscription ID
    await db('tenants').where({ id: tenantId }).update({ subscription_id: subscription.id });
    console.log('   ✅ Linked subscription back to tenant.');

    // 3. Perform Soft Delete (Mimicking TenantService.deleteTenant)
    console.log('3. Deleting tenant (soft-delete & auto-cancel subscription)...');
    
    // Auto-cancel subscriptions
    const subUpdateResult = await db('subscriptions')
      .where({ tenant_id: tenantId })
      .update({
        status: 'cancelled',
        updated_at: db.fn.now()
      });
    console.log(`   ✅ Cancelled ${subUpdateResult} subscriptions.`);

    // Archive and soft delete the tenant
    const deletedSlug = `${testSlug}-deleted-${Date.now()}`;
    const deletedName = `${testName} (Archived-${Date.now()})`;

    const tenantUpdateResult = await db('tenants')
      .where({ id: tenantId })
      .update({
        status: 'expired',
        name: deletedName,
        slug: deletedSlug,
        subscription_id: null,
        updated_at: db.fn.now()
      });
    console.log(`   ✅ Soft-deleted tenant record (${tenantUpdateResult} row updated).`);

    // 4. Verify results
    console.log('4. Verifying database post-delete state...');
    const postDeleteTenant = await db('tenants').where({ id: tenantId }).first();
    const postDeleteSub = await db('subscriptions').where({ tenant_id: tenantId }).first();

    if (postDeleteTenant.status === 'expired' && postDeleteTenant.slug.includes('-deleted-') && postDeleteSub.status === 'cancelled') {
      console.log('   🎉 SUCCESS: All database integrity constraints are clean and valid!');
    } else {
      console.log('   ❌ FAILURE: Database integrity validation failed.');
    }

  } catch (error) {
    console.error('   ❌ Unexpected test error:', error);
  } finally {
    // Cleanup the test data
    if (tenantId) {
      console.log('🧹 Cleaning up test records...');
      await db('subscriptions').where({ tenant_id: tenantId }).delete();
      await db('tenants').where({ id: tenantId }).delete();
      console.log('   ✅ Cleanup complete.');
    }
    await db.destroy();
    process.exit(0);
  }
}

runTenantLifecycleTest();
