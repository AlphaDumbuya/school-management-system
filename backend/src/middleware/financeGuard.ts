import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';
import { db } from '../utils/database.js';
import { logger } from '../utils/logger.js';

/**
 * Finance authorization + tenancy guards (financial-management spec).
 *
 * Centralizes:
 *  - `requireFinanceStaff`: only principal / super_admin / accountant may reach
 *    financial MANAGEMENT endpoints (fee CRUD, invoices, manual payments, term
 *    billing, fee structures, expenses, financial settings).
 *  - `resolveTenant(req)`: the acting user's tenant, taken ONLY from the
 *    authenticated context — never from the request body/query.
 *  - `assertStudentInTenant(studentId, tenantId)`: confirm a students.id row
 *    belongs to the tenant (the canonical charge subject is students.id).
 *  - `assertParentLinkedToStudent(userId, studentId, tenantId)`: confirm a
 *    parent/guardian is a VERIFIED link to the student before any read/pay.
 *
 * Requirements: 1.1, 1.2, 1.3, 8.1, 8.2, 8.5, 8.6, 10.4.
 */

export const FINANCE_STAFF_ROLES = ['principal', 'super_admin', 'accountant'] as const;

/** Roles allowed to manage a school's finances. */
export const requireFinanceStaff = (req: Request, res: Response, next: NextFunction) => {
  const role = req.user?.role || req.auth?.role;
  if (!role || !FINANCE_STAFF_ROLES.includes(role as any)) {
    logger.warn(`Finance access denied for role "${role}" on ${req.method} ${req.originalUrl}`);
    return next(new AppError('Access denied. Financial management is restricted to staff.', 403, 'FINANCE_FORBIDDEN'));
  }
  next();
};

/**
 * Resolve the acting tenant strictly from the authenticated user. Throws when no
 * tenant is present so no finance query can run unscoped.
 */
export function resolveTenant(req: Request): string {
  const tenantId = req.user?.tenant_id || req.auth?.tenantId;
  if (!tenantId) {
    throw new AppError('Tenant context required', 400, 'TENANT_REQUIRED');
  }
  return tenantId;
}

/**
 * Confirm `studentId` is a `students.id` within the tenant. The canonical charge
 * subject is students.id; if an id resolves only to a users row (role student)
 * and not a students row, the operation is REJECTED rather than reconciled.
 * Returns the students row on success.
 */
export async function assertStudentInTenant(studentId: string, tenantId: string): Promise<any> {
  if (!studentId) {
    throw new AppError('studentId is required', 400, 'VALIDATION_ERROR');
  }
  const student = await db('students').where({ id: studentId, tenant_id: tenantId }).first();
  if (student) return student;

  // Detect the legacy inconsistency: the id is actually a users.id (role
  // student). Reject with a clear, actionable error — never auto-map.
  const asUser = await db('users').where({ id: studentId, tenant_id: tenantId, role: 'student' }).first().catch(() => null);
  if (asUser) {
    throw new AppError(
      'Student identifier mismatch: a user id was supplied where a student id is required. Resolve the record before retrying.',
      422,
      'STUDENT_IDENTITY_MISMATCH',
    );
  }
  throw new AppError('Student not found or access denied', 403, 'STUDENT_NOT_IN_TENANT');
}

/**
 * Confirm the given user is a VERIFIED guardian link to the student, within the
 * tenant. A verified link is a `guardians` row associating the parent's user id
 * with the student. Used to gate parent reads/payments to their own children.
 */
export async function assertParentLinkedToStudent(
  userId: string,
  studentId: string,
  tenantId: string,
): Promise<void> {
  // Student must be in tenant first.
  await assertStudentInTenant(studentId, tenantId);

  const link = await db('guardians')
    .where({ student_id: studentId, user_id: userId })
    .first()
    .catch(() => null);

  if (!link) {
    throw new AppError('You are not linked to this student.', 403, 'PARENT_NOT_LINKED');
  }
}
