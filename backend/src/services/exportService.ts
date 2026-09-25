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

/** School/report identity rendered on exported documents. */
export interface ExportBranding {
  name?: string;
  logoUrl?: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  /** Report title (e.g. "Payments Export"). */
  title?: string;
  /** Academic year shown on every export (e.g. "2026/2027"). */
  academicYear?: string;
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

  // ──────────────────────────────────────────────────────────────────────────
  // Generic, reusable ROW exports (tenant-scoped endpoints build on these).
  //
  // `columns` maps an output header → the key on each row object. This keeps
  // exports consistent across finance/students/attendance and reusable by the
  // backup service.
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Rows → CSV string using an ordered { header: rowKey } column map.
   *
   * The data table is emitted RFC-4180 clean (properly quoted, one header row,
   * one row per record) so columns never mis-align in Excel/Sheets. When
   * `brand` is provided we prepend a small metadata block padded to the SAME
   * number of columns as the table, then a fully-blank separator row — this
   * keeps the header row aligned with the data instead of "choking" it.
   */
  rowsToCsv(
    rows: Record<string, any>[],
    columns: Record<string, string>,
    brand?: ExportBranding
  ): string {
    const headers = Object.keys(columns);
    const keys = Object.values(columns);
    const colCount = headers.length;

    // Normalise + trim each cell so stray newlines/whitespace don't break rows.
    const cell = (v: any): string => {
      if (v === null || v === undefined) return '';
      return String(v).replace(/\r?\n/g, ' ').trim();
    };

    const matrix: string[][] = [];

    if (brand) {
      const pad = (first: string): string[] => {
        const row = new Array(colCount).fill('');
        row[0] = first;
        return row;
      };
      if (brand.name) matrix.push(pad(brand.name));
      const contact = [brand.address, brand.contactPhone, brand.contactEmail]
        .filter(Boolean)
        .join(' | ');
      if (contact) matrix.push(pad(contact));
      matrix.push(pad(brand.title || 'Export'));
      const metaLine = [
        brand.academicYear ? `Academic Year: ${brand.academicYear}` : '',
        `Generated: ${new Date().toLocaleString()}`,
      ].filter(Boolean).join(' | ');
      matrix.push(pad(metaLine));
      matrix.push(new Array(colCount).fill('')); // blank separator, full width
    }

    matrix.push(headers);
    (rows || []).forEach((r) => matrix.push(keys.map((k) => cell(r[k]))));

    // A single stringify over the whole matrix guarantees consistent quoting
    // and an equal column count on every line.
    return stringify(matrix);
  }

  /** Fetch a logo URL into a Buffer for embedding (best-effort, never throws). */
  private async fetchLogo(url?: string): Promise<Buffer | null> {
    if (!url) return null;
    try {
      if (!/^https?:\/\//i.test(url)) return null; // only remote http(s) logos
      const res = await fetch(url);
      if (!res.ok) return null;
      const arrayBuf = await res.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      if (buf.length < 8) return null;
      // Validate magic bytes — PDFKit only accepts PNG or JPEG. Relying on the
      // content-type header isn't enough (some CDNs mislabel), so verify the
      // actual signature to avoid doc.image() throwing at render time.
      const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
      const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
      if (!isPng && !isJpeg) return null;
      return buf;
    } catch {
      return null;
    }
  }

  /**
   * Rows → XLSX Buffer, professionally formatted: a branded title block, a
   * styled + frozen header row, content-aware column widths, right-aligned
   * numeric columns, bordered cells, and auto-filter. Nothing is "choked".
   */
  async rowsToExcel(
    rows: Record<string, any>[],
    columns: Record<string, string>,
    sheetName = 'Export',
    brand?: ExportBranding,
    colorColumns?: Record<string, 'red' | 'green'>,
    highlightLastRow?: boolean
  ): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = brand?.name || 'WiSkul';
    wb.created = new Date();
    const ws = wb.addWorksheet((sheetName || 'Export').slice(0, 31), {
      views: [{ state: 'frozen', ySplit: 0 }], // set properly after we know header row
    });

    const headers = Object.keys(columns);
    const keys = Object.values(columns);
    const lastColLetter = ws.getColumn(Math.max(headers.length, 1)).letter;

    // ── Branded title block (merged across all columns) ──
    let cursor = 1;
    if (brand) {
      ws.mergeCells(`A${cursor}:${lastColLetter}${cursor}`);
      const t = ws.getCell(`A${cursor}`);
      t.value = brand.name || 'Export';
      t.font = { bold: true, size: 15, color: { argb: 'FF1A2B6B' } };
      t.alignment = { vertical: 'middle' };
      ws.getRow(cursor).height = 22;
      cursor++;

      const contact = [brand.address, brand.contactPhone, brand.contactEmail, brand.website]
        .filter(Boolean)
        .join('  •  ');
      if (contact) {
        ws.mergeCells(`A${cursor}:${lastColLetter}${cursor}`);
        const c = ws.getCell(`A${cursor}`);
        c.value = contact;
        c.font = { size: 9, color: { argb: 'FF666666' } };
        cursor++;
      }

      ws.mergeCells(`A${cursor}:${lastColLetter}${cursor}`);
      const t2 = ws.getCell(`A${cursor}`);
      t2.value = brand.title || sheetName;
      t2.font = { size: 12, bold: true, color: { argb: 'FF1D4ED8' } };
      cursor++;

      ws.mergeCells(`A${cursor}:${lastColLetter}${cursor}`);
      const sub = ws.getCell(`A${cursor}`);
      const metaLine = [
        brand.academicYear ? `Academic Year: ${brand.academicYear}` : '',
        `Generated ${new Date().toLocaleString()}`,
      ].filter(Boolean).join('  |  ');
      sub.value = metaLine;
      sub.font = { size: 9, italic: true, color: { argb: 'FF888888' } };
      cursor++;

      cursor++; // spacer row
    }

    // ── Header row ──
    const headerRowIndex = cursor;
    const headerRow = ws.getRow(headerRowIndex);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFBFC7D2' } } };
    });
    headerRow.height = 20;
    headerRow.commit();

    // Detect which columns are numeric (based on the data) for alignment/format.
    const numericCol: boolean[] = keys.map((k) =>
      (rows || []).some((r) => r[k] !== null && r[k] !== undefined && r[k] !== '') &&
      (rows || []).every((r) => r[k] === null || r[k] === undefined || r[k] === '' || !isNaN(Number(r[k])))
    );

    // Track the widest content per column (start from the header text). We use
    // this to size columns so the sheet reads as a full, well-proportioned
    // table rather than cramped narrow columns.
    const widths = headers.map((h) => h.length);

    // ── Data rows ──
    const thinBorder = { style: 'thin' as const, color: { argb: 'FFE5E9F0' } };
    const lastRowIdx = (rows || []).length - 1;
    (rows || []).forEach((r, idx) => {
      const isTotal = highlightLastRow && idx === lastRowIdx;
      const rowIndex = headerRowIndex + 1 + idx;
      const row = ws.getRow(rowIndex);
      row.height = isTotal ? 22 : 18;
      keys.forEach((k, i) => {
        const raw = r[k];
        const cell = row.getCell(i + 1);
        if (numericCol[i] && raw !== null && raw !== undefined && raw !== '') {
          cell.value = Number(raw);
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else {
          cell.value = raw === null || raw === undefined ? '' : String(raw);
          cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: false };
        }
        cell.border = { bottom: thinBorder, right: thinBorder };
        // Zebra striping for readability
        if (!isTotal && idx % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } };
        }
        // Grand-total row: light highlight background + top border + bold.
        if (isTotal) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // light amber
          cell.border = { top: { style: 'medium', color: { argb: 'FF1A2B6B' } }, bottom: thinBorder, right: thinBorder };
          cell.font = { bold: true, color: { argb: 'FF1A2B6B' } };
        }
        // Optional conditional font colour (e.g. green paid / red balance).
        const colour = colorColumns?.[k];
        if (colour) {
          cell.font = { color: { argb: colour === 'green' ? 'FF059669' : 'FFDC2626' }, bold: true };
        }
        const len = String(cell.value ?? '').length;
        if (len > widths[i]) widths[i] = len;
      });
      row.commit();
    });

    // ── Column widths ──
    // Size each column to its content, then pad generously and use a higher
    // floor so the sheet reads as a full, professional table (no cramped
    // columns, no awkward empty gutter). Long text columns get more room.
    headers.forEach((_h, i) => {
      const content = widths[i];
      const padded = numericCol[i] ? content + 4 : content + 6;
      ws.getColumn(i + 1).width = Math.min(Math.max(padded, 16), 55);
    });

    // Freeze everything above the first data row, and add an auto-filter.
    ws.views = [{ state: 'frozen', ySplit: headerRowIndex }];
    ws.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: { row: headerRowIndex, column: headers.length },
    };

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /** Escape HTML-special characters for safe interpolation. */
  private escHtml(v: any): string {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Rows → professional, branded PDF via headless Chromium (the same
   * production-proven path report cards use). This avoids PDFKit's bundled-font
   * problems on serverless and produces a clean, styled A4 landscape table with
   * the school logo, name, and contact details in the header.
   */
  async rowsToPdf(
    rows: Record<string, any>[],
    columns: Record<string, string>,
    title = 'Export',
    brand?: ExportBranding,
    colorColumns?: Record<string, 'red' | 'green'>,
    highlightLastRow?: boolean
  ): Promise<Buffer> {
    const headers = Object.keys(columns);
    const keys = Object.values(columns);
    const colStyle = (k: string) => {
      const c = colorColumns?.[k];
      return c ? ` style="color:${c === 'green' ? '#059669' : '#dc2626'};font-weight:700;"` : '';
    };
    const lastIdx = (rows || []).length - 1;

    const contact = [brand?.address, brand?.contactPhone, brand?.contactEmail, brand?.website]
      .filter(Boolean)
      .map((c) => this.escHtml(c))
      .join(' &nbsp;•&nbsp; ');

    const logoHtml = brand?.logoUrl
      ? `<img src="${this.escHtml(brand.logoUrl)}" alt="" class="logo" />`
      : '';

    const headHtml = headers.map((h) => `<th>${this.escHtml(h)}</th>`).join('');
    const bodyHtml = (rows || [])
      .map(
        (r, ri) =>
          `<tr${highlightLastRow && ri === lastIdx ? ' class="grand-total"' : ''}>${keys.map((k) => `<td${colStyle(k)}>${this.escHtml(r[k])}</td>`).join('')}</tr>`
      )
      .join('');

    const metaBits = [
      brand?.academicYear ? `Academic Year: ${this.escHtml(brand.academicYear)}` : '',
      `Generated: ${this.escHtml(new Date().toLocaleString())}`,
    ].filter(Boolean).join(' &nbsp;|&nbsp; ');

    const html = `<!doctype html><html><head><meta charset="utf-8"/>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
        /* Darker base ink + antialiasing so text stays crisp and fully visible
           when physically printed (not washed out). */
        body { font-family: Helvetica, Arial, sans-serif; color: #0b0b0b; font-size: 13px; margin: 0; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }

        /* Centered, professional header block with clear spacing. This whole
           block appears ONCE (page 1 only) — it's outside the table, so it does
           NOT repeat on subsequent pages. Only the column headers repeat. */
        .hdr { text-align: center; border-bottom: 3px solid #1d4ed8; padding-bottom: 14px; margin-bottom: 18px; }
        .logo { height: 68px; width: 68px; object-fit: contain; border-radius: 10px; background: #fff; display: block; margin: 0 auto 10px; }
        .school { font-size: 24px; font-weight: 800; color: #14204f; letter-spacing: 0.3px; line-height: 1.2; }
        .contact { font-size: 12px; color: #333; margin-top: 6px; font-weight: 500; }
        .title { font-size: 16px; font-weight: 800; color: #1543c4; margin-top: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        .meta { font-size: 11px; color: #444; margin-top: 4px; font-weight: 500; }

        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        /* Column headers repeat on every printed page for readability, but the
           big branded block above only appears once (it's outside the table). */
        thead { display: table-header-group; }
        thead th { background: #1543c4; color: #fff; text-align: left; padding: 10px 10px; font-size: 13px; font-weight: 700; white-space: nowrap; }
        tbody td { padding: 9px 10px; border-bottom: 1px solid #dfe4ec; font-size: 12.5px; font-weight: 500; color: #0b0b0b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        tbody tr { page-break-inside: avoid; }
        tbody tr:nth-child(even) td { background: #eef2f8; }
        tbody tr.grand-total td { background: #fde68a !important; font-weight: 800; color: #14204f; border-top: 2px solid #14204f; font-size: 13px; }
        .foot { margin-top: 16px; text-align: center; font-size: 11px; color: #555; border-top: 1px solid #d7dbe2; padding-top: 8px; font-weight: 500; }
      </style></head>
      <body>
        <div class="hdr">
          ${logoHtml}
          <div class="school">${this.escHtml(brand?.name || 'WiSkul')}</div>
          ${contact ? `<div class="contact">${contact}</div>` : ''}
          <div class="title">${this.escHtml(title)}</div>
          <div class="meta">${metaBits}</div>
        </div>
        <table>
          <thead><tr>${headHtml}</tr></thead>
          <tbody>${bodyHtml || `<tr><td colspan="${headers.length}" style="text-align:center;color:#888;padding:20px;">No records</td></tr>`}</tbody>
        </table>
        <div class="foot">${this.escHtml(brand?.name || 'WiSkul')} — ${(rows || []).length} record(s). Confidential.</div>
      </body></html>`;

    // Primary: headless Chromium (rich HTML/CSS). If it fails for any reason
    // (serverless Chromium unavailable, timeout, etc.), fall back to a pure-JS
    // pdf-lib table so PDF export NEVER 500s.
    try {
      const { htmlToPdf } = await import('@utils/pdfBrowser');
      return await htmlToPdf(html, { landscape: true });
    } catch (err) {
      logger.warn(`PDF via Chromium failed, using pdf-lib fallback: ${String((err as any)?.message || err)}`);
      return this.rowsToPdfLib(rows, columns, title, brand, colorColumns, highlightLastRow);
    }
  }

  /**
   * Pure-JS PDF fallback using pdf-lib (no browser, no external font files —
   * uses the built-in StandardFonts, so it works anywhere including serverless).
   * A clean A4 landscape table with a centered branded header.
   */
  async rowsToPdfLib(
    rows: Record<string, any>[],
    columns: Record<string, string>,
    title = 'Export',
    brand?: ExportBranding,
    colorColumns?: Record<string, 'red' | 'green'>,
    highlightLastRow?: boolean
  ): Promise<Buffer> {
    const { PDFDocument: PDFLibDoc, StandardFonts, rgb } = await import('pdf-lib');
    const pdf = await PDFLibDoc.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    // A4 landscape in points
    const PAGE_W = 841.89;
    const PAGE_H = 595.28;
    const margin = 32;
    const usableW = PAGE_W - margin * 2;

    const headers = Object.keys(columns);
    const keys = Object.values(columns);
    const colW = usableW / Math.max(headers.length, 1);

    const navy = rgb(0.078, 0.126, 0.31);
    const blue = rgb(0.083, 0.262, 0.769);
    // Darker gray than before so contact/meta lines stay legible on physical
    // prints (light grays wash out on many printers).
    const gray = rgb(0.27, 0.27, 0.27);
    const zebra = rgb(0.93, 0.945, 0.972);
    const black = rgb(0.043, 0.043, 0.043);
    const white = rgb(1, 1, 1);
    const green = rgb(0.02, 0.588, 0.412);
    const red = rgb(0.862, 0.149, 0.149);
    const cellColor = (k: string) => (colorColumns?.[k] === 'green' ? green : colorColumns?.[k] === 'red' ? red : black);

    // Try to embed the logo (PNG/JPEG only).
    let logoImg: any = null;
    let logoDims: { w: number; h: number } | null = null;
    const logoBuf = await this.fetchLogo(brand?.logoUrl);
    if (logoBuf) {
      try {
        logoImg = logoBuf[0] === 0x89 ? await pdf.embedPng(logoBuf) : await pdf.embedJpg(logoBuf);
        const scale = 44 / logoImg.height;
        logoDims = { w: logoImg.width * scale, h: 44 };
      } catch {
        logoImg = null;
      }
    }

    const fit = (text: string, size: number, f: any, maxW: number): string => {
      let s = String(text ?? '');
      if (f.widthOfTextAtSize(s, size) <= maxW) return s;
      while (s.length > 1 && f.widthOfTextAtSize(s + '…', size) > maxW) s = s.slice(0, -1);
      return s + '…';
    };
    const centerText = (page: any, text: string, size: number, f: any, y: number, color: any) => {
      const w = f.widthOfTextAtSize(text, size);
      page.drawText(text, { x: (PAGE_W - w) / 2, y, size, font: f, color });
    };

    let page = pdf.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - margin;

    const drawHeaderBlock = () => {
      y = PAGE_H - margin;
      if (logoImg && logoDims) {
        page.drawImage(logoImg, { x: (PAGE_W - logoDims.w) / 2, y: y - logoDims.h, width: logoDims.w, height: logoDims.h });
        y -= logoDims.h + 6;
      }
      centerText(page, brand?.name || 'WiSkul', 19, fontBold, y - 14, navy);
      y -= 23;
      const contact = [brand?.address, brand?.contactPhone, brand?.contactEmail].filter(Boolean).join('  •  ');
      if (contact) {
        centerText(page, fit(contact, 11, font, usableW), 11, font, y - 10, gray);
        y -= 15;
      }
      centerText(page, (title || 'Export').toUpperCase(), 14, fontBold, y - 12, blue);
      y -= 19;
      const meta = [brand?.academicYear ? `Academic Year: ${brand.academicYear}` : '', `Generated: ${new Date().toLocaleString()}`]
        .filter(Boolean)
        .join('   |   ');
      centerText(page, meta, 10, font, y - 10, gray);
      y -= 17;
      page.drawRectangle({ x: margin, y: y - 2, width: usableW, height: 2, color: blue });
      y -= 14;
    };

    const drawTableHeader = () => {
      page.drawRectangle({ x: margin, y: y - 18, width: usableW, height: 20, color: blue });
      headers.forEach((h, i) => {
        page.drawText(fit(h, 12, fontBold, colW - 8), { x: margin + i * colW + 4, y: y - 13, size: 12, font: fontBold, color: white });
      });
      y -= 22;
    };

    drawHeaderBlock();
    drawTableHeader();

    const amber = rgb(0.996, 0.953, 0.78); // light amber highlight
    const lastRow = (rows || []).length - 1;
    (rows || []).forEach((r, idx) => {
      if (y < margin + 28) {
        page = pdf.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - margin;
        drawTableHeader();
      }
      const isTotal = highlightLastRow && idx === lastRow;
      if (isTotal) {
        page.drawRectangle({ x: margin, y: y - 16, width: usableW, height: 19, color: amber });
        page.drawRectangle({ x: margin, y: y + 3, width: usableW, height: 1.5, color: navy });
      } else if (idx % 2 === 1) {
        page.drawRectangle({ x: margin, y: y - 16, width: usableW, height: 19, color: zebra });
      }
      keys.forEach((k, i) => {
        const val = r[k] === null || r[k] === undefined ? '' : String(r[k]);
        const c = isTotal ? navy : cellColor(k);
        const useBold = isTotal || colorColumns?.[k] ? fontBold : font;
        page.drawText(fit(val, 12, useBold, colW - 8), { x: margin + i * colW + 4, y: y - 13, size: 12, font: useBold, color: c });
      });
      y -= 19;
    });

    const bytes = await pdf.save();
    return Buffer.from(bytes);
  }

  /** Legacy PDFKit tabular renderer (kept for non-serverless/local fallback). */
  async rowsToPdfKit(
    rows: Record<string, any>[],
    columns: Record<string, string>,
    title = 'Export',
    brand?: ExportBranding
  ): Promise<Buffer> {
    const logo = await this.fetchLogo(brand?.logoUrl);
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
        const buffers: Buffer[] = [];
        doc.on('data', (c) => buffers.push(c));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        this.brandedPdfHeader(doc, title, brand, logo);

        const headers = Object.keys(columns);
        const keys = Object.values(columns);
        const startX = 40;
        const usableWidth = 762; // A4 landscape width minus margins
        const colWidth = usableWidth / headers.length;

        const writeRow = (values: any[], bold = false, fill?: boolean) => {
          const y = doc.y;
          if (fill) {
            doc.rect(startX, y - 2, usableWidth, 16).fill('#1d4ed8');
          }
          doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(bold && fill ? '#ffffff' : '#111111');
          values.forEach((v, i) => {
            doc.text(String(v ?? ''), startX + i * colWidth + 2, y, {
              width: colWidth - 6,
              ellipsis: true,
            });
          });
          doc.fillColor('#111111');
          doc.moveDown(0.7);
        };

        writeRow(headers, true, true);
        doc.moveDown(0.2);

        (rows || []).forEach((r, idx) => {
          if (doc.y > 520) {
            doc.addPage({ margin: 40, size: 'A4', layout: 'landscape' });
          }
          // Zebra striping for readability
          if (idx % 2 === 1) {
            doc.rect(startX, doc.y - 2, usableWidth, 14).fill('#f3f4f6');
            doc.fillColor('#111111');
          }
          writeRow(keys.map((k) => r[k]));
        });

        this.brandedPdfFooter(doc, brand, rows.length);
        doc.end();
      } catch (error) {
        logger.error(`Row PDF export error: ${error}`);
        reject(error);
      }
    });
  }

  /** Professional branded header: logo + school name + contact + title + date. */
  private brandedPdfHeader(doc: PDFDocument, title: string, brand?: ExportBranding, logo?: Buffer | null) {
    const topY = 40;
    let textX = 40;
    if (logo) {
      try {
        doc.image(logo, 40, topY, { fit: [46, 46] });
        textX = 96;
      } catch {
        /* ignore bad image */
      }
    }
    doc.fillColor('#1a2b6b').font('Helvetica-Bold').fontSize(16).text(brand?.name || 'WiSkul', textX, topY);
    const contact = [brand?.address, brand?.contactPhone, brand?.contactEmail, brand?.website]
      .filter(Boolean)
      .join('  •  ');
    doc.fillColor('#555555').font('Helvetica').fontSize(8);
    if (contact) doc.text(contact, textX, doc.y + 1, { width: 700 });

    doc.moveDown(0.6);
    doc.fillColor('#111111').font('Helvetica-Bold').fontSize(12).text(title, 40, doc.y);
    doc.fillColor('#888888').font('Helvetica').fontSize(8).text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown(0.4);
    doc.strokeColor('#1d4ed8').lineWidth(1.5).moveTo(40, doc.y).lineTo(802, doc.y).stroke();
    doc.strokeColor('#000000').lineWidth(1);
    doc.moveDown(0.5);
  }

  private brandedPdfFooter(doc: PDFDocument, brand?: ExportBranding, count?: number) {
    doc.moveDown(0.5);
    doc.strokeColor('#e5e7eb').moveTo(40, doc.y).lineTo(802, doc.y).stroke();
    doc.strokeColor('#000000');
    doc.moveDown(0.3);
    const label = `${brand?.name || 'WiSkul'} — ${count ?? 0} record(s). Confidential.`;
    doc.fillColor('#888888').font('Helvetica').fontSize(8).text(label, 40, doc.y, { align: 'center', width: 762 });
    doc.fillColor('#111111');
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
