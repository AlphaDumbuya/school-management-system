/**
 * Finance service — fees, invoices, and payments (admin/accountant views).
 * Talks to the Phase 8 financial routes mounted at /api/v1.
 */

import { apiClient } from '@lib/apiClient';

export interface Fee {
  id: string;
  student_id: string;
  type?: string;
  amount: number | string;
  balance?: number | string;
  due_date: string;
  status: string;
  description?: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  student_id: string;
  total_amount: number | string;
  total_paid: number | string;
  balance: number | string;
  due_date: string;
  status: string;
}

export interface Payment {
  id: string;
  student_id: string;
  amount: number | string;
  payment_date: string;
  method?: string;
  payment_method?: string;
  status: string;
  provider?: string;
  reference_number?: string;
}

export interface FinanceOverview {
  totalBilled: number;
  totalPaid: number;
  totalOutstanding: number;
  overdueInvoices: number;
}

export interface FinanceAnalytics {
  totals: { billed: number; paid: number; outstanding: number; collectionRate: number; invoiceCount: number; overdueCount: number; paidCount: number };
  byMethod: { method: string; total: number; count: number }[];
  trend: { label: string; total: number }[];
  byLevel: { level: string; billed: number; collected: number; outstanding: number; rate: number }[];
  byClass: { className: string; billed: number; collected: number; outstanding: number; rate: number }[];
  byTerm: { term: string; billed: number; collected: number; outstanding: number; rate: number }[];
  topDefaulters: { studentName: string; admissionNo: string; className: string; outstanding: number }[];
  recent: { id: string; studentName: string; amount: number; method: string; status: string; date: string }[];
  thisMonth: { total: number; count: number };
}

export const financeService = {
  // ── Tenant-wide overview (admin) ──────────────────────────────────────────
  getOverview: (academicYear?: string) => apiClient.get<{ success: boolean; data: FinanceOverview }>(
    `/api/v1/finance/overview${academicYear ? `?academic_year=${encodeURIComponent(academicYear)}` : ''}`,
  ),
  getAnalytics: (academicYear?: string) => apiClient.get<{ success: boolean; data: FinanceAnalytics }>(
    `/api/v1/finance/analytics${academicYear ? `?academic_year=${encodeURIComponent(academicYear)}` : ''}`,
  ),
  listInvoices: (status?: string, academicYear?: string) => {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (academicYear) qs.set('academic_year', academicYear);
    const s = qs.toString();
    return apiClient.get<{ success: boolean; data: (Invoice & { student_name: string; admission_no: string })[] }>(`/api/v1/finance/invoices${s ? `?${s}` : ''}`);
  },
  listPayments: (academicYear?: string) => apiClient.get<{ success: boolean; data: (Payment & { student_name: string })[] }>(
    `/api/v1/finance/payments${academicYear ? `?academic_year=${encodeURIComponent(academicYear)}` : ''}`,
  ),
  listFees: () => apiClient.get<{ success: boolean; data: (Fee & { student_name: string })[] }>('/api/v1/finance/fees'),

  // ── Fees ────────────────────────────────────────────────────────────────
  createFee: (data: { type: string; amount: number; dueDate: string; description?: string; studentId: string; classId?: string; academicSession?: string }) =>
    apiClient.post('/api/v1/fees', data),
  getStudentFees: (studentId: string) =>
    apiClient.get<{ success: boolean; data: Fee[] }>(`/api/v1/students/${studentId}/fees`),
  getStudentOutstanding: (studentId: string) =>
    apiClient.get<{ success: boolean; data: { studentId: string; outstandingBalance: number } }>(`/api/v1/students/${studentId}/outstanding`),
  getOverdueFees: () => apiClient.get('/api/v1/fees-overdue'),
  getFeeStatistics: () => apiClient.get('/api/v1/fees-statistics'),
  bulkBill: (data: { scope: 'class' | 'level' | 'all'; classId?: string; level?: string; type: string; amount: number; dueDate: string; term?: string; academicYear?: string; description?: string }) =>
    apiClient.post<{ success: boolean; data: { created: number; total: number } }>('/api/v1/finance/bulk-bill', data),

  // ── Invoices ──────────────────────────────────────────────────────────────
  generateInvoice: (data: { studentId: string; feeIds: string[]; dueDate?: string; notes?: string }) =>
    apiClient.post('/api/v1/invoices', data),
  bulkInvoice: (data: { scope: 'class' | 'level' | 'all'; classId?: string; level?: string; term?: string; academicYear?: string; dueDate?: string }) =>
    apiClient.post<{ success: boolean; data: { generated: number } }>('/api/v1/finance/bulk-invoice', data),
  getInvoiceDetail: (invoiceId: string) =>
    apiClient.get<{ success: boolean; data: { invoice: any; items: any[]; payments: any[] } }>(`/api/v1/finance/invoices/${invoiceId}/detail`),
  sendInvoiceReminder: (invoiceId: string) => apiClient.post(`/api/v1/invoices/${invoiceId}/reminder`, {}),
  getStudentInvoices: (studentId: string) =>
    apiClient.get<{ success: boolean; data: Invoice[] }>(`/api/v1/students/${studentId}/invoices`),
  getOverdueInvoices: () => apiClient.get('/api/v1/invoices-overdue'),
  getInvoiceStatistics: () => apiClient.get('/api/v1/invoices-statistics'),

  // ── Balance reminders (email parents about outstanding fees, with a Pay link) ─
  sendBalanceReminders: (data: { scope: 'student' | 'class' | 'section' | 'level' | 'all'; studentId?: string; classId?: string; section?: string; level?: string; term?: string; message?: string }) =>
    apiClient.post<{ success: boolean; data: { sent: number; notified: number; skippedNoBalance: number; skippedNoEmail: number; considered: number } }>('/api/v1/finance/balance-reminders', data),

  // ── Payments ──────────────────────────────────────────────────────────────
  recordPayment: (data: { feeId: string; amount: number; method: string; transactionReference?: string; notes?: string; paymentDate?: string }) =>
    apiClient.post('/api/v1/payments', data),
  getRecentPayments: () => apiClient.get<{ success: boolean; data: Payment[] }>('/api/v1/payments-recent'),
  getStudentPayments: (studentId: string) =>
    apiClient.get<{ success: boolean; data: Payment[] }>(`/api/v1/students/${studentId}/payments`),
  getPaymentStatistics: () => apiClient.get('/api/v1/payments/statistics'),
  getPaymentMethods: () => apiClient.get('/api/v1/payments-methods'),

  // ── School operating expenses (staff) ─────────────────────────────────────
  listExpenses: (params?: { academicYear?: string; term?: string; category?: string }) => {
    const q = new URLSearchParams();
    if (params?.academicYear) q.set('academic_year', params.academicYear);
    if (params?.term) q.set('term', params.term);
    if (params?.category) q.set('category', params.category);
    const qs = q.toString();
    return apiClient.get<{ success: boolean; data: SchoolExpense[] }>(`/api/v1/finance/expenses${qs ? `?${qs}` : ''}`);
  },
  createExpense: (data: { category: string; description?: string; amount: number; expense_date: string; academic_year: string; term?: string | null }) =>
    apiClient.post<{ success: boolean; data: SchoolExpense }>('/api/v1/finance/expenses', data),
  updateExpense: (id: string, data: Partial<{ category: string; description: string; amount: number; expense_date: string; academic_year: string; term: string | null }>) =>
    apiClient.put<{ success: boolean; data: SchoolExpense }>(`/api/v1/finance/expenses/${id}`, data),
  deleteExpense: (id: string) => apiClient.delete<{ success: boolean }>(`/api/v1/finance/expenses/${id}`),
  getFeesVsExpenses: (academicYear: string) =>
    apiClient.get<{ success: boolean; data: { academic_year: string; billed: number; collected: number; outstanding: number; expenses: number; net: number } }>(
      `/api/v1/finance/summary/fees-vs-expenses?academic_year=${encodeURIComponent(academicYear)}`,
    ),
};

export interface SchoolExpense {
  id: string;
  tenant_id: string;
  category: string;
  description: string | null;
  amount: number | string;
  expense_date: string;
  academic_year: string;
  term: string | null;
  recorded_by: string | null;
  created_at: string;
}

export default financeService;
