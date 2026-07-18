import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try loading .env from multiple locations to support running from root or backend directory
const envPath1 = path.resolve(__dirname, '../.env');
const envPath2 = path.resolve(__dirname, '../../.env');
const envPath3 = path.resolve(__dirname, '../../../.env');
const envPath4 = path.resolve(process.cwd(), '.env');
const envPath5 = path.resolve(process.cwd(), '../.env');

dotenv.config({ path: envPath1 });
dotenv.config({ path: envPath2 });
dotenv.config({ path: envPath3 });
dotenv.config({ path: envPath4 });
dotenv.config({ path: envPath5 });

console.log('🌍 Environment loader initialized. DATABASE_URL present:', !!process.env.DATABASE_URL);
