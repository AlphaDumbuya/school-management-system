import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Property 1: Tenant isolation (Task 12.1, Req 1.2/1.3).
 *
 * Every finance READ must be scoped to the acting tenant. We can't reach a real
 * DB here, so we assert the invariant at the query-building layer: for any
 * random tenant id, the ledger service ALWAYS applies a `where` containing that
 * tenant_id before returning rows — so a query for tenant A can never surface
 * tenant B's rows.
 */

// Capture every `.where(...)` argument the service passes, per table.
let whereCalls: Array<{ table: string; where: any }> = [];

function makeDb() {
  const api: any = (table: string) => {
    const chain: any = {
      where(w: any) { whereCalls.push({ table, where: w }); return chain; },
      whereNot() { return chain; },
      leftJoin() { return chain; },
      groupBy() { return chain; },
      select() { return chain; },
      first() { return Promise.resolve(null); },
      catch() { return chain; },
      // Make the chain awaitable so `await db(...).select(...)` resolves to [].
      then(resolve: any) { resolve([]); },
    };
    return chain;
  };
  api.raw = (s: string) => s;
  return api;
}

vi.mock('../../utils/database.js', () => ({
  db: Object.assign((t: string) => (global as any).__DB__(t), { raw: (s: string) => s }),
}));
// assertStudentInTenant also hits the db; stub it to pass so we reach the fee query.
vi.mock('../../middleware/financeGuard.js', () => ({
  assertStudentInTenant: vi.fn().mockResolvedValue({ id: 'stu', tenant_id: 'ten' }),
}));

import { financeLedgerService } from '../financeLedgerService';

beforeEach(() => {
  whereCalls = [];
  (global as any).__DB__ = makeDb();
});

function randTenant() {
  return `tenant-${Math.random().toString(36).slice(2, 10)}`;
}

describe('Property 1: tenant isolation on finance reads', () => {
  it('getStudentLedger always scopes the fees query to the given tenant', async () => {
    for (let i = 0; i < 100; i++) {
      whereCalls = [];
      const tenantId = randTenant();
      await financeLedgerService.getStudentLedger(tenantId, 'stu-1');
      // The fees query must carry the tenant_id (and the student_id).
      const feeWhere = whereCalls.find((c) => c.table === 'fees');
      expect(feeWhere).toBeDefined();
      expect(feeWhere!.where.tenant_id).toBe(tenantId);
    }
  });

  it('getTenantSummary always scopes to the given tenant', async () => {
    for (let i = 0; i < 100; i++) {
      whereCalls = [];
      const tenantId = randTenant();
      await financeLedgerService.getTenantSummary(tenantId, '2026/2027');
      const feeWhere = whereCalls.find((c) => c.table === 'fees');
      expect(feeWhere).toBeDefined();
      expect(feeWhere!.where.tenant_id).toBe(tenantId);
    }
  });

  it('getBreakdown (by term) always scopes to the given tenant', async () => {
    for (let i = 0; i < 50; i++) {
      whereCalls = [];
      const tenantId = randTenant();
      await financeLedgerService.getBreakdown(tenantId, '2026/2027', 'term');
      const feeWhere = whereCalls.find((c) => c.table === 'fees');
      expect(feeWhere).toBeDefined();
      expect(feeWhere!.where.tenant_id).toBe(tenantId);
    }
  });

  it('getBreakdown (by class) scopes to the tenant via the fees table alias', async () => {
    for (let i = 0; i < 50; i++) {
      whereCalls = [];
      const tenantId = randTenant();
      await financeLedgerService.getBreakdown(tenantId, '2026/2027', 'class');
      const scoped = whereCalls.find((c) => c.where && c.where['fees.tenant_id'] === tenantId);
      expect(scoped).toBeDefined();
    }
  });
});
