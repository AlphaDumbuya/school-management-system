import { describe, it, expect, vi } from 'vitest';
import { requireFinanceStaff, resolveTenant, FINANCE_STAFF_ROLES } from '../financeGuard';
import { AppError } from '../errorHandler';

/**
 * Unit tests for the finance authorization + tenancy guards (Task 1.3).
 * Endpoint-level integration coverage lands with tasks 3.3 / 9.5 / 12.1.
 */

function mockReq(user?: any, auth?: any): any {
  return { user, auth, method: 'POST', originalUrl: '/api/v1/fees' };
}
const mockRes = (): any => ({});

describe('requireFinanceStaff', () => {
  it('allows each finance-staff role', () => {
    for (const role of FINANCE_STAFF_ROLES) {
      const next = vi.fn();
      requireFinanceStaff(mockReq({ role }), mockRes(), next);
      expect(next).toHaveBeenCalledWith(); // called with no error
    }
  });

  it('denies non-finance roles with a 403 AppError', () => {
    for (const role of ['teacher', 'student', 'parent', 'guardian', undefined]) {
      const next = vi.fn();
      requireFinanceStaff(mockReq(role ? { role } : undefined), mockRes(), next);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.status).toBe(403);
      expect(err.code).toBe('FINANCE_FORBIDDEN');
    }
  });

  it('reads the role from req.auth when req.user is absent', () => {
    const next = vi.fn();
    requireFinanceStaff(mockReq(undefined, { role: 'accountant' }), mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('resolveTenant', () => {
  it('returns the tenant from req.user', () => {
    expect(resolveTenant(mockReq({ tenant_id: 't-1' }))).toBe('t-1');
  });

  it('falls back to req.auth.tenantId', () => {
    expect(resolveTenant(mockReq(undefined, { tenantId: 't-2' }))).toBe('t-2');
  });

  it('throws a 400 AppError when no tenant is present (never runs unscoped)', () => {
    try {
      resolveTenant(mockReq());
      throw new Error('should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(AppError);
      expect(e.status).toBe(400);
      expect(e.code).toBe('TENANT_REQUIRED');
    }
  });
});
