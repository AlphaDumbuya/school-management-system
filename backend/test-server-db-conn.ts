import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { db } from './src/utils/database';

async function testConn() {
  try {
    console.log('Testing connection using src/utils/database...');
    await db.raw('SELECT 1');
    console.log('✅ Connection success!');
  } catch (e: any) {
    console.error('❌ Connection failed:', e);
  } finally {
    await db.destroy();
  }
}

testConn();
