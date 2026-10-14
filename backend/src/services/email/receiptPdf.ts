/**
 * receiptPdf — the official payment receipt, as a PDF (pdfkit, A4).
 *
 * One school-branded receipt used everywhere: attached to every payment
 * confirmation email and downloaded from the finance pages, so the family and
 * the bursar always see the same document.
 *
 *  - Letterhead: the school's logo (read straight from storage; a monogram if it
 *    can't be read or isn't a PNG/JPEG), name, address and contacts, and a
 *    PAID / REFUNDED chip.
 *  - The pupil's card: photo (initials if there is none), name, admission
 *    number, class, academic year, who paid and how.
 *  - What the money paid for: one line per charge (fee type, term and year),
 *    the total in figures and in words, and the balance still owed.
 *  - An electronic-receipt block with a QR code and a verification code. The
 *    receipt is issued automatically when the payment is recorded, so it needs
 *    no signature or stamp: the QR opens a public page that shows the receipt as
 *    the school recorded it, which a copied or edited receipt cannot match.
 *  - A faint repeating school name behind the page (and a large REFUNDED mark on
 *    refunded receipts), so a screenshot or a cut-and-paste job is easier to spot.
 *
 * Only the built-in Helvetica/Courier fonts are used, so every character is drawn
 * from the Latin-1 set (no tick marks or other glyphs that print as boxes).
 */
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { resolveTenantBranding, platformBranding, type EmailBranding } from './emailBranding.js';
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

export interface ReceiptItemData {
  /** The charge, e.g. "Tuition" or "Uniform". */
  label: string;
  /** Term and year ("First Term · 2026/2027") or a short note. */
  detail?: string;
  amount: number;
}

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
  /** 'refunded' / 'part_refunded' mark the receipt instead of PAID. */
  status?: 'paid' | 'refunded' | 'part_refunded';
  /** What the payment covered, one line per charge. */
  items?: ReceiptItemData[];
  /** Where the pupil's photo is stored (inline data, storage address or https link). */
  studentPhotoRef?: string;
  /** The receipt's verification code as printed (XXXX-XXXX-XXXX-XXXX) and the address its QR opens. */
  verifyCode?: string;
  verifyUrl?: string;
  /**
   * 'platform' issues the receipt from WiSkul itself (a school paying for its
   * plan) instead of from a school, with WiSkul's letterhead and logo.
   */
  issuer?: 'platform';
  /** Replaces the standard pupil card with these label-value pairs (two per row). */
  fields?: Array<{ label: string; value?: string; bold?: boolean }>;
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

/** The pupil's photo bytes (PNG/JPEG only), or null: the receipt then shows initials. */
async function loadPhoto(tenantId: string, ref?: string): Promise<Buffer | null> {
  if (!ref) return null;
  try {
    const { readTenantImage } = await import('../../routes/brandingRoutes.js');
    const img = await readTenantImage(tenantId, ref);
    if (!img || !/^image\/(png|jpe?g)$/i.test(img.type)) return null;
    return img.body;
  } catch {
    return null;
  }
}

/** The QR code for the verification address, as PNG bytes. */
async function loadQr(url?: string): Promise<Buffer | null> {
  if (!url) return null;
  try {
    return await QRCode.toBuffer(url, { type: 'png', margin: 0, width: 280, errorCorrectionLevel: 'M', color: { dark: '#14284b', light: '#ffffff' } });
  } catch (e) {
    logger.warn(`Receipt QR code failed: ${(e as Error)?.message || e}`);
    return null;
  }
}

const initials = (name: string) => clean(name).split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || 'S';

/** "https://www.wiskulsl.com/verify-receipt/ABCD..." -> "www.wiskulsl.com/verify-receipt" */
const verifyPageOf = (url?: string) => (url ? url.replace(/^https?:\/\//i, '').replace(/\/[^/]*$/, '') : '');

/**
 * Build the receipt PDF and return it as base64.
 */
export async function generateReceiptPdfBase64(
  tenantId: string,
  data: ReceiptData,
): Promise<{ base64: string; branding: EmailBranding }> {
  const platform = data.issuer === 'platform';
  const branding = platform ? platformBranding() : await resolveTenantBranding(tenantId);
  const currency = data.currency || 'Le';
  const [logo, photo, qr] = await Promise.all([
    platform
      ? Promise.resolve(Buffer.from((await import('../../assets/platformLogo.js')).PLATFORM_LOGO_PNG_BASE64, 'base64'))
      : loadLogo(tenantId),
    platform ? Promise.resolve(null) : loadPhoto(tenantId, data.studentPhotoRef),
    platform ? Promise.resolve(null) : loadQr(data.verifyUrl),
  ]);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, left: 40, right: 40, bottom: 0 },
        info: {
          Title: `Receipt ${clean(data.receiptNumber)}`,
          Author: clean(branding.name),
          Subject: data.verifyUrl ? `Verify at ${data.verifyUrl}` : 'Electronic payment receipt',
        },
      });
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
      const statusColor = refunded ? RED : GREEN;

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

      /** Faint security pattern behind the page (and a big REFUNDED mark when refunded). */
      const background = () => {
        doc.save();
        doc.opacity(0.045).fillColor(NAVY).font('Helvetica-Bold').fontSize(15);
        doc.rotate(-32, { origin: [W / 2, H / 2] });
        const tile = clean(`${branding.name}  -  ${platform ? 'OFFICIAL RECEIPT' : data.receiptNumber}   `).toUpperCase();
        const row = tile.repeat(Math.ceil(1500 / Math.max(10, doc.widthOfString(tile))));
        let rowIndex = 0;
        for (let y = 20; y < 790; y += 46) {
          doc.text(row, -260 + (rowIndex++ % 2) * 120, y, { lineBreak: false });
        }
        doc.restore();
        if (refunded) {
          doc.save();
          doc.opacity(0.09).fillColor(RED).font('Helvetica-Bold').fontSize(96);
          doc.rotate(-32, { origin: [W / 2, H / 2] });
          doc.text(data.status === 'refunded' ? 'REFUNDED' : 'PART REFUNDED', 40, H / 2 - 40, { width: W - 80, align: 'center', lineBreak: false });
          doc.restore();
        }
      };
      background();
      doc.on('pageAdded', background);

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
      const chip = data.status === 'refunded' ? 'REFUNDED' : data.status === 'part_refunded' ? 'PART REFUNDED' : 'PAID';
      const chipW = chip.length > 6 ? 98 : 54;
      doc.roundedRect(R - chipW, 85, chipW, 16, 8).fill(refunded ? RED_BG : GREEN_BG);
      line(chip, R - chipW, 89, chipW, { size: 8.5, font: 'Helvetica-Bold', color: statusColor, align: 'center' });

      doc.moveTo(L, 108).lineTo(R, 108).lineWidth(1.5).strokeColor(NAVY).stroke();

      // ── Who paid, for whom ───────────────────────────────────────
      let y = 122;
      const colW = (CW - 24) / 2;
      const field = (label: string, value: string | undefined, x: number, yy: number, w: number, bold = false, size = 11) => {
        line(label.toUpperCase(), x, yy, w, { size: 7.5, color: MUTED, font: 'Helvetica-Bold' });
        line(value || '-', x, yy + 11, w, { size, font: bold ? 'Helvetica-Bold' : 'Helvetica' });
      };
      if (data.fields && data.fields.length) {
        data.fields.forEach((f, i) => {
          field(f.label, f.value, L + (i % 2) * (colW + 24), y, colW, f.bold);
          if (i % 2 === 1 || i === data.fields!.length - 1) y += 38;
        });
        y += 6;
      } else {
        // The pupil's card: photo on the left, details on the right.
        const cardH = 104;
        doc.roundedRect(L, y, CW, cardH, 8).lineWidth(0.75).fillAndStroke(ZEBRA, LINE);
        const px = L + 12, py = y + 12, pw = 66, ph = 80;
        let drewPhoto = false;
        if (photo) {
          try {
            doc.save();
            doc.roundedRect(px, py, pw, ph, 6).clip();
            doc.image(photo, px, py, { cover: [pw, ph], align: 'center', valign: 'center' });
            doc.restore();
            doc.roundedRect(px, py, pw, ph, 6).lineWidth(1).strokeColor(LINE).stroke();
            drewPhoto = true;
          } catch {
            doc.restore();
          }
        }
        if (!drewPhoto) {
          doc.roundedRect(px, py, pw, ph, 6).fill(NAVY);
          line(initials(data.studentName || data.payerName), px, py + ph / 2 - 11, pw, { font: 'Helvetica-Bold', size: 22, color: '#ffffff', align: 'center' });
        }
        const cx = px + pw + 18;
        const cw = R - 14 - cx;
        const aw = cw * 0.56;
        const bx = cx + aw + 14;
        const bw = cw - aw - 14;
        field('Pupil', data.studentName || data.payerName, cx, y + 11, aw, true, 13);
        field('Received from', data.payerName, bx, y + 11, bw, true);
        field('Admission no.', data.admissionNo, cx, y + 44, aw);
        field('Payment method', data.method, bx, y + 44, bw);
        field('Class  /  Academic year', [data.className, data.academicYear].filter(Boolean).join('   /   ') || undefined, cx, y + 77, aw);
        field('Reference', data.reference, bx, y + 77, bw);
        y += cardH + 20;
      }

      // ── What it paid for ─────────────────────────────────────────
      const items: ReceiptItemData[] = data.items && data.items.length ? data.items : [{ label: 'School fees', amount: data.amount }];
      line('WHAT THIS PAYMENT IS FOR', L, y, CW, { size: 8.5, font: 'Helvetica-Bold', color: NAVY });
      y += 15;
      const tableHeader = (yy: number) => {
        doc.rect(L, yy, CW, 22).fill(NAVY);
        line('CHARGE', L + 12, yy + 7, CW * 0.7, { size: 8.5, font: 'Helvetica-Bold', color: '#ffffff' });
        line('AMOUNT PAID', L + CW * 0.7, yy + 7, CW * 0.3 - 12, { size: 8.5, font: 'Helvetica-Bold', color: '#ffffff', align: 'right' });
        return yy + 22;
      };
      y = tableHeader(y);
      items.forEach((it, i) => {
        const rowH = it.detail ? 32 : 24;
        // Long itemised receipts continue on the next page with the header repeated.
        if (y + rowH > H - 130) { doc.addPage(); y = tableHeader(46); }
        if (i % 2 === 0) doc.rect(L, y, CW, rowH).fill(ZEBRA);
        if (it.detail) {
          line(it.label, L + 12, y + 5, CW * 0.7 - 12, { size: 10.5, font: 'Helvetica-Bold' });
          line(it.detail, L + 12, y + 19, CW * 0.7 - 12, { size: 8.5, color: MUTED });
        } else {
          line(it.label, L + 12, y + 7, CW * 0.7 - 12, { size: 10.5, font: 'Helvetica-Bold' });
        }
        line(money(it.amount, currency), L + CW * 0.7, y + (it.detail ? 10 : 7), CW * 0.3 - 12, { size: 10.5, font: 'Helvetica-Bold', align: 'right' });
        y += rowH;
      });
      doc.moveTo(L, y).lineTo(R, y).lineWidth(0.75).strokeColor(LINE).stroke();

      // ── Totals ────────────────────────────────────────────────────
      const hasBalance = data.balanceRemaining != null && Number.isFinite(Number(data.balanceRemaining)) && !refunded;
      const verifyH = platform ? 70 : 112;
      if (y + 14 + 66 + (hasBalance ? 46 : 0) + 18 + verifyH > H - 112) { doc.addPage(); y = 46; }
      y += 14;
      const boxW = 250;
      const boxX = R - boxW;
      doc.roundedRect(boxX, y, boxW, 52, 6).fill(refunded ? RED_BG : GREEN_BG);
      line(refunded ? 'AMOUNT REFUNDED' : 'TOTAL PAID', boxX + 14, y + 9, boxW - 28, { size: 8, font: 'Helvetica-Bold', color: statusColor });
      line(money(data.amount, currency), boxX + 14, y + 22, boxW - 28, { size: 19, font: 'Helvetica-Bold', color: statusColor });

      // Amount in words (left of the total box)
      line('AMOUNT IN WORDS', L, y + 4, CW - boxW - 16, { size: 7.5, font: 'Helvetica-Bold', color: MUTED });
      doc.font('Helvetica-Oblique').fontSize(10).fillColor(INK)
        .text(clean(amountInWords(data.amount)), L, y + 17, { width: CW - boxW - 16, height: 36, ellipsis: true });

      y += 66;
      if (hasBalance) {
        const owed = Number(data.balanceRemaining) > 0.005;
        doc.roundedRect(boxX, y, boxW, 34, 6).fill(owed ? AMBER_BG : GREEN_BG);
        line(owed ? 'BALANCE STILL OWED' : 'ACCOUNT STATUS', boxX + 14, y + 6, boxW - 28, { size: 7.5, font: 'Helvetica-Bold', color: owed ? AMBER : GREEN });
        line(owed ? money(Number(data.balanceRemaining), currency) : 'Fully paid, no balance', boxX + 14, y + 17, boxW - 28, { size: 12, font: 'Helvetica-Bold', color: owed ? AMBER : GREEN });
        y += 46;
      }

      // ── Electronic receipt + verification (replaces signature / stamp lines) ──
      y += 8;
      const issuedBy = platform ? 'WiSkul Billing' : clean(branding.name);
      doc.roundedRect(L, y, CW, verifyH, 8).lineWidth(0.75).strokeColor(LINE).stroke();
      if (!platform) {
        const qs = 82;
        const qx = L + 14, qy = y + (verifyH - qs) / 2;
        if (qr) {
          try { doc.image(qr, qx, qy, { width: qs, height: qs }); } catch { /* text code below still works */ }
        } else {
          doc.roundedRect(qx, qy, qs, qs, 6).lineWidth(0.75).strokeColor(LINE).stroke();
          line('QR code', qx, qy + qs / 2 - 5, qs, { size: 8, color: MUTED, align: 'center' });
        }
        const tx = qx + qs + 18;
        const tw = R - 14 - tx;
        line('ELECTRONIC RECEIPT  -  NO SIGNATURE OR STAMP NEEDED', tx, y + 12, tw, { size: 8.5, font: 'Helvetica-Bold', color: NAVY });
        doc.font('Helvetica').fontSize(8.2).fillColor(MUTED)
          .text(
            clean(`Issued automatically by ${issuedBy} when this payment was recorded${data.receivedBy ? ` by ${data.receivedBy}` : ''}. ` +
              (data.verifyUrl
                ? 'To check that it is genuine, scan the QR code, or go to the address below and enter the code. The page must show the same amount, date and pupil as this receipt.'
                : 'Contact the school office with the receipt number to confirm it.')),
            tx, y + 26, { width: tw, height: 40, lineBreak: true },
          );
        if (data.verifyCode) {
          line('VERIFICATION CODE', tx, y + 70, 120, { size: 7, font: 'Helvetica-Bold', color: MUTED });
          line(data.verifyCode, tx, y + 80, tw, { size: 13, font: 'Courier-Bold', color: NAVY });
          if (data.verifyUrl) line(verifyPageOf(data.verifyUrl), tx, y + 97, tw, { size: 7.5, color: MUTED });
        }
      } else {
        line('ELECTRONIC RECEIPT  -  NO SIGNATURE OR STAMP NEEDED', L + 14, y + 14, CW - 28, { size: 8.5, font: 'Helvetica-Bold', color: NAVY });
        doc.font('Helvetica').fontSize(8.2).fillColor(MUTED)
          .text(clean(`Issued automatically by ${issuedBy} when this payment was received. Questions about this receipt: contact WiSkul support with the receipt number.`), L + 14, y + 30, { width: CW - 28, height: 30 });
      }

      // ── Footer ───────────────────────────────────────────────────
      const fy = H - 96;
      doc.moveTo(L, fy).lineTo(R, fy).lineWidth(0.75).strokeColor(LINE).stroke();
      line(branding.name, L, fy + 10, CW, { size: 9.5, font: 'Helvetica-Bold' });
      line(
        platform
          ? 'Please keep this receipt as proof of payment. If anything on it looks wrong, contact WiSkul support with the receipt number.'
          : 'Please keep this receipt as proof of payment. If anything on it looks wrong, contact the school office with the receipt number.',
        L, fy + 25, CW, { size: 8, color: MUTED },
      );
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
