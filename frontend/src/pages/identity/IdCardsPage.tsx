/**
 * ID Cards Management Page
 * Main page for managing identity cards
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import {
    CreditCard,
    Users,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Plus,
    Download,
    RefreshCw,
    Search,
    X,
    ChevronDown,
    Eye,
    Edit,
    Ban,
    RotateCcw,
} from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { DataTable } from '@components/admin/table/DataTable';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { idCardService, IdCard, CardStatus } from '@services/idCardService';
import { CardGenerationModal } from './components/CardGenerationModal';
import { CardDetailsModal } from './components/CardDetailsModal';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';

// ── Utility Functions ─────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return '—';
    }
}

function getStatusVariant(status: CardStatus): 'active' | 'inactive' | 'pending' | 'suspended' {
    const map: Record<CardStatus, 'active' | 'inactive' | 'pending' | 'suspended'> = {
        active: 'active',
        expired: 'inactive',
        lost: 'pending',
        revoked: 'inactive',
        suspended: 'suspended',
    };
    return map[status] || 'inactive';
}

function isCardExpiringSoon(expiresAt: string): boolean {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const IdCardsPage: React.FC = () => {
    const queryClient = useQueryClient();

    // Filter state
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<CardStatus | ''>('');
    const [page, setPage] = useState(1);
    const [pageSize] = useState(25);

    // Modal state
    const [generationModalOpen, setGenerationModalOpen] = useState(false);
    const [detailsModal, setDetailsModal] = useState<{ open: boolean; cardId: string | null }>({
        open: false,
        cardId: null,
    });
    const [revokeTarget, setRevokeTarget] = useState<IdCard | null>(null);
    const [regenerateTarget, setRegenerateTarget] = useState<IdCard | null>(null);

    // Fetch cards
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['id-cards', { search, statusFilter, page, pageSize }],
        queryFn: () =>
            idCardService.listCards({
                page,
                limit: pageSize,
                status: statusFilter || undefined,
                search: search || undefined,
            }),
        staleTime: 30_000,
    });

    const cards: IdCard[] = (data?.data as any)?.data ?? [];
    const pagination = (data?.data as any)?.pagination ?? { total: 0, total_pages: 1 };

    // Fetch dashboard stats
    const { data: statsData } = useQuery({
        queryKey: ['id-cards-stats'],
        queryFn: () => idCardService.getDashboardStats(),
        staleTime: 60_000,
    });

    const stats = statsData?.data ?? {
        totalActive: 0,
        totalExpired: 0,
        totalRevoked: 0,
        totalLost: 0,
        expiringSoon: 0,
    };

    // Handle revoke
    const handleRevoke = async () => {
        if (!revokeTarget) return;
        const reason = prompt('Enter reason for revocation:');
        if (!reason) return;

        const res = await idCardService.revokeCard(revokeTarget.id, reason);
        if (res.success !== false) {
            showToast.success('Card revoked successfully');
            queryClient.invalidateQueries({ queryKey: ['id-cards'] });
            queryClient.invalidateQueries({ queryKey: ['id-cards-stats'] });
        } else {
            showToast.apiError(res.error);
        }
        setRevokeTarget(null);
    };

    // Handle regenerate
    const handleRegenerate = async () => {
        if (!regenerateTarget) return;

        const res = await idCardService.regenerateCard(regenerateTarget.id);
        if (res.success !== false) {
            showToast.success('Card regenerated successfully');
            queryClient.invalidateQueries({ queryKey: ['id-cards'] });
        } else {
            showToast.apiError(res.error);
        }
        setRegenerateTarget(null);
    };

    // Column definitions
    const columns: ColumnDef<IdCard, any>[] = [
        {
            id: 'cardNumber',
            accessorKey: 'cardNumber',
            header: 'Card Number',
            cell: ({ row }) => (
                <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                    {row.original.cardNumber}
                </span>
            ),
        },
        {
            id: 'user',
            header: 'User',
            cell: ({ row }) => {
                const user = row.original.user;
                return user ? (
                    <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                            {user.firstName} {user.lastName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                    </div>
                ) : (
                    <span className="text-gray-400 dark:text-gray-500">—</span>
                );
            },
        },
        {
            id: 'role',
            header: 'Role',
            cell: ({ row }) => {
                const role = row.original.user?.role;
                return role ? (
                    <span className="text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2.5 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 capitalize">
                        {role}
                    </span>
                ) : (
                    <span className="text-gray-400 dark:text-gray-500">—</span>
                );
            },
        },
        {
            id: 'format',
            accessorKey: 'format',
            header: 'Format',
            cell: ({ row }) => (
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                    {row.original.format}
                </span>
            ),
        },
        {
            id: 'issuedAt',
            accessorKey: 'issuedAt',
            header: 'Issued',
            cell: ({ row }) => (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                    {formatDate(row.original.issuedAt)}
                </span>
            ),
        },
        {
            id: 'expiresAt',
            accessorKey: 'expiresAt',
            header: 'Expires',
            cell: ({ row }) => {
                const expiring = isCardExpiringSoon(row.original.expiresAt);
                return (
                    <div className="flex items-center gap-1">
                        {expiring && (
                            <AlertTriangle size={14} className="text-amber-500 dark:text-amber-400" />
                        )}
                        <span
                            className={`text-sm ${expiring
                                    ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                    : 'text-gray-600 dark:text-gray-400'
                                }`}
                        >
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
            cell: ({ row }) => (
                <StatusBadge status={getStatusVariant(row.original.status)} showDot />
            ),
        },
    ];

    return (
        <MainLayout>
            <PageShell
                title="ID Card Management"
                subtitle="Generate, manage, and track identity cards for users"
                breadcrumbs={[{ label: 'Identity' }, { label: 'ID Cards' }]}
                actions={
                    <div className="flex items-center gap-2 sm:gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetch()}
                            disabled={isLoading}
                            className="flex items-center gap-1.5"
                        >
                            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                            <span className="hidden sm:inline">Refresh</span>
                        </Button>
                        <RoleGuard roles={['principal', 'admissions_officer']}>
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => setGenerationModalOpen(true)}
                                className="flex items-center gap-1.5 shadow-sm hover:shadow"
                            >
                                <Plus size={16} />
                                <span>Generate Card</span>
                            </Button>
                        </RoleGuard>
                    </div>
                }
            >
                {/* KPI Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 mb-8">
                    {isLoading && !data ? (
                        <>
                            <SkeletonCard />
                            <SkeletonCard />
                            <SkeletonCard />
                            <SkeletonCard />
                            <SkeletonCard />
                        </>
                    ) : (
                        <>
                            <KPICard
                                title="Active Cards"
                                value={stats.totalActive}
                                icon={
                                    <div className="p-2 rounded-xl bg-green-500 text-white shadow-sm flex items-center justify-center">
                                        <CheckCircle size={20} />
                                    </div>
                                }
                                color="green"
                            />
                            <KPICard
                                title="Expired"
                                value={stats.totalExpired}
                                icon={
                                    <div className="p-2 rounded-xl bg-gray-500 text-white shadow-sm flex items-center justify-center">
                                        <XCircle size={20} />
                                    </div>
                                }
                                color="gray"
                            />
                            <KPICard
                                title="Revoked"
                                value={stats.totalRevoked}
                                icon={
                                    <div className="p-2 rounded-xl bg-red-500 text-white shadow-sm flex items-center justify-center">
                                        <Ban size={20} />
                                    </div>
                                }
                                color="red"
                            />
                            <KPICard
                                title="Lost/Reported"
                                value={stats.totalLost}
                                icon={
                                    <div className="p-2 rounded-xl bg-amber-500 text-white shadow-sm flex items-center justify-center">
                                        <AlertTriangle size={20} />
                                    </div>
                                }
                                color="amber"
                            />
                            <KPICard
                                title="Expiring Soon"
                                value={stats.expiringSoon}
                                icon={
                                    <div className="p-2 rounded-xl bg-blue-500 text-white shadow-sm flex items-center justify-center">
                                        <CreditCard size={20} />
                                    </div>
                                }
                                color="blue"
                            />
                        </>
                    )}
                </div>

                {/* Search & Filter Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
                    {/* Search Input */}
                    <div className="relative flex-1 max-w-full md:max-w-md">
                        <Search
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-550 pointer-events-none"
                        />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by card number, user name, or email..."
                            className="w-full pl-9 pr-8 py-2 bg-transparent dark:bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                title="Clear search"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                        <div className="relative flex-1 sm:flex-initial sm:w-44">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as CardStatus | '')}
                                className="w-full appearance-none pl-3 pr-8 py-2 bg-transparent dark:bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all"
                            >
                                <option value="">All Statuses</option>
                                <option value="active" className="bg-white dark:bg-gray-800">
                                    Active
                                </option>
                                <option value="expired" className="bg-white dark:bg-gray-800">
                                    Expired
                                </option>
                                <option value="lost" className="bg-white dark:bg-gray-800">
                                    Lost
                                </option>
                                <option value="revoked" className="bg-white dark:bg-gray-800">
                                    Revoked
                                </option>
                                <option value="suspended" className="bg-white dark:bg-gray-800">
                                    Suspended
                                </option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-550">
                                <ChevronDown size={14} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Data Table */}
                <DataTable
                    columns={columns}
                    data={cards}
                    isLoading={isLoading}
                    error={error ? String(error) : null}
                    onRetry={refetch}
                    paginationMode="server"
                    pageIndex={page}
                    pageSize={pageSize}
                    totalRows={pagination.total}
                    onPageChange={setPage}
                    emptyMessage="No ID cards found"
                    emptyAction={{
                        label: 'Generate First Card',
                        onClick: () => setGenerationModalOpen(true),
                    }}
                    rowActions={(card) => [
                        {
                            label: 'View Details',
                            onClick: (row) => setDetailsModal({ open: true, cardId: row.id }),
                        },
                        {
                            label: 'Download PDF',
                            onClick: (row) => {
                                if (row.pdfUrl) {
                                    window.open(row.pdfUrl, '_blank');
                                } else {
                                    showToast.error('PDF not available');
                                }
                            },
                        },
                        {
                            label: 'Regenerate',
                            onClick: (row) => setRegenerateTarget(row),
                        },
                        {
                            label: 'Revoke',
                            variant: 'destructive',
                            onClick: (row) => setRevokeTarget(row),
                        },
                    ]}
                />
            </PageShell>

            {/* Modals */}
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
                message={`Are you sure you want to revoke card ${revokeTarget?.cardNumber}? This action cannot be undone.`}
                confirmLabel="Revoke Card"
            />

            <ConfirmationDialog
                isOpen={!!regenerateTarget}
                onClose={() => setRegenerateTarget(null)}
                onConfirm={handleRegenerate}
                title="Regenerate ID Card"
                message={`Regenerate card ${regenerateTarget?.cardNumber}? A new PDF will be generated.`}
                confirmLabel="Regenerate"
            />
        </MainLayout>
    );
};

export default IdCardsPage;
