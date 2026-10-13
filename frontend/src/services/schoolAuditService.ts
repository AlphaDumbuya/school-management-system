import { apiClient } from '@lib/apiClient';
import { downloadFile } from '@services/bursarService';

export interface AuditRow {
  id: string;
  at: string;
  actor: { id: string | null; name: string | null; role: string | null };
  category: string;
  summary: string;
  action: string;
  entityType: string;
  entityId: string | null;
  reason: string | null;
  source: string | null;
  before: unknown;
  after: unknown;
  /** Owner only. */
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditList {
  total: number;
  page: number;
  size: number;
  rows: AuditRow[];
  categories: string[];
  people: Array<{ id: string; name: string | null; role: string | null }>;
  canSeeAddresses: boolean;
  /** The academic year the list is limited to (null = all years). */
  academicYear: { id: string; name: string; start: string; end: string } | null;
  academicYearUnknown: boolean;
  /** This school's academic years, newest first. */
  sessions: Array<{ id: string; name: string; start: string; end: string; isActive: boolean }>;
  /** Activity per month inside the chosen year, newest first ('YYYY-MM'). */
  months: Array<{ month: string; count: number }>;
}

export interface AuditSummary {
  changesLast30Days: number;
  failedSignInsLast7Days: number;
  activePeopleLast7Days: number;
  latestAt: string | null;
}

export interface AuditFilters {
  /** A session id, 'all', or empty for the school's current academic year. */
  academicYear?: string;
  /** 'YYYY-MM' */
  month?: string;
  category?: string;
  person?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  size?: number;
}

const qs = (f: AuditFilters) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== '' && v !== null) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const schoolAuditService = {
  list: (f: AuditFilters) => apiClient.get<AuditList>(`/api/v1/school-audit${qs(f)}`),
  summary: () => apiClient.get<AuditSummary>('/api/v1/school-audit/summary'),
  /** Download the filtered log as a spreadsheet (page and size are ignored). */
  exportCsv: (f: AuditFilters) => {
    const { page: _p, size: _s, ...rest } = f;
    return downloadFile(`/api/v1/school-audit/export.csv${qs(rest)}`, `audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
  },
};

export default schoolAuditService;
