/**
 * IdCardsPage — /identity/cards
 * Production-ready ID card management following admin page pattern.
 * KPIs, search, filters, grid/table toggle, row actions, CRUD modals.
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import {
  CreditCard, Users, AlertTriangle, CheckCircle, XCircle, Plus, Download,
  RefreshCw, Search, X, ChevronDown, SlidersHorizontal, Eye, Edit, Ban,
  RotateCcw, LayoutGrid, List, Calendar,
} from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { DataTable } from '@components/admin/table/DataTable';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { idCardService, IdCard, CardStatus } from '@services/idCardService';
import { CardGenerationModal } from './components/CardGenerationModal';
import { CardDetailsModal } from './components/CardDetailsModal';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

function isCardExpiringSoon(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt);
  const now = new Date();
  const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
}

function statusLabel(s: CardStatus): string {
  switch (s) {
    case 'active': return 'Active';
    case 'expired': return 'Expired';
    case 'lost': return 'Lost';
    case 'revoked': return 'Revoked';
    case 'suspended': return 'Suspended';
    default: return s;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export const IdCardsPage: React.FC = () => {
  const queryClient = useQueryClient();

  // View & filter state
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CardStatus | ''>('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  // Modal state
  const [generationModalOpen, setGenerationModalOpen] = useState(false);
  const [detailsModal, setDetailsModal] = useState<{ open: boolean; cardId: string | null }>({ open: false, cardId: null });
  const [revokeTarget, setRevokeTarget] = useState<IdCard | null>(null);
  const [regenerateTarget, setRegenerateTarget] = useState<IdCard | null>(null);

  // ── Fetch Cards ─────────────────────────────────────────────────────────────
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['id-cards', { search, statusFilter, page, pageSize }],
    queryFn: () => idCardService.listCards({
      page,
      limit: pageSize,
      status: statusFilter || undefined,
      search: search || undefined,
    }),
    staleTime: 30_000,
  });

  // Handle both response patterns
  const cards: IdCard[] = (data as any)?.data?.data ?? (data as any)?.data ?? [];
  const pagination = (data as any)?.data?.pagination ?? (data as any)?.pagination ?? { total: 0, total_pages: 1 };

  // ── Fetch Stats ─────────────────────────────────────────────────────────────
  const { data: statsData } = useQuery({
    queryKey: ['id-cards-stats'],
    queryFn: () => idCardService.getDashboardStats(),
    staleTime: 60_000,
  });

  const stats = (statsData as any)?.data ?? (statsData as any) ?? {
    totalActive: 0,
    totalExpired: 0,
    totalRevoked: 0,
    totalLost: 0,
    expiringSoon: 0,
  };

  // ── Action Handlers ─────────────────────────────────────────────────────────
  const handleRevoke = async () => {
    if (!revokeTarget) return;
    const res = await idCardService.revokeCard(revokeTarget.id, 'Revoked by administrator');
    if ((res as any).success !== false) {
      showToast.success('Card revoked successfully');
      queryClient.invalidateQueries({ queryKey: ['id-cards'] });
      queryClient.invalidateQueries({ queryKey: ['id-cards-stats'] });
    } else {
      showToast.apiError((res as any).error);
    }
    setRevokeTarget(null);
  };

  const handleRegenerate = async () => {
    if (!regenerateTarget) return;
    const res = await idCardService.regenerateCard(regenerateTarget.id);
    if ((res as any).success !== false) {
      showToast.success('Card regenerated successfully');
      queryClient.invalidateQueries({ queryKey: ['id-cards'] });
    } else {
      showToast.apiError((res as any).error);
    }
    setRegenerateTarget(null);
  };

  // ── Table Columns ───────────────────────────────────────────────────────────
  const columns: ColumnDef<IdCard, any>[] = [
    {
      id: 'cardNumber',
      accessorKey: 'cardNumber',
      header: 'Card Number',
      cell: ({ row }) => (
        <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">{row.original.cardNumber}</span>
      ),
    },
    {
      id: 'user',
      header: 'User',
      cell: ({ row }) => {
        const user = row.original.user;
        return user ? (
          <div className="min-w-[150px]">
            <p className="font-medium text-gray-900 dark:text-white">{user.firstName} {user.lastName}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{user.email}</p>
          </div>
        ) : <span className="text-gray-400 dark:text-gray-500">—</span>;
      },
    },
    {
      id: 'role',
      header: 'Role',
      cell: ({ row }) => {
        const role = row.original.user?.role;
        return role ? (
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 capitalize">
            {role}
          </span>
        ) : <span className="text-gray-400 dark:text-gray-500">—</span>;
      },
    },
    {
      id: 'format',
      accessorKey: 'format',
      header: 'Format',
      cell: ({ row }) => (
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">{row.original.format}</span>
      ),
    },
    {
      id: 'issuedAt',
      header: 'Issued',
      cell: ({ row }) => (
        <span className="text-xs text-gray-600 dark:text-gray-400">{formatDate(row.original.issuedAt)}</span>
      ),
    },
    {
      id: 'expiresAt',
      header: 'Expires',
      cell: ({ row }) => {
        const expiring = isCardExpiringSoon(row.original.expiresAt);
        return (
          <div className="flex items-center gap-1">
            {expiring && <AlertTriangle size={13} className="text-amber-500" />}
            <span className={`text-xs ${expiring ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-gray-600 dark:text-gray-400'}`}>
              {formatDate(row.original.expiresAt)}
            </span>
          </div>
        );
      },
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} showDot />,
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <MainLayout>
      <PageShell
        title="ID Card Management"
        subtitle="Generate, manage, and track identity cards for students and staff"
        breadcrumbs={[{ label: 'Identity' }, { label: 'ID Cards' }]}
        actions={
          <div className="flex items-center gap-2 sm:gap-3">
            {/* View Toggle */}
            <div className="flex items-center border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-gray-100 dark:bg-gray-700 text-primary-600 dark:text-primary-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                title="Grid View"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-md transition-all ${viewMode === 'table' ? 'bg-gray-100 dark:bg-gray-700 text-primary-600 dark:text-primary-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                title="Table View"
              >
                <List size={18} />
              </button>
            </div>

            <RoleGuard roles={['principal', 'super_admin', 'admissions_officer']}>
              <Button variant="default" size="sm" onClick={() => setGenerationModalOpen(true)} className="whitespace-nowrap shadow-sm hover:shadow">
                <Plus size={16} className="mr-1" /> Generate Card
              </Button>
            </RoleGuard>
          </div>
        }
      >
        {/* KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6 mb-8">
          {isLoading && !data ? (
            <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
          ) : (
            <>
              <KPICard title="Active Cards" value={Number(stats.totalActive ?? 0)} icon={<div className="p-2 rounded-xl bg-green-500 text-white shadow-sm flex items-center justify-center"><CheckCircle size={20} /></div>} color="green" />
              <KPICard title="Expired" value={Number(stats.totalExpired ?? 0)} icon={<div className="p-2 rounded-xl bg-gray-500 text-white shadow-sm flex items-center justify-center"><XCircle size={20} /></div>} color="gray" />
              <KPICard title="Revoked" value={Number(stats.totalRevoked ?? 0)} icon={<div className="p-2 rounded-xl bg-red-500 text-white shadow-sm flex items-center justify-center"><Ban size={20} /></div>} color="red" />
              <KPICard title="Lost / Reported" value={Number(stats.totalLost ?? 0)} icon={<div className="p-2 rounded-xl bg-amber-500 text-white shadow-sm flex items-center justify-center"><AlertTriangle size={20} /></div>} color="amber" />
              <KPICard title="Expiring Soon" value={Number(stats.expiringSoon ?? 0)} icon={<div className="p-2 rounded-xl bg-blue-500 text-white shadow-sm flex items-center justify-center"><CreditCard size={20} /></div>} color="blue" />
            </>
          )}
        </div>

        {/* ── Search & Filter Bar ── */}
        <div className="flex flex-col gap-3 sm:gap-4 mb-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search */}
            <div className="relative w-full lg:max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search card number, name, or email..."
                className="w-full pl-9 pr-8 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
              {search && (
                <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Clear search">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Dropdown */}
            <div className="flex items-center gap-2 sm:gap-2.5 w-full lg:w-auto">
              <div className="relative flex-1 sm:flex-initial sm:min-w-[150px]">
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value as CardStatus | ''); setPage(1); }}
                  className="w-full appearance-none pl-3 pr-8 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="lost">Lost</option>
                  <option value="revoked">Revoked</option>
                  <option value="suspended">Suspended</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
              </div>
            </div>
          </div>

          {/* Active Filter Badges */}
          {(search || statusFilter) && (
            <div className="flex flex-wrap items-center gap-2 pt-1 mt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-450 dark:text-gray-500 flex items-center gap-1 mr-1">
                <SlidersHorizontal size={10} /> Active Filters:
              </span>
              {search && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-400 text-xs font-semibold border border-primary-200/30">
                  "{search}" <button onClick={() => { setSearch(''); setPage(1); }} className="hover:text-primary-900 dark:hover:text-primary-200"><X size={12} /></button>
                </span>
              )}
              {statusFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 text-xs font-semibold border border-blue-200/30 capitalize">
                  {statusLabel(statusFilter)} <button onClick={() => { setStatusFilter(''); setPage(1); }} className="hover:text-blue-900 dark:hover:text-blue-200"><X size={12} /></button>
                </span>
              )}
              <button onClick={() => { setSearch(''); setStatusFilter(''); setPage(1); }} className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 font-bold ml-auto transition-colors">
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* ── Content: Grid or Table ── */}
        {viewMode === 'grid' ? (
          isLoading && !data ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
          ) : cards.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <CreditCard size={48} className="text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">No ID cards found</p>
              <p className="text-sm text-gray-500 mt-1 mb-4">Try adjusting your filters or generate a new card.</p>
              <RoleGuard roles={['principal', 'super_admin', 'admissions_officer']}>
                <Button onClick={() => setGenerationModalOpen(true)}>Generate First Card</Button>
              </RoleGuard>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {cards.map((card) => {
                const user = card.user;
                const expiring = isCardExpiringSoon(card.expiresAt);

                return (
                  <div
                    key={card.id}
                    className="group relative overflow-hidden bg-white dark:bg-gray-800 border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1"
                  >
                    {/* Expiring badge */}
                    {expiring && (
                      <div className="absolute top-3 right-3">
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30 flex items-center gap-1">
                          <AlertTriangle size={10} /> Expiring
                        </span>
                      </div>
                    )}

                    {/* Header: Card number + status */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">{card.cardNumber}</span>
                        <span className="ml-2 text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">{card.format}</span>
                      </div>
                      {!expiring && <StatusBadge status={card.status} showDot />}
                    </div>

                    {/* User info */}
                    {user && (
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{user.firstName} {user.lastName}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">{user.email}</p>
                        <span className="inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200/30 dark:border-blue-800/30 capitalize">
                          {user.role}
                        </span>
                      </div>
                    )}

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-3 text-xs border-t border-gray-100 dark:border-gray-700/50 pt-3 mb-3">
                      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                        <Calendar size={12} className="text-green-500/80 flex-shrink-0" />
                        <span>Issued: {formatDate(card.issuedAt)}</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${expiring ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-gray-600 dark:text-gray-400'}`}>
                        <Calendar size={12} className={`flex-shrink-0 ${expiring ? 'text-amber-500' : 'text-red-500/80'}`} />
                        <span>Exp: {formatDate(card.expiresAt)}</span>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center justify-end gap-2 border-t border-gray-100 dark:border-gray-700/50 pt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetailsModal({ open: true, cardId: card.id })}
                        className="h-8 text-xs font-bold px-2.5 rounded-lg text-primary hover:text-primary dark:text-primary hover:bg-primary-50 dark:hover:bg-primary-950/20"
                      >
                        <Eye size={14} className="mr-1" /> View
                      </Button>
                      <RoleGuard roles={['principal', 'super_admin', 'admissions_officer']}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRegenerateTarget(card)}
                          className="h-8 p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Regenerate"
                        >
                          <RotateCcw size={15} />
                        </Button>
                        {card.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRevokeTarget(card)}
                            className="h-8 p-1.5 rounded-lg text-red-500 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
                            title="Revoke"
                          >
                            <Ban size={15} />
                          </Button>
                        )}
                      </RoleGuard>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <DataTable
            columns={columns}
            data={cards}
            isLoading={isLoading}
            error={error ? String(error) : null}
            onRetry={refetch}
            paginationMode="server"
            pageIndex={page}
            pageSize={pageSize}
            totalRows={Number(pagination.total ?? 0)}
            onPageChange={setPage}
            emptyMessage="No ID cards found"
            emptyAction={{ label: 'Generate First Card', onClick: () => setGenerationModalOpen(true) }}
            rowActions={(card) => [
              {
                label: 'View Details',
                onClick: (row) => setDetailsModal({ open: true, cardId: row.id }),
              },
              {
                label: 'Download PDF',
                onClick: (row) => {
                  if (row.pdfUrl) window.open(row.pdfUrl, '_blank');
                  else showToast.error('PDF not available');
                },
              },
              {
                label: 'Regenerate',
                onClick: (row) => setRegenerateTarget(row),
              },
              ...(card.status === 'active' ? [{
                label: 'Revoke',
                variant: 'destructive' as const,
                onClick: (row: IdCard) => setRevokeTarget(row),
              }] : []),
            ]}
          />
        )}
      </PageShell>

      {/* ── Modals ── */}
      <CardGenerationModal
        isOpen={generationModalOpen}
        onClose={() => setGenerationModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['id-cards'] });
          queryClient.invalidateQueries({ queryKey: ['id-cards-stats'] });
        }}
      />

      <CardDetailsModal
        isOpen={detailsModal.open}
        onClose={() => setDetailsModal({ open: false, cardId: null })}
        cardId={detailsModal.cardId}
      />

      <ConfirmationDialog
        isOpen={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
        title="Revoke ID Card"
        message={`Are you sure you want to revoke card "${revokeTarget?.cardNumber}"? The card holder will no longer be able to use this card for identification.`}
        confirmLabel="Revoke Card"
      />

      <ConfirmationDialog
        isOpen={!!regenerateTarget}
        onClose={() => setRegenerateTarget(null)}
        onConfirm={handleRegenerate}
        title="Regenerate ID Card"
        message={`Regenerate card "${regenerateTarget?.cardNumber}"? A new PDF will be generated with the latest user information.`}
        confirmLabel="Regenerate"
        isDestructive={false}
      />
    </MainLayout>
  );
};

export default IdCardsPage;
