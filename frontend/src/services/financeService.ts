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
  getOverview: () => apiClient.get<{ success: boolean; data: FinanceOverview }>('/api/v1/finance/overview'),
  getAnalytics: () => apiClient.get<{ success: boolean; data: FinanceAnalytics }>('/api/v1/finance/analytics'),
  listInvoices: (status?: string) =>
    apiClient.get<{ success: boolean; data: (Invoice & { student_name: string; admission_no: string })[] }>(`/api/v1/finance/invoices${status ? `?status=${status}` : ''}`),
  listPayments: () => apiClient.get<{ success: boolean; data: (Payment & { student_name: string })[] }>('/api/v1/finance/payments'),
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
  bulkCreateFees: (data: { classId: string; fees: any[] }) => apiClient.post('/api/v1/fees/bulk', data),

  // ── Invoices ──────────────────────────────────────────────────────────────
  generateInvoice: (data: { studentId: string; feeIds: string[]; dueDate?: string; notes?: string }) =>
    apiClient.post('/api/v1/invoices', data),
  getStudentInvoices: (studentId: string) =>
    apiClient.get<{ success: boolean; data: Invoice[] }>(`/api/v1/students/${studentId}/invoices`),
  getOverdueInvoices: () => apiClient.get('/api/v1/invoices-overdue'),
  getInvoiceStatistics: () => apiClient.get('/api/v1/invoices-statistics'),

  // ── Payments ──────────────────────────────────────────────────────────────
  recordPayment: (data: { feeId: string; amount: number; method: string; transactionReference?: string; notes?: string; paymentDate?: string }) =>
    apiClient.post('/api/v1/payments', data),
  getRecentPayments: () => apiClient.get<{ success: boolean; data: Payment[] }>('/api/v1/payments-recent'),
  getStudentPayments: (studentId: string) =>
    apiClient.get<{ success: boolean; data: Payment[] }>(`/api/v1/students/${studentId}/payments`),
  getPaymentStatistics: () => apiClient.get('/api/v1/payments/statistics'),
  getPaymentMethods: () => apiClient.get('/api/v1/payments-methods'),
};

export default financeService;
