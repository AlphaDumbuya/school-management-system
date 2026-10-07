/**
 * Bursar Phase A API: discounts & scholarships, late fees, aging, receipts,
 * credit, instalment plans, statements. apiClient never throws; callers
 * check `success === false`.
 */
import { apiClient } from '@lib/apiClient';
import { API_CONFIG } from '@config/api.config';
import { saveBlob } from '@lib/download';

const F = '/api/v1/finance';
const qs = (p: Record<string, any>) => {
  const q = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => { if (v !== undefined && v !== null && String(v) !== '') q.set(k, String(v)); });
  const s = q.toString();
  return s ? `?${s}` : '';
};

export type Bucket = 'not_due' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus';
export const BUCKET_LABEL: Record<Bucket, string> = {
  not_due: 'Not yet due', d1_30: '1–30 days', d31_60: '31–60 days', d61_90: '61–90 days', d90_plus: '90+ days',
};
export const TERMS = ['First Term', 'Second Term', 'Third Term'];

export interface DiscountRule {
  id: string; name: string; kind: 'sibling' | 'staff_child' | 'scholarship' | 'custom';
  basis: 'percent' | 'fixed'; value: number | string; applies_to: 'tuition' | 'all';
  sibling_order?: number | null; active: boolean; description?: string | null;
}
export interface DiscountGrant {
  id: string; student_id: string; student_name: string; admission_no: string; rule_id: string | null; label: string;
  academic_year: string; term: string | null; basis: 'percent' | 'fixed'; value: number | string; applies_to: string;
  reason: string | null; status: 'pending' | 'approved' | 'rejected' | 'revoked'; applied_amount: number;
  requested_by_name?: string; decided_by_name?: string; decision_reason?: string | null; created_at: string;
}
export interface StatementLine { date: string; kind: string; description: string; debit: number; credit: number; reference?: string | null; balance: number; fee_id?: string; outstanding?: number }
export interface Statement {
  student_id: string; student_name: string; admission_no: string; academic_year: string;
  opening_balance: number; brought_forward_years: string[]; lines: StatementLine[];
  totals: { charges: number; credits: number }; closing_balance: number; reconciles: boolean; account_credit: number;
}
export interface PlanSchedule {
  id: string; student_id: string; academic_year: string; term: string | null; status: string; total_amount: number; owed_now: number;
  installments: Array<{ number: number; due_date: string; amount: number; paid: number; remaining: number; status: 'paid' | 'part_paid' | 'due' | 'overdue' }>;
  next_due: { number: number; due_date: string; remaining: number; status: string } | null; overdue_amount: number; has_overdue: boolean;
  student_name?: string; admission_no?: string; cancelled_reason?: string | null;
}
export interface ReceiptRow {
  receipt_number: string; student_id: string; student_name: string; admission_no: string; amount: number; date: string;
  method: string; method_label: string; status: 'paid' | 'refunded' | 'part_refunded'; balance_after: number | null;
}

/** Download an authenticated file (PDF/CSV) and save it (web + native). */
export async function downloadFile(endpoint: string, filename: string): Promise<void> {
  const url = `${API_CONFIG.baseURL}${endpoint}`;
  const get = (tok: string | null) => fetch(url, { headers: tok ? { Authorization: `Bearer ${tok}` } : undefined, credentials: 'include' });
  let res = await get(localStorage.getItem('accessToken') || localStorage.getItem('token'));
  if (res.status === 401) {
    const refresh = localStorage.getItem('refreshToken');
    if (refresh) {
      const r = await fetch(`${API_CONFIG.baseURL}/api/v1/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: refresh }) });
      const b = await r.json().catch(() => ({}));
      const tok = b.access_token || b.accessToken || b?.data?.accessToken;
      if (tok) { localStorage.setItem('accessToken', tok); res = await get(tok); }
    }
  }
  if (!res.ok) {
    let msg = `Download failed (${res.status})`;
    try { const j = await res.json(); msg = j?.error || j?.message || msg; } catch { /* binary */ }
    throw new Error(msg);
  }
  await saveBlob(await res.blob(), filename);
}

export const bursarService = {
  // Discounts
  listRules: () => apiClient.get<{ success: boolean; data: DiscountRule[] }>(`${F}/discounts/rules`),
  createRule: (b: Partial<DiscountRule>) => apiClient.post<{ success: boolean; data: DiscountRule }>(`${F}/discounts/rules`, b),
  updateRule: (id: string, b: Partial<DiscountRule>) => apiClient.put<{ success: boolean; data: DiscountRule }>(`${F}/discounts/rules/${id}`, b),
  siblingCandidates: (ruleId: string, year?: string) =>
    apiClient.get<{ success: boolean; data: Array<{ student_id: string; admission_no: string; name: string; child_number: number; siblings: number }> }>(`${F}/discounts/rules/${ruleId}/candidates${qs({ academic_year: year })}`),
  listGrants: (p: { academic_year?: string; status?: string; student_id?: string }) =>
    apiClient.get<{ success: boolean; data: DiscountGrant[] }>(`${F}/discounts/grants${qs(p)}`),
  grant: (b: any) => apiClient.post<{ success: boolean; data: { grant: DiscountGrant; worth: number; applied: number; needsApproval: boolean } }>(`${F}/discounts/grants`, b),
  decide: (id: string, decision: 'approve' | 'reject' | 'revoke', reason?: string) =>
    apiClient.post<{ success: boolean; data: any }>(`${F}/discounts/grants/${id}/${decision}`, { reason }),

  // Late fees
  runLateFees: () => apiClient.post<{ success: boolean; data: { markedOverdue: number; lateFeesCharged: number; lateFeeAmount: number } }>(`${F}/late-fees/run`, {}),
  waiveLateFee: (feeId: string, reason: string) => apiClient.post(`${F}/fees/${feeId}/waive-late-fee`, { reason }),
  addLateFee: (feeId: string, amount: number, reason?: string) => apiClient.post(`${F}/fees/${feeId}/late-fee`, { amount, reason }),

  // Aging + cash
  aging: (p: Record<string, string | number | undefined>) =>
    apiClient.get<{ success: boolean; data: any }>(`${F}/aging${qs(p)}`),
  cashPosition: (year?: string) => apiClient.get<{ success: boolean; data: { academic_year: string; year: number; month: number; today: number } }>(`${F}/cash-position${qs({ academic_year: year })}`),
  unpaidInClass: (classId: string) => apiClient.get<{ success: boolean; data: Array<{ student_id: string; admission_no: string; student_name: string; outstanding: number }> }>(`${F}/unpaid-students${qs({ class_id: classId })}`),

  // Receipts
  receipts: (p: { from?: string; to?: string; class_id?: string; student_id?: string }) => apiClient.get<{ success: boolean; data: ReceiptRow[] }>(`${F}/receipts${qs(p)}`),
  studentReceipts: (studentId: string) => apiClient.get<{ success: boolean; data: ReceiptRow[] }>(`${F}/students/${studentId}/receipts`),
  emailReceipt: (no: string) => apiClient.post<{ success: boolean; data: { sent: boolean; to?: string }; error?: string }>(`${F}/receipts/${encodeURIComponent(no)}/email`, {}),
  bulkEmailReceipts: (b: { from: string; to: string; class_id?: string }) =>
    apiClient.post<{ success: boolean; data: { considered: number; sent: number; skipped: number; failed: number } }>(`${F}/receipts/bulk-email`, b),
  downloadReceipt: (no: string) => downloadFile(`${F}/receipts/${encodeURIComponent(no)}/pdf`, `Receipt-${no}.pdf`),

  // Credit
  credit: (studentId: string) => apiClient.get<{ success: boolean; data: { balance: number; entries: any[] } }>(`${F}/credits/${studentId}`),
  creditNote: (studentId: string, amount: number, reason: string) => apiClient.post(`${F}/credits/${studentId}/note`, { amount, reason }),
  applyCredit: (studentId: string) => apiClient.post<{ success: boolean; data: { applied: number; balance: number } }>(`${F}/credits/${studentId}/apply`, {}),
  refundCredit: (studentId: string, amount: number, reason: string) => apiClient.post(`${F}/credits/${studentId}/refund`, { amount, reason }),

  // Plans
  plans: (year?: string) => apiClient.get<{ success: boolean; data: PlanSchedule[] }>(`${F}/plans${qs({ academic_year: year })}`),
  studentPlans: (studentId: string) => apiClient.get<{ success: boolean; data: PlanSchedule[] }>(`${F}/plans/student/${studentId}`),
  createPlan: (b: any) => apiClient.post<{ success: boolean; data: PlanSchedule }>(`${F}/plans`, b),
  cancelPlan: (id: string, reason: string) => apiClient.post(`${F}/plans/${id}/cancel`, { reason }),

  // Statement
  statement: (studentId: string, year?: string) => apiClient.get<{ success: boolean; data: Statement }>(`${F}/statements/${studentId}${qs({ academic_year: year })}`),
  downloadStatement: (studentId: string, year: string | undefined, label: string) =>
    downloadFile(`${F}/statements/${studentId}${qs({ academic_year: year, format: 'pdf' })}`, `Statement-${label}.pdf`),
};

export default bursarService;

// ── Phase B: expenses, petty cash, budgets, payroll ─────────────────────────
export const EXPENSE_CATEGORIES = [
  'Salaries', 'Statutory (PAYE/NASSIT)', 'Utilities', 'Supplies', 'Maintenance', 'Transport',
  'Food & Catering', 'Rent', 'Events', 'Administration', 'Other',
];
export const EXPENSE_METHODS = [
  { value: 'cash', label: 'Cash' }, { value: 'bank_transfer', label: 'Bank transfer' }, { value: 'cheque', label: 'Cheque' }, { value: 'mobile_money', label: 'Mobile money' },
];
export interface Expense {
  id: string; category: string; amount: number; expense_date: string; academic_year: string; term: string | null; description: string | null;
  vendor: string | null; payment_method: string | null; reference: string | null; receipt_url: string | null; department: string | null;
  source: 'manual' | 'petty_cash' | 'payroll'; voided_at: string | null; void_reason: string | null; recorded_by_name?: string;
}
export interface PayLine { name: string; amount: number; taxable?: boolean }
export interface PayStaff {
  kind: 'staff' | 'support'; ref: string; name: string; staff_number: string | null; designation: string | null; user_id: string | null; email: string | null; active: boolean;
  profile: null | { basic_salary: number | string; allowances: PayLine[]; deductions: PayLine[]; paye_applies: boolean; nassit_applies: boolean; payment_method: string; bank_name: string | null; account_number: string | null; active: boolean };
  preview: null | { gross: number; paye: number; nassit_employee: number; net: number };
}
export interface PayRun {
  id: string; period: string; status: 'draft' | 'approved' | 'paid' | 'cancelled'; gross: number | string; paye: number | string; nassit_employee: number | string;
  nassit_employer: number | string; other_deductions: number | string; net: number | string; staff_count: number; payment_date: string | null;
  approved_by_name?: string; paid_by_name?: string; cancelled_reason?: string | null; payslips?: any[];
}

export const bursarB = {
  expenses: (p: Record<string, string | undefined>) => apiClient.get<{ success: boolean; data: { academic_year: string; rows: Expense[]; total: number; by_category: Array<{ category: string; total: number }> } }>(`${F}/expenses-v2${qs(p)}`),
  createExpense: (b: any) => apiClient.post<{ success: boolean; data: Expense & { budget_warning?: string | null } }>(`${F}/expenses-v2`, b),
  updateExpense: (id: string, b: any) => apiClient.put<{ success: boolean; data: Expense }>(`${F}/expenses-v2/${id}`, b),
  voidExpense: (id: string, reason: string) => apiClient.post(`${F}/expenses-v2/${id}/void`, { reason }),
  feesVsExpenses: (year: string) => apiClient.get<{ success: boolean; data: any }>(`${F}/summary/fees-vs-expenses${qs({ academic_year: year })}`),

  funds: () => apiClient.get<{ success: boolean; data: any[] }>(`${F}/petty-cash`),
  saveFund: (b: any, id?: string) => (id ? apiClient.put(`${F}/petty-cash/${id}`, b) : apiClient.post(`${F}/petty-cash`, b)),
  fundEntries: (id: string, year?: string) => apiClient.get<{ success: boolean; data: { fund: any; balance: number; entries: any[] } }>(`${F}/petty-cash/${id}/entries${qs({ academic_year: year })}`),
  addEntry: (id: string, b: any) => apiClient.post<{ success: boolean; data: any }>(`${F}/petty-cash/${id}/entries`, b),
  voidEntry: (entryId: string, reason: string) => apiClient.post(`${F}/petty-cash/entries/${entryId}/void`, { reason }),

  budget: (year: string) => apiClient.get<{ success: boolean; data: any }>(`${F}/budgets${qs({ academic_year: year })}`),
  saveBudget: (year: string, lines: any[], notes?: string) => apiClient.put<{ success: boolean; data: any }>(`${F}/budgets`, { academic_year: year, lines, notes }),
  approveBudget: (year: string) => apiClient.post<{ success: boolean; data: any }>(`${F}/budgets/approve`, { academic_year: year }),

  paySettings: () => apiClient.get<{ success: boolean; data: { bands: Array<{ upto: number | null; rate: number }>; nassitEmployeePct: number; nassitEmployerPct: number; payeAfterNassit: boolean } }>(`${F}/payroll/settings`),
  savePaySettings: (b: any) => apiClient.put(`${F}/payroll/settings`, b),
  payStaff: () => apiClient.get<{ success: boolean; data: PayStaff[] }>(`${F}/payroll/staff`),
  saveProfile: (b: any) => apiClient.put(`${F}/payroll/staff`, b),
  runs: () => apiClient.get<{ success: boolean; data: PayRun[] }>(`${F}/payroll/runs`),
  run: (id: string) => apiClient.get<{ success: boolean; data: PayRun }>(`${F}/payroll/runs/${id}`),
  generateRun: (period: string) => apiClient.post<{ success: boolean; data: PayRun }>(`${F}/payroll/runs`, { period }),
  runAction: (id: string, action: 'regenerate' | 'approve' | 'pay' | 'cancel' | 'email', body?: any) => apiClient.post<{ success: boolean; data: any }>(`${F}/payroll/runs/${id}/${action}`, body || {}),
  editSlip: (id: string, b: any) => apiClient.put(`${F}/payroll/payslips/${id}`, b),
  removeSlip: (id: string) => apiClient.delete(`${F}/payroll/payslips/${id}`),
  mySlips: () => apiClient.get<{ success: boolean; data: any[] }>(`${F}/payroll/my-payslips`),
  downloadSlip: (id: string, label: string) => downloadFile(`${F}/payroll/payslips/${id}/pdf`, `Payslip-${label}.pdf`),
};

// ── Phase C: accounting (chart of accounts, journal, statements, bank rec, audit) ──
export type GLAccount = {
  id: string; code: string; name: string; type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  subtype: string | null; system_key: string | null; is_active: boolean; is_system: boolean; control: boolean; balance: number; has_activity: boolean;
};
export type GLLine = { id: string; entry_id: string; account_id: string; code: string; name: string; debit: number; credit: number; memo: string | null };
export type GLEntry = {
  id: string; entry_no: string; entry_date: string; academic_year: string | null; memo: string | null; kind: 'auto' | 'manual';
  source_type: string; source_id: string | null; reverses_id: string | null; reversed_by_id: string | null; reverse_reason: string | null;
  created_by_name: string | null; lines: GLLine[]; total: number;
};
export type Paged<T> = { total: number; page: number; size: number; rows: T[] };
export type RangeQuery = { academic_year?: string; from?: string; to?: string };

export const ACCOUNT_TYPE_LABEL: Record<string, string> = { asset: 'Assets', liability: 'Liabilities', equity: 'Equity', income: 'Income', expense: 'Expenses' };
export const SOURCE_TYPE_LABEL: Record<string, string> = {
  fee: 'Fee billed', payment: 'Payment', refund: 'Refund', adjustment: 'Discount / waiver', credit: 'Student credit',
  expense: 'Expense', petty_cash: 'Petty cash', payroll: 'Payroll', manual: 'Manual journal',
};

export const bursarC = {
  accounts: () => apiClient.get<{ success: boolean; data: GLAccount[] }>(`${F}/gl/accounts`),
  saveAccount: (b: Partial<GLAccount> & { description?: string }, id?: string) => (id ? apiClient.put(`${F}/gl/accounts/${id}`, b) : apiClient.post(`${F}/gl/accounts`, b)),
  sync: () => apiClient.post<{ success: boolean; data: { posted: number; documents: number } }>(`${F}/gl/sync`, {}),
  journal: (p: Record<string, string | number | undefined>) => apiClient.get<{ success: boolean; data: Paged<GLEntry> }>(`${F}/gl/journal${qs(p)}`),
  postJournal: (b: { entry_date: string; memo: string; lines: Array<{ account_id: string; debit?: number; credit?: number; memo?: string }> }) => apiClient.post<{ success: boolean; data: GLEntry }>(`${F}/gl/journal`, b),
  reverse: (id: string, reason: string) => apiClient.post<{ success: boolean; data: GLEntry }>(`${F}/gl/journal/${id}/reverse`, { reason }),
  lock: () => apiClient.get<{ success: boolean; data: { locked_until: string | null } }>(`${F}/gl/lock`),
  setLock: (locked_until: string | null) => apiClient.put<{ success: boolean; data: { locked_until: string | null } }>(`${F}/gl/lock`, { locked_until }),
  report: (kind: 'trial-balance' | 'income-statement' | 'balance-sheet' | 'cash-flow', p: RangeQuery) => apiClient.get<{ success: boolean; data: any }>(`${F}/gl/reports/${kind}${qs(p)}`),
  ledger: (accountId: string, p: RangeQuery) => apiClient.get<{ success: boolean; data: any }>(`${F}/gl/reports/ledger/${accountId}${qs(p)}`),
  integrity: () => apiClient.get<{ success: boolean; data: { as_at: string; balanced: boolean; checks: Array<{ label: string; books: number; records: number; difference: number; ok: boolean; hint: string }> } }>(`${F}/gl/integrity`),
  bankAccounts: () => apiClient.get<{ success: boolean; data: Array<{ id: string; code: string; name: string; system_key: string | null; book_balance: number; statement_lines: number; unmatched: number; last_statement_date: string | null }> }>(`${F}/bank/accounts`),
  bankView: (accountId: string, p: { to?: string; statement_balance?: string }) => apiClient.get<{ success: boolean; data: any }>(`${F}/bank/${accountId}${qs(p)}`),
  bankImport: (accountId: string, rows: Array<{ date: string; description?: string; reference?: string; amount: number; balance?: number | null }>) =>
    apiClient.post<{ success: boolean; data: { batch: string; inserted: number; skipped: number } }>(`${F}/bank/${accountId}/import`, { rows }),
  bankUndoImport: (batch: string) => apiClient.delete<{ success: boolean; data: { removed: number } }>(`${F}/bank/imports/${batch}`),
  bankAutoMatch: (accountId: string) => apiClient.post<{ success: boolean; data: { matched: number; remaining: number } }>(`${F}/bank/${accountId}/auto-match`, {}),
  bankMatch: (statement_line_id: string, gl_line_ids: string[]) => apiClient.post(`${F}/bank/match`, { statement_line_id, gl_line_ids }),
  bankUnmatch: (statement_line_id: string) => apiClient.post(`${F}/bank/unmatch`, { statement_line_id }),
  bankIgnore: (id: string, ignored: boolean) => apiClient.post(`${F}/bank/lines/${id}/ignore`, { ignored }),
  bankBook: (id: string, account_id: string, memo?: string) => apiClient.post<{ success: boolean; data: { entry_no: string } }>(`${F}/bank/lines/${id}/book`, { account_id, memo }),
  audit: (p: Record<string, string | number | undefined>) => apiClient.get<{ success: boolean; data: Paged<any> & { areas: string[]; people: Array<{ id: string; name: string; role: string }> } }>(`${F}/audit${qs(p)}`),
};
