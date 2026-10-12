import { describe, it, expect } from 'vitest';
import { describeDatabase, assertDestructiveAllowed, assertTestsUseSafeDatabase } from '../dbSafety';

const NEON = 'postgres://u:p@ep-x-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';

describe('db safety', () => {
  it('classifies hosts', () => {
    expect(describeDatabase('postgres://u:p@localhost:5432/school_test').local).toBe(true);
    expect(describeDatabase('postgres://u:p@127.0.0.1/x').local).toBe(true);
    expect(describeDatabase('postgres://u:p@postgres:5432/x').local).toBe(true);
    expect(describeDatabase(NEON).local).toBe(false);
    expect(describeDatabase('not a url').local).toBe(false);
  });
  it('blocks destructive work on a remote db, even with the override, while testing', () => {
    expect(() => assertDestructiveAllowed('wipe', NEON)).toThrow(/BLOCKED/);
    process.env.ALLOW_DESTRUCTIVE_DB = describeDatabase(NEON).label;
    expect(() => assertDestructiveAllowed('wipe', NEON)).toThrow(/BLOCKED/);
    delete process.env.ALLOW_DESTRUCTIVE_DB;
  });
  it('allows a local db', () => {
    expect(() => assertDestructiveAllowed('wipe', 'postgres://u:p@localhost/school_test')).not.toThrow();
    expect(() => assertTestsUseSafeDatabase('postgres://u:p@localhost/school_test')).not.toThrow();
  });
  it('refuses to let tests connect to a remote db', () => {
    expect(() => assertTestsUseSafeDatabase(NEON)).toThrow(/remote database/);
  });
  it('the app connection refuses to load against the real DATABASE_URL in a test run', async () => {
    // .env points at the remote database; importing the connection must throw before any query can run.
    await expect(import('../database')).rejects.toThrow(/BLOCKED/);
  });
});

describe('knexfile (used by tests that build their own connection)', () => {
  it('refuses to load for a test run pointed at the real database', async () => {
    await expect(import('../../../knexfile')).rejects.toThrow(/BLOCKED/);
  });
});
