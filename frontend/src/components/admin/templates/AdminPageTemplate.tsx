import React, { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { PageShell } from '../layout/PageShell';
import { BreadcrumbItem } from '../layout/Breadcrumb';
import { TabItem } from '../common/PageTabs';
import { ActionBar, ActionBarFilter } from '../table/ActionBar';
import { BulkToolbar, BulkAction } from '../table/BulkToolbar';
import { DataTable, RowAction, PaginationMode } from '../table/DataTable';
import { KPICard } from '../../dashboard/KPICard';

interface StatItem {
  key: string;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; isPositive: boolean };
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'indigo';
  onClick?: () => void;
}

export interface AdminPageTemplateProps<TData> {
  // PageShell
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  backHref?: string;
  tabs?: TabItem[];
  // KPI stat row
  stats?: StatItem[];
  statsLoading?: boolean;
  // Action bar
  onSearch?: (value: string) => void;
  filters?: ActionBarFilter[];
  filterValues?: Record<string, any>;
  onFilterChange?: (key: string, value: any) => void;
  onAdd?: () => void;
  onExport?: (format: 'csv' | 'pdf') => void;
  onImport?: () => void;
  addLabel?: string;
  // Data table
  columns: ColumnDef<TData, any>[];
  data: TData[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  paginationMode?: PaginationMode;
  pageIndex?: number;
  pageSize?: number;
  totalRows?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  enableRowSelection?: boolean;
  rowActions?: (row: TData) => RowAction<TData>[];
  bulkActions?: BulkAction[];
  emptyMessage?: string;
  emptyAction?: { label: string; onClick: () => void };
  // Extra content
  children?: React.ReactNode;
}

export function AdminPageTemplate<TData>({
  title,
  subtitle,
  breadcrumbs,
  backHref,
  tabs,
  stats,
  statsLoading,
  onSearch,
  filters,
  filterValues,
  onFilterChange,
  onAdd,
  onExport,
  onImport,
  addLabel,
  columns,
  data,
  isLoading,
  error,
  onRetry,
  paginationMode,
  pageIndex,
  pageSize,
  totalRows,
  onPageChange,
  onPageSizeChange,
  enableRowSelection,
  rowActions,
  bulkActions = [],
  emptyMessage,
  emptyAction,
  children,
}: AdminPageTemplateProps<TData>) {
  const [selectedRows, setSelectedRows] = useState<TData[]>([]);

  return (
    <PageShell
      title={title}
      subtitle={subtitle}
      breadcrumbs={breadcrumbs}
      backHref={backHref}
      tabs={tabs}
    >
      {/* Stat row */}
      {stats && stats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((stat) => (
            <KPICard
              key={stat.key}
              title={stat.title}
              value={stat.value}
              subtitle={stat.subtitle}
              trend={stat.trend}
              icon={stat.icon}
              color={stat.color}
              onClick={stat.onClick}
              isLoading={statsLoading}
            />
          ))}
        </div>
      )}

      {/* Action bar */}
      <ActionBar
        onSearch={onSearch}
        filters={filters}
        filterValues={filterValues}
        onFilterChange={onFilterChange}
        onAdd={onAdd}
        onExport={onExport}
        onImport={onImport}
        addLabel={addLabel}
      />

      {/* Bulk toolbar */}
      {selectedRows.length > 0 && (
        <BulkToolbar
          selectedCount={selectedRows.length}
          actions={bulkActions}
          onDeselectAll={() => setSelectedRows([])}
        />
      )}

      {/* Data table */}
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        paginationMode={paginationMode}
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalRows={totalRows}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        enableRowSelection={enableRowSelection}
        onSelectionChange={setSelectedRows}
        rowActions={rowActions}
        emptyMessage={emptyMessage}
        emptyAction={emptyAction}
      />

      {children}
    </PageShell>
  );
}

export default AdminPageTemplate;
