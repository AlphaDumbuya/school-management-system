/**
 * dbSafety: stops destructive database work from touching a real database.
 *
 * Why: the school data lives on ONE shared remote database. A single test or
 * script that truncates, drops or mass-deletes there wipes every school.
 * (This happened once: a test's `TRUNCATE users CASCADE` emptied the lot.)
 *
 * The rule: anything that wipes or resets data may only run against a LOCAL
 * database (localhost / a docker-internal host name). A remote database needs
 * a deliberate, exact override typed by a person:
 *
 *     ALLOW_DESTRUCTIVE_DB=<host>/<database>
 *
 * Tests never get an override: they must use TEST_DATABASE_URL, a separate
 * throw-away database.
 *
 * No imports from the app on purpose, so scripts, seeds, tests and the
 * connection layer can all use it without cycles.
 */

export interface DbTarget {
  host: string;
  name: string;
  /** True for localhost / docker-internal hosts: safe to wipe. */
  local: boolean;
  /** "host/database", the exact value ALLOW_DESTRUCTIVE_DB must equal. */
  label: string;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'host.docker.internal']);

/** Read host and database name from a connection URL (or the DB_* variables). */
export function describeDatabase(url: string | undefined = process.env.DATABASE_URL): DbTarget {
  let host = '';
  let name = '';
  if (url) {
    try {
      const u = new URL(url);
      host = u.hostname.toLowerCase();
      name = decodeURIComponent(u.pathname.replace(/^\//, ''));
    } catch {
      /* unparseable: treated as remote below */
    }
  } else {
    host = (process.env.DB_HOST || 'localhost').toLowerCase();
    name = process.env.DB_NAME || 'school_management_dev';
  }
  // A host name with no dot (e.g. "postgres", "db") is a docker-internal
  // service, never a public cloud database.
  const local = !!host && (LOCAL_HOSTS.has(host) || !host.includes('.'));
  return { host: host || 'unknown', name: name || 'unknown', local, label: `${host || 'unknown'}/${name || 'unknown'}` };
}

export class DestructiveDatabaseBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DestructiveDatabaseBlockedError';
  }
}

const running = (): 'test' | 'production' | null => {
  if (process.env.VITEST || process.env.NODE_ENV === 'test') return 'test';
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') return 'production';
  return null;
};

/**
 * Call at the top of anything that wipes, resets or mass-deletes data
 * (reset scripts, destructive seeds, test cleanup). Throws unless the target
 * database is local, or a person typed the exact override for a remote one.
 */
export function assertDestructiveAllowed(action: string, url: string | undefined = process.env.DATABASE_URL): void {
  const target = describeDatabase(url);
  if (target.local) return;

  const where = running();
  if (where === 'test') {
    throw new DestructiveDatabaseBlockedError(
      `BLOCKED: tests must never ${action} on a remote database (${target.label}).\n` +
      '  Point TEST_DATABASE_URL at a local or throw-away database and run the tests again.',
    );
  }
  if (where === 'production') {
    throw new DestructiveDatabaseBlockedError(`BLOCKED: refusing to ${action} from a production runtime (${target.label}).`);
  }
  if (process.env.ALLOW_DESTRUCTIVE_DB === target.label) return;
  throw new DestructiveDatabaseBlockedError(
    `BLOCKED: this would ${action} on the REMOTE database ${target.label}.\n` +
    '  That database holds real school data. If you truly mean it (and have a Neon restore point),\n' +
    `  run it again with:  ALLOW_DESTRUCTIVE_DB=${target.label}`,
  );
}

/**
 * Connection-layer guard: the test runner may only ever connect to a local
 * database. Called when the app's database connection is created, so every
 * test that touches the database is stopped before it can run a single query.
 */
export function assertTestsUseSafeDatabase(url: string | undefined = process.env.DATABASE_URL): void {
  if (!process.env.VITEST && process.env.NODE_ENV !== 'test') return;
  const target = describeDatabase(url);
  if (target.local) return;
  throw new DestructiveDatabaseBlockedError(
    `BLOCKED: the test runner is pointed at a remote database (${target.label}).\n` +
    '  Tests create, change and delete data, so they must not run against real school data.\n' +
    '  Set TEST_DATABASE_URL to a local or throw-away database (e.g. postgres://postgres:password@localhost:5432/school_test).',
  );
}
