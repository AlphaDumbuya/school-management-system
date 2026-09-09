/**
 * studentImportService — bulk student import from CSV.
 *
 * Parses an uploaded CSV, validates each row, enforces the tenant's plan
 * student limit, then inserts valid rows in a single transaction scoped to the
 * tenant. Returns a per-row summary so the UI can show what imported, what was
 * skipped, and why. Never trusts a tenant column in the file — every insert
 * uses the acting user's tenantId.
 */
import { parse } from 'csv-parse/sync';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { generateNextId } from '../utils/idGenerator';
import { linkGuardianForStudent } from '../utils/guardianLinking';
import { SubscriptionService } from './subscriptionService';

/** The columns the template exposes → the student field they map to. */
export const IMPORT_COLUMNS: { header: string; field: string; required?: boolean }[] = [
  { header: 'First Name', field: 'first_name', required: true },
  { header: 'Last Name', field: 'last_name', required: true },
  { header: 'Gender', field: 'gender' },
  { header: 'Date of Birth (YYYY-MM-DD)', field: 'date_of_birth' },
  { header: 'Email', field: 'email' },
  { header: 'Phone', field: 'phone' },
  { header: 'Address', field: 'address' },
  { header: 'Guardian Name', field: 'guardian_name' },
  { header: 'Guardian Phone', field: 'guardian_phone' },
  { header: 'Guardian Email', field: 'guardian_email' },
  { header: 'Guardian Relationship', field: 'guardian_relationship' },
  { header: 'Class Name', field: 'class_name' },
];

export interface ImportRowError {
  row: number; // 1-based data row number (excludes header)
  message: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  total: number;
  errors: ImportRowError[];
}

/** Build a downloadable CSV template with the expected headers + one sample row. */
export function buildStudentTemplate(): string {
  const headers = IMPORT_COLUMNS.map((c) => c.header);
  const sample = [
    'Aminata', 'Kamara', 'female', '2014-05-12', '', '+23276000000',
    '12 Circular Rd, Freetown', 'Mariama Kamara', '+23276111111', '', 'Mother', 'JSS 1',
  ];
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return headers.map(esc).join(',') + '\n' + sample.map(esc).join(',') + '\n';
}

/** Normalise a header string for tolerant matching (case/space/punct-insensitive). */
function norm(s: string): string {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Parse + validate + import. Returns a summary. `tenantId` is authoritative.
 */
export async function importStudents(
  csvText: string,
  tenantId: string,
  createdBy: string | null
): Promise<ImportResult> {
  if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');

  let records: Record<string, string>[];
  try {
    records = parse(csvText, {
      columns: (header: string[]) => header.map((h) => norm(h)),
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch (e: any) {
    throw new AppError(`Could not parse the CSV: ${e?.message || e}`, 400, 'PARSE_ERROR');
  }

  if (!records.length) {
    throw new AppError('The file has no data rows.', 400, 'EMPTY_FILE');
  }
  if (records.length > 2000) {
    throw new AppError('Too many rows (max 2000 per import).', 400, 'TOO_MANY_ROWS');
  }

  // Map normalised header → field using IMPORT_COLUMNS.
  const fieldByNorm = new Map<string, string>();
  IMPORT_COLUMNS.forEach((c) => fieldByNorm.set(norm(c.header), c.field));
  // Accept a couple of common aliases too.
  fieldByNorm.set('dateofbirth', 'date_of_birth');
  fieldByNorm.set('dob', 'date_of_birth');
  fieldByNorm.set('class', 'class_name');

  const get = (rec: Record<string, string>, field: string): string => {
    for (const [k, v] of Object.entries(rec)) {
      if (fieldByNorm.get(k) === field) return (v || '').trim();
    }
    return '';
  };

  // ── Plan headroom: how many students can still be added? ──
  const [{ count: currentCountRaw }] = await db('students').where({ tenant_id: tenantId }).count('* as count');
  const currentCount = parseInt(currentCountRaw as string, 10) || 0;
  const sub = await SubscriptionService.getActiveSubscription(tenantId).catch(() => null as any);
  const maxStudents = sub?.max_students ?? 999999;
  const headroom = Math.max(0, maxStudents - currentCount);

  // Pre-load classes for name→id resolution (tenant-scoped).
  const classes = await db('classes').where({ tenant_id: tenantId }).select('id', 'name');
  const classByName = new Map<string, string>();
  classes.forEach((c: any) => classByName.set(norm(c.name), c.id));

  const errors: ImportRowError[] = [];
  const valid: Array<{ data: any; className: string; guardian: any }> = [];
  const seenEmails = new Set<string>();

  records.forEach((rec, i) => {
    const rowNo = i + 1;
    const first = get(rec, 'first_name');
    const last = get(rec, 'last_name');
    if (!first || !last) {
      errors.push({ row: rowNo, message: 'First Name and Last Name are required.' });
      return;
    }

    const dob = get(rec, 'date_of_birth');
    if (dob) {
      const d = new Date(dob);
      if (isNaN(d.getTime())) {
        errors.push({ row: rowNo, message: `Invalid Date of Birth "${dob}" (use YYYY-MM-DD).` });
        return;
      }
    }

    const email = get(rec, 'email').toLowerCase();
    if (email) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        errors.push({ row: rowNo, message: `Invalid email "${email}".` });
        return;
      }
      if (seenEmails.has(email)) {
        errors.push({ row: rowNo, message: `Duplicate email "${email}" within the file.` });
        return;
      }
      seenEmails.add(email);
    }

    const className = get(rec, 'class_name');
    if (className && !classByName.has(norm(className))) {
      errors.push({ row: rowNo, message: `Class "${className}" not found. Create it first or leave blank.` });
      return;
    }

    valid.push({
      data: {
        first_name: first,
        last_name: last,
        gender: get(rec, 'gender') || null,
        date_of_birth: dob || null,
        email: email || null,
        phone: get(rec, 'phone') || null,
        address: get(rec, 'address') || null,
      },
      className,
      guardian: {
        guardian_name: get(rec, 'guardian_name') || null,
        guardian_phone: get(rec, 'guardian_phone') || null,
        guardian_email: get(rec, 'guardian_email') || null,
        guardian_relationship: get(rec, 'guardian_relationship') || null,
      },
    });
  });

  // Enforce plan limit: only import up to headroom; flag the rest as skipped.
  let toImport = valid;
  let limitSkipped = 0;
  if (valid.length > headroom) {
    toImport = valid.slice(0, headroom);
    limitSkipped = valid.length - headroom;
  }

  let imported = 0;
  if (toImport.length) {
    await db.transaction(async (trx) => {
      for (const item of toImport) {
        // Reject emails that already exist for this tenant (checked in-txn).
        if (item.data.email) {
          const exists = await trx('students').where({ email: item.data.email, tenant_id: tenantId }).first();
          if (exists) {
            errors.push({ row: 0, message: `Email ${item.data.email} already registered — skipped.` });
            continue;
          }
        }
        const studentId = await generateNextId(trx, tenantId, 'student');
        const [inserted] = await trx('students')
          .insert({
            tenant_id: tenantId,
            user_id: null,
            student_id: studentId,
            ...item.data,
            enrollment_date: new Date().toISOString().split('T')[0],
            status: 'active',
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning('*');

        // Enroll into the named class if provided.
        const classId = item.className ? classByName.get(norm(item.className)) : undefined;
        if (classId && inserted?.id) {
          await trx('enrollments')
            .insert({
              student_id: inserted.id,
              class_id: classId,
              enrollment_date: new Date().toISOString().split('T')[0],
              status: 'active',
              created_at: new Date(),
              updated_at: new Date(),
            })
            .catch(() => undefined);
        }

        // Link guardian (reuses an existing parent for siblings).
        if (inserted?.id) {
          await linkGuardianForStudent(
            trx,
            tenantId,
            inserted.id,
            item.data.last_name,
            item.guardian,
            createdBy
          ).catch(() => undefined);
        }

        imported += 1;
      }
    });
  }

  if (limitSkipped > 0) {
    errors.push({
      row: 0,
      message: `Plan limit reached (${maxStudents} students). ${limitSkipped} valid row(s) were not imported. Upgrade your plan to add more.`,
    });
  }

  const failed = errors.filter((e) => e.row > 0).length;
  logger.info(`Student import for tenant ${tenantId}: imported ${imported}, failed ${failed}, limitSkipped ${limitSkipped}`);

  return {
    imported,
    skipped: limitSkipped,
    failed,
    total: records.length,
    errors,
  };
}

export default { importStudents, buildStudentTemplate, IMPORT_COLUMNS };
