/**
 * Shared pieces for the accounting pages (bursar Phase C): unwrap helper,
 * period picker (academic year or custom dates), grouped account select.
 */
import React from 'react';
import { YearFilter } from '@components/common/YearFilter';
import { ACCOUNT_TYPE_LABEL, type GLAccount, type RangeQuery } from '@services/bursarService';

export async function unwrap<T>(p: Promise<any>, msg = 'Could not load.'): Promise<T> {
  const r = await p;
  if (r?.success === false) throw new Error(r.error || msg);
  return r?.data as T;
}

export const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export type Period = { mode: 'year' | 'dates'; year: string; from: string; to: string };
export const periodQuery = (p: Period, activeYear?: string): RangeQuery =>
  p.mode === 'dates' ? { from: p.from || undefined, to: p.to || undefined } : { academic_year: p.year || activeYear || undefined };

const field = 'px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm';

/** Academic year (default) or a custom date range. */
export const PeriodPicker: React.FC<{ value: Period; onChange: (p: Period) => void; activeYear?: string; asAt?: boolean }> = ({ value, onChange, activeYear, asAt }) => (
  <div className="flex flex-wrap items-center gap-2">
    <div role="group" aria-label="Period" className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-900/50 p-0.5">
      {(['year', 'dates'] as const).map((m) => (
        <button key={m} type="button" aria-pressed={value.mode === m} onClick={() => onChange({ ...value, mode: m })}
          className={`px-2.5 py-1 rounded-md text-xs font-semibold ${value.mode === m ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}>
          {m === 'year' ? 'Academic year' : asAt ? 'As at date' : 'Dates'}
        </button>
      ))}
    </div>
    {value.mode === 'year'
      ? <YearFilter value={value.year || activeYear || ''} onChange={(y) => onChange({ ...value, year: y })} noAutoSelect />
      : <>
        {!asAt && <><label htmlFor="pp-from" className="sr-only">From</label>
          <input id="pp-from" type="date" value={value.from} max={value.to || todayLocal()} onChange={(e) => onChange({ ...value, from: e.target.value })} className={field} placeholder="From" /></>}
        <label htmlFor="pp-to" className="sr-only">{asAt ? 'As at' : 'To'}</label>
        <input id="pp-to" type="date" value={value.to} max={todayLocal()} min={asAt ? undefined : value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} className={field} placeholder="To" />
      </>}
  </div>
);

/** Account dropdown grouped by type. */
export const AccountSelect: React.FC<{
  id?: string; value: string; onChange: (id: string) => void; accounts: GLAccount[];
  excludeControl?: boolean; exclude?: string[]; types?: string[]; className?: string; placeholder?: string; ariaLabel?: string;
}> = ({ id, value, onChange, accounts, excludeControl, exclude = [], types, className, placeholder = 'Choose an account…', ariaLabel }) => {
  const list = accounts.filter((a) => a.is_active && !(excludeControl && a.control) && !exclude.includes(a.id) && (!types || types.includes(a.type)));
  return (
    <select id={id} aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} className={className || `w-full ${field}`}>
      <option value="">{placeholder}</option>
      {Object.keys(ACCOUNT_TYPE_LABEL).map((t) => {
        const group = list.filter((a) => a.type === t);
        return group.length ? <optgroup key={t} label={ACCOUNT_TYPE_LABEL[t]}>{group.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</optgroup> : null;
      })}
    </select>
  );
};

export const Money: React.FC<{ v: number | null | undefined; zero?: string; className?: string }> = ({ v, zero = '—', className }) => {
  const n = Number(v || 0);
  if (!n) return <span className={className || 'text-gray-300 dark:text-gray-600'}>{zero}</span>;
  const s = `Le ${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return <span className={className}>{n < 0 ? `(${s})` : s}</span>;
};

/**
 * Page-header action buttons on the finance pages. On phones the label stays
 * visible (icon + short text), the tap target is about 40px tall, and buttons
 * keep their width so the header row wraps instead of squashing them.
 */
export const HEADER_BTN = 'min-h-[40px] sm:min-h-0 whitespace-nowrap shrink-0';
/**
 * The same for <ExportButton>, through its `className` (outer wrapper): shows
 * its label on phones and gives it the 40px tap target.
 */
export const HEADER_EXPORT = 'shrink-0 [&>button]:min-h-[40px] sm:[&>button]:min-h-0 [&>button]:whitespace-nowrap [&>button>span]:inline';

/** Button text: an optional shorter wording below `sm`, the full one above. */
export const BtnLabel: React.FC<{ short?: string; children: React.ReactNode }> = ({ short, children }) =>
  short
    ? <><span className="sm:hidden">{short}</span><span className="hidden sm:inline">{children}</span></>
    : <span>{children}</span>;

export const CheckBadge: React.FC<{ ok: boolean; okText: string; badText: string }> = ({ ok, okText, badText }) => (
  <span role="status" className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'}`}>
    {ok ? '✓' : '!'} {ok ? okText : badText}
  </span>
);
