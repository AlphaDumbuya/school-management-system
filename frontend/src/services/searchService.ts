/**
 * searchService: the records half of the header search (students, staff,
 * parents, classes, finance, announcements...). One request; the server only
 * returns what the signed-in role may see. See backend/src/services/globalSearchService.ts.
 */
import apiClient from '@lib/apiClient';

export type SearchType =
  | 'student' | 'staff' | 'support_staff' | 'guardian' | 'class' | 'subject' | 'admission'
  | 'invoice' | 'receipt' | 'announcement' | 'event' | 'assignment' | 'tenant';

export interface SearchItem {
  type: SearchType;
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  photo?: string | null;
  score: number;
  extra?: Record<string, any>;
}

export interface SearchSection {
  type: SearchType;
  label: string;
  items: SearchItem[];
}

export interface SearchResponse {
  query: string;
  sections: SearchSection[];
  top: SearchItem | null;
  tookMs: number;
}

export const searchService = {
  async search(query: string, signal?: AbortSignal, limit = 5): Promise<SearchResponse> {
    const res: any = await apiClient.get('/api/v1/search', { params: { q: query, limit }, signal });
    const data = res?.data ?? res;
    return {
      query: data?.query ?? query,
      sections: Array.isArray(data?.sections) ? data.sections : [],
      top: data?.top ?? null,
      tookMs: Number(data?.tookMs ?? 0),
    };
  },
};

export default searchService;
