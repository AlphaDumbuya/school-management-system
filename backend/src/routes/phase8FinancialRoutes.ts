import express, { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '@middleware/authMiddleware';
import { FeeService } from '@services/feeService';
import { PaymentService } from '@services/paymentService';
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
 * Requires: admin or accountant role
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
 * Requires: admin, accountant, or student role
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
 * Requires: admin or accountant role
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
 * Requires: admin or accountant role
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
 * Requires: admin or accountant role
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
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { invoiceId } = req.params;
      const userId = (req as any).user.id;

      const result = await invoiceService.sendInvoiceReminder(invoiceId, userId);

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
 * Requires: admin or accountant role
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
 * Requires: admin or accountant role
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
 * Requires: admin or accountant role
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
 * Requires: admin or accountant role
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
 * Requires: admin or accountant role
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
 * Delete fee (admin only)
 * DELETE /api/v1/fees/:feeId
 * Requires: admin role
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

export default router;
