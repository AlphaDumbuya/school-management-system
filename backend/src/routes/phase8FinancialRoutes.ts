import express, { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { authenticate, attachUserContext } from '@middleware/authMiddleware';
import { FeeService } from '@services/feeService';
import { PaymentService } from '@services/paymentService';

const STAFF_ROLES = ['principal', 'super_admin', 'accountant'];
/**
 * Middleware: only staff (principal/super_admin/accountant) may access admin
 * finance pages. Runs AFTER the inline `authenticate` on each route. Since this
 * router is mounted on the shared `/api/v1` prefix we cannot safely add a
 * blanket `router.use(authenticate)`, so this guard also ensures the DB-backed
 * user context (req.user.tenant_id) is populated for the handlers that need it.
 */
const requireStaff = async (req: Request, res: Response, next: NextFunction) => {
  // Populate req.user from the DB if the inline `authenticate` set req.auth but
  // attachUserContext hasn't run for this route.
  if (!(req as any).user && (req as any).auth?.userId) {
    await attachUserContext(req, res, () => {});
  }
  const role = (req as any).user?.role || (req as any).auth?.role;
  if (!role || !STAFF_ROLES.includes(role)) {
    return res.status(403).json({ success: false, error: 'Access denied. Finance management is restricted to staff roles.' });
  }
  next();
};

// ── Tenant-ownership guards for the legacy per-resource routes ────────────────
// The older /fees/:id, /payments/:id and /students/:id/* routes call shared
// service methods that look a resource up by id ALONE (no tenant filter). Left
// unguarded that is a cross-tenant IDOR: any authenticated user could read or
// mutate another school's fee, payment, or a student's whole ledger. These
// helpers assert the resource belongs to the caller's tenant BEFORE the service
// runs. Finance tables carry tenant_id directly (migration 112); students carry
// it too, so we scope student-keyed routes via the students table.

/** Populate req.user from the DB when only req.auth is set (mirrors requireStaff). */
async function ensureUserContext(req: Request, res: Response): Promise<void> {
  if (!(req as any).user && (req as any).auth?.userId) {
    await attachUserContext(req, res, () => {});
  }
}

function getTenantId(req: Request): string | null {
  return (req as any).user?.tenant_id ?? null;
}

/** True if the fee belongs to this tenant (direct tenant_id, student fallback). */
async function feeInTenant(feeId: string, tenantId: string): Promise<boolean> {
  const row = await db('fees')
    .leftJoin('students', 'fees.student_id', 'students.id')
    .where('fees.id', feeId)
    .where(function (this: any) {
      this.where('fees.tenant_id', tenantId).orWhere('students.tenant_id', tenantId);
    })
    .first()
    .catch(() => null);
  return !!row;
}

/** True if the payment belongs to this tenant (via its fee → tenant/student). */
async function paymentInTenant(paymentId: string, tenantId: string): Promise<boolean> {
  const row = await db('payments')
    .leftJoin('fees', 'payments.fee_id', 'fees.id')
    .leftJoin('students', 'fees.student_id', 'students.id')
    .where('payments.id', paymentId)
    .where(function (this: any) {
      this.where('payments.tenant_id', tenantId)
        .orWhere('fees.tenant_id', tenantId)
        .orWhere('students.tenant_id', tenantId);
    })
    .first()
    .catch(() => null);
  return !!row;
}

/** True if the invoice belongs to this tenant (direct tenant_id, student fallback). */
async function invoiceInTenant(invoiceId: string, tenantId: string): Promise<boolean> {
  const row = await db('invoices')
    .leftJoin('students', 'invoices.student_id', 'students.id')
    .where('invoices.id', invoiceId)
    .where(function (this: any) {
      this.where('invoices.tenant_id', tenantId).orWhere('students.tenant_id', tenantId);
    })
    .first()
    .catch(() => null);
  return !!row;
}

/** True if the student belongs to this tenant. */
async function studentInTenant(studentId: string, tenantId: string): Promise<boolean> {
  const row = await db('students')
    .where('id', studentId)
    .where('tenant_id', tenantId)
    .first()
    .catch(() => null);
  return !!row;
}

/** True if the class belongs to this tenant (session- or creator-scoped). */
async function classInTenant(classId: string, tenantId: string): Promise<boolean> {
  const row = await db('classes')
    .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
    .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
    .where('classes.id', classId)
    .where(function (this: any) {
      this.where('academic_sessions.tenant_id', tenantId).orWhere(function (this: any) {
        this.whereNull('classes.academic_session_id').where('class_creator.tenant_id', tenantId);
      });
    })
    .first()
    .catch(() => null);
  return !!row;
}

/**
 * Guard for the student-keyed routes (/students/:studentId/fees|payments|
 * outstanding). Staff see any student in their tenant; a student may only see
 * their own ledger; a parent/guardian only a linked child's. Prevents both
 * cross-tenant IDOR and a student reading a classmate's fees.
 */
async function assertStudentAccess(req: Request, res: Response, next: NextFunction) {
  try {
    await ensureUserContext(req, res);
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context is required' });
    }
    const studentId = (req.params as any).studentId as string;
    if (!studentId || !(await studentInTenant(studentId, tenantId))) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    const role = (req as any).user?.role;
    const userId = (req as any).user?.id;

    if (STAFF_ROLES.includes(role)) return next();

    if (role === 'student') {
      const own = await db('students')
        .where({ id: studentId, tenant_id: tenantId, user_id: userId })
        .first()
        .catch(() => null);
      if (own) return next();
      return res.status(403).json({ success: false, error: 'You can only view your own fees.' });
    }

    if (role === 'parent' || role === 'guardian') {
      const linked = await db('guardians')
        .where({ user_id: userId, student_id: studentId })
        .first()
        .catch(() => null);
      if (linked) return next();
      return res.status(403).json({ success: false, error: 'You can only view your own child\'s fees.' });
    }

    return res.status(403).json({ success: false, error: 'Access denied.' });
  } catch (err) {
    next(err);
  }
}

/**
 * Guard middleware: resolve tenant context, then verify the resource named by
 * `param` belongs to it using `check`. 404 (not 403) on failure so we don't
 * confirm the existence of another tenant's resource.
 */
function assertInTenant(
  param: string,
  check: (id: string, tenantId: string) => Promise<boolean>,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await ensureUserContext(req, res);
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Tenant context is required' });
      }
      const id = (req.params as any)[param];
      if (!id || !(await check(id, tenantId))) {
        return res.status(404).json({ success: false, error: 'Resource not found' });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
import { InvoiceService } from '@services/invoiceService';
import { db } from '@utils/database';
import { logger } from '@utils/logger';
import { normalizeAcademicYear, resolveYearScope, resolveActiveYear } from '@utils/academicYear';
import exportService from '@services/exportService';
import { sendExport } from '@utils/exportResponse';
import { AuditService } from '@services/auditService';

const router: Router = express.Router();
const feeService = new FeeService(db);
const paymentService = new PaymentService(db);
const invoiceService = new InvoiceService(db);
const auditService = new AuditService(db);

/**
 * Create a fee
 * POST /api/v1/fees
 * Requires: principal or accountant role
 */
router.post(
  '/fees',
  authenticate,
  requireStaff,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { type, amount, dueDate, description, studentId, classId, academicSession } =
        req.body;
      const userId = (req as any).user.id;
      const tenantId = getTenantId(req);

      // Validate required fields
      if (!type || !amount || !studentId || !dueDate) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['type', 'amount', 'studentId', 'dueDate'],
        });
      }

      // Cross-tenant guard: never bill a student (or reference a class) from
      // another school.
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Tenant context is required' });
      }
      if (!(await studentInTenant(studentId, tenantId))) {
        return res.status(404).json({ success: false, error: 'Student not found' });
      }
      if (classId && !(await classInTenant(classId, tenantId))) {
        return res.status(400).json({ success: false, error: 'Selected class does not belong to this school' });
      }

      const fee = await feeService.createFee(
        {
          type,
          amount,
          dueDate,
          description,
          studentId,
          classId,
          academicSession,
        },
        userId
      );

      res.status(201).json({
        success: true,
        data: fee,
        message: 'Fee created successfully',
      });
    } catch (error) {
      logger.error(`Error creating fee: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get fee by ID
 * GET /api/v1/fees/:feeId
 */
router.get(
  '/fees/:feeId',
  authenticate,
  requireStaff,
  assertInTenant('feeId', feeInTenant),
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { feeId } = req.params;

      const fee = await feeService.getFeeById(feeId);

      res.status(200).json({
        success: true,
        data: fee,
        message: 'Fee retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching fee: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get student fees
 * GET /api/v1/students/:studentId/fees
 */
router.get(
  '/students/:studentId/fees',
  authenticate,
  assertStudentAccess,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { studentId } = req.params;
      const { status, startDate, endDate } = req.query;

      const fees = await feeService.getStudentFees(studentId, {
        status,
        startDate,
        endDate,
      });

      res.status(200).json({
        success: true,
        data: fees,
        count: fees.length,
        message: 'Fees retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching student fees: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get class fees
 * GET /api/v1/classes/:classId/fees
 */
router.get(
  '/classes/:classId/fees',
  authenticate,
  requireStaff,
  assertInTenant('classId', classInTenant),
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { classId } = req.params;

      const fees = await feeService.getClassFees(classId);

      res.status(200).json({
        success: true,
        data: fees,
        count: fees.length,
        message: 'Class fees retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching class fees: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Update fee status
 * PATCH /api/v1/fees/:feeId/status
 */
router.patch(
  '/fees/:feeId/status',
  authenticate,
  requireStaff,
  assertInTenant('feeId', feeInTenant),
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { feeId } = req.params;
      const { status } = req.body;
      const userId = (req as any).user.id;

      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }

      const result = await feeService.updateFeeStatus(feeId, status, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Fee status updated successfully',
      });
    } catch (error) {
      logger.error(`Error updating fee status: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get student outstanding balance
 * GET /api/v1/students/:studentId/outstanding
 */
router.get(
  '/students/:studentId/outstanding',
  authenticate,
  assertStudentAccess,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { studentId } = req.params;

      const outstanding = await feeService.getStudentOutstanding(studentId);

      res.status(200).json({
        success: true,
        data: { studentId, outstandingBalance: outstanding },
        message: 'Outstanding balance retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching outstanding balance: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Record a payment
 * POST /api/v1/payments
 * Requires: principal, accountant, or student role
 */
router.post(
  '/payments',
  authenticate,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { feeId, amount, method, transactionReference, notes, paymentDate } = req.body;
      const userId = (req as any).user.id;
      const role = (req as any).user?.role;
      const tenantId = getTenantId(req);

      if (!feeId || !amount || !method) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['feeId', 'amount', 'method'],
        });
      }

      // IDOR guard: the fee being paid MUST belong to the caller's tenant, and
      // a student/parent may only pay their OWN fee — never record a payment
      // against another school's or another student's fee.
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Tenant context is required' });
      }
      const feeRow = await db('fees')
        .leftJoin('students', 'fees.student_id', 'students.id')
        .where('fees.id', feeId)
        .where(function (this: any) {
          this.where('fees.tenant_id', tenantId).orWhere('students.tenant_id', tenantId);
        })
        .select('fees.id', 'fees.student_id', 'students.user_id as student_user_id')
        .first()
        .catch(() => null);
      if (!feeRow) {
        return res.status(404).json({ success: false, error: 'Fee not found' });
      }
      if (role === 'student') {
        if (feeRow.student_user_id !== userId) {
          return res.status(403).json({ success: false, error: 'You can only pay your own fees.' });
        }
      } else if (role === 'parent' || role === 'guardian') {
        const linked = await db('guardians')
          .where({ user_id: userId, student_id: feeRow.student_id })
          .first()
          .catch(() => null);
        if (!linked) {
          return res.status(403).json({ success: false, error: 'You can only pay your own child\'s fees.' });
        }
      } else if (!STAFF_ROLES.includes(role)) {
        return res.status(403).json({ success: false, error: 'Access denied.' });
      }

      // Enforce the school's minimum-payment policy on manual payments too, so a
      // below-minimum partial can't be recorded through the admin path either.
      // (Staff may still take full settlement any time.)
      try {
        const { financeLedgerService } = await import('@services/financeLedgerService');
        const minErr = await financeLedgerService.enforceMinimumPayment(tenantId, feeRow.student_id, Number(amount));
        if (minErr) {
          return res.status(422).json({ success: false, error: minErr });
        }
      } catch { /* policy check best-effort — never block on lookup failure */ }

      const payment = await paymentService.recordPayment(
        {
          feeId,
          amount,
          method,
          transactionReference,
          notes,
          paymentDate,
        },
        userId
      );

      res.status(201).json({
        success: true,
        data: payment,
        message: 'Payment recorded successfully',
      });
    } catch (error) {
      logger.error(`Error recording payment: ${error}`);
      const msg = (error as Error).message || '';
      // Validation failures from the service are the caller's fault, not a 500.
      if (/exceeds outstanding balance|greater than zero|not found/i.test(msg)) {
        return res.status(400).json({ success: false, error: msg, message: msg });
      }
      res.status(500).json({
        error: 'Internal server error',
        message: msg,
      });
    }
  }
);

/**
 * Get student payments
 * GET /api/v1/students/:studentId/payments
 */
router.get(
  '/students/:studentId/payments',
  authenticate,
  assertStudentAccess,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { studentId } = req.params;
      const { startDate, endDate, method } = req.query;

      const payments = await paymentService.getStudentPayments(studentId, {
        startDate: startDate as string,
        endDate: endDate as string,
        method: method as string,
      });

      res.status(200).json({
        success: true,
        data: payments,
        count: payments.length,
        message: 'Payments retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching student payments: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get payment statistics
 * GET /api/v1/payments/statistics
 */
router.get(
  '/payments/statistics',
  authenticate,
  requireStaff,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { startDate, endDate, studentId } = req.query;

      const stats = await paymentService.getPaymentStatistics({
        startDate: startDate as string,
        endDate: endDate as string,
        studentId: studentId as string,
      }, getTenantId(req) || undefined);

      res.status(200).json({
        success: true,
        data: stats,
        message: 'Payment statistics retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching payment statistics: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get payment receipt
 * GET /api/v1/payments/:paymentId/receipt
 */
router.get(
  '/payments/:paymentId/receipt',
  authenticate,
  assertInTenant('paymentId', paymentInTenant),
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { paymentId } = req.params;

      const receipt = await paymentService.getPaymentReceipt(paymentId);

      res.status(200).json({
        success: true,
        data: receipt,
        message: 'Payment receipt retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching payment receipt: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Refund a payment
 * POST /api/v1/payments/:paymentId/refund
 * Requires: principal or accountant role
 */
router.post(
  '/payments/:paymentId/refund',
  authenticate,
  requireStaff,
  assertInTenant('paymentId', paymentInTenant),
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { paymentId } = req.params;
      const { reason } = req.body;
      const userId = (req as any).user.id;

      if (!reason) {
        return res.status(400).json({ error: 'Reason is required for refund' });
      }

      const refund = await paymentService.refundPayment(paymentId, reason, userId);

      res.status(201).json({
        success: true,
        data: refund,
        message: 'Payment refunded successfully',
      });
    } catch (error) {
      logger.error(`Error refunding payment: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Generate invoice
 * POST /api/v1/invoices
 * Requires: principal or accountant role
 */
router.post(
  '/invoices',
  authenticate,
  requireStaff,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { studentId, feeIds, dueDate, notes } = req.body;
      const userId = (req as any).user.id;
      const tenantId = getTenantId(req);

      if (!studentId || !feeIds || feeIds.length === 0) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['studentId', 'feeIds (array with at least one fee)'],
        });
      }

      // Cross-tenant guard: the student AND every fee being invoiced must belong
      // to the caller's tenant — never invoice another school's student/fees.
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Tenant context is required' });
      }
      if (!(await studentInTenant(studentId, tenantId))) {
        return res.status(404).json({ success: false, error: 'Student not found' });
      }
      const feeTenantCount = await db('fees')
        .leftJoin('students', 'fees.student_id', 'students.id')
        .whereIn('fees.id', feeIds)
        .where(function (this: any) {
          this.where('fees.tenant_id', tenantId).orWhere('students.tenant_id', tenantId);
        })
        .countDistinct('fees.id as c')
        .first()
        .catch(() => null);
      if (Number((feeTenantCount as any)?.c ?? 0) !== feeIds.length) {
        return res.status(400).json({ success: false, error: 'One or more fees do not belong to this school' });
      }

      const invoice = await invoiceService.generateInvoice(
        {
          studentId,
          feeIds,
          dueDate,
          notes,
        },
        userId
      );

      res.status(201).json({
        success: true,
        data: invoice,
        message: 'Invoice generated successfully',
      });
    } catch (error) {
      logger.error(`Error generating invoice: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get invoice by ID
 * GET /api/v1/invoices/:invoiceId
 */
router.get(
  '/invoices/:invoiceId',
  authenticate,
  attachUserContext,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { invoiceId } = req.params;
      const tenantId = (req as any).user?.tenant_id;
      const role = (req as any).user?.role as string | undefined;
      const userId = (req as any).user?.id;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context required' });
      }

      // Tenant-scoped fetch — a cross-tenant id resolves to "not found".
      const invoice = await invoiceService.getInvoiceById(invoiceId, tenantId);

      // Non-staff (student/parent/guardian) may only view an invoice for a
      // student they own / are linked to.
      const STAFF = ['principal', 'super_admin', 'accountant', 'admissions_officer', 'teacher'];
      if (!STAFF.includes(role || '')) {
        let allowed = false;
        if (role === 'student') {
          const own = await db('students').where({ user_id: userId, tenant_id: tenantId }).first().catch(() => null);
          allowed = !!own && own.id === invoice.student_id;
        } else if (role === 'parent' || role === 'guardian') {
          const link = await db('guardians').where({ student_id: invoice.student_id, user_id: userId }).first().catch(() => null);
          allowed = !!link;
        }
        if (!allowed) {
          return res.status(403).json({ error: 'You are not allowed to view this invoice' });
        }
      }

      res.status(200).json({
        success: true,
        data: invoice,
        message: 'Invoice retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching invoice: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get student invoices
 * GET /api/v1/students/:studentId/invoices
 */
router.get(
  '/students/:studentId/invoices',
  authenticate,
  attachUserContext,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { studentId } = req.params;
      const { status, startDate, endDate } = req.query;
      const tenantId = (req as any).user?.tenant_id;
      const role = (req as any).user?.role as string | undefined;
      const userId = (req as any).user?.id;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context required' });
      }

      // Non-staff may only read invoices for a student they own / are linked to.
      const STAFF = ['principal', 'super_admin', 'accountant', 'admissions_officer', 'teacher'];
      if (!STAFF.includes(role || '')) {
        let allowed = false;
        if (role === 'student') {
          const own = await db('students').where({ user_id: userId, tenant_id: tenantId }).first().catch(() => null);
          allowed = !!own && own.id === studentId;
        } else if (role === 'parent' || role === 'guardian') {
          const link = await db('guardians').where({ student_id: studentId, user_id: userId }).first().catch(() => null);
          allowed = !!link;
        }
        if (!allowed) {
          return res.status(403).json({ error: 'You are not allowed to view these invoices' });
        }
      }

      const invoices = await invoiceService.getStudentInvoices(studentId, {
        status: status as string,
        startDate: startDate as string,
        endDate: endDate as string,
      }, tenantId);

      res.status(200).json({
        success: true,
        data: invoices,
        count: invoices.length,
        message: 'Student invoices retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching student invoices: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Update invoice status
 * PATCH /api/v1/invoices/:invoiceId/status
 */
router.patch(
  '/invoices/:invoiceId/status',
  authenticate,
  requireStaff,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { invoiceId } = req.params;
      const { status } = req.body;
      const userId = (req as any).user.id;
      const tenantId = (req as any).user.tenant_id;

      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context required' });
      }

      const result = await invoiceService.updateInvoiceStatus(invoiceId, status, userId, tenantId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Invoice status updated successfully',
      });
    } catch (error) {
      logger.error(`Error updating invoice status: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get overdue invoices
 * GET /api/v1/invoices/overdue
 * Requires: principal or accountant role
 */
router.get(
  '/invoices-overdue',
  authenticate,
  requireStaff,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const tenantId = (req as any).user?.tenant_id;
      const invoices = await invoiceService.getOverdueInvoices(tenantId);

      res.status(200).json({
        success: true,
        data: invoices,
        count: invoices.length,
        message: 'Overdue invoices retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching overdue invoices: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Send invoice reminder
 * POST /api/v1/invoices/:invoiceId/reminder
 */
router.post(
  '/invoices/:invoiceId/reminder',
  authenticate,
  requireStaff,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { invoiceId } = req.params;
      const userId = (req as any).user.id;
      const tenantId = (req as any).user.tenant_id;

      const result = await invoiceService.sendInvoiceReminder(invoiceId, userId, tenantId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Invoice reminder sent successfully',
      });
    } catch (error) {
      logger.error(`Error sending invoice reminder: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get fee statistics
 * GET /api/v1/fees/statistics
 */
router.get(
  '/fees-statistics',
  authenticate,
  requireStaff,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { classId } = req.query;

      const stats = await feeService.getFeeStatistics(classId as string, getTenantId(req) || undefined);

      res.status(200).json({
        success: true,
        data: stats,
        message: 'Fee statistics retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching fee statistics: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get invoice statistics
 * GET /api/v1/invoices/statistics
 */
router.get(
  '/invoices-statistics',
  authenticate,
  requireStaff,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { startDate, endDate } = req.query;

      const stats = await invoiceService.getInvoiceStatistics({
        startDate: startDate as string,
        endDate: endDate as string,
      }, getTenantId(req) || undefined);

      res.status(200).json({
        success: true,
        data: stats,
        message: 'Invoice statistics retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching invoice statistics: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Bulk create fees
 * POST /api/v1/fees/bulk
 * Requires: principal or accountant role
 */
router.post(
  '/fees/bulk',
  authenticate,
  requireStaff,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { classId, fees } = req.body;
      const userId = (req as any).user.id;
      const tenantId = getTenantId(req);

      if (!classId || !fees || fees.length === 0) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['classId', 'fees (array with at least one fee)'],
        });
      }

      // Cross-tenant guard: never bulk-bill another school's class.
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Tenant context is required' });
      }
      if (!(await classInTenant(classId, tenantId))) {
        return res.status(404).json({ success: false, error: 'Class not found' });
      }

      const results = await feeService.bulkCreateFees(classId, fees, userId);

      res.status(201).json({
        success: true,
        data: results,
        count: results.length,
        message: 'Fees created successfully in bulk',
      });
    } catch (error) {
      logger.error(`Error bulk creating fees: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Bulk record payments
 * POST /api/v1/payments/bulk
 * Requires: principal or accountant role
 */
router.post(
  '/payments/bulk',
  authenticate,
  requireStaff,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { payments } = req.body;
      const userId = (req as any).user.id;

      if (!payments || payments.length === 0) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['payments (array with at least one payment)'],
        });
      }

      const results = await paymentService.bulkRecordPayments(payments, userId);

      res.status(201).json({
        success: true,
        data: results,
        count: results.length,
        message: 'Payments recorded successfully in bulk',
      });
    } catch (error) {
      logger.error(`Error bulk recording payments: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Bulk generate invoices
 * POST /api/v1/invoices/bulk
 * Requires: principal or accountant role
 */
router.post(
  '/invoices/bulk',
  authenticate,
  requireStaff,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { classId, feeType } = req.body;
      const userId = (req as any).user.id;
      const tenantId = getTenantId(req);

      if (!classId || !feeType) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['classId', 'feeType'],
        });
      }

      // Cross-tenant guard: never bulk-invoice another school's class.
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Tenant context is required' });
      }
      if (!(await classInTenant(classId, tenantId))) {
        return res.status(404).json({ success: false, error: 'Class not found' });
      }

      const results = await invoiceService.bulkGenerateInvoices(classId, feeType, userId);

      res.status(201).json({
        success: true,
        data: results,
        count: results.length,
        message: 'Invoices generated successfully in bulk',
      });
    } catch (error) {
      logger.error(`Error bulk generating invoices: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get overdue fees
 * GET /api/v1/fees/overdue
 * Requires: principal or accountant role
 */
router.get(
  '/fees-overdue',
  authenticate,
  requireStaff,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { daysOverdue } = req.query;

      const fees = await feeService.getOverdueFees(
        daysOverdue ? parseInt(daysOverdue as string) : 0,
        getTenantId(req) || undefined
      );

      res.status(200).json({
        success: true,
        data: fees,
        count: fees.length,
        message: 'Overdue fees retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching overdue fees: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get fees by type
 * GET /api/v1/fees/type/:type
 */
router.get(
  '/fees-by-type/:type',
  authenticate,
  requireStaff,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { type } = req.params;
      const { classId } = req.query;

      const fees = await feeService.getFeesByType(type, classId as string, getTenantId(req) || undefined);

      res.status(200).json({
        success: true,
        data: fees,
        count: fees.length,
        message: 'Fees by type retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching fees by type: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Adjust fee amount
 * PATCH /api/v1/fees/:feeId/adjust
 * Requires: principal or accountant role
 */
router.patch(
  '/fees/:feeId/adjust',
  authenticate,
  requireStaff,
  assertInTenant('feeId', feeInTenant),
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { feeId } = req.params;
      const { adjustment, reason } = req.body;
      const userId = (req as any).user.id;

      if (adjustment === undefined || !reason) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['adjustment', 'reason'],
        });
      }

      const result = await feeService.adjustFeeAmount(feeId, adjustment, reason, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Fee amount adjusted successfully',
      });
    } catch (error) {
      logger.error(`Error adjusting fee amount: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get payment summary
 * GET /api/v1/payments/summary
 */
router.get(
  '/payments-summary',
  authenticate,
  requireStaff,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['startDate', 'endDate'],
        });
      }

      const summary = await paymentService.getPaymentSummary(
        startDate as string,
        endDate as string,
        getTenantId(req) || undefined
      );

      res.status(200).json({
        success: true,
        data: summary,
        message: 'Payment summary retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching payment summary: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get payment methods summary
 * GET /api/v1/payments/methods
 */
router.get(
  '/payments-methods',
  authenticate,
  requireStaff,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const summary = await paymentService.getPaymentMethodsSummary(getTenantId(req) || undefined);

      res.status(200).json({
        success: true,
        data: summary,
        message: 'Payment methods summary retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching payment methods summary: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get invoice summary
 * GET /api/v1/invoices/:invoiceId/summary
 */
router.get(
  '/invoices/:invoiceId/summary',
  authenticate,
  attachUserContext,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { invoiceId } = req.params;
      const tenantId = (req as any).user?.tenant_id;
      const role = (req as any).user?.role as string | undefined;
      const userId = (req as any).user?.id;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context required' });
      }

      const summary = await invoiceService.getInvoiceSummary(invoiceId, tenantId);

      // Non-staff may only view a summary for their own / linked student.
      const STAFF = ['principal', 'super_admin', 'accountant', 'admissions_officer', 'teacher'];
      if (!STAFF.includes(role || '')) {
        const sid = summary?.student?.id;
        let allowed = false;
        if (role === 'student') {
          const own = await db('students').where({ user_id: userId, tenant_id: tenantId }).first().catch(() => null);
          allowed = !!own && own.id === sid;
        } else if (role === 'parent' || role === 'guardian') {
          const link = await db('guardians').where({ student_id: sid, user_id: userId }).first().catch(() => null);
          allowed = !!link;
        }
        if (!allowed) {
          return res.status(403).json({ error: 'You are not allowed to view this invoice' });
        }
      }

      res.status(200).json({
        success: true,
        data: summary,
        message: 'Invoice summary retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching invoice summary: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Export invoice data
 * GET /api/v1/invoices/:invoiceId/export
 */
router.get(
  '/invoices/:invoiceId/export',
  authenticate,
  requireStaff,
  assertInTenant('invoiceId', invoiceInTenant),
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { invoiceId } = req.params;

      const exportData = await invoiceService.exportInvoiceData(invoiceId);

      res.status(200).json({
        success: true,
        data: exportData,
        message: 'Invoice data exported successfully',
      });
    } catch (error) {
      logger.error(`Error exporting invoice data: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get recent payments
 * GET /api/v1/payments/recent
 */
router.get(
  '/payments-recent',
  authenticate,
  requireStaff,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { limit } = req.query;

      const payments = await paymentService.getRecentPayments(
        limit ? parseInt(limit as string) : 50,
        getTenantId(req) || undefined
      );

      res.status(200).json({
        success: true,
        data: payments,
        count: payments.length,
        message: 'Recent payments retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching recent payments: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Delete fee (principal only)
 * DELETE /api/v1/fees/:feeId
 * Requires: principal role
 */
router.delete(
  '/fees/:feeId',
  authenticate,
  requireStaff,
  assertInTenant('feeId', feeInTenant),
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { feeId } = req.params;
      const { reason } = req.body;
      const userId = (req as any).user.id;

      if (!reason) {
        return res.status(400).json({ error: 'Reason is required for deletion' });
      }

      await feeService.deleteFee(feeId, reason, userId);

      res.status(200).json({
        success: true,
        message: 'Fee deleted successfully',
      });
    } catch (error) {
      logger.error(`Error deleting fee: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get fee payments (payments for a specific fee)
 * GET /api/v1/fees/:feeId/payments
 */
router.get(
  '/fees/:feeId/payments',
  authenticate,
  requireStaff,
  assertInTenant('feeId', feeInTenant),
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { feeId } = req.params;

      const payments = await paymentService.getFeePayments(feeId);

      res.status(200).json({
        success: true,
        data: payments,
        count: payments.length,
        message: 'Fee payments retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching fee payments: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get payment by ID
 * GET /api/v1/payments/:paymentId
 */
router.get(
  '/payments/:paymentId',
  authenticate,
  requireStaff,
  assertInTenant('paymentId', paymentInTenant),
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { paymentId } = req.params;

      const payment = await paymentService.getPaymentById(paymentId);

      res.status(200).json({
        success: true,
        data: payment,
        message: 'Payment retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching payment: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * ── Tenant-wide finance overview (admin/accountant) ──────────────────────────
 * These power the finance admin pages. All are scoped to the caller's tenant
 * via the students join (finance tables carry tenant_id after migration 112,
 * but we also join students for older rows).
 */

// GET /api/v1/finance/overview — KPIs for the finance dashboard.
// Driven by the FEES ledger (the source of truth for what is billed/owed) so
// the numbers are real whether or not invoices have been generated. Collected =
// billed − outstanding (i.e. SUM(amount) − SUM(balance)).
router.get('/finance/overview', authenticate, requireStaff, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    // Optional ?academic_year= scope (fees are keyed by academic_year).
    // Omitted = all years, preserving the existing dashboard behaviour.
    const overviewYear = req.query.academic_year ? String(req.query.academic_year) : '';
    const aggQ = db('fees')
      .where('fees.tenant_id', tenantId)
      .whereNot('fees.status', 'deleted');
    if (overviewYear) aggQ.where('fees.academic_year', overviewYear);
    const agg = await aggQ
      .select(
        db.raw('COALESCE(SUM(fees.amount),0) as billed'),
        db.raw('COALESCE(SUM(fees.balance),0) as outstanding'),
        db.raw("COUNT(CASE WHEN fees.status = 'overdue' THEN 1 END) as overdue_count"),
      )
      .first();
    const billed = Number(agg?.billed) || 0;
    const outstanding = Number(agg?.outstanding) || 0;
    const paidTotal = Math.max(0, billed - outstanding);
    res.json({
      success: true,
      data: {
        totalBilled: billed,
        totalPaid: paidTotal,
        totalOutstanding: outstanding,
        overdueInvoices: Number(agg?.overdue_count) || 0,
      },
    });
  } catch (error) {
    logger.error(`finance/overview error: ${error}`);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Scope an invoices query (already joined to `students`) to one academic year
 * and join the class the student was in THAT year. An invoice's year is its own
 * academic_year, else the year of the fees it bundles, else (no fees linked)
 * the year's date window on created_at. No year = all years, current class.
 */
async function scopeInvoicesToYear(q: any, tenantId: string, rawYear: unknown) {
  const year = normalizeAcademicYear(rawYear ? String(rawYear) : null);
  const scope = year && year !== 'all' ? await resolveYearScope(tenantId, year) : null;
  if (!scope) {
    q.leftJoin('enrollments', function (this: any) {
      this.on('enrollments.student_id', '=', 'students.id').andOn('enrollments.status', '=', db.raw('?', ['active']));
    }).leftJoin('classes', 'classes.id', 'enrollments.class_id');
    return q;
  }
  const feeYearSql = '(SELECT MIN(f.academic_year) FROM invoice_items ii JOIN fees f ON f.id = ii.fee_id WHERE ii.invoice_id = invoices.id)';
  q.where((w: any) => {
    w.where('invoices.academic_year', year)
      .orWhere((w2: any) => {
        w2.whereNull('invoices.academic_year').whereRaw(`${feeYearSql} = ?`, [year]);
      })
      .orWhere((w3: any) => {
        w3.whereNull('invoices.academic_year').whereRaw(`${feeYearSql} IS NULL`);
        if (scope.from) w3.where('invoices.created_at', '>=', scope.from);
        if (scope.to) w3.where('invoices.created_at', '<', scope.to);
      });
  });
  const HISTORIC = ['enrolled', 'active', 'completed', 'promoted', 'repeated', 'graduated'];
  const yearClassIds = scope.classIds.length ? scope.classIds : ['00000000-0000-0000-0000-000000000000'];
  q.leftJoin(
    db('enrollments').distinctOn('student_id')
      .select('student_id', 'class_id')
      .whereIn('class_id', yearClassIds)
      .whereIn('status', HISTORIC)
      .orderBy('student_id').orderBy('created_at', 'desc')
      .as('ye'),
    'ye.student_id', 'students.id',
  ).leftJoin('classes', 'classes.id', 'ye.class_id');
  return q;
}

// GET /api/v1/finance/invoices?status=&academic_year= — invoices for the tenant
// (with student name + the class they were in that year).
router.get('/finance/invoices', authenticate, requireStaff, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const status = req.query.status as string | undefined;
    let q = db('invoices')
      .join('students', 'invoices.student_id', 'students.id')
      .leftJoin('users', 'students.user_id', 'users.id')
      .where('students.tenant_id', tenantId);
    await scopeInvoicesToYear(q, tenantId, req.query.academic_year);
    q = q
      .select(
        'invoices.*',
        db.raw("COALESCE(users.first_name || ' ' || users.last_name, students.first_name || ' ' || students.last_name, students.student_id) as student_name"),
        'students.student_id as admission_no',
        'classes.name as class_name',
        'classes.level as class_level',
      )
      .orderBy('invoices.created_at', 'desc');
    if (status) q = q.where('invoices.status', status);
    const rows = await q.limit(500);
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error(`finance/invoices error: ${error}`);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// GET /api/v1/finance/invoices/export?format=csv|excel|pdf&status= — download invoices.
router.get('/finance/invoices/export', authenticate, requireStaff, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const status = req.query.status as string | undefined;
    let q = db('invoices')
      .join('students', 'invoices.student_id', 'students.id')
      .leftJoin('users', 'students.user_id', 'users.id')
      .where('students.tenant_id', tenantId);
    await scopeInvoicesToYear(q, tenantId, req.query.academic_year);
    q = q
      .select(
        'invoices.invoice_number',
        db.raw("COALESCE(users.first_name || ' ' || users.last_name, students.first_name || ' ' || students.last_name, students.student_id) as student_name"),
        'students.student_id as admission_no',
        'classes.name as class_name',
        'invoices.total_amount',
        'invoices.total_paid as amount_paid',
        'invoices.status',
        'invoices.due_date',
        'invoices.created_at',
      )
      .orderBy('invoices.created_at', 'desc');
    if (status) q = q.where('invoices.status', status);
    const rows = await q.limit(10000);

    const formatted = rows.map((r: any) => ({
      ...r,
      total_amount: `Le ${Number(r.total_amount || 0).toLocaleString()}`,
      amount_paid: `Le ${Number(r.amount_paid || 0).toLocaleString()}`,
      due_date: r.due_date ? new Date(r.due_date).toLocaleDateString() : '',
      created_at: r.created_at ? new Date(r.created_at).toLocaleDateString() : '',
    }));

    await sendExport(res, {
      format: req.query.format as string,
      tenantId,
      rows: formatted,
      columns: {
        'Invoice No': 'invoice_number',
        Student: 'student_name',
        'Admission No': 'admission_no',
        Class: 'class_name',
        Total: 'total_amount',
        Paid: 'amount_paid',
        Status: 'status',
        Due: 'due_date',
        Issued: 'created_at',
      },
      filename: 'invoices_export',
      title: 'Invoices Export',
      sheetName: 'Invoices',
    });
  } catch (error) {
    logger.error(`finance/invoices/export error: ${error}`);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// GET /api/v1/finance/payments — all payments for the tenant (with student name).
router.get('/finance/payments', authenticate, requireStaff, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    // Optional ?academic_year= scope. A payment belongs to the year of the fee
    // it settles; unlinked payments fall back to the year's date window. The
    // class shown is the class the student was in THAT year, and the balance
    // columns cover that year's fees only. Omitted = all years (current class).
    const payYear = normalizeAcademicYear(req.query.academic_year ? String(req.query.academic_year) : null);
    const scope = payYear && payYear !== 'all' ? await resolveYearScope(tenantId, payYear) : null;

    const q = db('payments')
      .join('students', 'payments.student_id', 'students.id')
      .leftJoin('users', 'students.user_id', 'users.id')
      .where('students.tenant_id', tenantId);

    if (scope) {
      const HISTORIC = ['enrolled', 'active', 'completed', 'promoted', 'repeated', 'graduated'];
      const yearClassIds = scope.classIds.length ? scope.classIds : ['00000000-0000-0000-0000-000000000000'];
      q.leftJoin('fees as pf', db.raw('pf.id::text'), 'payments.fee_id')
        .where((w) => {
          w.where('pf.academic_year', payYear).orWhere((w2) => {
            w2.whereNull('pf.id');
            if (scope.from) w2.where('payments.payment_date', '>=', scope.from);
            if (scope.to) w2.where('payments.payment_date', '<', scope.to);
          });
        })
        .leftJoin(
          db('enrollments').distinctOn('student_id')
            .select('student_id', 'class_id')
            .whereIn('class_id', yearClassIds)
            .whereIn('status', HISTORIC)
            .orderBy('student_id').orderBy('created_at', 'desc')
            .as('ye'),
          'ye.student_id', 'students.id',
        )
        .leftJoin('classes', 'classes.id', 'ye.class_id');
    } else {
      q.leftJoin('enrollments', function () {
        this.on('enrollments.student_id', '=', 'students.id').andOn('enrollments.status', '=', db.raw('?', ['active']));
      })
        .leftJoin('classes', 'classes.id', 'enrollments.class_id');
    }

    const feeYearSql = scope ? ' AND f.academic_year = ?' : '';
    const feeYearArgs = scope ? [payYear] : [];
    const rows = await q
      .select(
        'payments.*',
        db.raw("COALESCE(users.first_name || ' ' || users.last_name, students.first_name || ' ' || students.last_name, students.student_id) as student_name"),
        'students.student_id as admission_no',
        'classes.name as class_name',
        'classes.level as class_level',
        // Per-student fee totals so the ledger can show Total Billed / Paid / Balance
        // alongside each transaction (fees are the source of truth for what's owed).
        db.raw(`(SELECT COALESCE(SUM(f.amount),0) FROM fees f WHERE f.student_id = payments.student_id AND f.status <> 'deleted'${feeYearSql}) as student_total_billed`, feeYearArgs),
        db.raw(`(SELECT COALESCE(SUM(f.balance),0) FROM fees f WHERE f.student_id = payments.student_id AND f.status <> 'deleted'${feeYearSql}) as student_balance`, feeYearArgs),
      )
      .orderBy('payments.payment_date', 'desc')
      .limit(1000);
    // Derive total-paid = billed − balance for each row.
    const enriched = rows.map((r: any) => {
      const billed = Number(r.student_total_billed) || 0;
      const balance = Number(r.student_balance) || 0;
      return { ...r, student_total_billed: billed, student_balance: balance, student_total_paid: Math.max(0, billed - balance) };
    });
    res.json({ success: true, data: enriched });
  } catch (error) {
    logger.error(`finance/payments error: ${error}`);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// GET /api/v1/finance/export?format=csv|excel|pdf — STUDENT FEE-RECORD REPORT.
// One row per student (NOT per transaction) covering their whole fee account:
// billed / paid / balance / status + last payment. Includes students who have
// NOT paid so the report is a complete picture for finance reporting.
// Staff-only + tenant-scoped.
router.get('/finance/export', authenticate, requireStaff, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    // Optional filters (mirror the on-screen Payments filters).
    const statusF = String(req.query.status || '').toLowerCase();     // 'paid' | 'partial' | 'unpaid'
    const sectionF = String(req.query.section || '').toLowerCase();   // 'nursery' | 'primary' | 'jss' | 'sss'
    const classF = String(req.query.className || req.query.class || '');

    const SECTION_LEVELS: Record<string, string[]> = {
      nursery: ['NURSERY1', 'NURSERY2', 'NURSERY3'],
      primary: ['CLASS1', 'CLASS2', 'CLASS3', 'CLASS4', 'CLASS5', 'CLASS6'],
      jss: ['JSS1', 'JSS2', 'JSS3'],
      sss: ['SSS1', 'SSS2', 'SSS3'],
    };

    // Optional ?academic_year=: only that year's fees, labelled with the class
    // each student was in that year. Omitted = all years (current class).
    const exportYear = normalizeAcademicYear(req.query.academic_year ? String(req.query.academic_year) : null);
    const exportScope = exportYear && exportYear !== 'all' ? await resolveYearScope(tenantId, exportYear) : null;

    let q = db('students')
      .join('fees', 'fees.student_id', 'students.id')
      .leftJoin('users', 'students.user_id', 'users.id')
      .where('students.tenant_id', tenantId)
      .whereNot('fees.status', 'deleted');
    if (exportScope) {
      const HISTORIC = ['enrolled', 'active', 'completed', 'promoted', 'repeated', 'graduated'];
      const yearClassIds = exportScope.classIds.length ? exportScope.classIds : ['00000000-0000-0000-0000-000000000000'];
      q = q.where('fees.academic_year', exportYear)
        .leftJoin(
          db('enrollments').distinctOn('student_id')
            .select('student_id', 'class_id')
            .whereIn('class_id', yearClassIds)
            .whereIn('status', HISTORIC)
            .orderBy('student_id').orderBy('created_at', 'desc')
            .as('ye'),
          'ye.student_id', 'students.id',
        )
        .leftJoin('classes', 'classes.id', 'ye.class_id');
    } else {
      q = q.leftJoin('enrollments', function () {
        this.on('enrollments.student_id', '=', 'students.id').andOn('enrollments.status', '=', db.raw('?', ['active']));
      })
        .leftJoin('classes', 'classes.id', 'enrollments.class_id');
    }

    if (sectionF && SECTION_LEVELS[sectionF]) q = q.whereIn('classes.level', SECTION_LEVELS[sectionF]);
    if (classF) q = q.where('classes.name', classF);

    const rows = await q
      .groupBy('students.id', 'users.first_name', 'users.last_name', 'students.first_name', 'students.last_name', 'students.student_id', 'classes.name')
      .select(
        db.raw("COALESCE(users.first_name || ' ' || users.last_name, students.first_name || ' ' || students.last_name, students.student_id) as student_name"),
        'students.student_id as admission_no',
        'classes.name as class_name',
        db.raw('COALESCE(SUM(fees.amount),0) as billed'),
        db.raw('COALESCE(SUM(fees.balance),0) as balance'),
        db.raw("(SELECT MAX(p.payment_date) FROM payments p WHERE p.student_id = students.id AND p.status = 'completed') as last_payment"),
      )
      // Order by class then by balance so the report reads class-by-class.
      .orderByRaw("COALESCE(classes.name, 'ZZZ') ASC, SUM(fees.balance) DESC")
      .limit(10000);

    // Compute status per row and apply the status filter in memory.
    const enriched = rows
      .map((r: any) => {
        const billed = Number(r.billed) || 0;
        const balance = Number(r.balance) || 0;
        const paid = Math.max(0, billed - balance);
        const status = balance <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
        return { ...r, billed, balance, paid, status, className: r.class_name || '—' };
      })
      .filter((r: any) => !statusF || r.status === statusF);

    // One row per student (already ordered class-by-class), then a SINGLE grand
    // total at the very bottom — no per-class subtotals (avoids duplication).
    const money = (n: number) => `Le ${n.toLocaleString()}`;
    const cap1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const formatted: Record<string, any>[] = [];
    let gBilled = 0, gPaid = 0, gBalance = 0;

    enriched.forEach((r: any) => {
      gBilled += r.billed; gPaid += r.paid; gBalance += r.balance;
      formatted.push({
        class_name: r.className,
        student_name: r.student_name,
        admission_no: r.admission_no,
        total_billed: money(r.billed),
        total_paid: money(r.paid),
        balance: money(r.balance),
        status: cap1(r.status),
        last_payment: r.last_payment ? new Date(r.last_payment).toLocaleDateString() : 'No payment',
      });
    });

    // Grand total across all exported students.
    if (formatted.length > 0) {
      const gRate = gBilled > 0 ? Math.round((gPaid / gBilled) * 1000) / 10 : 0;
      const gOut = gBilled > 0 ? Math.round((gBalance / gBilled) * 1000) / 10 : 0;
      formatted.push({
        class_name: 'GRAND TOTAL',
        student_name: `${enriched.length} student${enriched.length === 1 ? '' : 's'}`,
        admission_no: '',
        total_billed: money(gBilled),
        total_paid: `${money(gPaid)} (${gRate}%)`,
        balance: `${money(gBalance)} (${gOut}%)`,
        status: '',
        last_payment: '',
      });
    }

    const scopeBits = [
      sectionF ? `Section: ${cap1(sectionF)}` : '',
      classF ? `Class: ${classF}` : '',
      statusF ? `Status: ${cap1(statusF)}` : '',
    ].filter(Boolean).join(' · ');
    const title = statusF === 'unpaid' ? 'Unpaid Students Report' : 'Student Fees Report';

    await sendExport(res, {
      format: req.query.format as string,
      tenantId,
      rows: formatted,
      columns: {
        Class: 'class_name',
        Student: 'student_name',
        'Admission No': 'admission_no',
        'Total Billed': 'total_billed',
        'Total Paid': 'total_paid',
        Balance: 'balance',
        Status: 'status',
        'Last Payment': 'last_payment',
      },
      filename: statusF === 'unpaid' ? 'unpaid_students_report' : 'student_fees_report',
      title: scopeBits ? `${title} — ${scopeBits}` : title,
      sheetName: 'Fees Report',
      // paid → green, balance → red (Excel/PDF only).
      colorColumns: { total_paid: 'green', balance: 'red' },
      highlightLastRow: true, // shade the GRAND TOTAL row
    });
  } catch (error) {
    logger.error(`finance/export error: ${error}`);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// GET /api/v1/finance/analytics — enterprise finance-hub analytics: totals,
// collection rate %, by-term, by-level, by-class, method mix, 6-month trend,
// top defaulters, and recent payments. Tenant-scoped via the students join.
router.get('/finance/analytics', authenticate, requireStaff, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    // Optional academic-year scope for all FEES-derived figures (billed/paid/
    // outstanding + by-term/level/class + defaulters). Omitted = all years.
    // Payment method mix / 6-month trend / this-month stay transaction-time
    // based (cashflow views), not partitioned by school year.
    const analyticsYear = req.query.academic_year ? String(req.query.academic_year) : '';
    const feeYear = (qb: any) => (analyticsYear ? qb.where('fees.academic_year', analyticsYear) : qb);

    // ── Totals from the FEES ledger (authoritative billed/owed, invoice-free) ──
    // collected = billed − outstanding = SUM(amount) − SUM(balance).
    const totals = await feeYear(db('fees')
      .where('fees.tenant_id', tenantId)
      .whereNot('fees.status', 'deleted'))
      .select(
        db.raw('COALESCE(SUM(fees.amount),0) as billed'),
        db.raw('COALESCE(SUM(fees.balance),0) as outstanding'),
        db.raw('COUNT(fees.id) as invoice_count'),
        db.raw("COUNT(CASE WHEN fees.status = 'overdue' THEN 1 END) as overdue_count"),
        db.raw("COUNT(CASE WHEN fees.status = 'paid' THEN 1 END) as paid_count"),
      )
      .first();
    const billed = Number(totals?.billed) || 0;
    const outstanding = Number(totals?.outstanding) || 0;
    const paid = Math.max(0, billed - outstanding);
    const collectionRate = billed > 0 ? Math.round((paid / billed) * 1000) / 10 : 0;

    // ── Payment method breakdown (scoped to selected year when specified) ──
    // Same rule as the payments ledger: a payment belongs to the year of the
    // fee it settles; unlinked payments fall back to the year's date window.
    const methodYear = normalizeAcademicYear(analyticsYear || null);
    const methodScope = methodYear && methodYear !== 'all'
      ? await resolveYearScope(tenantId, methodYear)
      : null;

    const methodQuery = db('payments')
      .join('students', 'payments.student_id', 'students.id')
      .where('students.tenant_id', tenantId)
      .where('payments.status', 'completed');

    if (methodScope) {
      methodQuery
        .leftJoin('fees as pf', db.raw('pf.id::text'), 'payments.fee_id')
        .where((w) => {
          w.where('pf.academic_year', methodYear).orWhere((w2) => {
            w2.whereNull('pf.id');
            if (methodScope.from) w2.where('payments.payment_date', '>=', methodScope.from);
            if (methodScope.to) w2.where('payments.payment_date', '<', methodScope.to);
          });
        });
    }

    const byMethod = await methodQuery
      .select(db.raw('COALESCE(payments.method, payments.payment_method) as method'))
      .sum('payments.amount as total')
      .count('payments.id as count')
      .groupByRaw('COALESCE(payments.method, payments.payment_method)');

    // ── 6-month collection trend (zero-filled) ──
    // Build a continuous run of the last 6 months with generate_series so the
    // chart line is unbroken even for months with no collections, then LEFT
    // JOIN the monthly payment sums onto it. Also return a payment count so the
    // tooltip can show how many transactions made up each month.
    const trend = await db
      .with('months', (qb) => {
        qb.select(db.raw(
          "generate_series(DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months', DATE_TRUNC('month', CURRENT_DATE), INTERVAL '1 month') AS month",
        ));
      })
      .with('paid', (qb) => {
        qb.select(db.raw("DATE_TRUNC('month', payments.payment_date) AS month"))
          .sum('payments.amount as total')
          .count('payments.id as cnt')
          .from('payments')
          .join('students', 'payments.student_id', 'students.id')
          .where('students.tenant_id', tenantId)
          .where('payments.status', 'completed')
          .where('payments.payment_date', '>=', db.raw("DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'"))
          .groupByRaw("DATE_TRUNC('month', payments.payment_date)");
      })
      .select(db.raw("TO_CHAR(months.month, 'Mon YYYY') as label"))
      .select(db.raw('COALESCE(paid.total, 0) as total'))
      .select(db.raw('COALESCE(paid.cnt, 0) as count'))
      .from('months')
      .leftJoin('paid', 'paid.month', 'months.month')
      .orderBy('months.month');

    // ── Collection + outstanding by class LEVEL (from fees) ──
    // collected = SUM(amount) − SUM(balance).
    const byLevel = await feeYear(db('fees')
      .join('students', 'fees.student_id', 'students.id')
      .leftJoin('enrollments', function () {
        this.on('enrollments.student_id', '=', 'students.id').andOn('enrollments.status', '=', db.raw('?', ['active']));
      })
      .leftJoin('classes', 'classes.id', 'enrollments.class_id')
      .where('fees.tenant_id', tenantId)
      .whereNot('fees.status', 'deleted'))
      .select(db.raw("COALESCE(classes.level, 'Unassigned') as level"))
      .select(
        db.raw('COALESCE(SUM(fees.amount),0) as billed'),
        db.raw('COALESCE(SUM(fees.amount) - SUM(fees.balance),0) as collected'),
        db.raw('COALESCE(SUM(fees.balance),0) as outstanding'),
      )
      .groupByRaw("COALESCE(classes.level, 'Unassigned')")
      .orderByRaw("COALESCE(classes.level, 'Unassigned')");

    // ── Collection by CLASS (name) from fees ──
    const byClass = await feeYear(db('fees')
      .join('students', 'fees.student_id', 'students.id')
      .leftJoin('enrollments', function () {
        this.on('enrollments.student_id', '=', 'students.id').andOn('enrollments.status', '=', db.raw('?', ['active']));
      })
      .leftJoin('classes', 'classes.id', 'enrollments.class_id')
      .where('fees.tenant_id', tenantId)
      .whereNot('fees.status', 'deleted')
      .whereNotNull('classes.name'))
      .select('classes.name as class_name')
      .select(
        db.raw('COALESCE(SUM(fees.amount),0) as billed'),
        db.raw('COALESCE(SUM(fees.amount) - SUM(fees.balance),0) as collected'),
        db.raw('COALESCE(SUM(fees.balance),0) as outstanding'),
      )
      .groupBy('classes.name')
      .orderByRaw('SUM(fees.balance) DESC')
      .limit(20);

    // ── Collection by TERM (from fees) ──
    const byTerm = await feeYear(db('fees')
      .where('fees.tenant_id', tenantId)
      .whereNot('fees.status', 'deleted'))
      .select(db.raw("COALESCE(fees.term, 'Unspecified') as term"))
      .select(
        db.raw('COALESCE(SUM(fees.amount),0) as billed'),
        db.raw('COALESCE(SUM(fees.amount) - SUM(fees.balance),0) as collected'),
        db.raw('COALESCE(SUM(fees.balance),0) as outstanding'),
      )
      .groupByRaw("COALESCE(fees.term, 'Unspecified')")
      .orderByRaw("COALESCE(fees.term, 'Unspecified')");

    // ── Top defaulters (highest outstanding, from fees) ──
    const topDefaulters = await feeYear(db('fees')
      .join('students', 'fees.student_id', 'students.id')
      .leftJoin('users', 'students.user_id', 'users.id')
      .leftJoin('enrollments', function () {
        this.on('enrollments.student_id', '=', 'students.id').andOn('enrollments.status', '=', db.raw('?', ['active']));
      })
      .leftJoin('classes', 'classes.id', 'enrollments.class_id')
      .where('fees.tenant_id', tenantId)
      .whereNot('fees.status', 'deleted')
      .where('fees.balance', '>', 0))
      .groupBy('students.id', 'users.first_name', 'users.last_name', 'students.first_name', 'students.last_name', 'students.student_id', 'classes.name')
      .select(
        'students.id as student_id',
        db.raw("COALESCE(users.first_name || ' ' || users.last_name, students.first_name || ' ' || students.last_name, students.student_id) as student_name"),
        'students.student_id as admission_no',
        'classes.name as class_name',
        db.raw('SUM(fees.balance) as outstanding'),
      )
      .orderByRaw('SUM(fees.balance) DESC')
      .limit(10);

    // ── Recent payments ──
    const recent = await db('payments')
      .join('students', 'payments.student_id', 'students.id')
      .leftJoin('users', 'students.user_id', 'users.id')
      .where('students.tenant_id', tenantId)
      .select(
        'payments.id', 'payments.amount', 'payments.payment_date', 'payments.status',
        db.raw('COALESCE(payments.method, payments.payment_method) as method'),
        db.raw("COALESCE(users.first_name || ' ' || users.last_name, students.first_name || ' ' || students.last_name, students.student_id) as student_name"),
      )
      .orderBy('payments.payment_date', 'desc')
      .limit(8);

    const thisMonth = await db('payments')
      .join('students', 'payments.student_id', 'students.id')
      .where('students.tenant_id', tenantId)
      .where('payments.status', 'completed')
      .whereRaw("DATE_TRUNC('month', payments.payment_date) = DATE_TRUNC('month', CURRENT_DATE)")
      .select(db.raw('COALESCE(SUM(payments.amount),0) as total'), db.raw('COUNT(payments.id) as count'))
      .first();

    const rate = (b: any, c: any) => { const bv = Number(b) || 0; const cv = Number(c) || 0; return bv > 0 ? Math.round((cv / bv) * 1000) / 10 : 0; };

    res.json({
      success: true,
      data: {
        totals: {
          billed, paid, outstanding, collectionRate,
          invoiceCount: Number(totals?.invoice_count) || 0,
          overdueCount: Number(totals?.overdue_count) || 0,
          paidCount: Number(totals?.paid_count) || 0,
        },
        byMethod: byMethod.map((r: any) => ({ method: r.method || 'unknown', total: Number(r.total) || 0, count: Number(r.count) || 0 })),
        trend: trend.map((r: any) => ({ label: r.label, total: Number(r.total) || 0, count: Number(r.count) || 0 })),
        byLevel: byLevel.map((r: any) => ({ level: r.level, billed: Number(r.billed) || 0, collected: Number(r.collected) || 0, outstanding: Number(r.outstanding) || 0, rate: rate(r.billed, r.collected) })),
        byClass: byClass.map((r: any) => ({ className: r.class_name, billed: Number(r.billed) || 0, collected: Number(r.collected) || 0, outstanding: Number(r.outstanding) || 0, rate: rate(r.billed, r.collected) })),
        byTerm: byTerm.map((r: any) => ({ term: r.term, billed: Number(r.billed) || 0, collected: Number(r.collected) || 0, outstanding: Number(r.outstanding) || 0, rate: rate(r.billed, r.collected) })),
        topDefaulters: topDefaulters.map((r: any) => ({ studentId: r.student_id, studentName: r.student_name, admissionNo: r.admission_no, className: r.class_name, outstanding: Number(r.outstanding) || 0 })),
        recent: recent.map((r: any) => ({ id: r.id, studentName: r.student_name, amount: Number(r.amount) || 0, method: r.method, status: r.status, date: r.payment_date })),
        thisMonth: { total: Number(thisMonth?.total) || 0, count: Number(thisMonth?.count) || 0 },
      },
    });
  } catch (error) {
    logger.error(`finance/analytics error: ${error}`);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// POST /api/v1/finance/bulk-bill — create a fee for every student matching a
// target (a class, a level, or ALL active students). Enterprise billing.
router.post('/finance/bulk-bill', authenticate, requireStaff, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const userId = (req as any).user.id;
    const { scope, classId, level, type, amount, dueDate, term, academicYear, description } = req.body || {};

    if (!type || !amount || !dueDate) return res.status(400).json({ success: false, error: 'type, amount and dueDate are required' });
    const amt = Number(amount);
    if (!(amt > 0)) return res.status(400).json({ success: false, error: 'Amount must be greater than 0' });

    // Resolve the target students (active enrollments within this tenant).
    let q = db('students')
      .leftJoin('enrollments', function () {
        this.on('enrollments.student_id', '=', 'students.id').andOn('enrollments.status', '=', db.raw('?', ['active']));
      })
      .leftJoin('classes', 'classes.id', 'enrollments.class_id')
      .where('students.tenant_id', tenantId)
      .where('students.status', 'active');

    if (scope === 'class' && classId) q = q.where('enrollments.class_id', classId);
    else if (scope === 'level' && level) q = q.where('classes.level', level);
    // scope === 'all' → no extra filter.

    const students = await q.distinct('students.id as id').select('students.id');
    if (students.length === 0) return res.status(400).json({ success: false, error: 'No matching active students found' });

    const now = new Date();
    let created = 0;
    for (const s of students) {
      const feeId = crypto.randomUUID(); // fees.id is a UUID column
      try {
        await db('fees').insert({
          id: feeId,
          tenant_id: tenantId,
          student_id: s.id,
          type,
          amount: amt,
          balance: amt,
          due_date: new Date(dueDate),
          term: term || null,
          academic_year: academicYear || null,
          description: description || null,
          class_id: scope === 'class' ? classId : null,
          status: 'pending',
          created_at: now,
          updated_at: now,
        });
        created++;
      } catch (e) { /* skip individual failures */ }
    }

    await auditService.logAudit({
      entityType: 'fee', entityId: `bulk-bill-${Date.now()}`, action: 'bulk_create',
      performedBy: userId, details: { scope, classId, level, type, amount: amt, created }, timestamp: now,
    }).catch(() => {});

    res.json({ success: true, data: { created, total: students.length } });
  } catch (error) {
    logger.error(`finance/bulk-bill error: ${error}`);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// POST /api/v1/finance/bulk-invoice — generate ONE invoice per student from
// their outstanding (unbilled) fees, optionally scoped by term/class/level.
router.post('/finance/bulk-invoice', authenticate, requireStaff, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const userId = (req as any).user.id;
    const { scope, classId, level, term, dueDate } = req.body || {};
    // Invoices are always tagged with a real year: the one sent, else the
    // school's ACTIVE year (never null, so year filters can find them).
    const academicYear = normalizeAcademicYear(req.body?.academicYear || null)
      || (await resolveActiveYear(tenantId)).yearString;

    // Students in scope.
    let sq = db('students')
      .leftJoin('enrollments', function () {
        this.on('enrollments.student_id', '=', 'students.id').andOn('enrollments.status', '=', db.raw('?', ['active']));
      })
      .leftJoin('classes', 'classes.id', 'enrollments.class_id')
      .where('students.tenant_id', tenantId)
      .where('students.status', 'active');
    if (scope === 'class' && classId) sq = sq.where('enrollments.class_id', classId);
    else if (scope === 'level' && level) sq = sq.where('classes.level', level);
    const students = await sq.distinct('students.id as id').select('students.id');

    const now = new Date();
    let generated = 0;
    for (const s of students) {
      // Fees for this student not yet linked to an invoice, with a balance.
      let fq = db('fees')
        .leftJoin('invoice_items', 'invoice_items.fee_id', 'fees.id')
        .whereNull('invoice_items.id')
        .where('fees.student_id', s.id)
        .whereIn('fees.status', ['pending', 'partial', 'overdue']);
      if (term) fq = fq.where('fees.term', term);
      if (academicYear) fq = fq.where('fees.academic_year', academicYear);
      const fees = await fq.select('fees.id', 'fees.amount', 'fees.balance');
      if (fees.length === 0) continue;

      const total = fees.reduce((sum: number, f: any) => sum + (Number(f.balance ?? f.amount) || 0), 0);
      if (total <= 0) continue;

      const invoiceId = crypto.randomUUID(); // invoices.id is a UUID column
      const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 900000 + 100000)}`;
      await db('invoices').insert({
        id: invoiceId,
        tenant_id: tenantId,
        invoice_number: invoiceNumber,
        student_id: s.id,
        total_amount: total,
        total_paid: 0,
        balance: total,
        due_date: dueDate ? new Date(dueDate) : now,
        term: term || null,
        academic_year: academicYear || null,
        status: 'pending',
        generated_at: now,
        created_at: now,
        updated_at: now,
      }).catch(() => {});
      for (const f of fees) {
        await db('invoice_items').insert({
          id: crypto.randomUUID(),
          invoice_id: invoiceId, fee_id: f.id, created_at: now,
        }).catch(() => {});
      }
      generated++;
    }

    await auditService.logAudit({
      entityType: 'invoice', entityId: `bulk-invoice-${Date.now()}`, action: 'bulk_create',
      performedBy: userId, details: { scope, classId, level, term, generated }, timestamp: now,
    }).catch(() => {});

    res.json({ success: true, data: { generated } });
  } catch (error) {
    logger.error(`finance/bulk-invoice error: ${error}`);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// GET /api/v1/finance/invoices/:id/detail — invoice with its fee line items + payments.
router.get('/finance/invoices/:id/detail', authenticate, requireStaff, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const invoice = await db('invoices')
      .join('students', 'invoices.student_id', 'students.id')
      .leftJoin('users', 'students.user_id', 'users.id')
      .where('invoices.id', req.params.id)
      .where('students.tenant_id', tenantId)
      .select('invoices.*', db.raw("COALESCE(users.first_name || ' ' || users.last_name, students.first_name || ' ' || students.last_name, students.student_id) as student_name"), 'students.student_id as admission_no')
      .first();
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });

    const items = await db('invoice_items')
      .join('fees', 'invoice_items.fee_id', 'fees.id')
      .where('invoice_items.invoice_id', invoice.id)
      .select('fees.id', 'fees.type', 'fees.amount', 'fees.balance', 'fees.status', 'fees.due_date');
    const payments = await db('payments')
      .where('invoice_id', invoice.id)
      .select('id', 'amount', 'payment_date', db.raw('COALESCE(method, payment_method) as method'), 'status', 'reference_number')
      .orderBy('payment_date', 'desc');

    res.json({ success: true, data: { invoice, items, payments } });
  } catch (error) {
    logger.error(`finance/invoices/detail error: ${error}`);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// GET /api/v1/finance/fees — all fees for the tenant (with student name).
router.get('/finance/fees', authenticate, requireStaff, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const rows = await db('fees')
      .join('students', 'fees.student_id', 'students.id')
      .leftJoin('users', 'students.user_id', 'users.id')
      .leftJoin('enrollments', function () {
        this.on('enrollments.student_id', '=', 'students.id').andOn('enrollments.status', '=', db.raw('?', ['active']));
      })
      .leftJoin('classes', 'classes.id', 'enrollments.class_id')
      .where('students.tenant_id', tenantId)
      .select(
        'fees.*',
        db.raw("COALESCE(users.first_name || ' ' || users.last_name, students.first_name || ' ' || students.last_name, students.student_id) as student_name"),
        'students.student_id as admission_no',
        'classes.name as class_name',
        'classes.level as class_level',
      )
      .orderBy('fees.due_date', 'desc')
      .limit(1000);
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error(`finance/fees error: ${error}`);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// POST /api/v1/finance/balance-reminders — email guardians (or students) a
// descriptive reminder of their child's OUTSTANDING FEE BALANCE with a "Pay
// Fees" button that links to the portal. Works off the fees ledger, so it does
// NOT require invoices. Scopes: single student, class, level, or all defaulters.
router.post('/finance/balance-reminders', authenticate, requireStaff, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const userId = (req as any).user.id;
    const { scope, studentId, classId, level, section, term, message } = req.body || {};

    const REMINDER_SECTION_LEVELS: Record<string, string[]> = {
      nursery: ['NURSERY1', 'NURSERY2', 'NURSERY3'],
      primary: ['CLASS1', 'CLASS2', 'CLASS3', 'CLASS4', 'CLASS5', 'CLASS6'],
      jss: ['JSS1', 'JSS2', 'JSS3'],
      sss: ['SSS1', 'SSS2', 'SSS3'],
    };

    // Resolve the set of students in scope.
    let sq = db('students')
      .leftJoin('enrollments', function () {
        this.on('enrollments.student_id', '=', 'students.id').andOn('enrollments.status', '=', db.raw('?', ['active']));
      })
      .leftJoin('classes', 'classes.id', 'enrollments.class_id')
      .where('students.tenant_id', tenantId)
      .where('students.status', 'active');
    if (scope === 'student' && studentId) sq = sq.where('students.id', studentId);
    else if (scope === 'class' && classId) sq = sq.where('enrollments.class_id', classId);
    else if (scope === 'section' && section && REMINDER_SECTION_LEVELS[String(section).toLowerCase()]) {
      sq = sq.whereIn('classes.level', REMINDER_SECTION_LEVELS[String(section).toLowerCase()]);
    } else if (scope === 'level' && level) sq = sq.where('classes.level', level);
    const students = await sq.distinct('students.id as id').select('students.id');

    const { default: emailService } = await import('@services/emailService');
    const { default: notificationService } = await import('@services/notificationService');
    const now = new Date();
    let sent = 0;
    let notified = 0;
    let skippedNoBalance = 0;
    let skippedNoEmail = 0;

    // Helper to fire a targeted in-app notification (fire-and-forget).
    const notify = async (recipientUserId: string | null | undefined, studentName: string, balance: number, overdue: boolean, sid: string) => {
      if (!recipientUserId) return;
      await notificationService.createNotification({
        notificationType: 'payment',
        recipientId: recipientUserId,
        subject: overdue ? 'Overdue school fees' : 'Outstanding school fees',
        message: `${studentName} has an outstanding balance of Le ${balance.toLocaleString()}${overdue ? ' which is now overdue' : ''}. Tap to view and pay from your portal.`,
        data: { studentId: sid, balance, overdue, kind: 'balance_reminder' },
        channels: ['in_app'],
        sourceType: 'fee',
        sourceId: sid,
        createdBy: userId,
      }).then(() => { notified++; }).catch(() => {});
    };

    for (const s of students) {
      // Outstanding balance from the fees ledger (optionally per-term).
      let fq = db('fees')
        .where('fees.student_id', s.id)
        .whereNot('fees.status', 'deleted')
        .whereIn('fees.status', ['pending', 'partial', 'overdue']);
      if (term) fq = fq.where('fees.term', term);
      const fees = await fq.select('fees.balance', 'fees.amount', 'fees.due_date');
      const balance = fees.reduce((sum: number, f: any) => sum + (Number(f.balance ?? f.amount) || 0), 0);
      if (balance <= 0) { skippedNoBalance++; continue; }

      // Earliest due date drives the "overdue" flag.
      const dueDates = fees.map((f: any) => (f.due_date ? new Date(f.due_date) : null)).filter(Boolean) as Date[];
      const earliestDue = dueDates.length ? new Date(Math.min(...dueDates.map((d) => d.getTime()))) : undefined;
      const overdue = earliestDue ? earliestDue < now : false;

      // Resolve student name + best recipient (linked active guardian first).
      const studentRow = await db('students').where('id', s.id).first().catch(() => null);
      const studentUser = studentRow?.user_id
        ? await db('users').where('id', studentRow.user_id).first().catch(() => null)
        : null;
      const studentName = studentRow
        ? [studentRow.first_name, studentRow.last_name].filter(Boolean).join(' ')
        : (studentUser ? [studentUser.first_name, studentUser.last_name].filter(Boolean).join(' ') : 'your child');

      let recipientEmail: string | null = studentRow?.email || studentUser?.email || null;
      let recipientName = 'Parent/Guardian';
      let guardianUserId: string | null = null;

      const guardianLink = await db('student_guardians')
        .where({ student_id: s.id, status: 'active' })
        .first()
        .catch(() => null);
      if (guardianLink?.guardian_id) {
        guardianUserId = guardianLink.guardian_id;
        const guardian = await db('users').where({ id: guardianLink.guardian_id }).first().catch(() => null);
        if (guardian?.email) {
          recipientEmail = guardian.email;
          recipientName = [guardian.first_name, guardian.last_name].filter(Boolean).join(' ') || recipientName;
        }
      }

      // In-app notifications — fire to the guardian's account and the student's
      // own account (if any). These work even when no email is on file, so the
      // balance still surfaces in the portal bell.
      await notify(guardianUserId, studentName, balance, overdue, s.id);
      await notify(studentRow?.user_id, studentName, balance, overdue, s.id);

      if (!recipientEmail) { skippedNoEmail++; continue; }

      try {
        await emailService.sendFeeReminderEmail(tenantId, recipientEmail, {
          guardianName: recipientName,
          studentName,
          amountDue: balance,
          currency: 'Le',
          dueDate: earliestDue,
          overdue,
          feeName: term ? `${term} fees` : 'Outstanding school fees',
          customMessage: message || undefined,
        } as any);
        sent++;
      } catch (mailErr) {
        logger.warn(`balance reminder email failed for student ${s.id}: ${mailErr}`);
        skippedNoEmail++;
      }
    }

    await auditService.logAudit({
      entityType: 'fee', entityId: `balance-reminders-${Date.now()}`, action: 'send_balance_reminders',
      performedBy: userId, details: { scope, studentId, classId, level, term, sent, notified, skippedNoBalance, skippedNoEmail }, timestamp: now,
    }).catch(() => {});

    res.json({ success: true, data: { sent, notified, skippedNoBalance, skippedNoEmail, considered: students.length } });
  } catch (error) {
    logger.error(`finance/balance-reminders error: ${error}`);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
