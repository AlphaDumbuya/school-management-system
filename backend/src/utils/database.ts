import knex, { Knex } from 'knex';
import dotenv from 'dotenv';

dotenv.config();

const environment = process.env.NODE_ENV || 'development';

// Determine connection method: use DATABASE_URL if available, otherwise use individual credentials
const getConnection = () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  
  // Fallback to individual credentials
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
      min: 2,
      max: 20,
    },
  },
  production: {
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
      min: 5,
      max: 30,
    },
  },
};

export const db: Knex = knex(config[environment]);

export default db;
