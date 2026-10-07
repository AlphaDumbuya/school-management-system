/**
 * usePaged + TablePager: pagination for hand-built tables, with the same look
 * as DataTable's footer (rows per page, first / previous / next / last, total).
 *
 *   const pg = usePaged(rows, [year, search, filter]);  // back to page 1 when these change
 *   {pg.pageRows.map(...)}
 *   <TablePager {...pg.pager} />
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const PAGE_SIZES = [10, 25, 50, 100];

export function usePaged<T>(rows: T[], resetOn: unknown[] = [], initialSize = 25) {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(initialSize);
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, resetOn);
  useEffect(() => { if (page > pageCount - 1) setPage(pageCount - 1); }, [page, pageCount]);
  const pageRows = useMemo(() => rows.slice(page * size, page * size + size), [rows, page, size]);
  return {
    pageRows,
    pager: { page, pageCount, size, total, onPage: setPage, onSize: (n: number) => { setSize(n); setPage(0); } },
  };
}

export const TablePager: React.FC<{
  page: number; pageCount: number; size: number; total: number;
  onPage: (p: number) => void; onSize: (n: number) => void; label?: string;
}> = ({ page, pageCount, size, total, onPage, onSize, label = 'total' }) => {
  if (total <= PAGE_SIZES[0]) return null; // one short page: no controls needed
  const btn = 'p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 dark:text-gray-400 items-center justify-center';
  const from = page * size + 1;
  const to = Math.min(total, (page + 1) * size);
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
      <div className="flex items-center gap-2">
        <label htmlFor="pager-size" className="whitespace-nowrap text-gray-500">Rows:</label>
        <select id="pager-size" value={size} onChange={(e) => onSize(Number(e.target.value))}
          className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500">
          {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-gray-400">·</span>
        <span>{from}–{to} of {total} {label}</span>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onPage(0)} disabled={page === 0} className={`${btn} hidden sm:flex`} aria-label="First page"><ChevronsLeft size={16} /></button>
        <button type="button" onClick={() => onPage(page - 1)} disabled={page === 0} className={`${btn} flex`} aria-label="Previous page"><ChevronLeft size={16} /></button>
        <span className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg min-w-[72px] text-center" aria-live="polite">{page + 1} / {pageCount}</span>
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pageCount - 1} className={`${btn} flex`} aria-label="Next page"><ChevronRight size={16} /></button>
        <button type="button" onClick={() => onPage(pageCount - 1)} disabled={page >= pageCount - 1} className={`${btn} hidden sm:flex`} aria-label="Last page"><ChevronsRight size={16} /></button>
      </div>
    </nav>
  );
};

export default TablePager;
