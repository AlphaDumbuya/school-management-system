/**
 * Public receipt verification: raw fetch (no auth token), because the page is
 * reached by scanning the QR code on a printed or emailed receipt.
 */

export interface VerifiedReceipt {
  verified: true;
  code: string;
  receipt_number: string;
  status: 'paid' | 'refunded' | 'part_refunded';
  currency: string;
  amount: number;
  date: string;
  method: string | null;
  /** First name and last initial only. */
  student: string;
  class_name: string | null;
  academic_year: string | null;
  items: Array<{ label: string; detail: string | null; amount: number }>;
  issued_by: { name: string; address?: string | null; phone?: string | null; email?: string | null; logo_url?: string | null };
  checked_at: string;
}

export type VerifyReceiptResult =
  | { ok: true; data: VerifiedReceipt }
  | { ok: false; reason: 'not_found' | 'rate_limited' | 'network'; message: string };

export async function verifyReceipt(code: string): Promise<VerifyReceiptResult> {
  const base = (import.meta as any).env?.VITE_API_URL || '';
  try {
    const res = await fetch(`${base}/api/v1/public/verify-receipt/${encodeURIComponent(code)}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.status === 429) {
      return { ok: false, reason: 'rate_limited', message: 'Too many checks from this connection. Please wait a few minutes and try again.' };
    }
    const body = await res.json().catch(() => null);
    if (res.ok && body?.success && body.data) return { ok: true, data: body.data as VerifiedReceipt };
    if (res.status === 404 || res.status === 400) {
      return { ok: false, reason: 'not_found', message: body?.error || 'No receipt matches this code.' };
    }
    return { ok: false, reason: 'network', message: body?.error || 'The check could not be completed. Please try again.' };
  } catch {
    return { ok: false, reason: 'network', message: 'Could not reach the server. Check your connection and try again.' };
  }
}
