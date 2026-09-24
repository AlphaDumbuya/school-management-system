import { apiClient } from '@lib/apiClient';

export interface FeeStructureExpense { id?: string; label: string; amount: number; required?: boolean; }

export interface FeeStructure {
  id: string;
  classId: string;
  className?: string;
  classLevel?: string;
  academicYear: string;
  term1Tuition: number;
  term2Tuition: number;
  term3Tuition: number;
  minPercentNew?: number | null;
  minPercentContinuing?: number | null;
  minPercentTerm?: number | null;
  allowInstallments: boolean;
  chargesCompulsoryFirstTerm?: boolean;
  lateFeePercent?: number | null;
  policyNotes?: string | null;
  expenses: FeeStructureExpense[];
  expenseTotal?: number;
  fullYearTotal?: number;
  billed?: boolean;
  billedTerms?: string[];
}

export const feeStructureService = {
  list: (academicYear?: string) =>
    apiClient.get<{ success: boolean; data: FeeStructure[] }>(
      `/api/v1/fee-structures${academicYear ? `?academic_year=${encodeURIComponent(academicYear)}` : ''}`,
    ),
  get: (classId: string, academicYear: string) =>
    apiClient.get<{ success: boolean; data: FeeStructure | null }>(
      `/api/v1/fee-structures/${classId}?academic_year=${encodeURIComponent(academicYear)}`,
    ),
  // When editing an existing structure, pass its `id` so the server treats it
  // as an edit rather than blocking a duplicate create (Req 3.3).
  save: (data: Partial<FeeStructure> & { classId: string; academicYear: string }) =>
    apiClient.post<{ success: boolean; data: { id: string } }>('/api/v1/fee-structures', {
      structureId: data.id,
      classId: data.classId,
      academicYear: data.academicYear,
      term1Tuition: data.term1Tuition ?? 0,
      term2Tuition: data.term2Tuition ?? 0,
      term3Tuition: data.term3Tuition ?? 0,
      minPercentNew: data.minPercentNew ?? null,
      minPercentContinuing: data.minPercentContinuing ?? null,
      minPercentTerm: data.minPercentTerm ?? null,
      allowInstallments: data.allowInstallments !== false,
      chargesCompulsoryFirstTerm: data.chargesCompulsoryFirstTerm === true,
      lateFeePercent: data.lateFeePercent ?? null,
      policyNotes: data.policyNotes ?? null,
      expenses: data.expenses ?? [],
    }),
  remove: (structureId: string) =>
    apiClient.delete<{ success: boolean }>(`/api/v1/fee-structures/${structureId}`),
  /** Bill a single term (1|2|3) or the whole year ('year'). */
  billTerm: (structureId: string, term: 1 | 2 | 3 | 'year', dueDate?: string) =>
    apiClient.post<{ success: boolean; data: { billed: number; term: string }; error?: string }>(
      `/api/v1/fee-structures/${structureId}/bill`,
      { term, dueDate },
    ),
  /** Remove UNPAID charges for a structure — optionally scoped to one term. */
  unbill: (structureId: string, term?: 1 | 2 | 3) =>
    apiClient.post<{ success: boolean; data: { removed: number; term: string }; error?: string }>(
      `/api/v1/fee-structures/${structureId}/unbill`,
      { term },
    ),
  billingStatus: (structureId: string) =>
    apiClient.get<{ success: boolean; data: { billed: boolean; total: number; byTerm: Record<string, number> } }>(
      `/api/v1/fee-structures/${structureId}/billing-status`,
    ),
};

export default feeStructureService;
