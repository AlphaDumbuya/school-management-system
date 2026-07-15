import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  RowSelectionState,
} from '@tanstack/react-table';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { SkeletonTableRow } from '../feedback/Skeleton';
import { EmptyState } from '../feedback/EmptyState';
import { ErrorState } from '../feedback/ErrorState';

export interface RowAction<TData = any> {
  label: string;
  icon?: React.ReactNode;
  onClick: (row: TData) => void;
  variant?: 'default' | 'destructive';
}

export type PaginationMode = 'client' | 'server';

export interface DataTableProps<TData> {
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
  onSelectionChange?: (rows: TData[]) => void;
  rowActions?: (row: TData) => RowAction<TData>[];
  emptyMessage?: string;
  emptyAction?: { label: string; onClick: () => void };
}

const PAGE_SIZES = [10, 25, 50, 100];

function RowActionMenu<TData>({ row, actions }: { row: TData; actions: RowAction<TData>[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Row actions"
        className="p-1 rounded hover:bg-gray-100"
      >
        <MoreHorizontal size={16} className="text-gray-500" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[140px]">
            {actions.map((action, i) => (
              <button
                key={i}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                  action.variant === 'destructive' ? 'text-red-600' : 'text-gray-700'
                }`}
                onClick={() => { action.onClick(row); setOpen(false); }}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function DataTable<TData>({
  columns,
  data,
  isLoading = false,
  error,
  onRetry,
  paginationMode = 'client',
  pageIndex: controlledPage,
  pageSize: controlledPageSize = 10,
  totalRows,
  onPageChange,
  onPageSizeChange,
  enableRowSelection = false,
  onSelectionChange,
  rowActions,
  emptyMessage = 'No records found',
  emptyAction,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Inject checkbox column when row selection is enabled
  const allColumns: ColumnDef<TData, any>[] = enableRowSelection
    ? [
        {
          id: '_select',
          header: ({ table }) => (
            <input
              type="checkbox"
              checked={table.getIsAllPageRowsSelected()}
              onChange={table.getToggleAllPageRowsSelectedHandler()}
              aria-label="Select all rows"
              className="rounded border-gray-300"
            />
          ),
          cell: ({ row }) => (
            <input
              type="checkbox"
              checked={row.getIsSelected()}
              onChange={row.getToggleSelectedHandler()}
              aria-label="Select row"
              className="rounded border-gray-300"
            />
          ),
          size: 40,
        },
        ...columns,
      ]
    : columns;

  // Inject row actions column when provided
  const finalColumns: ColumnDef<TData, any>[] = rowActions
    ? [
        ...allColumns,
        {
          id: '_actions',
          header: '',
          cell: ({ row }) => (
            <RowActionMenu row={row.original} actions={rowActions(row.original)} />
          ),
          size: 48,
        },
      ]
    : allColumns;

  const table = useReactTable({
    data,
    columns: finalColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      rowSelection,
      ...(paginationMode === 'client'
        ? {}
        : { pagination: { pageIndex: (controlledPage ?? 1) - 1, pageSize: controlledPageSize } }),
    },
    onSortingChange: setSorting,
    onRowSelectionChange: (updater) => {
      setRowSelection((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (onSelectionChange) {
          const selectedRows = Object.keys(next)
            .filter((k) => next[k])
            .map((k) => data[Number(k)]);
          onSelectionChange(selectedRows);
        }
        return next;
      });
    },
    manualPagination: paginationMode === 'server',
    pageCount: paginationMode === 'server' && totalRows && controlledPageSize
      ? Math.ceil(totalRows / controlledPageSize)
      : undefined,
    initialState: { pagination: { pageSize: controlledPageSize } },
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const total = paginationMode === 'server' ? (totalRows ?? 0) : data.length;
  const colCount = finalColumns.length;

  const handlePageSizeChange = (size: number) => {
    table.setPageSize(size);
    onPageSizeChange?.(size);
  };

  const handlePageChange = (newPage: number) => {
    if (paginationMode === 'server') {
      onPageChange?.(newPage + 1);
    } else {
      table.setPageIndex(newPage);
    }
  };

  return (
    <div className="flex flex-col gap-0">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDir = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      className={`px-4 py-3 font-medium text-gray-600 whitespace-nowrap ${canSort ? 'cursor-pointer select-none hover:text-gray-900' : ''}`}
                      style={header.column.columnDef.size ? { width: header.column.columnDef.size } : undefined}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <div className="flex items-center gap-1">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          sortDir === 'asc' ? <ChevronUp size={14} className="text-blue-600" /> :
                          sortDir === 'desc' ? <ChevronDown size={14} className="text-blue-600" /> :
                          <ChevronsUpDown size={14} className="text-gray-300" />
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <SkeletonTableRow key={i} columnCount={colCount} />
              ))
            ) : error ? (
              <tr>
                <td colSpan={colCount} className="p-0">
                  <ErrorState message={error} onRetry={onRetry} />
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="p-0">
                  <EmptyState message={emptyMessage} action={emptyAction} />
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-gray-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer — always visible */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-transparent dark:bg-transparent text-xs sm:text-sm text-gray-600 dark:text-gray-400">
        {/* Rows selector */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
          <span className="whitespace-nowrap">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="border border-gray-300 dark:border-gray-600 bg-transparent dark:bg-transparent text-gray-850 dark:text-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {PAGE_SIZES.map((s) => <option key={s} value={s} className="bg-white dark:bg-gray-800">{s}</option>)}
          </select>
        </div>

        {/* Page Indicators & Actions */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full sm:w-auto justify-center sm:justify-end">
          <span className="whitespace-nowrap">
            Page {pageIndex + 1} of {pageCount || 1} &nbsp;·&nbsp; {total} total
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(pageIndex - 1)}
              disabled={!table.getCanPreviousPage()}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-500 dark:text-gray-400"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => handlePageChange(pageIndex + 1)}
              disabled={!table.getCanNextPage()}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-500 dark:text-gray-400"
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DataTable;
