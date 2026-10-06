/**
 * Statement of account (bursar Phase A, R7): for one student and year,
 *   opening  = what is still unpaid from EARLIER years (brought forward)
 *   lines    = charges, discounts/waivers, late fees, payments, refunds,
 *              applied credit, in date order with a running balance
 *   closing  = opening + the year's movements (= everything owed now)
 * `reconciles` says whether the lines add up to the live balances (they do
 * whenever every money path keeps the balance identity).
 */
import PDFDocument from 'pdfkit';
import { db } from '@utils/database';
import { normalizeAcademicYear, resolveActiveYear } from '@utils/academicYear';
import { resolveTenantBranding } from '@services/email/emailBranding';
import { round2, studentLabel } from './core';
import { creditService } from './creditService';

type Line = { date: string; kind: string; description: string; debit: number; credit: number; reference?: string | null; balance?: number; fee_id?: string; outstanding?: number };

const d10 = (v: any) => {
  if (!v) return '';
  if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  return String(v).slice(0, 10);
};
const KIND_LABEL: Record<string, string> = { discount: 'Discount', waiver: 'Waiver', credit_applied: 'Account credit applied', late_fee_waiver: 'Late fee waived' };

export const statementService = {
  async build(tenantId: string, studentId: string, rawYear?: string) {
    const year = normalizeAcademicYear(rawYear || null) || (await resolveActiveYear(tenantId)).yearString;
    const fees = await db('fees').where({ tenant_id: tenantId, student_id: studentId }).whereNot('status', 'deleted')
      .select('id', 'type', 'description', 'amount', 'balance', 'term', 'academic_year', 'created_at', 'due_date', 'source');
    const yearFees = fees.filter((f: any) => f.academic_year === year);
    const earlier = fees.filter((f: any) => f.academic_year && f.academic_year < year);
    const opening = round2(earlier.reduce((s: number, f: any) => s + Number(f.balance || 0), 0));
    const ids = yearFees.map((f: any) => String(f.id));
    const feeById = new Map(yearFees.map((f: any) => [String(f.id), f]));

    const lines: Line[] = [];
    for (const f of yearFees) {
      lines.push({
        date: d10(f.created_at), kind: f.source === 'late_fee' ? 'late_fee' : 'charge',
        description: `${f.type || 'Fee'}${f.term ? ` · ${f.term}` : ''}`, debit: round2(f.amount), credit: 0,
        fee_id: String(f.id), outstanding: round2(f.balance),
      });
    }
    if (ids.length) {
      const adjs = await db('fee_adjustments').whereIn('fee_id', ids);
      for (const a of adjs) {
        const fee: any = feeById.get(String(a.fee_id));
        const what = `${KIND_LABEL[a.kind] || a.kind}${a.reason ? `: ${a.reason}` : ''} (${fee?.type || 'fee'})`;
        lines.push({ date: d10(a.created_at), kind: a.kind, description: what, debit: 0, credit: round2(a.amount) });
        if (a.reversed_at) lines.push({ date: d10(a.reversed_at), kind: 'reversal', description: `Reversed: ${what}`, debit: round2(a.amount), credit: 0 });
      }
      const pays = await db('payments').where({ tenant_id: tenantId, student_id: studentId }).whereIn('fee_id', ids)
        .whereIn('status', ['completed', 'refunded'])
        .select('id', 'amount', 'payment_date', 'receipt_number', 'method', 'payment_method', 'status', 'created_at');
      const byReceipt = new Map<string, any>();
      for (const p of pays) {
        const k = p.receipt_number || p.id;
        const r = byReceipt.get(k) || byReceipt.set(k, { date: d10(p.payment_date), amount: 0, method: p.method || p.payment_method, ref: p.receipt_number }).get(k);
        r.amount = round2(r.amount + Number(p.amount));
      }
      for (const r of byReceipt.values()) {
        lines.push({ date: r.date, kind: 'payment', description: `Payment · ${String(r.method || '').replace(/_/g, ' ')}`, debit: 0, credit: r.amount, reference: r.ref });
      }
      const refunds = await db('refunds as r').join('payments as p', 'p.id', 'r.original_payment_id')
        .whereIn('p.fee_id', ids).select('r.amount', 'r.refund_date', 'r.reason', 'p.receipt_number');
      for (const r of refunds) {
        lines.push({ date: d10(r.refund_date), kind: 'refund', description: `Refund${r.reason ? `: ${r.reason}` : ''}`, debit: round2(r.amount), credit: 0, reference: r.receipt_number });
      }
    }
    // Online payments settle fees without a fee link: show those in the year's window.
    const scopeStart = yearFees.length ? yearFees.map((f: any) => d10(f.created_at)).sort()[0] : null;
    const online = await db('payments').where({ tenant_id: tenantId, student_id: studentId, status: 'completed' }).whereNull('fee_id')
      .whereNotExists(db('student_credits as c').whereRaw('c.payment_id = payments.id'))
      .modify((q) => { if (scopeStart) q.where('payment_date', '>=', scopeStart); })
      .select('amount', 'payment_date', 'receipt_number', 'method');
    for (const p of online) lines.push({ date: d10(p.payment_date), kind: 'payment', description: `Online payment · ${p.method || 'monime'}`, debit: 0, credit: round2(p.amount), reference: p.receipt_number });

    const order: Record<string, number> = { charge: 0, late_fee: 1, discount: 2, waiver: 2, late_fee_waiver: 2, reversal: 3, credit_applied: 4, payment: 5, refund: 6 };
    lines.sort((a, b) => a.date.localeCompare(b.date) || (order[a.kind] ?? 9) - (order[b.kind] ?? 9));
    let bal = opening;
    for (const l of lines) { bal = round2(bal + l.debit - l.credit); l.balance = bal; }
    const yearOutstanding = round2(yearFees.reduce((s: number, f: any) => s + Number(f.balance || 0), 0));
    const closing = round2(opening + yearOutstanding);
    const student = await studentLabel(studentId);
    return {
      student_id: studentId, student_name: student.name, admission_no: student.admissionNo,
      academic_year: year,
      opening_balance: opening,
      brought_forward_years: Array.from(new Set(earlier.filter((f: any) => Number(f.balance) > 0).map((f: any) => f.academic_year))).sort(),
      lines,
      totals: {
        charges: round2(lines.reduce((s, l) => s + l.debit, 0)),
        credits: round2(lines.reduce((s, l) => s + l.credit, 0)),
      },
      closing_balance: closing,
      reconciles: Math.abs(bal - closing) < 0.01,
      account_credit: await creditService.balance(tenantId, studentId),
      generated_at: new Date().toISOString(),
    };
  },

  async pdf(tenantId: string, studentId: string, year?: string): Promise<Buffer> {
    const st = await this.build(tenantId, studentId, year);
    const branding = await resolveTenantBranding(tenantId);
    const le = (n: number) => `Le ${round2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        const left = 40, right = doc.page.width - 40, W = right - left;
        doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text(branding.name, left, 40);
        doc.font('Helvetica').fontSize(9).fillColor('#64748b').text([branding.address, branding.contactPhone, branding.contactEmail].filter(Boolean).join('  ·  '), left, 60, { width: W });
        doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827').text('STATEMENT OF ACCOUNT', left, 86);
        doc.font('Helvetica').fontSize(10).fillColor('#334155')
          .text(`${st.student_name}${st.admission_no ? ` (${st.admission_no})` : ''}`, left, 106)
          .text(`Academic year ${st.academic_year}  ·  Printed ${new Date().toLocaleDateString('en-GB')}`, left, 120);
        let y = 146;
        const cols = [left, left + 70, left + 300, left + 370, left + 440];
        const header = () => {
          doc.rect(left, y, W, 18).fill('#1a1a2e');
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff');
          ['Date', 'Description', 'Charges', 'Credits', 'Balance'].forEach((h, i) => doc.text(h, cols[i] + 4, y + 5, { width: i === 1 ? 225 : 70, align: i >= 2 ? 'right' : 'left' }));
          y += 22;
        };
        header();
        const row = (date: string, desc: string, debit: string, credit: string, bal: string, bold = false) => {
          if (y > doc.page.height - 90) { doc.addPage(); y = 40; header(); }
          doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor('#111827');
          const h = Math.max(12, doc.heightOfString(desc, { width: 225 }));
          doc.text(date, cols[0] + 4, y, { width: 66 });
          doc.text(desc, cols[1] + 4, y, { width: 225 });
          doc.text(debit, cols[2], y, { width: 66, align: 'right' });
          doc.text(credit, cols[3], y, { width: 66, align: 'right' });
          doc.text(bal, cols[4], y, { width: W - (cols[4] - left) - 4, align: 'right' });
          y += h + 6;
          doc.moveTo(left, y - 3).lineTo(right, y - 3).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
        };
        row('', `Balance brought forward${st.brought_forward_years.length ? ` (${st.brought_forward_years.join(', ')})` : ''}`, '', '', le(st.opening_balance), true);
        for (const l of st.lines) row(l.date, `${l.description}${l.reference ? ` · ${l.reference}` : ''}`, l.debit ? le(l.debit) : '', l.credit ? le(l.credit) : '', le(l.balance || 0));
        row('', 'Closing balance (amount owed)', le(st.totals.charges), le(st.totals.credits), le(st.closing_balance), true);
        if (st.account_credit > 0) { y += 6; doc.font('Helvetica').fontSize(9).fillColor('#047857').text(`Account credit available: ${le(st.account_credit)}`, left, y); }
        doc.font('Helvetica').fontSize(8).fillColor('#94a3b8').text('Computer-generated statement. Please quote the admission number with any payment.', left, doc.page.height - 60, { width: W, align: 'center' });
        doc.end();
      } catch (e) { reject(e); }
    });
  },
};

export default statementService;
