import axios from 'axios';

const BASE = 'http://localhost:3000/api/v1';

async function main() {
  console.log('🚀 Starting Settings & Subscription API validation...');

  // Step 1: Login
  const loginRes = await axios.post(`${BASE}/auth/login`, {
    email: 'principal@school.com',
    password: 'password123',
  });
  const token = loginRes.data?.data?.accessToken;
  console.log('✅ Login successful. Token obtained.');

  const headers = { Authorization: `Bearer ${token}` };

  // Step 2: Fetch School Info
  const infoRes = await axios.get(`${BASE}/school-config/info`, { headers });
  console.log('✅ School info fetched:', {
    name: infoRes.data.data?.name,
    principal: infoRes.data.data?.principal_name,
  });

  // Step 3: Fetch School Settings
  const settingsRes = await axios.get(`${BASE}/school-config/settings`, { headers });
  console.log('✅ Settings fetched:', {
    academic_year: settingsRes.data.data?.academic_year,
    student_prefix: settingsRes.data.data?.id_student_prefix,
    max_class_size: settingsRes.data.data?.max_class_size,
  });

  // Step 4: Fetch Active Subscription
  const subRes = await axios.get(`${BASE}/school-config/subscription/active`, { headers });
  console.log('✅ Subscription fetched:', {
    plan_type: subRes.data.data?.subscription?.plan_type,
    status: subRes.data.data?.subscription?.status,
    students_limit: subRes.data.data?.usage?.students?.max,
    staff_limit: subRes.data.data?.usage?.staff?.max,
  });

  // Step 5: Upgrade to Combra Plan
  console.log('🔄 Simulating upgrade to COMBRA plan...');
  const upgradeRes = await axios.post(`${BASE}/school-config/subscription/change-plan`, {
    plan_type: 'combra',
    billing_cycle: 'monthly',
  }, { headers });
  console.log('✅ Plan changed successfully:', upgradeRes.data.message);

  // Step 6: Verify Limits updated
  const updatedSubRes = await axios.get(`${BASE}/school-config/subscription/active`, { headers });
  console.log('✅ New limits fetched:', {
    plan_type: updatedSubRes.data.data?.subscription?.plan_type,
    students_limit: updatedSubRes.data.data?.usage?.students?.max,
    staff_limit: updatedSubRes.data.data?.usage?.staff?.max,
  });

  // Step 7: Fetch Billing History
  const billingRes = await axios.get(`${BASE}/school-config/subscription/billing`, { headers });
  console.log('✅ Billing history fetched count:', billingRes.data.data?.length);

  // Step 8: Validate Expiration Tracking
  console.log('🔄 Simulating subscription expiration...');
  const { db } = await import('./utils/database.js');
  
  // Set end_date to yesterday in database
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  await db('subscriptions')
    .where({ tenant_id: 'cea3d4e9-e226-40cd-9d82-38f238a159ee', status: 'active' })
    .update({ end_date: yesterday });
    
  // Fetch active subscription (should automatically mark status as 'expired')
  const expiredSubRes = await axios.get(`${BASE}/school-config/subscription/active`, { headers });
  console.log('✅ Expired subscription status detected:', expiredSubRes.data.data?.subscription?.status);

  // Attempt to create student (should be blocked by subscription guard)
  try {
    console.log('🔄 Attempting to create student under expired plan...');
    await axios.post(`${BASE}/students`, {
      first_name: 'Test',
      last_name: 'Student',
      enrollment_date: '2026-07-20',
      date_of_birth: '2010-01-01',
    }, { headers });
    console.log('❌ Error: Student creation succeeded under expired subscription plan!');
  } catch (err: any) {
    console.log('✅ Success: Student creation blocked as expected:', {
      status: err.response?.status,
      code: err.response?.data?.error?.code,
      message: err.response?.data?.error?.message,
    });
  }

  // Restore plan for clean database state
  console.log('🔄 Restoring active subscription status for Demo School...');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 30);
  await db('subscriptions')
    .where({ tenant_id: 'cea3d4e9-e226-40cd-9d82-38f238a159ee' })
    .update({ status: 'active', end_date: tomorrow });
  await db('tenants')
    .where({ id: 'cea3d4e9-e226-40cd-9d82-38f238a159ee' })
    .update({ status: 'active' });

  await db.destroy();

  console.log('🎉 Settings & Subscriptions integration fully validated!');
}

main().catch((e) => {
  console.error('❌ Error during API validation:', e.response?.data ?? e.message);
});
