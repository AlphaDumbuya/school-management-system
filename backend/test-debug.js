import axios from 'axios';

async function testDebug() {
  try {
    const url = 'http://localhost:3000/api/v1/debug';
    const response = await axios.get(url);
    console.log('📋 Debug info from server:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Failed to get debug info:', error.message);
  }
}

testDebug();
