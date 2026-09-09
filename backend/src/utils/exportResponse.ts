/**
 * exportResponse — shared helper to turn a set of rows into a downloadable
 * CSV / XLSX / PDF response. Keeps every export endpoint (finance, students,
 * attendance, backups) consistent in format handling, headers, and branding.
 *
 * Column map is { header: rowKey } and preserves order. When a tenantId is
 * given, the document carries the SCHOOL's logo/name/contact so exports look
 * professional and identify their source.
 */
import { Response } from 'express';
import exportService, { ExportBranding } from '@services/exportService';
import { resolveTenantBranding } from '@services/email/emailBranding';

export type ExportFormat = 'csv' | 'excel' | 'xlsx' | 'pdf';

/** Resolve the tenant's current academic year (best-effort, never throws). */
async function resolveAcademicYear(tenantId: string): Promise<string | undefined> {
  try {
    const { db } = await import('@utils/database');
    const hasTable = await db.schema.hasTable('academic_sessions');
    if (!hasTable) return undefined;
    const current =
      (await db('academic_sessions').where({ tenant_id: tenantId, is_current: true }).first()) ||
      (await db('academic_sessions').where({ tenant_id: tenantId }).orderBy('start_date', 'desc').first());
    return current?.name || undefined;
  } catch {
    return undefined;
  }
}

async function brandFor(
  tenantId: string | undefined,
  title: string,
  academicYear?: string
): Promise<ExportBranding | undefined> {
  if (!tenantId) return undefined;
  try {
    const b = await resolveTenantBranding(tenantId);
    const year = academicYear || (await resolveAcademicYear(tenantId));
    return {
      name: b.name,
      logoUrl: b.logoUrl,
      address: b.address,
      contactEmail: b.contactEmail,
      contactPhone: b.contactPhone,
      website: b.website,
      title,
      academicYear: year,
    };
  } catch {
    return undefined;
  }
}

export async function sendExport(
  res: Response,
  opts: {
    format: string | undefined;
    rows: Record<string, any>[];
    columns: Record<string, string>;
    filename: string; // without extension
    title?: string;
    sheetName?: string;
    /** School to brand the document with (logo/name/contact). */
    tenantId?: string;
    /** Override the academic year shown on the export (else auto-resolved). */
    academicYear?: string;
  }
): Promise<void> {
  const fmt = (opts.format || 'csv').toLowerCase();
  const safeName = opts.filename.replace(/[^a-z0-9_-]+/gi, '_');
  const title = opts.title || opts.filename;
  const brand = await brandFor(opts.tenantId, title, opts.academicYear);

  if (fmt === 'pdf') {
    const buf = await exportService.rowsToPdf(opts.rows, opts.columns, title, brand);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
    res.send(buf);
    return;
  }

  if (fmt === 'excel' || fmt === 'xlsx') {
    const buf = await exportService.rowsToExcel(opts.rows, opts.columns, opts.sheetName || title || 'Export', brand);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.xlsx"`);
    res.send(buf);
    return;
  }

  // Default: CSV (with a small branded metadata block when available)
  const csv = exportService.rowsToCsv(opts.rows, opts.columns, brand);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.csv"`);
  res.send(csv);
}

export default sendExport;
