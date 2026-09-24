/**
 * Finance ledger service (frontend) — reads the per-student ledger and the
 * tenant summary/breakdown exposed by /api/v1/finance/ledger.
 */
import { apiClient } from '@lib/apiClient';

export type LedgerTerm = 'first_term' | 'second_term' | 'third_term';

export interface LedgerCharge {
  id: string;
  type: string | null;
  description: string | null;
  amount: number;
  outstanding: number;
  status: string | null;
  due_date: string | null;
  term: LedgerTerm | null;
  academic_year: string | null;
}

export interface TermBucket {
  term: LedgerTerm;
  billed: number;
  paid: number;
  outstanding: number;
  charges: LedgerCharge[];
}

export interface YearBucket {
  academic_year: string;
  billed: number;
  paid: number;
  outstanding: number;
  terms: TermBucket[];
}

export interface StudentLedger {
  student_id: string;
  tenant_id: string;
  years: YearBucket[];
  totals: { billed: number; paid: number; outstanding: number };
}

export const financeLedgerService = {
  /** A specific student's ledger (staff any student; parent verified child). */
  getStudentLedger: (studentId: string) =>
    apiClient.get<{ success: boolean; data: StudentLedger }>(
      `/api/v1/finance/ledger/student/${studentId}`,
    ),

  /** The calling student's own ledger. */
  getMyLedger: () =>
    apiClient.get<{ success: boolean; data: StudentLedger }>('/api/v1/finance/ledger/me'),

  /** Tenant summary for a year (staff). */
  getTenantSummary: (academicYear: string) =>
    apiClient.get<{ success: boolean; data: { academic_year: string; billed: number; collected: number; outstanding: number } }>(
      `/api/v1/finance/ledger/summary?academic_year=${encodeURIComponent(academicYear)}`,
    ),

  /** Breakdown by term/class/level for a year (staff). */
  getBreakdown: (academicYear: string, by: 'term' | 'class' | 'level') =>
    apiClient.get<{ success: boolean; data: Array<{ key: string; billed: number; collected: number; outstanding: number }> }>(
      `/api/v1/finance/ledger/breakdown?academic_year=${encodeURIComponent(academicYear)}&by=${by}`,
    ),
};

export default financeLedgerService;
