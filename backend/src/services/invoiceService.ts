import { Knex } from 'knex';
import { logger } from '@utils/logger';
import { AuditService } from './auditService';

export interface InvoiceData {
  studentId: string;
  feeIds: string[];
  dueDate?: string;
  notes?: string;
}

export interface InvoiceFilter {
  studentId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  classId?: string;
}

export class InvoiceService {
  private auditService: AuditService;

  constructor(private db: Knex) {
    this.auditService = new AuditService(db);
  }

  /**
   * Generate invoice from fees
   */
  async generateInvoice(data: InvoiceData, userId: string): Promise<any> {
    try {
      logger.info(`Generating invoice for student ${data.studentId}`);

      // Validate student exists
      const student = await this.db('users')
        .where('id', data.studentId)
        .where('role', 'student')
        .first();

      if (!student) {
        throw new Error(`Student ${data.studentId} not found`);
      }

      // Get all fees and calculate totals
      let fees = await this.db('fees')
        .whereIn('id', data.feeIds)
        .where('student_id', data.studentId);

      if (fees.length === 0) {
        throw new Error('No fees found for invoice');
      }

      const totalAmount = fees.reduce((sum: number, fee: any) => sum + fee.amount, 0);
      const totalBalance = fees.reduce((sum: number, fee: any) => sum + fee.balance, 0);
      const totalPaid = totalAmount - totalBalance;

      // Generate invoice number
      const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const invoice = {
        id: invoiceNumber,
        student_id: data.studentId,
        invoice_number: invoiceNumber,
        total_amount: totalAmount,
        total_paid: totalPaid,
        balance: totalBalance,
        status: totalBalance === 0 ? 'paid' : 'pending',
        due_date: new Date(data.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
        notes: data.notes || null,
        generated_by: userId,
        generated_at: new Date(),
        created_at: new Date(),
      };

      await this.db('invoices').insert(invoice);

      // Link invoice to fees
      for (const feeId of data.feeIds) {
        await this.db('invoice_items').insert({
          id: `INV-ITEM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          invoice_id: invoiceNumber,
          fee_id: feeId,
          created_at: new Date(),
        });
      }

      // Log to audit
      await this.auditService.logAudit({
        entityType: 'invoice',
        entityId: invoiceNumber,
        action: 'create',
        performedBy: userId,
        details: {
          studentId: data.studentId,
          feeCount: data.feeIds.length,
          totalAmount,
        },
        timestamp: new Date(),
      });

      logger.info(`Invoice ${invoiceNumber} generated successfully`);
      return invoice;
    } catch (error) {
      logger.error(`Error generating invoice: ${error}`);
      throw error;
    }
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(invoiceId: string): Promise<any> {
    try {
      const invoice = await this.db('invoices')
        .where('id', invoiceId)
        .first();

      if (!invoice) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }

      // Get invoice items
      const items = await this.db('invoice_items')
        .where('invoice_id', invoiceId)
        .leftJoin('fees', 'invoice_items.fee_id', 'fees.id')
        .select('fees.*', 'invoice_items.id as item_id');

      return {
        ...invoice,
        items,
      };
    } catch (error) {
      logger.error(`Error fetching invoice: ${error}`);
      throw error;
    }
  }

  /**
   * Get student invoices
   */
  async getStudentInvoices(studentId: string, filters?: InvoiceFilter): Promise<any[]> {
    try {
      logger.info(`Fetching invoices for student ${studentId}`);

      let query = this.db('invoices').where('student_id', studentId);

      if (filters?.status) {
        query = query.where('status', filters.status);
      }

      if (filters?.startDate) {
        query = query.where('generated_at', '>=', new Date(filters.startDate));
      }

      if (filters?.endDate) {
        query = query.where('generated_at', '<=', new Date(filters.endDate));
      }

      const invoices = await query.orderBy('generated_at', 'desc');

      return invoices;
    } catch (error) {
      logger.error(`Error fetching student invoices: ${error}`);
      throw error;
    }
  }

  /**
   * Update invoice status
   */
  async updateInvoiceStatus(invoiceId: string, status: string, userId: string): Promise<any> {
    try {
      logger.info(`Updating invoice ${invoiceId} status to ${status}`);

      const invoice = await this.getInvoiceById(invoiceId);

      await this.db('invoices')
        .where('id', invoiceId)
        .update({
          status,
          updated_at: new Date(),
        });

      // Log to audit
      await this.auditService.logAudit({
        entityType: 'invoice',
        entityId: invoiceId,
        action: 'update_status',
        performedBy: userId,
        details: {
          from: invoice.status,
          to: status,
        },
        timestamp: new Date(),
      });

      return { id: invoiceId, status };
    } catch (error) {
      logger.error(`Error updating invoice status: ${error}`);
      throw error;
    }
  }

  /**
   * Get invoice statistics
   */
  async getInvoiceStatistics(filters?: InvoiceFilter): Promise<any> {
    try {
      logger.info('Calculating invoice statistics');

      let query = this.db('invoices');

      if (filters?.startDate) {
        query = query.where('generated_at', '>=', new Date(filters.startDate));
      }

      if (filters?.endDate) {
        query = query.where('generated_at', '<=', new Date(filters.endDate));
      }

      const stats = await query
        .select(
          this.db.raw('COUNT(*) as total_invoices'),
          this.db.raw('SUM(total_amount) as total_amount_invoiced'),
          this.db.raw('SUM(total_paid) as total_amount_paid'),
          this.db.raw('SUM(balance) as total_outstanding'),
          this.db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as paid_invoices', ['paid']),
          this.db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as pending_invoices', ['pending']),
          this.db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as overdue_invoices', ['overdue']),
          this.db.raw('AVG(total_amount) as average_invoice_amount')
        )
        .first();

      return stats;
    } catch (error) {
      logger.error(`Error calculating invoice statistics: ${error}`);
      throw error;
    }
  }

  /**
   * Get overdue invoices
   */
  async getOverdueInvoices(): Promise<any[]> {
    try {
      const today = new Date();

      const invoices = await this.db('invoices')
        .where('due_date', '<', today)
        .where('status', '!= ', 'paid')
        .leftJoin('users', 'invoices.student_id', 'users.id')
        .select(
          'invoices.*',
          'users.name as student_name',
          'users.email as student_email'
        )
        .orderBy('invoices.due_date', 'asc');

      return invoices;
    } catch (error) {
      logger.error(`Error fetching overdue invoices: ${error}`);
      throw error;
    }
  }

  /**
   * Send invoice reminder
   */
  async sendInvoiceReminder(invoiceId: string, userId: string): Promise<any> {
    try {
      logger.info(`Sending reminder for invoice ${invoiceId}`);

      const invoice = await this.getInvoiceById(invoiceId);

      // Get student details
      const student = await this.db('users')
        .where('id', invoice.student_id)
        .first();

      // Log to audit
      await this.auditService.logAudit({
        entityType: 'invoice',
        entityId: invoiceId,
        action: 'send_reminder',
        performedBy: userId,
        details: {
          studentEmail: student.email,
          invoiceAmount: invoice.total_amount,
        },
        timestamp: new Date(),
      });

      // Note: Actual email sending would be done via email service
      return {
        success: true,
        message: `Reminder sent for invoice ${invoiceId}`,
        studentEmail: student.email,
      };
    } catch (error) {
      logger.error(`Error sending invoice reminder: ${error}`);
      throw error;
    }
  }

  /**
   * Export invoice as data
   */
  async exportInvoiceData(invoiceId: string): Promise<any> {
    try {
      const invoice = await this.getInvoiceById(invoiceId);

      const student = await this.db('users')
        .where('id', invoice.student_id)
        .first();

      return {
        invoice: invoice,
        student: student,
        exportDate: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`Error exporting invoice: ${error}`);
      throw error;
    }
  }

  /**
   * Bulk generate invoices
   */
  async bulkGenerateInvoices(classId: string, feeType: string, userId: string): Promise<any> {
    try {
      logger.info(`Bulk generating invoices for class ${classId}`);

      // Get all students in class
      const enrollments = await this.db('enrollments')
        .where('class_id', classId)
        .select('student_id');

      const results = {
        created: 0,
        failed: 0,
        invoiceIds: [] as string[],
        errors: [] as string[],
      };

      for (const enrollment of enrollments) {
        try {
          // Get fees for this student
          const fees = await this.db('fees')
            .where('student_id', enrollment.student_id)
            .where('type', feeType)
            .where('status', '!=', 'paid')
            .select('id');

          if (fees.length > 0) {
            const feeIds = fees.map((f: any) => f.id);
            const invoice = await this.generateInvoice(
              {
                studentId: enrollment.student_id,
                feeIds,
              },
              userId
            );
            results.created++;
            results.invoiceIds.push(invoice.id);
          }
        } catch (error) {
          results.failed++;
          results.errors.push(`Failed for student ${enrollment.student_id}: ${error}`);
        }
      }

      return results;
    } catch (error) {
      logger.error(`Error bulk generating invoices: ${error}`);
      throw error;
    }
  }

  /**
   * Get invoice summary
   */
  async getInvoiceSummary(invoiceId: string): Promise<any> {
    try {
      const invoice = await this.getInvoiceById(invoiceId);

      const summary = {
        invoiceNumber: invoice.invoice_number,
        student: await this.db('users').where('id', invoice.student_id).first(),
        items: invoice.items,
        totalAmount: invoice.total_amount,
        totalPaid: invoice.total_paid,
        balance: invoice.balance,
        status: invoice.status,
        dueDate: invoice.due_date,
        generatedDate: invoice.generated_at,
      };

      return summary;
    } catch (error) {
      logger.error(`Error generating invoice summary: ${error}`);
      throw error;
    }
  }
}
