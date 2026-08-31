import { apiClient } from '@lib/apiClient';

export interface FeeStructureExpense { id?: string; label: string; amount: number; }

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
  lateFeePercent?: number | null;
  policyNotes?: string | null;
  expenses: FeeStructureExpense[];
  expenseTotal?: number;
  fullYearTotal?: number;
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
  save: (data: Partial<FeeStructure> & { classId: string; academicYear: string }) =>
    apiClient.post<{ success: boolean; data: { id: string } }>('/api/v1/fee-structures', {
      classId: data.classId,
      academicYear: data.academicYear,
      term1Tuition: data.term1Tuition ?? 0,
      term2Tuition: data.term2Tuition ?? 0,
      term3Tuition: data.term3Tuition ?? 0,
      minPercentNew: data.minPercentNew ?? null,
      minPercentContinuing: data.minPercentContinuing ?? null,
      minPercentTerm: data.minPercentTerm ?? null,
      allowInstallments: data.allowInstallments !== false,
      lateFeePercent: data.lateFeePercent ?? null,
      policyNotes: data.policyNotes ?? null,
      expenses: data.expenses ?? [],
    }),
  billTerm: (structureId: string, term: 1 | 2 | 3, dueDate?: string) =>
    apiClient.post<{ success: boolean; data: { billed: number; term: string } }>(
      `/api/v1/fee-structures/${structureId}/bill`,
      { term, dueDate },
    ),
};

export default feeStructureService;
