// Quick end-to-end test: login + hit dashboard complete endpoint
import axios from 'axios';

const BASE = 'http://localhost:3000/api/v1';

async function main() {
  // Step 1: Login
  const loginRes = await axios.post(`${BASE}/auth/login`, {
    email: 'principal@school.com',
    password: 'password123',
  });

  const token = loginRes.data?.data?.accessToken;
  console.log('✅ Login OK. Token:', token ? 'obtained' : 'MISSING');

  // Step 2: Hit the complete dashboard
  const dashRes = await axios.get(`${BASE}/dashboards/admin/complete`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = dashRes.data;
  console.log('✅ Dashboard response:', JSON.stringify({
    success: data.success,
    metrics: data.data?.metrics,
    alertsCount: data.data?.alerts?.length,
    chartsKeys: Object.keys(data.data?.charts ?? {}),
    systemHealth: data.data?.systemHealth,
  }, null, 2));
}

main().catch(e => console.error('❌ Error:', e.response?.data ?? e.message));
