import { logger } from '@utils/logger';
import db from '@utils/database';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { stringify } from 'csv-stringify/sync';
import { Readable } from 'stream';

export interface ExportOptions {
  format: 'pdf' | 'excel' | 'csv' | 'json';
  title?: string;
  columns?: string[];
  includeCharts?: boolean;
  template?: string;
}

export interface ExportTemplate {
  id: string;
  name: string;
  format: string;
  columns: string[];
  filters?: Record<string, any>;
  createdAt: string;
}

/**
 * Export Service for generating reports in multiple formats
 */
class ExportService {
  /**
   * Export dashboard data to PDF
   */
  async exportToPDF(data: any, options: ExportOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margin: 50,
          size: 'A4',
        });

        const buffers: Buffer[] = [];

        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Header
        this.generatePDFHeader(doc, options.title || 'Dashboard Report');

        // Content
        if (data.metrics) {
          this.generatePDFMetrics(doc, data.metrics);
        }

        if (data.financialSummary) {
          this.generatePDFFinancial(doc, data.financialSummary);
        }

        if (data.alerts && data.alerts.length > 0) {
          this.generatePDFAlerts(doc, data.alerts);
        }

        // Footer
        this.generatePDFFooter(doc);

        doc.end();
      } catch (error) {
        logger.error(`PDF export error: ${error}`);
        reject(error);
      }
    });
  }

  /**
   * Export dashboard data to Excel
   */
  async exportToExcel(data: any, options: ExportOptions): Promise<Buffer> {
    try {
      const wb = new ExcelJS.Workbook();

      // Dashboard sheet
      if (data.metrics) {
        const ws = wb.addWorksheet('Metrics');
        ws.addRow(['Key Metric', 'Value']);
        ws.addRow(['Total Students', data.metrics.totalStudents]);
        ws.addRow(['Total Teachers', data.metrics.totalTeachers]);
        ws.addRow(['Total Classes', data.metrics.totalClasses]);
        ws.addRow(['Outstanding Fees', data.metrics.outstandingFees]);
        ws.addRow(['Total Collected', data.metrics.totalCollected]);
        ws.addRow(['Attendance Rate', `${data.metrics.attendanceRate}%`]);
        ws.addRow(['Average Grade', data.metrics.averageGrade]);
      }

      // Financial sheet
      if (data.financialSummary) {
        const ws = wb.addWorksheet('Financial');
        ws.addRow(['Financial Metric', 'Value']);
        ws.addRow(['Total Revenue', data.financialSummary.totalRevenue]);
        ws.addRow(['This Month Collected', data.financialSummary.thisMonthCollected]);
        ws.addRow(['Monthly Target', data.financialSummary.thisMonthTarget]);
        ws.addRow(['Outstanding Balance', data.financialSummary.outstandingBalance]);
        ws.addRow(['Overdue Amount', data.financialSummary.overdueAmount]);
        ws.addRow(['Collection Rate', `${data.financialSummary.collectionRate}%`]);
        ws.addRow(['Trend', `${data.financialSummary.trend}%`]);
      }

      // Alerts sheet
      if (data.alerts && data.alerts.length > 0) {
        const ws = wb.addWorksheet('Alerts');
        ws.addRow(['Type', 'Title', 'Message', 'Severity', 'Timestamp']);
        data.alerts.forEach((alert: any) => {
          ws.addRow([alert.type, alert.title, alert.message, alert.severity, alert.timestamp]);
        });
      }

      // At-risk students sheet
      if (data.atRiskStudents && data.atRiskStudents.length > 0) {
        const ws = wb.addWorksheet('At-Risk Students');
        ws.addRow(['Name', 'Roll Number', 'Class', 'Risk Factors', 'Attendance', 'Grade', 'Severity']);
        data.atRiskStudents.forEach((student: any) => {
          ws.addRow([
            student.name,
            student.rollNumber,
            student.className,
            student.riskFactors.join(', '),
            `${student.attendanceRate}%`,
            student.averageGrade,
            student.severity,
          ]);
        });
      }

      const buffer = await wb.xlsx.writeBuffer();
      return Buffer.from(buffer);
    } catch (error) {
      logger.error(`Excel export error: ${error}`);
      throw error;
    }
  }

  /**
   * Export dashboard data to CSV
   */
  async exportToCSV(data: any, options: ExportOptions): Promise<string> {
    try {
      const records: any[] = [];

      if (data.metrics) {
        records.push({
          category: 'Metrics',
          'Total Students': data.metrics.totalStudents,
          'Total Teachers': data.metrics.totalTeachers,
          'Total Classes': data.metrics.totalClasses,
          'Outstanding Fees': data.metrics.outstandingFees,
          'Total Collected': data.metrics.totalCollected,
        });
      }

      if (data.financialSummary) {
        records.push({
          category: 'Financial Summary',
          'Total Revenue': data.financialSummary.totalRevenue,
          'This Month': data.financialSummary.thisMonthCollected,
          Target: data.financialSummary.thisMonthTarget,
          Outstanding: data.financialSummary.outstandingBalance,
          Overdue: data.financialSummary.overdueAmount,
        });
      }

      const csv = stringify(records, {
        header: true,
        columns: Object.keys(records[0] || {}),
      });

      return csv;
    } catch (error) {
      logger.error(`CSV export error: ${error}`);
      throw error;
    }
  }

  /**
   * Export dashboard data to JSON
   */
  async exportToJSON(data: any): Promise<string> {
    try {
      return JSON.stringify(data, null, 2);
    } catch (error) {
      logger.error(`JSON export error: ${error}`);
      throw error;
    }
  }

  /**
   * Generate PDF header
   */
  private generatePDFHeader(doc: PDFDocument, title: string) {
    doc.fontSize(20).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).font('Helvetica').text(`Generated on: ${new Date().toLocaleString()}`, {
      align: 'center',
    });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();
  }

  /**
   * Generate PDF metrics section
   */
  private generatePDFMetrics(doc: PDFDocument, metrics: any) {
    doc.fontSize(14).font('Helvetica-Bold').text('Key Metrics', { underline: true });
    doc.moveDown();

    const metricsData = [
      { label: 'Total Students', value: metrics.totalStudents },
      { label: 'Total Teachers', value: metrics.totalTeachers },
      { label: 'Total Classes', value: metrics.totalClasses },
      { label: 'Outstanding Fees', value: `Le${metrics.outstandingFees.toLocaleString()}` },
      { label: 'Attendance Rate', value: `${metrics.attendanceRate}%` },
    ];

    doc.fontSize(10).font('Helvetica');
    metricsData.forEach((metric) => {
      doc.text(`${metric.label}: ${metric.value}`);
    });

    doc.moveDown();
  }

  /**
   * Generate PDF financial section
   */
  private generatePDFFinancial(doc: PDFDocument, financial: any) {
    doc.fontSize(14).font('Helvetica-Bold').text('Financial Summary', { underline: true });
    doc.moveDown();

    const financialData = [
      { label: 'Total Revenue', value: `Le${financial.totalRevenue.toLocaleString()}` },
      { label: 'This Month', value: `Le${financial.thisMonthCollected.toLocaleString()}` },
      { label: 'Monthly Target', value: `Le${financial.thisMonthTarget.toLocaleString()}` },
      { label: 'Collection Rate', value: `${financial.collectionRate}%` },
      { label: 'Outstanding Balance', value: `Le${financial.outstandingBalance.toLocaleString()}` },
    ];

    doc.fontSize(10).font('Helvetica');
    financialData.forEach((item) => {
      doc.text(`${item.label}: ${item.value}`);
    });

    doc.moveDown();
  }

  /**
   * Generate PDF alerts section
   */
  private generatePDFAlerts(doc: PDFDocument, alerts: any[]) {
    doc.fontSize(14).font('Helvetica-Bold').text('System Alerts', { underline: true });
    doc.moveDown();

    doc.fontSize(10).font('Helvetica');
    alerts.slice(0, 5).forEach((alert) => {
      doc.text(`• [${alert.severity.toUpperCase()}] ${alert.title}`);
      doc.text(`  ${alert.message}`);
    });

    doc.moveDown();
  }

  /**
   * Generate PDF footer
   */
  private generatePDFFooter(doc: PDFDocument) {
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();
    doc.fontSize(9).font('Helvetica').text('This report is confidential and contains sensitive information.', {
      align: 'center',
    });
  }

  /**
   * Save export template
   */
  async saveTemplate(userId: string, template: Omit<ExportTemplate, 'id' | 'createdAt'>): Promise<ExportTemplate> {
    try {
      const id = Math.random().toString(36).substr(2, 9);
      const createdAt = new Date().toISOString();

      await db('export_templates').insert({
        id,
        userId,
        ...template,
        createdAt,
      });

      return { id, ...template, createdAt };
    } catch (error) {
      logger.error(`Error saving template: ${error}`);
      throw error;
    }
  }

  /**
   * Get user's export templates
   */
  async getUserTemplates(userId: string): Promise<ExportTemplate[]> {
    try {
      const templates = await db('export_templates').where({ userId }).select();
      return templates;
    } catch (error) {
      logger.error(`Error getting templates: ${error}`);
      throw error;
    }
  }

  /**
   * Delete export template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    try {
      await db('export_templates').where({ id: templateId }).delete();
    } catch (error) {
      logger.error(`Error deleting template: ${error}`);
      throw error;
    }
  }

  /**
   * Log export activity
   */
  async logExport(userId: string, format: string, dataSize: number): Promise<void> {
    try {
      await db('export_history').insert({
        id: Math.random().toString(36).substr(2, 9),
        userId,
        format,
        dataSize,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error logging export: ${error}`);
      // Don't throw - logging failure shouldn't block export
    }
  }
}

export default new ExportService();
