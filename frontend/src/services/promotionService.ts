/**
 * Promotions API Service — wraps /api/v1/promotions
 */

import { apiClient } from '@lib/apiClient';

export type PromotionOutcome = 'promoted' | 'promoted_effort' | 'repeated' | 'graduated';

export interface PromotionCandidate {
  student_id: string;
  student_name: string;
  student_reg_id: string | null;
  combined_score: number | null;
  percentage: number | null;
  position: number | null;
  class_size: number;
  outcome: PromotionOutcome | null;
  recommendation: string | null;
  already_promoted: boolean;
}

export interface PromotionDecision {
  student_id: string;
  outcome: PromotionOutcome;
  to_class_id?: string | null;
  percentage?: number | null;
  position?: number | null;
  notes?: string;
}

export interface PromotionHistoryRow {
  id: string;
  student_id: string;
  student_name: string;
  student_reg_id: string | null;
  from_class_name: string | null;
  to_class_name: string | null;
  academic_year: string;
  outcome: PromotionOutcome;
  yearly_percentage: number | null;
  yearly_position: number | null;
  source: 'manual' | 'auto';
  created_at: string;
}

export const promotionService = {
  getCandidates: (classId: string, academicYear: string) =>
    apiClient.get<{ class_size: number; candidates: PromotionCandidate[] }>(
      '/api/v1/promotions/candidates',
      { params: { class_id: classId, academic_year: academicYear } },
    ),

  execute: (data: {
    from_class_id: string;
    academic_year: string;
    to_class_id?: string | null;
    graduate?: boolean;
    decisions: PromotionDecision[];
  }) => apiClient.post('/api/v1/promotions/execute', data),

  getHistory: (params?: { class_id?: string; academic_year?: string }) =>
    apiClient.get<PromotionHistoryRow[]>('/api/v1/promotions/history', { params }),
};

export default promotionService;
