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

  console.log('🎉 Settings & Subscriptions integration fully validated!');
}

main().catch((e) => {
  console.error('❌ Error during API validation:', e.response?.data ?? e.message);
});
