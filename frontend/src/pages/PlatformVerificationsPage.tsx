/**
 * PlatformVerificationsPage — /platform/verifications (super admin).
 * School verification submissions waiting for WiSkul's review, plus the ones
 * already verified or rejected. A row opens the review drawer with the full
 * details and the Approve / Reject / Revoke actions.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Modal } from '@components/admin/feedback/Modal';
import {
  VerificationReview,
  VerificationStatusChip,
  NameMatchChip,
  EmisConflictFlag,
  fmtVerificationDate,
} from '@components/platform/VerificationReview';
import { ID_TYPE_LABEL } from '@services/verificationService';
import platformVerificationService, {
  verificationKeys,
  type VerificationFilter,
  type VerificationRow,
} from '@services/platformVerificationService';
import { pollWhileActive } from '@lib/activity';

const TABS: { key: VerificationFilter; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'verified', label: 'Verified' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

const shortDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const PlatformVerificationsPage: React.FC = () => {
  const [tab, setTab] = useState<VerificationFilter>('pending');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [openRow, setOpenRow] = useState<VerificationRow | null>(null);
  // While a confirm dialog is open inside the drawer, Escape closes only that dialog.
  const innerDialogOpen = useRef(false);
  const onDialogChange = useCallback((open: boolean) => { innerDialogOpen.current = open; }, []);

  // Search after a short pause in typing.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: verificationKeys.list(tab, search),
    queryFn: () => platformVerificationService.list(tab, search),
    staleTime: 15_000,
  });
  const { data: countRes } = useQuery({
    queryKey: verificationKeys.count,
    queryFn: () => platformVerificationService.count(),
    refetchInterval: pollWhileActive(120_000),
    staleTime: 30_000,
  });
  const pending = countRes?.success ? countRes.data?.pending ?? 0 : 0;
  const rows: VerificationRow[] = data?.success && Array.isArray(data.data) ? data.data : [];
  const loadError = data && !data.success ? data.error || 'Could not load verifications.' : null;

  // The "Review verification" button in the team email links here with ?tenant=<id>:
  // open that school's review straight away (its name fills in from the list when loaded).
  const [params, setParams] = useSearchParams();
  const linkedTenant = params.get('tenant');
  useEffect(() => {
    if (!linkedTenant || !/^[0-9a-f-]{36}$/i.test(linkedTenant)) return;
    const known = rows.find((r) => r.tenant_id === linkedTenant);
    setOpenRow((cur) => (cur?.tenant_id === linkedTenant && cur.school_name !== 'School' ? cur
      : known || ({ tenant_id: linkedTenant, school_name: 'School' } as VerificationRow)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedTenant, rows]);

  const closeDrawer = () => {
    if (innerDialogOpen.current) return;
    setOpenRow(null);
    if (linkedTenant) {
      const next = new URLSearchParams(params);
      next.delete('tenant');
      setParams(next, { replace: true });
    }
  };

  const tabId = (k: string) => `vtab-${k}`;

  return (
    <MainLayout>
      <PageShell
        title="School Verifications"
        subtitle="Review the details school owners submit, then approve or reject them"
        breadcrumbs={[{ label: 'Platform', href: '/platform/dashboard' }, { label: 'Verifications' }]}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
      >
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Verification status">
            {TABS.map((t) => (
              <button
                key={t.key}
                id={tabId(t.key)}
                role="tab"
                aria-selected={tab === t.key}
                aria-controls="vpanel"
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${tab === t.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}
              >
                {t.label}
                {t.key === 'pending' && pending > 0 && (
                  <span className={`px-1.5 rounded-full text-[10px] font-bold ${tab === t.key ? 'bg-white/25 text-white' : 'bg-red-600 text-white'}`}>{pending}</span>
                )}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search school, owner, email or EMIS code"
              aria-label="Search verifications"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-9 pr-3 py-2 text-sm"
            />
          </div>
        </div>

        <div id="vpanel" role="tabpanel" aria-labelledby={tabId(tab)} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <div className="hidden lg:grid grid-cols-[1.5fr_1.5fr_1.1fr_1.2fr_1fr_1fr_110px] gap-3 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-700">
            <span>School</span><span>Owner</span><span>EMIS</span><span>Level · district</span><span>ID</span><span>Dates</span><span>Status</span>
          </div>

          {isLoading ? (
            <div className="p-10 text-center text-gray-500" role="status" aria-label="Loading verifications">
              <Loader2 className="mx-auto animate-spin" />
            </div>
          ) : loadError ? (
            <div className="p-10 text-center text-sm text-red-600" role="alert">{loadError}</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500" role="status">
              {search ? 'No schools match your search.' : tab === 'pending' ? 'Nothing waiting for review.' : 'No schools in this list yet.'}
            </div>
          ) : (
            <ul>
              {rows.map((r) => (
                <li key={r.tenant_id} className="border-b last:border-b-0 border-gray-100 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setOpenRow(r)}
                    aria-label={`Review ${r.school_name}`}
                    className="w-full text-left grid grid-cols-1 lg:grid-cols-[1.5fr_1.5fr_1.1fr_1.2fr_1fr_1fr_110px] gap-x-3 gap-y-1.5 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                  >
                    <span className="min-w-0 flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block font-semibold text-gray-900 dark:text-white truncate">{r.school_name}</span>
                        {r.tenant_status && r.tenant_status !== 'active' && <span className="block text-[11px] text-gray-500">School {r.tenant_status}</span>}
                      </span>
                      <span className="lg:hidden shrink-0"><VerificationStatusChip status={r.status} /></span>
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm text-gray-800 dark:text-gray-200 truncate">{r.owner_name || '—'}</span>
                      <span className="block text-xs text-gray-500 truncate">{r.owner_email || ''}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-mono text-gray-800 dark:text-gray-200 truncate">
                        <span className="lg:hidden font-sans text-xs text-gray-500">EMIS </span>{r.emis_code || '—'}
                      </span>
                      {r.emis_conflict && <span className="block mt-1"><EmisConflictFlag /></span>}
                    </span>
                    <span className="min-w-0 text-xs text-gray-600 dark:text-gray-300">
                      <span className="block truncate">{r.school_level || '—'}</span>
                      <span className="block truncate text-gray-500">{r.district || ''}</span>
                    </span>
                    <span className="min-w-0 text-xs text-gray-600 dark:text-gray-300 flex flex-wrap lg:flex-col lg:items-start gap-1">
                      <span>{r.id_type ? ID_TYPE_LABEL[r.id_type] || r.id_type : 'ID'}{r.id_last4 ? ` ending ${r.id_last4}` : ''}</span>
                      <NameMatchChip match={r.name_match} />
                    </span>
                    <span className="min-w-0 text-[11px] text-gray-500">
                      <span className="block" title={fmtVerificationDate(r.submitted_at)}>Submitted {shortDate(r.submitted_at)}</span>
                      {r.reviewed_at && (
                        <span className="block" title={fmtVerificationDate(r.reviewed_at)}>
                          Reviewed {shortDate(r.reviewed_at)}{r.reviewed_by_name ? ` · ${r.reviewed_by_name}` : ''}
                        </span>
                      )}
                    </span>
                    <span className="hidden lg:block"><VerificationStatusChip status={r.status} /></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {!isLoading && !loadError && rows.length > 0 && (
          <p className="mt-3 text-xs text-gray-500" role="status">{rows.length} {rows.length === 1 ? 'school' : 'schools'}</p>
        )}
      </PageShell>

      <Modal isOpen={!!openRow} onClose={closeDrawer} title={openRow ? `Review: ${openRow.school_name}` : 'Review'} size="lg">
        {openRow && (
          <VerificationReview
            tenantId={openRow.tenant_id}
            showTenantLink
            onDialogChange={onDialogChange}
            onChanged={() => { innerDialogOpen.current = false; closeDrawer(); }}
          />
        )}
      </Modal>
    </MainLayout>
  );
};

export default PlatformVerificationsPage;
