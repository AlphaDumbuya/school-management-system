import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import knex from 'knex';
import jwt from 'jsonwebtoken';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import knexConfig from './knexfile.js';

const env = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[env]);

async function testApiRequest() {
  try {
    console.log('🧪 Starting live API request debug (with root env)...');

    // Find a teacher or principal user
    const user = await db('users')
      .whereIn('role', ['principal', 'teacher'])
      .first();

    if (!user) {
      console.error('❌ No suitable user found in database!');
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.email} (Role: ${user.role})`);

    // Generate JWT token
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error('❌ JWT_SECRET not found in environment!');
      process.exit(1);
    }
    
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30m' });
    console.log('🔑 JWT token generated successfully');

    // Make API request to local server
    console.log('📡 Sending GET request to /api/v1/attendance...');
    const url = 'http://localhost:3000/api/v1/attendance?page=1&limit=20';
    
    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      console.log('✅ Response Status:', response.status);
      console.log('📋 Response Data:', JSON.stringify(response.data, null, 2));
    } catch (apiError) {
      console.error('❌ API Request Failed!');
      if (apiError.response) {
        console.error('   Status Code:', apiError.response.status);
        console.error('   Response Body:', JSON.stringify(apiError.response.data, null, 2));
      } else {
        console.error('   Error Message:', apiError.message);
      }
    }

  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

testApiRequest();
