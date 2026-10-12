/**
 * Runs before every test file. Tests use TEST_DATABASE_URL (a local or
 * throw-away database) and never the real DATABASE_URL from .env. If no test
 * database is configured, DATABASE_URL is left alone; the connection guard in
 * utils/database.ts then refuses to connect when it points at a remote host,
 * so tests that need a database fail loudly instead of touching real data.
 * (Tests that need no database are unaffected.)
 */
import '../utils/env'; // loads .env so TEST_DATABASE_URL can live there

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
// A test run never inherits a destructive override.
delete process.env.ALLOW_DESTRUCTIVE_DB;
