/**
 * backupService — produces an on-demand data backup of a single tenant.
 *
 * The backup is a multi-sheet XLSX workbook (one sheet per core table), which
 * is restorable/inspectable and needs no extra dependency or ZIP archiver, and
 * works on serverless. Every query is filtered by tenant_id so one tenant's
 * backup can NEVER contain another tenant's data.
 *
 * Super-admin only (enforced at the route).
 */
import ExcelJS from 'exceljs';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { isSecretColumn } from '../utils/redact';

/** Tables included in a tenant backup. Each is filtered by tenant_id where the
 *  column exists; child tables are scoped through their tenant-owned parent. */
const DIRECT_TENANT_TABLES = [
  'schools',
  'academic_sessions',
  'classes',
  'subjects',
  'students',
  'users',
  'teachers',
  'admission_applications',
];

function sanitizeSheetName(name: string): string {
  // Excel sheet names: max 31 chars, no []:*?/\
  return name.replace(/[\[\]:*?/\\]/g, ' ').slice(0, 31) || 'Sheet';
}

/** Flatten a row's values to Excel-friendly primitives. */
function toCell(v: any): any {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

async function addSheet(wb: ExcelJS.Workbook, table: string, rows: any[]) {
  const ws = wb.addWorksheet(sanitizeSheetName(table));
  if (!rows.length) {
    ws.addRow(['(no rows)']);
    return;
  }
  // Secrets (payment tokens, password hashes, 2FA seeds) never go into a downloadable backup.
  const headers = Object.keys(rows[0]).filter((h) => !isSecretColumn(h));
  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };
  rows.forEach((r) => ws.addRow(headers.map((h) => toCell(r[h]))));
  headers.forEach((h, i) => {
    ws.getColumn(i + 1).width = Math.min(Math.max(h.length + 2, 12), 40);
  });
}

/** Build a tenant backup workbook and return it as a Buffer + a summary. */
export async function buildTenantBackup(
  tenantId: string
): Promise<{ buffer: Buffer; summary: Record<string, number> }> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'WiSkul';
  wb.created = new Date();

  const summary: Record<string, number> = {};

  // Cover sheet with metadata
  const tenant = await db('tenants').where({ id: tenantId }).first();
  const cover = wb.addWorksheet('Backup Info');
  cover.addRow(['WiSkul Tenant Backup']).font = { bold: true, size: 14 } as any;
  cover.addRow(['Tenant', tenant?.name || tenantId]);
  cover.addRow(['Tenant ID', tenantId]);
  cover.addRow(['Generated', new Date().toISOString()]);
  cover.addRow([]);
  cover.addRow(['Table', 'Rows']).font = { bold: true } as any;

  // Resolve the tenant's student & user ids for scoping child tables.
  const studentRows = await db('students').where({ tenant_id: tenantId }).select('id');
  const studentIds = studentRows.map((r: any) => r.id);
  const classRows = await db('classes').where({ tenant_id: tenantId }).select('id');
  const classIds = classRows.map((r: any) => r.id);

  // Direct tenant tables
  for (const table of DIRECT_TENANT_TABLES) {
    try {
      const hasTable = await db.schema.hasTable(table);
      if (!hasTable) continue;
      const hasTenantCol = await db.schema.hasColumn(table, 'tenant_id');
      const rows = hasTenantCol
        ? await db(table).where({ tenant_id: tenantId }).select('*')
        : [];
      await addSheet(wb, table, rows);
      summary[table] = rows.length;
    } catch (err) {
      logger.warn(`Backup: skipped table ${table}: ${String((err as any)?.message || err)}`);
    }
  }

  // Child tables scoped through students / classes
  const childScopes: Array<{ table: string; column: string; ids: string[] }> = [
    { table: 'enrollments', column: 'student_id', ids: studentIds },
    { table: 'attendance', column: 'student_id', ids: studentIds },
    { table: 'grades', column: 'class_id', ids: classIds },
    { table: 'invoices', column: 'student_id', ids: studentIds },
    { table: 'payments', column: 'student_id', ids: studentIds },
    { table: 'fees', column: 'student_id', ids: studentIds },
  ];

  for (const scope of childScopes) {
    try {
      const hasTable = await db.schema.hasTable(scope.table);
      if (!hasTable) continue;
      const rows = scope.ids.length
        ? await db(scope.table).whereIn(scope.column, scope.ids).select('*')
        : [];
      await addSheet(wb, scope.table, rows);
      summary[scope.table] = rows.length;
    } catch (err) {
      logger.warn(`Backup: skipped child table ${scope.table}: ${String((err as any)?.message || err)}`);
    }
  }

  // Fill the cover summary
  Object.entries(summary).forEach(([table, count]) => cover.addRow([table, count]));

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  logger.info(`Tenant backup built for ${tenantId}: ${Object.keys(summary).length} tables`);
  return { buffer, summary };
}

export default { buildTenantBackup };
