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
// SAFETY: several tests build their own connection from this file. Under the test
// runner it may only ever point at a local database (same rule as src/utils/dbSafety.ts;
// inlined because the knex CLI loads this file without the app's module resolution).
if ((process.env.VITEST || process.env.NODE_ENV === 'test') && process.env.DATABASE_URL) {
  let host = '';
  try { host = new URL(process.env.DATABASE_URL).hostname.toLowerCase(); } catch { /* unparseable: remote */ }
  const local = !!host && (['localhost', '127.0.0.1', '::1', '[::1]', 'host.docker.internal'].includes(host) || !host.includes('.'));
  if (!local) {
    throw new Error(
      'BLOCKED: the test runner is pointed at a remote database (' + (host || 'unknown') + '). Tests must not run against real school data. ' +
      'Set TEST_DATABASE_URL to a local or throw-away database.',
    );
  }
}

// SAFETY: rolling back migrations or running the seeds can delete real data.
// Refuse on a remote database unless a person typed the exact override
// (ALLOW_DESTRUCTIVE_DB=<host>/<database>). `migrate:latest` is unaffected.
(() => {
  const cmd = process.argv.find((a) => /^(migrate:rollback|migrate:down|seed:run)$/.test(a));
  if (!cmd || !process.env.DATABASE_URL) return;
  let host = '';
  let name = '';
  try {
    const u = new URL(process.env.DATABASE_URL);
    host = u.hostname.toLowerCase();
    name = decodeURIComponent(u.pathname.replace(/^\//, ''));
  } catch { /* unparseable: treated as remote */ }
  const local = !!host && (['localhost', '127.0.0.1', '::1', '[::1]', 'host.docker.internal'].includes(host) || !host.includes('.'));
  const label = `${host || 'unknown'}/${name || 'unknown'}`;
  if (local || process.env.ALLOW_DESTRUCTIVE_DB === label) return;
  console.error(
    `BLOCKED: "${cmd}" could delete real data on the REMOTE database ${label}.\n` +
    `  If you truly mean it (and have a Neon restore point), run it again with:  ALLOW_DESTRUCTIVE_DB=${label}`,
  );
  process.exit(1);
})();


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
