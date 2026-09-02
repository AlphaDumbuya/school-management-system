/**
 * receiptPdf — generates a professional, tenant-branded payment receipt PDF
 * using pdfkit. The school's own name/email/phone/address/logo are pulled via
 * resolveTenantBranding, so each school's receipts carry its own identity.
 *
 * Returns a base64 string suitable for attaching to a Brevo email.
 */
import PDFDocument from 'pdfkit';
import axios from 'axios';
import { resolveTenantBranding, type EmailBranding } from './emailBranding.js';
import { logger } from '@utils/logger';

const ACCENT: [number, number, number] = [0, 212, 170]; // #00d4aa
const INK: [number, number, number] = [26, 26, 46]; // #1a1a2e
const MUTED = '#64748b';

export interface ReceiptData {
  receiptNumber: string;
  payerName: string;
  studentName?: string;
  amount: number;
  currency?: string;
  method?: string;
  reference?: string;
  date?: Date;
  balanceRemaining?: number;
}

function money(amount: number, currency = 'Le'): string {
  const n = Number(amount) || 0;
  return `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtDate(d?: Date): string {
  const date = d || new Date();
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Best-effort fetch of the logo image bytes (PNG/JPG) for embedding. */
async function fetchLogo(url?: string): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 6000 });
    return Buffer.from(res.data);
  } catch {
    return null;
  }
}

/**
 * Build the receipt PDF and return it as base64.
 */
export async function generateReceiptPdfBase64(
  tenantId: string,
  data: ReceiptData
): Promise<{ base64: string; branding: EmailBranding }> {
  const branding = await resolveTenantBranding(tenantId);
  const currency = data.currency || 'Le';
  const logo = await fetchLogo(branding.logoUrl);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => {
        const base64 = Buffer.concat(chunks).toString('base64');
        resolve({ base64, branding });
      });

      const pageWidth = doc.page.width;
      const left = doc.page.margins.left;
      const right = pageWidth - doc.page.margins.right;
      const contentW = right - left;

      // ── Header band ──────────────────────────────────────────────
      doc.rect(0, 0, pageWidth, 130).fill(INK);
      let headerTextX = left;
      if (logo) {
        try {
          doc.image(logo, left, 32, { fit: [64, 64] });
          headerTextX = left + 78;
        } catch {
          /* bad image data — skip */
        }
      }
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(20)
        .text(branding.name, headerTextX, 40, { width: contentW - (headerTextX - left) });
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#a0aec0')
        .text('Official Payment Receipt', headerTextX, 68);

      // "RECEIPT" tag on the right
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(ACCENT as any)
        .text('RECEIPT', right - 120, 44, { width: 120, align: 'right' });
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#a0aec0')
        .text(`No. ${data.receiptNumber}`, right - 160, 62, { width: 160, align: 'right' })
        .text(fmtDate(data.date), right - 160, 76, { width: 160, align: 'right' });

      // ── Body ─────────────────────────────────────────────────────
      let y = 165;

      // "Received from"
      doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('RECEIVED FROM', left, y);
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827').text(data.payerName, left, y + 14);
      if (data.studentName) {
        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor(MUTED)
          .text(`On behalf of: ${data.studentName}`, left, y + 34);
      }

      // Amount highlight box (right)
      const boxW = 200;
      const boxX = right - boxW;
      doc.roundedRect(boxX, y, boxW, 56, 8).fill('#ecfdf5');
      doc.font('Helvetica').fontSize(9).fillColor('#047857').text('AMOUNT PAID', boxX + 14, y + 10);
      doc
        .font('Helvetica-Bold')
        .fontSize(20)
        .fillColor('#059669')
        .text(money(data.amount, currency), boxX + 14, y + 24, { width: boxW - 28 });

      y += 90;

      // Details table
      const rows: Array<[string, string]> = [];
      if (data.method) rows.push(['Payment Method', data.method]);
      if (data.reference) rows.push(['Reference', data.reference]);
      rows.push(['Date', fmtDate(data.date)]);
      if (data.balanceRemaining != null) rows.push(['Balance Remaining', money(data.balanceRemaining, currency)]);

      doc.moveTo(left, y).lineTo(right, y).strokeColor('#e5e7eb').lineWidth(1).stroke();
      y += 14;
      rows.forEach(([label, value]) => {
        doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(label, left, y, { width: contentW * 0.5 });
        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('#111827')
          .text(value, left + contentW * 0.5, y, { width: contentW * 0.5, align: 'right' });
        y += 24;
        doc.moveTo(left, y - 6).lineTo(right, y - 6).strokeColor('#f1f5f9').lineWidth(1).stroke();
      });

      // Paid stamp
      y += 16;
      doc.roundedRect(left, y, 120, 30, 6).fill('#ecfdf5');
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#059669').text('✓ PAID', left + 16, y + 8);

      // ── Footer ───────────────────────────────────────────────────
      const footerY = doc.page.height - 110;
      doc.moveTo(left, footerY).lineTo(right, footerY).strokeColor('#e5e7eb').lineWidth(1).stroke();

      const footerBits: string[] = [];
      if (branding.contactEmail) footerBits.push(branding.contactEmail);
      if (branding.contactPhone) footerBits.push(branding.contactPhone);
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#111827')
        .text(branding.name, left, footerY + 12, { width: contentW });
      if (footerBits.length) {
        doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(footerBits.join('  •  '), left, footerY + 28);
      }
      if (branding.address) {
        doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(branding.address, left, footerY + 42);
      }
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#94a3b8')
        .text('This is a computer-generated receipt. Thank you for your payment.', left, footerY + 62, {
          width: contentW,
        });
      if (!branding.isPlatform) {
        doc.font('Helvetica').fontSize(8).fillColor('#94a3b8').text('Powered by WiSkul', left, footerY + 76);
      }

      doc.end();
    } catch (err) {
      logger.error('Failed to generate receipt PDF', err);
      reject(err);
    }
  });
}
