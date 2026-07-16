import React, { useState, useRef } from 'react';
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
  ChevronsLeft,
  ChevronsRight,
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

// ── Row Action Menu ───────────────────────────────────────────────────────────

function RowActionMenu<TData>({ row, actions }: { row: TData; actions: RowAction<TData>[] }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top?: number; bottom?: number; right: number }>({ right: 0 });

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const menuHeight = Math.min(actions.length * 40 + 8, 300); // estimate menu height
      const spaceBelow = viewportHeight - rect.bottom;
      const rightPos = window.innerWidth - rect.right;

      if (spaceBelow < menuHeight && rect.top > menuHeight) {
        // Open upward
        setPosition({ bottom: viewportHeight - rect.top + 4, right: rightPos });
      } else {
        // Open downward
        setPosition({ top: rect.bottom + 4, right: rightPos });
      }
    }
    setOpen((v) => !v);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={handleOpen}
        aria-label="Row actions"
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <MoreHorizontal size={16} className="text-gray-500 dark:text-gray-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl min-w-[170px] py-1.5 animate-in fade-in duration-100"
            style={{
              ...(position.top !== undefined ? { top: position.top } : {}),
              ...(position.bottom !== undefined ? { bottom: position.bottom } : {}),
              right: position.right,
            }}
          >
            {actions.map((action, i) => (
              <button
                key={i}
                className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2.5 transition-colors ${
                  action.variant === 'destructive' ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'
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

// ── Mobile Card View ──────────────────────────────────────────────────────────

function MobileCard<TData>({
  row,
  columns,
  rowActions,
  enableRowSelection,
  isSelected,
  onToggleSelect,
}: {
  row: TData;
  columns: ColumnDef<TData, any>[];
  rowActions?: (row: TData) => RowAction<TData>[];
  enableRowSelection: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  // Get visible user-defined columns (skip _select and _actions)
  const visibleCols = columns.filter(c => c.id !== '_select' && c.id !== '_actions');

  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-4 space-y-2.5 ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
      {/* Header row: checkbox + first column value + actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {enableRowSelection && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              aria-label="Select row"
              className="rounded border-gray-300 mt-0.5 flex-shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            {/* Render first column prominently */}
            {visibleCols[0] && (
              <div className="font-semibold text-gray-900 text-sm truncate">
                {typeof visibleCols[0].cell === 'function'
                  ? flexRender(visibleCols[0].cell, { row: { original: row } } as any)
                  : (row as any)[(visibleCols[0] as any).accessorKey] ?? '—'}
              </div>
            )}
          </div>
        </div>
        {rowActions && (
          <RowActionMenu row={row} actions={rowActions(row)} />
        )}
      </div>

      {/* Remaining columns as key-value pairs */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pl-0">
        {visibleCols.slice(1).map((col, idx) => {
          const header = typeof col.header === 'string' ? col.header : (col.id || `Col ${idx}`);
          return (
            <div key={col.id || idx} className="min-w-0">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{header}</p>
              <div className="text-sm text-gray-700 truncate">
                {typeof col.cell === 'function'
                  ? flexRender(col.cell, { row: { original: row } } as any)
                  : (row as any)[(col as any).accessorKey] ?? '—'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main DataTable Component ──────────────────────────────────────────────────

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

  // Get current page rows for mobile view
  const currentRows = table.getRowModel().rows;

  return (
    <div className="flex flex-col">
      {/* ── Desktop/Tablet: Traditional Table (hidden on mobile) ──────── */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200">
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
                      className={`px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap ${canSort ? 'cursor-pointer select-none hover:text-gray-700' : ''}`}
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
            ) : currentRows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="p-0">
                  <EmptyState message={emptyMessage} action={emptyAction} />
                </td>
              </tr>
            ) : (
              currentRows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/60 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3.5 text-gray-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile: Card Layout (visible only on mobile) ──────────────── */}
      <div className="md:hidden">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-3 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-2/3" />
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} />
        ) : currentRows.length === 0 ? (
          <EmptyState message={emptyMessage} action={emptyAction} />
        ) : (
          <div className="space-y-3">
            {/* Select all on mobile */}
            {enableRowSelection && currentRows.length > 0 && (
              <div className="flex items-center gap-2 px-1 pb-1">
                <input
                  type="checkbox"
                  checked={table.getIsAllPageRowsSelected()}
                  onChange={table.getToggleAllPageRowsSelectedHandler()}
                  aria-label="Select all"
                  className="rounded border-gray-300"
                />
                <span className="text-xs text-gray-500 font-medium">Select all</span>
              </div>
            )}
            {currentRows.map((row) => (
              <MobileCard
                key={row.id}
                row={row.original}
                columns={finalColumns}
                rowActions={rowActions}
                enableRowSelection={enableRowSelection}
                isSelected={row.getIsSelected()}
                onToggleSelect={row.getToggleSelectedHandler()}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Pagination Footer (responsive) ────────────────────────────── */}
      {!isLoading && !error && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-4 py-3 mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          {/* Rows per page selector + total */}
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-gray-500 dark:text-gray-400">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="text-gray-400 dark:text-gray-500">·</span>
            <span className="text-gray-500 dark:text-gray-400">{total} total</span>
          </div>

          {/* Page navigation */}
          <div className="flex items-center gap-1">
            {/* First page */}
            <button
              onClick={() => handlePageChange(0)}
              disabled={pageIndex === 0}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 dark:text-gray-400 hidden sm:flex items-center justify-center"
              aria-label="First page"
            >
              <ChevronsLeft size={16} />
            </button>
            {/* Previous */}
            <button
              onClick={() => handlePageChange(pageIndex - 1)}
              disabled={!table.getCanPreviousPage()}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 dark:text-gray-400 flex items-center justify-center"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Page indicator */}
            <span className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg min-w-[72px] sm:min-w-[80px] text-center">
              {pageIndex + 1} / {pageCount || 1}
            </span>

            {/* Next */}
            <button
              onClick={() => handlePageChange(pageIndex + 1)}
              disabled={!table.getCanNextPage()}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 dark:text-gray-400 flex items-center justify-center"
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
            {/* Last page */}
            <button
              onClick={() => handlePageChange((pageCount || 1) - 1)}
              disabled={pageIndex >= (pageCount || 1) - 1}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 dark:text-gray-400 hidden sm:flex items-center justify-center"
              aria-label="Last page"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
