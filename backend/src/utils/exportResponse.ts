/**
 * exportResponse — shared helper to turn a set of rows into a downloadable
 * CSV / XLSX / PDF response. Keeps every export endpoint (finance, students,
 * attendance, backups) consistent in format handling and headers.
 *
 * Column map is { header: rowKey } and preserves order.
 */
import { Response } from 'express';
import exportService from '@services/exportService';

export type ExportFormat = 'csv' | 'excel' | 'xlsx' | 'pdf';

export async function sendExport(
  res: Response,
  opts: {
    format: string | undefined;
    rows: Record<string, any>[];
    columns: Record<string, string>;
    filename: string; // without extension
    title?: string;
    sheetName?: string;
  }
): Promise<void> {
  const fmt = (opts.format || 'csv').toLowerCase();
  const safeName = opts.filename.replace(/[^a-z0-9_-]+/gi, '_');

  if (fmt === 'pdf') {
    const buf = await exportService.rowsToPdf(opts.rows, opts.columns, opts.title || opts.filename);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
    res.send(buf);
    return;
  }

  if (fmt === 'excel' || fmt === 'xlsx') {
    const buf = await exportService.rowsToExcel(opts.rows, opts.columns, opts.sheetName || opts.title || 'Export');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.xlsx"`);
    res.send(buf);
    return;
  }

  // Default: CSV
  const csv = exportService.rowsToCsv(opts.rows, opts.columns);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.csv"`);
  res.send(csv);
}

export default sendExport;
