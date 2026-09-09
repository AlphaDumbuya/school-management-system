import express, { Router, Request, Response } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import ImportExportService from '../services/importExportService';
import BulkOperationService from '../services/bulkOperationService';
import { StudentImportValidator } from '../validators/studentImportValidator';
import { GradeImportValidator } from '../validators/gradeImportValidator';
import { AttendanceImportValidator } from '../validators/attendanceImportValidator';
import { authMiddleware, attachUserContext } from '../middleware/authMiddleware';
import { SubscriptionService } from '../services/subscriptionService';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  },
});

// POST /api/v1/import/students - Import students from CSV/Excel
router.post('/students', authenticate, attachUserContext, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const filePath = req.file.path;
    const data = ImportExportService.parseUploadedFile(filePath);

    // Enforce the plan's student limit for the whole batch (blocks bulk-import
    // bypass of max_students). Expired/suspended subscriptions are blocked too.
    const tenantId = (req as any).user?.tenant_id;
    if (tenantId) {
      const sub = await SubscriptionService.getActiveSubscription(tenantId);
      if (sub.status === 'expired' || sub.status === 'suspended') {
        fs.unlinkSync(filePath);
        return res.status(403).json({ error: `Your school subscription has ${sub.status}. Please renew to import students.`, code: 'SUBSCRIPTION_EXPIRED' });
      }
      const limit = await SubscriptionService.checkLimit(tenantId, 'students');
      const incoming = Array.isArray(data) ? data.length : 0;
      if (limit.current + incoming > limit.max) {
        fs.unlinkSync(filePath);
        return res.status(403).json({
          error: `Importing ${incoming} students would exceed your plan limit (${limit.current}/${limit.max}). Upgrade your plan or import fewer.`,
          code: 'PLAN_LIMIT_REACHED',
        });
      }
    }

    // Use validator to get rules and perform bulk import
    const validationRules = StudentImportValidator.getValidationRules();
    const errors = ImportExportService.validateData(data, validationRules);

    // Use bulk operation service
    const bulkResult = await BulkOperationService.importStudents(data, {
      skipDuplicates: req.query.skipDuplicates === 'true',
      duplicateStrategy: (req.query.duplicateStrategy as any) || 'keep-first',
      validateEnrollment: req.query.validateEnrollment === 'true',
    });

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({
      totalProcessed: bulkResult.totalProcessed,
      successful: bulkResult.successful,
      failed: bulkResult.failed,
      duplicates: bulkResult.duplicates,
      skipped: bulkResult.skipped,
      errors: bulkResult.errors.slice(0, 50),
      warnings: bulkResult.warnings,
      report: BulkOperationService.generateBulkOperationReport(bulkResult),
    });
  } catch (error: any) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/v1/import/grades - Import grades from CSV/Excel
router.post('/grades', authenticate, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const filePath = req.file.path;
    const data = ImportExportService.parseUploadedFile(filePath);

    // Use validator to get rules
    const validationRules = GradeImportValidator.getValidationRules();
    const errors = ImportExportService.validateData(data, validationRules);

    // Use bulk operation service
    const bulkResult = await BulkOperationService.importGrades(data, {
      skipDuplicates: req.query.skipDuplicates === 'true',
      duplicateStrategy: (req.query.duplicateStrategy as any) || 'keep-first',
      validateEnrollment: req.query.validateEnrollment === 'true',
    });

    fs.unlinkSync(filePath);

    res.json({
      totalProcessed: bulkResult.totalProcessed,
      successful: bulkResult.successful,
      failed: bulkResult.failed,
      duplicates: bulkResult.duplicates,
      skipped: bulkResult.skipped,
      errors: bulkResult.errors.slice(0, 50),
      warnings: bulkResult.warnings,
      report: BulkOperationService.generateBulkOperationReport(bulkResult),
    });
  } catch (error: any) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/v1/import/attendance - Import attendance from CSV/Excel
router.post('/attendance', authenticate, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const filePath = req.file.path;
    const data = ImportExportService.parseUploadedFile(filePath);

    // Use validator to get rules
    const validationRules = AttendanceImportValidator.getValidationRules();
    const errors = ImportExportService.validateData(data, validationRules);

    // Use bulk operation service
    const bulkResult = await BulkOperationService.importAttendance(data, {
      skipDuplicates: req.query.skipDuplicates === 'true',
      duplicateStrategy: (req.query.duplicateStrategy as any) || 'keep-first',
      validateEnrollment: req.query.validateEnrollment === 'true',
    });

    fs.unlinkSync(filePath);

    res.json({
      totalProcessed: bulkResult.totalProcessed,
      successful: bulkResult.successful,
      failed: bulkResult.failed,
      duplicates: bulkResult.duplicates,
      skipped: bulkResult.skipped,
      errors: bulkResult.errors.slice(0, 50),
      warnings: bulkResult.warnings,
      report: BulkOperationService.generateBulkOperationReport(bulkResult),
    });
  } catch (error: any) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(400).json({ error: error.message });
  }
});

// GET /api/v1/export/students - Export students
router.get('/students', authenticate, async (req: Request, res: Response) => {
  try {
    // Mock data - in production, fetch from database
    const students = [
      { firstName: 'Ahmed', lastName: 'Hassan', email: 'ahmed@example.com', class: '10-A', phone: '0123456789', dateOfBirth: '2010-01-15' },
      { firstName: 'Fatima', lastName: 'Ali', email: 'fatima@example.com', class: '9-B', phone: '0987654321', dateOfBirth: '2011-05-20' },
      { firstName: 'Mohammed', lastName: 'Khan', email: 'mohammed@example.com', class: '10-A', phone: '0111122233', dateOfBirth: '2010-03-10' },
    ];

    const format = (req.query.format || 'csv') as string;
    const fileName = `students_export_${new Date().getTime()}`;

    if (format === 'excel') {
      const filePath = `${fileName}.xlsx`;
      ImportExportService.exportToExcel(students, filePath);
      res.download(filePath, () => fs.unlinkSync(filePath));
    } else if (format === 'json') {
      res.json({ data: students, exportedAt: new Date().toISOString() });
    } else {
      const filePath = `${fileName}.csv`;
      ImportExportService.exportToCSV(students, filePath);
      res.download(filePath, () => fs.unlinkSync(filePath));
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/export/grades - Export grades
router.get('/grades', authenticate, async (req: Request, res: Response) => {
  try {
    // Mock data - in production, fetch from database
    const grades = [
      { studentEmail: 'ahmed@example.com', subject: 'Mathematics', marks: 92, maxMarks: 100, date: '2026-07-01', grade: 'A+' },
      { studentEmail: 'fatima@example.com', subject: 'English', marks: 88, maxMarks: 100, date: '2026-07-01', grade: 'A' },
      { studentEmail: 'mohammed@example.com', subject: 'Science', marks: 85, maxMarks: 100, date: '2026-07-01', grade: 'B+' },
    ];

    const format = (req.query.format || 'csv') as string;
    const fileName = `grades_export_${new Date().getTime()}`;

    if (format === 'excel') {
      const filePath = `${fileName}.xlsx`;
      ImportExportService.exportToExcel(grades, filePath);
      res.download(filePath, () => fs.unlinkSync(filePath));
    } else if (format === 'json') {
      res.json({ data: grades, exportedAt: new Date().toISOString() });
    } else {
      const filePath = `${fileName}.csv`;
      ImportExportService.exportToCSV(grades, filePath);
      res.download(filePath, () => fs.unlinkSync(filePath));
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/export/attendance - Export attendance
router.get('/attendance', authenticate, async (req: Request, res: Response) => {
  try {
    // Mock data - in production, fetch from database
    const attendance = [
      { studentEmail: 'ahmed@example.com', class: '10-A', date: '2026-07-01', status: 'present' },
      { studentEmail: 'fatima@example.com', class: '9-B', date: '2026-07-01', status: 'absent' },
      { studentEmail: 'mohammed@example.com', class: '10-A', date: '2026-07-01', status: 'present' },
    ];

    const format = (req.query.format || 'csv') as string;
    const fileName = `attendance_export_${new Date().getTime()}`;

    if (format === 'excel') {
      const filePath = `${fileName}.xlsx`;
      ImportExportService.exportToExcel(attendance, filePath);
      res.download(filePath, () => fs.unlinkSync(filePath));
    } else if (format === 'json') {
      res.json({ data: attendance, exportedAt: new Date().toISOString() });
    } else {
      const filePath = `${fileName}.csv`;
      ImportExportService.exportToCSV(attendance, filePath);
      res.download(filePath, () => fs.unlinkSync(filePath));
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/import/:importId/report - Get import report
router.get('/:importId/report', authenticate, async (req: Request, res: Response) => {
  try {
    const { importId } = req.params;
    // In production, fetch report from database
    const report = `Import Report for ${importId}\nStatus: Completed\nSuccess: 95\nFailed: 5`;
    res.json({ report });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
