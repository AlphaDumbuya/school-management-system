import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for assertStudentInTenant identity resolution (Task 2.3).
 * The db module is mocked so we can exercise the three branches:
 *  - valid students.id in tenant → returns the row
 *  - a users.id (role student) passed instead → STUDENT_IDENTITY_MISMATCH (422)
 *  - unknown id → STUDENT_NOT_IN_TENANT (403)
 */

// A tiny chainable query stub whose terminal `.first()` resolves to a queued row.
function makeDb(resolver: (table: string, where: any) => any) {
  return (table: string) => {
    let whereArgs: any = {};
    const chain: any = {
      where(arg: any) { whereArgs = arg; return chain; },
      first() { return Promise.resolve(resolver(table, whereArgs)); },
      catch() { return chain.first(); },
    };
    return chain;
  };
}

vi.mock('../../utils/database.js', () => ({ db: (t: string) => (global as any).__DB__(t) }));

import { assertStudentInTenant, assertParentLinkedToStudent } from '../financeGuard';
import { AppError } from '../errorHandler';

const TENANT = 'tenant-1';

beforeEach(() => {
  (global as any).__DB__ = makeDb(() => null);
});

describe('assertStudentInTenant', () => {
  it('returns the student row when the id is a valid students.id in the tenant', async () => {
    (global as any).__DB__ = makeDb((table, where) => {
      if (table === 'students' && where.id === 'stu-1' && where.tenant_id === TENANT) {
        return { id: 'stu-1', tenant_id: TENANT };
      }
      return null;
    });
    const row = await assertStudentInTenant('stu-1', TENANT);
    expect(row.id).toBe('stu-1');
  });

  it('throws STUDENT_IDENTITY_MISMATCH (422) when a users.id is supplied', async () => {
    (global as any).__DB__ = makeDb((table, where) => {
      if (table === 'students') return null; // not a students.id
      if (table === 'users' && where.id === 'usr-1' && where.role === 'student') {
        return { id: 'usr-1', tenant_id: TENANT, role: 'student' };
      }
      return null;
    });
    await expect(assertStudentInTenant('usr-1', TENANT)).rejects.toMatchObject({
      status: 422,
      code: 'STUDENT_IDENTITY_MISMATCH',
    });
  });

  it('throws STUDENT_NOT_IN_TENANT (403) for an unknown id', async () => {
    (global as any).__DB__ = makeDb(() => null);
    await expect(assertStudentInTenant('nope', TENANT)).rejects.toMatchObject({
      status: 403,
      code: 'STUDENT_NOT_IN_TENANT',
    });
  });

  it('rejects a missing studentId', async () => {
    await expect(assertStudentInTenant('', TENANT)).rejects.toBeInstanceOf(AppError);
  });
});

describe('assertParentLinkedToStudent', () => {
  it('passes when a guardians row links the parent user to the student', async () => {
    (global as any).__DB__ = makeDb((table, where) => {
      if (table === 'students' && where.id === 'stu-1') return { id: 'stu-1', tenant_id: TENANT };
      if (table === 'guardians' && where.student_id === 'stu-1' && where.user_id === 'parent-1') return { id: 'g-1' };
      return null;
    });
    await expect(assertParentLinkedToStudent('parent-1', 'stu-1', TENANT)).resolves.toBeUndefined();
  });

  it('rejects (PARENT_NOT_LINKED) when no guardian link exists', async () => {
    (global as any).__DB__ = makeDb((table, where) => {
      if (table === 'students' && where.id === 'stu-1') return { id: 'stu-1', tenant_id: TENANT };
      return null; // no guardians row
    });
    await expect(assertParentLinkedToStudent('parent-2', 'stu-1', TENANT)).rejects.toMatchObject({
      status: 403,
      code: 'PARENT_NOT_LINKED',
    });
  });
});
