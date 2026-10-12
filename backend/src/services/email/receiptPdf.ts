/**
 * receiptPdf — the official payment receipt, as a PDF (pdfkit, A4).
 *
 * One school-branded receipt used everywhere: attached to every payment
 * confirmation email and downloaded from the finance pages, so the family and
 * the bursar always see the same document.
 *
 *  - Letterhead: the school's logo (read straight from storage; a monogram if it
 *    can't be read or isn't a PNG/JPEG), name, address and contacts.
 *  - Receipt number and date, who paid, which pupil / class / academic year.
 *  - What the money paid for (itemised), total in figures and in words, the
 *    balance still owed (or "Fully paid"), and a PAID / REFUNDED stamp.
 *  - Signature and school-stamp lines, and who received the payment.
 *
 * Only the built-in Helvetica fonts are used, so every character is drawn from
 * the Latin-1 set (no tick marks or other glyphs that print as boxes).
 */
import PDFDocument from 'pdfkit';
import { resolveTenantBranding, type EmailBranding } from './emailBranding.js';
import { logger } from '@utils/logger';

const NAVY = '#14284b';
const GREEN = '#047857';
const GREEN_BG = '#ecfdf5';
const RED = '#b91c1c';
const RED_BG = '#fef2f2';
const AMBER = '#b45309';
const AMBER_BG = '#fffbeb';
const INK = '#111827';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const ZEBRA = '#f8fafc';

export interface ReceiptData {
  receiptNumber: string;
  payerName: string;
  studentName?: string;
  admissionNo?: string;
  className?: string;
  academicYear?: string;
  /** Who took the payment at the school (staff name). Online payments leave this empty. */
  receivedBy?: string;
  amount: number;
  currency?: string;
  method?: string;
  reference?: string;
  date?: Date;
  balanceRemaining?: number;
  /** 'refunded' / 'part_refunded' stamp the receipt instead of PAID. */
  status?: 'paid' | 'refunded' | 'part_refunded';
  /** What the payment covered (charge labels). */
  items?: Array<{ label: string; amount: number }>;
}

/** Latin-1 safe text: Helvetica can't draw anything else. */
function clean(v: unknown): string {
  return String(v ?? '').replace(/[^\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026]/g, '?').trim();
}

/** "Le 1,500.00": always two decimals. */
export function money(amount: number, currency = 'Le'): string {
  const n = Number(amount) || 0;
  return `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d?: Date): string {
  const date = d && !Number.isNaN(new Date(d).getTime()) ? new Date(d) : new Date();
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function below1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} hundred`);
  if (r) parts.push(`${h ? 'and ' : ''}${r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? `-${ONES[r % 10]}` : ''}`}`);
  return parts.join(' ');
}
/** 1500.5 → "One thousand five hundred Leones and fifty Cents only". */
export function amountInWords(amount: number, major = 'Leones', minor = 'Cents'): string {
  const total = Math.round(Math.abs(Number(amount) || 0) * 100);
  let whole = Math.floor(total / 100);
  const cents = total % 100;
  const units: Array<[number, string]> = [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']];
  const words: string[] = [];
  for (const [size, name] of units) {
    if (whole >= size) { words.push(`${below1000(Math.floor(whole / size))} ${name}`); whole %= size; }
  }
  if (whole) words.push(below1000(whole));
  let text = words.join(' ').replace(/\s+/g, ' ').trim() || 'zero';
  text = text.charAt(0).toUpperCase() + text.slice(1);
  return `${text} ${major}${cents ? ` and ${cents < 20 ? ONES[cents] : `${TENS[Math.floor(cents / 10)]}${cents % 10 ? `-${ONES[cents % 10]}` : ''}`} ${minor}` : ''} only`;
}

/** The school's logo bytes (PNG/JPEG only: pdfkit can't draw anything else). */
async function loadLogo(tenantId: string): Promise<Buffer | null> {
  try {
    const { readTenantLogo } = await import('../../routes/brandingRoutes.js');
    const logo = await readTenantLogo(tenantId);
    if (!logo || !/^image\/(png|jpe?g)$/i.test(logo.type)) return null;
    return logo.body;
  } catch {
    return null;
  }
}

const initials = (name: string) => clean(name).split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || 'S';

/**
 * Build the receipt PDF and return it as base64.
 */
export async function generateReceiptPdfBase64(
  tenantId: string,
  data: ReceiptData,
): Promise<{ base64: string; branding: EmailBranding }> {
  const branding = await resolveTenantBranding(tenantId);
  const currency = data.currency || 'Le';
  const logo = await loadLogo(tenantId);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 40, left: 40, right: 40, bottom: 0 }, info: { Title: `Receipt ${clean(data.receiptNumber)}`, Author: clean(branding.name) } });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve({ base64: Buffer.concat(chunks).toString('base64'), branding }));
      doc.on('error', reject);

      const W = doc.page.width;
      const H = doc.page.height;
      const L = 40;
      const R = W - 40;
      const CW = R - L;
      const refunded = data.status === 'refunded' || data.status === 'part_refunded';

      /** One line of text that never wraps or runs into its neighbour. */
      const line = (str: string, x: number, y: number, w: number, o: { font?: string; size?: number; color?: string; align?: 'left' | 'right' | 'center' } = {}) => {
        doc.font(o.font || 'Helvetica').fontSize(o.size || 10).fillColor(o.color || INK);
        // Trim to the column by hand: pdfkit's own `ellipsis` wraps onto a
        // second line, which collides with the next row.
        let s = clean(str);
        if (doc.widthOfString(s) > w) {
          while (s.length > 1 && doc.widthOfString(`${s}...`) > w) s = s.slice(0, -1);
          s = `${s.trimEnd()}...`;
        }
        doc.text(s, x, y, { width: w + 1, align: o.align || 'left', lineBreak: false });
      };

      // ── Letterhead ────────────────────────────────────────────────
      doc.rect(0, 0, W, 8).fill(NAVY);
      let textX = L;
      if (logo) {
        try {
          doc.image(logo, L, 28, { fit: [64, 64], align: 'center', valign: 'center' });
          textX = L + 78;
        } catch { /* unreadable image: use the monogram below */ }
      }
      if (textX === L) {
        doc.circle(L + 30, 58, 30).fill(NAVY);
        line(initials(branding.name), L, 49, 60, { font: 'Helvetica-Bold', size: 18, color: '#ffffff', align: 'center' });
        textX = L + 78;
      }
      const headW = R - 200 - textX;
      line(branding.name, textX, 30, headW, { font: 'Helvetica-Bold', size: 17, color: NAVY });
      let hy = 52;
      for (const bit of [branding.address, [branding.contactPhone, branding.contactEmail].filter(Boolean).join('   |   '), branding.website ? String(branding.website).replace(/^https?:\/\//i, '').replace(/\/$/, '') : '']) {
        if (!bit) continue;
        line(bit, textX, hy, headW, { size: 9, color: MUTED });
        hy += 13;
      }

      // Title block (right)
      line('OFFICIAL RECEIPT', R - 190, 30, 190, { font: 'Helvetica-Bold', size: 15, color: NAVY, align: 'right' });
      line(`No. ${data.receiptNumber}`, R - 190, 52, 190, { font: 'Helvetica-Bold', size: 11, align: 'right' });
      line(fmtDate(data.date), R - 190, 68, 190, { size: 10, color: MUTED, align: 'right' });

      doc.moveTo(L, 108).lineTo(R, 108).lineWidth(1.5).strokeColor(NAVY).stroke();

      // ── Who paid, for whom ───────────────────────────────────────
      let y = 124;
      const colW = (CW - 24) / 2;
      const field = (label: string, value: string | undefined, x: number, yy: number, w: number, bold = false) => {
        line(label.toUpperCase(), x, yy, w, { size: 7.5, color: MUTED, font: 'Helvetica-Bold' });
        line(value || '-', x, yy + 11, w, { size: 11, font: bold ? 'Helvetica-Bold' : 'Helvetica' });
      };
      field('Received from', data.payerName, L, y, colW, true);
      field('Payment method', data.method, L + colW + 24, y, colW);
      y += 38;
      field('Pupil', data.studentName ? `${data.studentName}${data.admissionNo ? `  (${data.admissionNo})` : ''}` : undefined, L, y, colW, true);
      field('Reference', data.reference, L + colW + 24, y, colW);
      y += 38;
      field('Class', data.className, L, y, colW);
      field('Academic year', data.academicYear, L + colW + 24, y, colW);
      y += 44;

      // ── What it paid for ─────────────────────────────────────────
      const items = (data.items && data.items.length ? data.items : [{ label: 'School fees', amount: data.amount }]);
      const rowH = 22;
      const tableHeader = (yy: number) => {
        doc.rect(L, yy, CW, 22).fill(NAVY);
        line('DESCRIPTION', L + 12, yy + 7, CW * 0.65, { size: 8.5, font: 'Helvetica-Bold', color: '#ffffff' });
        line('AMOUNT', L + CW * 0.65, yy + 7, CW * 0.35 - 12, { size: 8.5, font: 'Helvetica-Bold', color: '#ffffff', align: 'right' });
        return yy + 22;
      };
      y = tableHeader(y);
      items.forEach((it, i) => {
        if (y + rowH > H - 330 && i < items.length) {
          // Long itemised receipts continue on the next page with the header repeated.
          if (y + rowH > H - 150) { doc.addPage(); y = tableHeader(46); }
        }
        if (i % 2 === 0) doc.rect(L, y, CW, rowH).fill(ZEBRA);
        line(it.label, L + 12, y + 6, CW * 0.65 - 12, { size: 10 });
        line(money(it.amount, currency), L + CW * 0.65, y + 6, CW * 0.35 - 12, { size: 10, font: 'Helvetica-Bold', align: 'right' });
        y += rowH;
      });
      doc.moveTo(L, y).lineTo(R, y).lineWidth(0.75).strokeColor(LINE).stroke();

      // ── Totals ────────────────────────────────────────────────────
      if (y > H - 300) { doc.addPage(); y = 46; }
      y += 14;
      const boxW = 250;
      const boxX = R - boxW;
      doc.roundedRect(boxX, y, boxW, 52, 6).fill(refunded ? RED_BG : GREEN_BG);
      line(refunded ? 'AMOUNT REFUNDED' : 'TOTAL PAID', boxX + 14, y + 9, boxW - 28, { size: 8, font: 'Helvetica-Bold', color: refunded ? RED : GREEN });
      line(money(data.amount, currency), boxX + 14, y + 22, boxW - 28, { size: 19, font: 'Helvetica-Bold', color: refunded ? RED : GREEN });

      // Amount in words (left of the total box)
      line('AMOUNT IN WORDS', L, y + 4, CW - boxW - 16, { size: 7.5, font: 'Helvetica-Bold', color: MUTED });
      doc.font('Helvetica-Oblique').fontSize(10).fillColor(INK)
        .text(clean(amountInWords(data.amount)), L, y + 17, { width: CW - boxW - 16, height: 36, ellipsis: true });

      y += 66;
      // Balance
      const hasBalance = data.balanceRemaining != null && Number.isFinite(Number(data.balanceRemaining));
      if (hasBalance && !refunded) {
        const owed = Number(data.balanceRemaining) > 0.005;
        doc.roundedRect(boxX, y, boxW, 34, 6).fill(owed ? AMBER_BG : GREEN_BG);
        line(owed ? 'BALANCE STILL OWED' : 'ACCOUNT STATUS', boxX + 14, y + 6, boxW - 28, { size: 7.5, font: 'Helvetica-Bold', color: owed ? AMBER : GREEN });
        line(owed ? money(Number(data.balanceRemaining), currency) : 'Fully paid, no balance', boxX + 14, y + 17, boxW - 28, { size: 12, font: 'Helvetica-Bold', color: owed ? AMBER : GREEN });
        y += 46;
      }

      // Status stamp
      const stamp = data.status === 'refunded' ? 'REFUNDED' : data.status === 'part_refunded' ? 'PART REFUNDED' : 'PAID';
      const stampW = stamp.length > 6 ? 150 : 90;
      doc.roundedRect(L, y - 2, stampW, 30, 5).lineWidth(2).strokeColor(refunded ? RED : GREEN).stroke();
      line(stamp, L, y + 6, stampW, { size: 14, font: 'Helvetica-Bold', color: refunded ? RED : GREEN, align: 'center' });
      y += 52;

      // ── Signatures ───────────────────────────────────────────────
      if (y > H - 190) { doc.addPage(); y = 60; }
      const sigY = Math.max(y + 18, H - 190);
      const sigW = (CW - 40) / 2;
      doc.moveTo(L, sigY).lineTo(L + sigW, sigY).lineWidth(0.75).strokeColor(MUTED).stroke();
      doc.moveTo(R - sigW, sigY).lineTo(R, sigY).stroke();
      line(data.receivedBy ? `Received by: ${data.receivedBy}` : 'Received by', L, sigY + 5, sigW, { size: 8.5, color: MUTED });
      line('Authorised signature and school stamp', R - sigW, sigY + 5, sigW, { size: 8.5, color: MUTED });

      // ── Footer ───────────────────────────────────────────────────
      const fy = H - 96;
      doc.moveTo(L, fy).lineTo(R, fy).lineWidth(0.75).strokeColor(LINE).stroke();
      line(branding.name, L, fy + 10, CW, { size: 9.5, font: 'Helvetica-Bold' });
      line('Please keep this receipt as proof of payment. If anything on it looks wrong, contact the school office with the receipt number.', L, fy + 25, CW, { size: 8, color: MUTED });
      const contacts = [branding.contactPhone, branding.contactEmail].filter(Boolean).join('   |   ');
      if (contacts) line(contacts, L, fy + 38, CW, { size: 8, color: MUTED });
      line(branding.isPlatform ? 'Generated by WiSkul' : 'Powered by WiSkul', L, fy + 54, CW, { size: 7.5, color: '#94a3b8' });

      doc.end();
    } catch (err) {
      logger.error('Failed to generate receipt PDF', err);
      reject(err);
    }
  });
}
