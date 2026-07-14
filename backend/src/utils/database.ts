import knex, { Knex } from 'knex';
import dotenv from 'dotenv';

dotenv.config();

const environment = process.env.NODE_ENV || 'development';

// Determine connection method: use DATABASE_URL if available, otherwise use individual credentials
const getConnection = () => {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'school_management_dev',
  };
};

const config: Record<string, Knex.Config> = {
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
    pool: {
      min: 0,
      max: 10,
    },
  },
  production: {
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    },
    migrations: {
      directory: './src/database/migrations',
      extension: 'ts',
    },
    seeds: {
      directory: './src/database/seeds',
      extension: 'ts',
    },
    // Serverless-friendly pool — minimal connections, short timeout
    pool: {
      min: 0,
      max: 3,
      acquireTimeoutMillis: 10000,
      idleTimeoutMillis: 500,
      reapIntervalMillis: 200,
    },
  },
};

export const db: Knex = knex(config[environment]);

export default db;
