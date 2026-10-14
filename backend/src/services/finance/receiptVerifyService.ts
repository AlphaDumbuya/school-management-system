/**
 * Receipt verification: a way to tell a genuine receipt from a copied or edited one.
 *
 * Each receipt gets ONE random code (80 bits, so it cannot be guessed or counted
 * up like the sequential receipt number). The PDF prints it as text and as a QR
 * code that opens /verify-receipt/<code>. That public page shows the receipt as
 * the school recorded it (amount, date, pupil, what it paid for, and whether it
 * has since been refunded), so a receipt whose figures were changed, or made up
 * from scratch, does not match, and a refunded receipt cannot be passed off as
 * paid.
 *
 * The code is stable: reprinting or re-emailing a receipt shows the same code.
 */
import crypto from 'crypto';
import { db } from '@utils/database';
import { publicAppUrl } from '@utils/publicUrl';
import { logger } from '@utils/logger';

/** Crockford base32: no I, L, O or U, so a code read aloud or typed is hard to get wrong. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 16; // 16 x 5 bits = 80 bits

function newCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[bytes[i] % 32];
  return out;
}

/** What was typed or scanned, as the stored form (upper-case, no dashes or spaces, look-alikes mapped). */
export function normalizeCode(raw: unknown): string {
  return String(raw ?? '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/U/g, 'V');
}

/** XXXX-XXXX-XXXX-XXXX, how the code is shown to people. */
export function formatCode(code: string): string {
  return (code.match(/.{1,4}/g) || [code]).join('-');
}

export function verifyUrl(code: string): string {
  const base = (process.env.RECEIPT_VERIFY_URL || publicAppUrl()).replace(/\/+$/, '');
  return `${base}/verify-receipt/${code}`;
}

/** The receipt's code, creating it the first time the receipt is rendered. Null if it cannot be stored. */
export async function getOrCreateCode(tenantId: string, receiptNumber: string): Promise<string | null> {
  try {
    const existing = await db('receipt_verifications').where({ tenant_id: tenantId, receipt_number: receiptNumber }).first('code');
    if (existing?.code) return existing.code;
    for (let attempt = 0; attempt < 4; attempt++) {
      // Two renders at once, or a (vanishingly unlikely) clash: the unique indexes
      // make one insert win and the other read the winner.
      await db('receipt_verifications')
        .insert({ tenant_id: tenantId, receipt_number: receiptNumber, code: newCode() })
        .onConflict().ignore();
      const row = await db('receipt_verifications').where({ tenant_id: tenantId, receipt_number: receiptNumber }).first('code');
      if (row?.code) return row.code;
    }
  } catch (e: any) {
    // A receipt must still be produced if verification can't be stored (for
    // example the table is not there yet during a deploy).
    logger.warn(`Could not create a verification code for receipt ${receiptNumber}: ${e?.message || e}`);
  }
  return null;
}

/** "Mariama Kamara" -> "Mariama K.": the public page never shows a pupil's full name. */
export function maskName(name?: string | null): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export interface PublicReceiptCheck {
  verified: true;
  code: string;
  receipt_number: string;
  status: 'paid' | 'refunded' | 'part_refunded';
  currency: string;
  amount: number;
  date: string;
  method: string | null;
  student: string;
  class_name: string | null;
  academic_year: string | null;
  items: Array<{ label: string; detail: string | null; amount: number }>;
  issued_by: { name: string; address?: string | null; phone?: string | null; email?: string | null; logo_url?: string | null };
}

/** Everything the public page may show for a code, or null when no receipt has it. */
export async function lookup(rawCode: unknown): Promise<PublicReceiptCheck | null> {
  const code = normalizeCode(rawCode);
  if (code.length !== CODE_LENGTH) return null;
  const row = await db('receipt_verifications').where({ code }).first('tenant_id', 'receipt_number', 'code');
  if (!row) return null;

  const { receiptService } = await import('./receiptService');
  const r = await receiptService.get(row.tenant_id, row.receipt_number).catch(() => null);
  if (!r) return null;
  const school = await db('schools').where({ tenant_id: row.tenant_id }).first('name', 'address', 'phone', 'email', 'logo_url').catch(() => null);
  const tenant = school?.name ? null : await db('tenants').where({ id: row.tenant_id }).first('name').catch(() => null);

  return {
    verified: true,
    code: row.code,
    receipt_number: r.receipt_number,
    status: r.status,
    currency: 'Le',
    amount: r.amount,
    date: new Date(r.date).toISOString(),
    method: r.method_label || null,
    student: maskName(r.student_name),
    class_name: r.class_name,
    academic_year: r.academic_year,
    items: r.items.map((i: any) => ({ label: i.label, detail: i.detail || null, amount: i.amount })),
    issued_by: {
      name: school?.name || tenant?.name || 'School',
      address: school?.address || null,
      phone: school?.phone || null,
      email: school?.email || null,
      // A data: logo would bloat the response; only link a real address.
      logo_url: school?.logo_url && /^https?:\/\//i.test(school.logo_url) ? school.logo_url : null,
    },
  };
}

export default { getOrCreateCode, lookup, verifyUrl, formatCode, normalizeCode, maskName };
