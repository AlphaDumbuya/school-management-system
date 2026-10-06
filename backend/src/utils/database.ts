import './env.js';
import knex, { Knex } from 'knex';
import dotenv from 'dotenv';

const environment = process.env.NODE_ENV || 'development';

/**
 * Guards so one dead connection can't take the whole API down. With a remote
 * database, a network drop or a laptop sleep leaves sockets half-open: queries
 * on them never return, never free their pool slot, and once the pool is full
 * every request waits 60s ("Timeout acquiring a connection").
 *  - keepAlive: the OS notices dead sockets
 *  - connectionTimeoutMillis: give up connecting after 10s
 *  - statement_timeout / query_timeout: no query holds a connection forever
 *  - idle_in_transaction_session_timeout: an abandoned transaction is ended
 */
const CONNECTION_GUARDS = {
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 45_000,
  query_timeout: 50_000,
  idle_in_transaction_session_timeout: 60_000,
};

/**
 * Pooled connection URLs ignore startup options, so the server-side timeouts
 * are set on each new connection instead.
 */
const afterCreate = (conn: any, done: (err: Error | null, conn: any) => void) => {
  conn.query(
    "SET statement_timeout = '45s'; SET idle_in_transaction_session_timeout = '60s'",
    (err: Error | null) => done(err, conn),
  );
};

// Determine connection method: use DATABASE_URL if available, otherwise use individual credentials
const getConnection = () => {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      ...CONNECTION_GUARDS,
    };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'school_management_dev',
    ...CONNECTION_GUARDS,
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
      // Fail fast (15s, not 60s) and drop idle connections so a sleep/wake
      // doesn't leave the pool full of dead sockets.
      acquireTimeoutMillis: 15_000,
      idleTimeoutMillis: 30_000,
      reapIntervalMillis: 1_000,
      afterCreate,
    },
  },
  production: {
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      ...CONNECTION_GUARDS,
    } as any,
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
      afterCreate,
    },
  },
};

export const db: Knex = knex(config[environment] || config.development);

export default db;
