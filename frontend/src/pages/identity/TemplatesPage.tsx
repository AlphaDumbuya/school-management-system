/**
 * Card Templates Management Page
 * Page for managing ID card templates
 */

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import {
    Layout,
    Plus,
    Edit,
    Trash2,
    Check,
    X,
    RefreshCw,
    Star,
    CheckCircle,
    Clock,
    Archive,
    ChevronDown,
} from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { DataTable } from '@components/admin/table/DataTable';
import { SearchBar } from '@components/admin/table/SearchBar';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { idCardService, CardTemplate, TemplateStatus } from '@services/idCardService';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { TemplateFormModal } from './components/TemplateFormModal';

// ── Utility Functions ─────────────────────────────────────────────────────────

function getStatusVariant(
    status: TemplateStatus
): 'active' | 'inactive' | 'pending' | 'suspended' {
    const map: Record<TemplateStatus, 'active' | 'inactive' | 'pending' | 'suspended'> = {
        approved: 'active',
        draft: 'inactive',
        pending_approval: 'pending',
        archived: 'suspended',
    };
    return map[status] || 'inactive';
}

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

// ── Component ─────────────────────────────────────────────────────────────────

export const TemplatesPage: React.FC = () => {
    const queryClient = useQueryClient();

    // State
    const [formModalOpen, setFormModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<CardTemplate | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<CardTemplate | null>(null);
    const [approveTarget, setApproveTarget] = useState<CardTemplate | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    // Fetch templates
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['card-templates'],
        queryFn: () => idCardService.listTemplates(),
        staleTime: 30_000,
    });

    const templates: CardTemplate[] =
        (data as any)?.templates ??
        (data?.data as any)?.templates ??
        (data?.data as any)?.data ??
        [];

    // Client-side search + status filter (list is not server-paginated).
    const filteredTemplates = React.useMemo(() => {
        const term = search.trim().toLowerCase();
        return templates.filter((t) => {
            const matchesSearch =
                !term ||
                t.name?.toLowerCase().includes(term) ||
                t.format?.toLowerCase().includes(term);
            const matchesStatus = !statusFilter || t.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [templates, search, statusFilter]);

    // Handle delete
    const handleDelete = async () => {
        if (!deleteTarget) return;

        const targetId = deleteTarget.id || (deleteTarget as any).templateId || (deleteTarget as any).template_id;
        if (!targetId || targetId === 'undefined') {
            showToast.error('Invalid template ID: template cannot be deleted.');
            setDeleteTarget(null);
            return;
        }

        try {
            await idCardService.deleteTemplate(targetId);
            showToast.deleted('Template');
            queryClient.invalidateQueries({ queryKey: ['card-templates'] });
            refetch();
        } catch (err: any) {
            showToast.error(err.response?.data?.message || err.message || 'Failed to delete template');
        } finally {
            setDeleteTarget(null);
        }
    };

    // Handle approve
    const handleApprove = async () => {
        if (!approveTarget) return;

        try {
            await idCardService.approveTemplate(approveTarget.id);
            showToast.success('Template approved successfully');
            queryClient.invalidateQueries({ queryKey: ['card-templates'] });
            refetch();
        } catch (err: any) {
            showToast.error(err.response?.data?.message || err.message || 'Failed to approve template');
        } finally {
            setApproveTarget(null);
        }
    };

    // Handle set as default
    const handleSetDefault = async (template: CardTemplate) => {
        if (template.defaultForRoles.length === 0) {
            showToast.error('Please specify roles for this template first');
            return;
        }

        try {
            const role = template.defaultForRoles[0]; // Use first role for now
            await idCardService.setDefaultTemplate(template.id, role);
            showToast.success('Template set as default');
            queryClient.invalidateQueries({ queryKey: ['card-templates'] });
        } catch (err: any) {
            showToast.error(err.response?.data?.message || err.message || 'Failed to set template as default');
        }
    };

    // Column definitions
    const columns: ColumnDef<CardTemplate, any>[] = [
        {
            id: 'name',
            accessorKey: 'name',
            header: 'Template Name',
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Layout size={16} className="text-gray-400" />
                    <div>
                        <div className="font-medium text-gray-900 dark:text-white">{row.original.name}</div>
                        {row.original.isDefault && (
                            <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                <Star size={12} className="fill-current" />
                                Default
                            </div>
                        )}
                    </div>
                </div>
            ),
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
            id: 'version',
            accessorKey: 'version',
            header: 'Version',
            cell: ({ row }) => (
                <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
                    v{row.original.version}
                </span>
            ),
        },
        {
            id: 'roles',
            header: 'Default For Roles',
            cell: ({ row }) => {
                const roles = row.original.defaultForRoles;
                return roles.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                        {roles.map((role) => (
                            <span
                                key={role}
                                className="text-xs px-2 py-0.5 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 rounded-full capitalize"
                            >
                                {role}
                            </span>
                        ))}
                    </div>
                ) : (
                    <span className="text-gray-400 dark:text-gray-500 text-sm">—</span>
                );
            },
        },
        {
            id: 'status',
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => <StatusBadge status={getStatusVariant(row.original.status)} showDot />,
        },
        {
            id: 'createdAt',
            accessorKey: 'createdAt',
            header: 'Created',
            cell: ({ row }) => (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                    {formatDate(row.original.createdAt)}
                </span>
            ),
        },
    ];

    return (
        <MainLayout>
            <PageShell
                title="Card Templates"
                subtitle="Manage ID card design templates and branding"
                breadcrumbs={[{ label: 'Identity' }, { label: 'Templates' }]}
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
                        <RoleGuard roles={['principal', 'super_admin']}>
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                    setEditingTemplate(null);
                                    setFormModalOpen(true);
                                }}
                                className="flex items-center gap-1.5 shadow-sm hover:shadow"
                            >
                                <Plus size={16} />
                                <span>Create Template</span>
                            </Button>
                        </RoleGuard>
                    </div>
                }
            >
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Templates</div>
                                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {templates.length}
                                </div>
                            </div>
                            <Layout size={24} className="text-blue-500" />
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Approved</div>
                                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                    {templates.filter((t) => t.status === 'approved').length}
                                </div>
                            </div>
                            <CheckCircle size={24} className="text-green-500" />
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Pending</div>
                                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                                    {templates.filter((t) => t.status === 'pending_approval').length}
                                </div>
                            </div>
                            <Clock size={24} className="text-amber-500" />
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Archived</div>
                                <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                                    {templates.filter((t) => t.status === 'archived').length}
                                </div>
                            </div>
                            <Archive size={24} className="text-gray-500" />
                        </div>
                    </div>
                </div>

                {/* Search + status filter */}
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-4">
                    <SearchBar
                        placeholder="Search templates by name or format…"
                        onSearch={setSearch}
                        isLoading={isLoading}
                        resultCount={search ? filteredTemplates.length : undefined}
                        defaultValue={search}
                        className="w-full sm:max-w-md"
                    />
                    <div className="relative w-full sm:w-44">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full appearance-none pl-3 pr-8 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                            <option value="">All Statuses</option>
                            <option value="approved">Approved</option>
                            <option value="draft">Draft</option>
                            <option value="pending_approval">Pending Approval</option>
                            <option value="archived">Archived</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                    </div>
                </div>

                {/* Data Table */}
                <DataTable
                    columns={columns}
                    data={filteredTemplates}
                    isLoading={isLoading}
                    error={error ? String(error) : null}
                    onRetry={refetch}
                    emptyMessage="No templates found"
                    emptyAction={{
                        label: 'Create First Template',
                        onClick: () => {
                            setEditingTemplate(null);
                            setFormModalOpen(true);
                        },
                    }}
                    rowActions={(template) => {
                        const actions = [
                            {
                                label: 'Edit',
                                onClick: (row: CardTemplate) => {
                                    setEditingTemplate(row);
                                    setFormModalOpen(true);
                                },
                            },
                        ];

                        if (template.status === 'draft') {
                            actions.push({
                                label: 'Submit for Approval',
                                onClick: async (row: CardTemplate) => {
                                    try {
                                        await idCardService.submitForApproval(row.id);
                                        showToast.success('Template submitted for approval');
                                        queryClient.invalidateQueries({ queryKey: ['card-templates'] });
                                    } catch (err: any) {
                                        showToast.error(err.response?.data?.message || 'Failed to submit');
                                    }
                                },
                            });
                        }

                        if (template.status === 'pending_approval') {
                            actions.push({
                                label: 'Approve',
                                onClick: (row: CardTemplate) => setApproveTarget(row),
                            });
                        }

                        if (!template.isDefault && template.status === 'approved') {
                            actions.push({
                                label: 'Set as Default',
                                onClick: (row: CardTemplate) => handleSetDefault(row),
                            });
                        }

                        actions.push({
                            label: 'Duplicate',
                            onClick: async (row: CardTemplate) => {
                                try {
                                    await idCardService.createTemplate({
                                        ...row,
                                        name: `${row.name} (Copy)`,
                                        status: 'draft' as any,
                                        isDefault: false,
                                    } as any);
                                    showToast.success('Template duplicated as draft');
                                    queryClient.invalidateQueries({ queryKey: ['card-templates'] });
                                } catch (err: any) {
                                    showToast.error('Failed to duplicate template');
                                }
                            },
                        });

                        actions.push({
                            label: 'Delete',
                            onClick: (row: CardTemplate) => setDeleteTarget(row),
                        });

                        return actions;
                    }}
                />
            </PageShell>

            {/* Modals */}
            <TemplateFormModal
                isOpen={formModalOpen}
                onClose={() => {
                    setFormModalOpen(false);
                    setEditingTemplate(null);
                }}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['card-templates'] });
                    refetch();
                }}
                editingTemplate={editingTemplate}
            />

            <ConfirmationDialog
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="Delete Template"
                message={`Are you sure you want to delete template "${deleteTarget?.name}"? This action cannot be undone.`}
                confirmLabel="Delete"
            />

            <ConfirmationDialog
                isOpen={!!approveTarget}
                onClose={() => setApproveTarget(null)}
                onConfirm={handleApprove}
                title="Approve Template"
                message={`Approve template "${approveTarget?.name}" for use?`}
                confirmLabel="Approve"
            />
        </MainLayout>
    );
};

export default TemplatesPage;
