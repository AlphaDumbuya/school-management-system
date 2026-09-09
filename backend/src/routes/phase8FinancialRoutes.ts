import express, { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '@middleware/authMiddleware';
import { FeeService } from '@services/feeService';
import { PaymentService } from '@services/paymentService';

const STAFF_ROLES = ['principal', 'super_admin', 'accountant'];
/** Middleware: only staff (principal/super_admin/accountant) may access admin finance pages. */
const requireStaff = (req: Request, res: Response, next: NextFunction) => {
  const role = (req as any).user?.role;
  if (!role || !STAFF_ROLES.includes(role)) {
    return res.status(403).json({ success: false, error: 'Access denied. Finance management is restricted to staff roles.' });
  }
  next();
};
import { InvoiceService } from '@services/invoiceService';
import { db } from '@utils/database';
import { logger } from '@utils/logger';
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
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { type, amount, dueDate, description, studentId, classId, academicSession } =
        req.body;
      const userId = (req as any).user.id;

      // Validate required fields
      if (!type || !amount || !studentId || !dueDate) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['type', 'amount', 'studentId', 'dueDate'],
        });
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

      if (!feeId || !amount || !method) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['feeId', 'amount', 'method'],
        });
      }

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
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
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
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { startDate, endDate, studentId } = req.query;

      const stats = await paymentService.getPaymentStatistics({
        startDate: startDate as string,
        endDate: endDate as string,
        studentId: studentId as string,
      });

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
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { studentId, feeIds, dueDate, notes } = req.body;
      const userId = (req as any).user.id;

      if (!studentId || !feeIds || feeIds.length === 0) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['studentId', 'feeIds (array with at least one fee)'],
        });
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
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { invoiceId } = req.params;

      const invoice = await invoiceService.getInvoiceById(invoiceId);

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
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { studentId } = req.params;
      const { status, startDate, endDate } = req.query;

      const invoices = await invoiceService.getStudentInvoices(studentId, {
        status: status as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

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
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { invoiceId } = req.params;
      const { status } = req.body;
      const userId = (req as any).user.id;

      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }

      const result = await invoiceService.updateInvoiceStatus(invoiceId, status, userId);

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
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const invoices = await invoiceService.getOverdueInvoices();

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
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { classId } = req.query;

      const stats = await feeService.getFeeStatistics(classId as string);

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
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { startDate, endDate } = req.query;

      const stats = await invoiceService.getInvoiceStatistics({
        startDate: startDate as string,
        endDate: endDate as string,
      });

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
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { classId, fees } = req.body;
      const userId = (req as any).user.id;

      if (!classId || !fees || fees.length === 0) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['classId', 'fees (array with at least one fee)'],
        });
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
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { classId, feeType } = req.body;
      const userId = (req as any).user.id;

      if (!classId || !feeType) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['classId', 'feeType'],
        });
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
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { daysOverdue } = req.query;

      const fees = await feeService.getOverdueFees(
        daysOverdue ? parseInt(daysOverdue as string) : 0
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
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { type } = req.params;
      const { classId } = req.query;

      const fees = await feeService.getFeesByType(type, classId as string);

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
        endDate as string
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
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const summary = await paymentService.getPaymentMethodsSummary();

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
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { invoiceId } = req.params;

      const summary = await invoiceService.getInvoiceSummary(invoiceId);

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
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { limit } = req.query;

      const payments = await paymentService.getRecentPayments(
        limit ? parseInt(limit as string) : 50
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
router.get('/finance/overview', authenticate, requireStaff, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const billed = await db('invoices')
      .leftJoin('students', 'invoices.student_id', 'students.id')
      .where('students.tenant_id', tenantId)
      .sum('invoices.total_amount as total').first();
    const paid = await db('invoices')
      .leftJoin('students', 'invoices.student_id', 'students.id')
      .where('students.tenant_id', tenantId)
      .sum('invoices.total_paid as total').first();
    const outstanding = await db('invoices')
      .leftJoin('students', 'invoices.student_id', 'students.id')
      .where('students.tenant_id', tenantId)
      .sum('invoices.balance as total').first();
    const overdue = await db('invoices')
      .leftJoin('students', 'invoices.student_id', 'students.id')
      .where('students.tenant_id', tenantId)
      .where('invoices.status', 'overdue')
      .count('invoices.id as count').first();
    res.json({
      success: true,
      data: {
        totalBilled: Number(billed?.total) || 0,
        totalPaid: Number(paid?.total) || 0,
        totalOutstanding: Number(outstanding?.total) || 0,
        overdueInvoices: Number(overdue?.count) || 0,
      },
    });
  } catch (error) {
    logger.error(`finance/overview error: ${error}`);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// GET /api/v1/finance/invoices — all invoices for the tenant (with student name).
router.get('/finance/invoices', authenticate, requireStaff, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const status = req.query.status as string | undefined;
    let q = db('invoices')
      .join('students', 'invoices.student_id', 'students.id')
      .leftJoin('users', 'students.user_id', 'users.id')
      .where('students.tenant_id', tenantId)
      .leftJoin('enrollments', function () {
        this.on('enrollments.student_id', '=', 'students.id').andOn('enrollments.status', '=', db.raw('?', ['active']));
      })
      .leftJoin('classes', 'classes.id', 'enrollments.class_id')
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

// GET /api/v1/finance/payments — all payments for the tenant (with student name).
router.get('/finance/payments', authenticate, requireStaff, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const rows = await db('payments')
      .join('students', 'payments.student_id', 'students.id')
      .leftJoin('users', 'students.user_id', 'users.id')
      .leftJoin('enrollments', function () {
        this.on('enrollments.student_id', '=', 'students.id').andOn('enrollments.status', '=', db.raw('?', ['active']));
      })
      .leftJoin('classes', 'classes.id', 'enrollments.class_id')
      .where('students.tenant_id', tenantId)
      .select(
        'payments.*',
        db.raw("COALESCE(users.first_name || ' ' || users.last_name, students.first_name || ' ' || students.last_name, students.student_id) as student_name"),
        'students.student_id as admission_no',
        'classes.name as class_name',
        'classes.level as class_level',
      )
      .orderBy('payments.payment_date', 'desc')
      .limit(1000);
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error(`finance/payments error: ${error}`);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// GET /api/v1/finance/analytics — enterprise finance-hub analytics: totals,
// collection rate %, by-term, by-level, by-class, method mix, 6-month trend,
// top defaulters, and recent payments. Tenant-scoped via the students join.
router.get('/finance/analytics', authenticate, requireStaff, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenant_id;

    // ── Totals from invoices (the authoritative billed/paid/outstanding) ──
    const totals = await db('invoices')
      .join('students', 'invoices.student_id', 'students.id')
      .where('students.tenant_id', tenantId)
      .select(
        db.raw('COALESCE(SUM(invoices.total_amount),0) as billed'),
        db.raw('COALESCE(SUM(invoices.total_paid),0) as paid'),
        db.raw('COALESCE(SUM(invoices.balance),0) as outstanding'),
        db.raw('COUNT(invoices.id) as invoice_count'),
        db.raw("COUNT(CASE WHEN invoices.status = 'overdue' THEN 1 END) as overdue_count"),
        db.raw("COUNT(CASE WHEN invoices.status = 'paid' THEN 1 END) as paid_count"),
      )
      .first();
    const billed = Number(totals?.billed) || 0;
    const paid = Number(totals?.paid) || 0;
    const outstanding = Number(totals?.outstanding) || 0;
    const collectionRate = billed > 0 ? Math.round((paid / billed) * 1000) / 10 : 0;

    // ── Payment method breakdown ──
    const byMethod = await db('payments')
      .join('students', 'payments.student_id', 'students.id')
      .where('students.tenant_id', tenantId)
      .where('payments.status', 'completed')
      .select(db.raw('COALESCE(payments.method, payments.payment_method) as method'))
      .sum('payments.amount as total')
      .count('payments.id as count')
      .groupByRaw('COALESCE(payments.method, payments.payment_method)');

    // ── 6-month collection trend ──
    const trend = await db('payments')
      .join('students', 'payments.student_id', 'students.id')
      .where('students.tenant_id', tenantId)
      .where('payments.status', 'completed')
      .where('payments.payment_date', '>=', db.raw("CURRENT_DATE - INTERVAL '6 months'"))
      .select(db.raw("TO_CHAR(DATE_TRUNC('month', payments.payment_date), 'Mon YYYY') as label"))
      .sum('payments.amount as total')
      .groupByRaw("DATE_TRUNC('month', payments.payment_date)")
      .orderByRaw("DATE_TRUNC('month', payments.payment_date)");

    // ── Collection + outstanding by class LEVEL ──
    const byLevel = await db('invoices')
      .join('students', 'invoices.student_id', 'students.id')
      .leftJoin('enrollments', function () {
        this.on('enrollments.student_id', '=', 'students.id').andOn('enrollments.status', '=', db.raw('?', ['active']));
      })
      .leftJoin('classes', 'classes.id', 'enrollments.class_id')
      .where('students.tenant_id', tenantId)
      .select(db.raw("COALESCE(classes.level, 'Unassigned') as level"))
      .sum('invoices.total_amount as billed')
      .sum('invoices.total_paid as collected')
      .sum('invoices.balance as outstanding')
      .groupByRaw("COALESCE(classes.level, 'Unassigned')")
      .orderByRaw("COALESCE(classes.level, 'Unassigned')");

    // ── Collection by CLASS (name) ──
    const byClass = await db('invoices')
      .join('students', 'invoices.student_id', 'students.id')
      .leftJoin('enrollments', function () {
        this.on('enrollments.student_id', '=', 'students.id').andOn('enrollments.status', '=', db.raw('?', ['active']));
      })
      .leftJoin('classes', 'classes.id', 'enrollments.class_id')
      .where('students.tenant_id', tenantId)
      .whereNotNull('classes.name')
      .select('classes.name as class_name')
      .sum('invoices.total_amount as billed')
      .sum('invoices.total_paid as collected')
      .sum('invoices.balance as outstanding')
      .groupBy('classes.name')
      .orderByRaw('SUM(invoices.balance) DESC')
      .limit(20);

    // ── Collection by TERM ──
    const byTerm = await db('invoices')
      .join('students', 'invoices.student_id', 'students.id')
      .where('students.tenant_id', tenantId)
      .select(db.raw("COALESCE(invoices.term, 'Unspecified') as term"))
      .sum('invoices.total_amount as billed')
      .sum('invoices.total_paid as collected')
      .sum('invoices.balance as outstanding')
      .groupByRaw("COALESCE(invoices.term, 'Unspecified')")
      .orderByRaw("COALESCE(invoices.term, 'Unspecified')");

    // ── Top defaulters (highest outstanding) ──
    const topDefaulters = await db('invoices')
      .join('students', 'invoices.student_id', 'students.id')
      .leftJoin('users', 'students.user_id', 'users.id')
      .leftJoin('enrollments', function () {
        this.on('enrollments.student_id', '=', 'students.id').andOn('enrollments.status', '=', db.raw('?', ['active']));
      })
      .leftJoin('classes', 'classes.id', 'enrollments.class_id')
      .where('students.tenant_id', tenantId)
      .where('invoices.balance', '>', 0)
      .groupBy('students.id', 'users.first_name', 'users.last_name', 'students.first_name', 'students.last_name', 'students.student_id', 'classes.name')
      .select(
        db.raw("COALESCE(users.first_name || ' ' || users.last_name, students.first_name || ' ' || students.last_name, students.student_id) as student_name"),
        'students.student_id as admission_no',
        'classes.name as class_name',
        db.raw('SUM(invoices.balance) as outstanding'),
      )
      .orderByRaw('SUM(invoices.balance) DESC')
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
        trend: trend.map((r: any) => ({ label: r.label, total: Number(r.total) || 0 })),
        byLevel: byLevel.map((r: any) => ({ level: r.level, billed: Number(r.billed) || 0, collected: Number(r.collected) || 0, outstanding: Number(r.outstanding) || 0, rate: rate(r.billed, r.collected) })),
        byClass: byClass.map((r: any) => ({ className: r.class_name, billed: Number(r.billed) || 0, collected: Number(r.collected) || 0, outstanding: Number(r.outstanding) || 0, rate: rate(r.billed, r.collected) })),
        byTerm: byTerm.map((r: any) => ({ term: r.term, billed: Number(r.billed) || 0, collected: Number(r.collected) || 0, outstanding: Number(r.outstanding) || 0, rate: rate(r.billed, r.collected) })),
        topDefaulters: topDefaulters.map((r: any) => ({ studentName: r.student_name, admissionNo: r.admission_no, className: r.class_name, outstanding: Number(r.outstanding) || 0 })),
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
      const feeId = `FEE-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
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
    const { scope, classId, level, term, academicYear, dueDate } = req.body || {};

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

      const invoiceId = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
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
          id: `II-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
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

export default router;
