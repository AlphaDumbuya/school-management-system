import type { Knex } from 'knex';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try loading .env from multiple locations
const envPath1 = path.resolve(__dirname, '../.env');
const envPath2 = path.resolve(__dirname, '../../.env');
const envPath3 = path.resolve(process.cwd(), '.env');

dotenv.config({ path: envPath1 });
dotenv.config({ path: envPath2 });
dotenv.config({ path: envPath3 });

// Debug: log what we loaded
console.log('DATABASE_URL available:', !!process.env.DATABASE_URL);

// Determine connection method: use DATABASE_URL if available, otherwise use individual credentials
const getConnection = () => {
  if (process.env.DATABASE_URL) {
    console.log('Using DATABASE_URL connection');
    // Return object form so we can attach ssl config
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    };
  }
  
  console.log('Using individual DB credentials');
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'school_management_dev',
  };
};

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'pg',
    connection: getConnection(),
    migrations: {
      directory: './src/database/migrations',
      extension: 'ts',
    },
    seeds: {
      directory: './src/database/seeds',
      extension: 'ts',
    },
  },
  staging: {
    client: 'pg',
    connection: getConnection(),
    migrations: {
      directory: './src/database/migrations',
      extension: 'ts',
    },
    seeds: {
      directory: './src/database/seeds',
      extension: 'ts',
    },
  },
  production: {
    client: 'pg',
    connection: getConnection(),
    migrations: {
      directory: './dist/database/migrations',
      extension: 'js',
    },
    seeds: {
      directory: './dist/database/seeds',
      extension: 'js',
    },
    pool: {
      min: 0,
      max: 3,
      acquireTimeoutMillis: 10000,
      idleTimeoutMillis: 500,
    },
  },
};

export default config;
