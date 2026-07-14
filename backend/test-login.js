import fetch from 'node-fetch';

async function testLogin() {
  try {
    console.log('Testing login endpoint...\n');
    
    const response = await fetch('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@school.com',
        password: 'password123',
      }),
    });
    
    console.log('Status:', response.status, response.statusText);
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('\n✅ Login successful!');
      console.log('\nUser:', data.user);
      console.log('\nAccess token (first 50 chars):', data.access_token?.substring(0, 50));
      console.log('Refresh token (first 50 chars):', data.refresh_token?.substring(0, 50));
    } else {
      console.log('\n❌ Login failed!');
      console.log('Error:', data);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testLogin();
