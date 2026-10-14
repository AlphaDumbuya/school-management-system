/**
 * FeesPage — /finance/fees
 * Sierra-Leone-style Academic Year Fee Structures Configurator.
 *
 * Layout:
 *  1. Year picker + KPI row (configured classes, total expected, collected,
 *     outstanding).
 *  2. Class badge grid — click any class to open the configurator.
 *  3. Configured structures list — expand for term breakdown.
 *  4. FeeStructureModal — term tuition, itemised year expenses, payment-policy
 *     rules (min % for new / continuing students, per-term clearance, late fee,
 *     instalment flag) + live full-year summary.
 *  5. BillTermModal — materialise fees for one term from a structure.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, CheckCircle2, ChevronDown, ChevronRight,
  Settings2, Layers, Info, Undo2,
} from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { cardTint } from '@lib/cardTint';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { SearchBar } from '@components/admin/table/SearchBar';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { Modal } from '@components/admin/feedback/Modal';
import { showToast } from '@utils/toast';
import { classesService } from '@services/classesService';
import { feeStructureService, FeeStructure, FeeStructureExpense } from '@services/feeStructureService';
import { financeService } from '@services/financeService';
import { useAcademicYears } from '@hooks/useAcademicYears';
import { YearFilter } from '@components/common/YearFilter';
import { usePaged, TablePager } from '@components/admin/table/TablePager';

/* ── helpers ─────────────────────────────────────────────────────────────── */
const fmtLe = (v: number | string | null | undefined) => `Le ${(Number(v) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const LEVEL_COLORS: Record<string, string> = {
  'Nursery School': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  'Primary School': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Junior Secondary (JSS)': 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  'Senior Secondary (SSS)': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};
const levelCls = (l?: string) => LEVEL_COLORS[l || ''] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';

/* ── main component ──────────────────────────────────────────────────────── */
export const FeesPage: React.FC = () => {
  const queryClient = useQueryClient();
  // Opens on the school's ACTIVE year; past years are read-only history.
  const [pickedYear, setPickedYear] = useState('');
  const { activeYear } = useAcademicYears();
  // '' = the current year, so the page follows a rollover.
  const setYear = (y: string) => setPickedYear(!y || y === activeYear ? '' : y);
  const year = pickedYear || activeYear;
  const viewingPast = !!year && !!activeYear && year < activeYear;
  const [search, setSearch] = useState('');
  const [configClass, setConfigClass] = useState<any | null>(null); // class object to configure
  const [billTarget, setBillTarget] = useState<FeeStructure | null>(null);
  const [unbillTarget, setUnbillTarget] = useState<FeeStructure | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // The classes that exist in the selected year (each year has its own class
  // rows after a rollover, and fee structures point at that year's classes).
  const { data: classResp, isLoading: classLoading, error: classError } = useQuery({
    queryKey: ['classes-all', year],
    queryFn: () => okOrThrow(classesService.listClasses({ limit: 200, academic_year: year, scope: 'finance' } as any)),
    enabled: !!year,
    staleTime: 60_000,
  });
  const classes: any[] = ((classResp as any)?.data?.data ?? (classResp as any)?.data ?? []);

  // Configured structures for the year
  const { data: structResp, isLoading: structLoading, refetch, error: structError } = useQuery({
    queryKey: ['fee-structures', year], queryFn: () => okOrThrow(feeStructureService.list(year)), enabled: !!year, staleTime: 15_000,
  });
  const loadError = (structError || classError) as Error | null;
  const structures: FeeStructure[] = ((structResp as any)?.data?.data ?? (structResp as any)?.data ?? []);

  // Finance overview KPIs
  const { data: ovResp, isError: ovError } = useQuery({
    queryKey: ['finance-overview', year], queryFn: () => okOrThrow(financeService.getOverview(year)), enabled: !!year, staleTime: 30_000,
  });
  const ov = (ovResp as any)?.data?.data ?? (ovResp as any)?.data;

  const configuredIds = useMemo(() => new Set(structures.map((s) => s.classId || (s as any).class_id)), [structures]);

  const visibleClasses = useMemo(() => {
    const t = search.trim().toLowerCase();
    return classes.filter((c) => !t || c.name?.toLowerCase().includes(t) || c.level?.toLowerCase().includes(t));
  }, [classes, search]);

  const pg = usePaged<any>(structures, [year], 10);
  const toggleExpand = (id: string) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });


  return (
    <MainLayout>
      <PageShell
        title="Fee Structures"
        subtitle="Configure term tuition & academic-year expenses per class"
        onRefresh={() => refetch()}
        isRefreshing={structLoading}
        actions={
          <YearFilter value={year} onChange={setYear} noAutoSelect />
        }
      >
        {viewingPast && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
            <span>Showing the <strong>{year}</strong> fee structures as history (read-only). Configure and bill fees in {activeYear}.</span>
            <button type="button" onClick={() => setYear(activeYear)} className="text-xs font-bold text-blue-700 hover:underline dark:text-blue-300">
              Back to {activeYear}
            </button>
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <KPITile label="Configured Classes" value={structures.length} sub={`of ${classes.length} total`} color="blue" />
          {/* Billed comes from the ledger: the old "Total Expected" summed one
              student's full-year fee per class, not per enrolled student. */}
          <KPITile label="Total Billed" value={ovError ? '—' : fmtLe(ov?.totalBilled)} sub={`Charged to students · ${year || ''}`} color="indigo" />
          <KPITile label="Total Collected" value={ovError ? '—' : fmtLe(ov?.totalPaid)} sub="Billed minus still owed" color="emerald" />
          <KPITile label="Outstanding Balances" value={ovError ? '—' : fmtLe(ov?.totalOutstanding)} sub="Still owed this year" color="rose" />
        </div>

        {loadError && (
          <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <span>{loadError.message}</span>
            <button type="button" onClick={() => refetch()} className="text-xs font-bold hover:underline">Retry</button>
          </div>
        )}

        {/* Search */}
        <div className="mb-4">
          <SearchBar placeholder="Search classes…" onSearch={setSearch} isLoading={classLoading} className="w-full sm:max-w-md" />
        </div>

        {/* Class badge grid (configuration happens in the current year only) */}
        {!viewingPast && <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 mb-6">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Quick Class Preset Setup</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Academic Year <span className="font-semibold">{year}</span> — pick a class below to configure its term tuition & year expenses.
          </p>

          {/* Class dropdown selector — every class in the school; marks which are
              already configured for the selected year (Req 3.1, 3.4). */}
          {classes.length > 0 && (
            <div className="mb-4 flex flex-col sm:flex-row sm:items-end gap-2">
              <div className="flex flex-col gap-1 flex-1 sm:max-w-xs">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Select a class to configure</label>
                <div className="relative">
                  <select
                    value=""
                    onChange={(e) => {
                      const c = classes.find((x) => String(x.id) === e.target.value);
                      if (c) setConfigClass(c);
                    }}
                    className="w-full appearance-none pl-3 pr-8 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="" disabled>Choose a class…</option>
                    {classes.map((c) => {
                      const done = configuredIds.has(c.id);
                      return (
                        <option key={c.id} value={String(c.id)}>
                          {c.name}{c.level ? ` · ${c.level}` : ''} {done ? '✓ configured' : '— not configured'}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                </div>
              </div>
            </div>
          )}

          {visibleClasses.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No classes found for this school yet. Add classes first.</p>
          ) : (
            <>
            <div className="flex flex-wrap gap-2">
              {visibleClasses.map((c) => {
                const done = configuredIds.has(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => setConfigClass(c)}
                    className={`group relative flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all hover:-translate-y-0.5 hover:shadow-md ${
                      done
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-400'
                        : 'bg-white dark:bg-gray-800 border-dashed border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400'
                    }`}
                  >
                    {done
                      ? <CheckCircle2 size={13} className="flex-shrink-0" />
                      : <Plus size={13} className="flex-shrink-0 opacity-60 group-hover:opacity-100" />}
                    {c.name}
                    {!done && <span className="text-[10px] font-bold text-blue-500 hidden group-hover:inline ml-1">Configure →</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-4">
              Click any class badge to configure its fees. <span className="text-blue-500">Dashed border = not yet configured.</span> <span className="text-emerald-600">Green = configured.</span>
            </p>
            </>
          )}
        </div>}

        {/* Configured structures list */}
        {structures.length === 0 ? (
          <EmptyState
            message={`No fee structures configured for ${year || 'this year'}`}
            description={viewingPast ? 'No fees were set up for this year.' : 'Click any class badge above to set up its term tuition and year expenses.'}
          />
        ) : (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Academic Year Fee Structures ({structures.length})
            </h3>
            {!viewingPast && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              <Info size={14} className="flex-shrink-0 mt-0.5" />
              <span>
                A structure only defines the amounts. To actually charge students —
                so they and their parents see fees in their portals — click the
                <strong> Bill a term</strong> (layers) button on a structure.
              </span>
            </div>}
            {pg.pageRows.map((s: any, idx: number) => {
              const isOpen = expanded.has(s.id);
              const t1 = Number(s.term1_tuition) || 0;
              const t2 = Number(s.term2_tuition) || 0;
              const t3 = Number(s.term3_tuition) || 0;
              const exp = s.expenses ?? [];
              const expTotal = exp.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
              const fullYear = t1 + t2 + t3 + expTotal;
              return (
                <div key={s.id} className={`rounded-2xl ${cardTint(idx)} sm:bg-white sm:dark:bg-gray-800 sm:border-gray-200 sm:dark:border-gray-700 border overflow-hidden`}>
                  {/* Phones: [chevron | name, level, status, terms | icons] on
                      the first row and the year total on its own full-width
                      row underneath, so nothing squeezes the class name or
                      overflows. sm+: the original single row. */}
                  <div className="flex flex-wrap sm:flex-nowrap items-start sm:items-center gap-x-3 gap-y-2 px-3 sm:px-4 py-3 cursor-pointer" onClick={() => toggleExpand(s.id)}>
                    <button type="button" aria-expanded={isOpen} aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${s.class_name}`} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex-shrink-0 mt-0.5 sm:mt-0">
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900 dark:text-white break-words min-w-0">{s.class_name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${levelCls(s.class_level)}`}>{s.class_level || 'Class'}</span>
                        <span className="sm:hidden"><BilledBadge s={s} /></span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 tabular-nums">
                        <span className="whitespace-nowrap">Term 1: {fmtLe(t1)}</span>
                        <span aria-hidden className="hidden sm:inline">·</span>
                        <span className="whitespace-nowrap">Term 2: {fmtLe(t2)}</span>
                        <span aria-hidden className="hidden sm:inline">·</span>
                        <span className="whitespace-nowrap">Term 3: {fmtLe(t3)}</span>
                      </div>
                    </div>
                    <div className="order-last sm:order-none basis-full sm:basis-auto flex sm:block flex-wrap items-baseline justify-between gap-x-3 pl-7 sm:pl-0 text-left sm:text-right flex-shrink-0 min-w-0">
                      <div className="text-sm font-black text-gray-900 dark:text-white tabular-nums">{fmtLe(fullYear)} / Yr</div>
                      <div className="text-[10px] text-gray-400 tabular-nums">inc. {fmtLe(expTotal)} expenses</div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-1.5 sm:ml-2 flex-shrink-0">
                      <span className="hidden sm:inline-flex"><BilledBadge s={s} /></span>
                      {!viewingPast && <>
                      <button onClick={(e) => { e.stopPropagation(); setConfigClass(classes.find((c) => c.id === (s.classId || s.class_id)) ?? { id: s.classId || s.class_id, name: s.class_name, level: s.class_level }); }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-600" title="Edit" aria-label={`Edit ${s.class_name} fee structure`}><Settings2 size={15} /></button>
                      <button onClick={(e) => { e.stopPropagation(); setBillTarget(s); }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-emerald-600" title="Bill a term or the full year" aria-label={`Bill ${s.class_name}`}><Layers size={15} /></button>
                      {s.billed && (
                        <button onClick={(e) => { e.stopPropagation(); setUnbillTarget(s); }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-600" title="Unbill (remove unpaid charges)" aria-label={`Unbill ${s.class_name}`}><Undo2 size={15} /></button>
                      )}
                      </>}
                    </div>
                  </div>
                  {isOpen && (
                    <div className="border-t border-gray-100 dark:border-gray-700 px-3 sm:px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Term Tuition</div>
                        <div className="space-y-1.5">
                          {[['Term 1 (Tuition + Expenses)', t1 + expTotal], ['Term 2 (Tuition Only)', t2], ['Term 3 (Tuition Only)', t3]].map(([l, v]) => (
                            <div key={l as string} className="flex justify-between gap-3">
                              <span className="text-gray-500 min-w-0">{l}</span>
                              <span className="font-semibold tabular-nums whitespace-nowrap">{fmtLe(v)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between gap-3 border-t border-gray-100 dark:border-gray-700 pt-1.5">
                            <span className="font-bold text-gray-700 dark:text-gray-300 min-w-0">Full Year Total</span>
                            <span className="font-black text-gray-900 dark:text-white tabular-nums whitespace-nowrap">{fmtLe(fullYear)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-700 dark:text-gray-300 mb-2">General Academic Year Expenses</div>
                        {exp.length === 0 ? <p className="text-gray-400 text-xs">No one-off expenses.</p> : (
                          <div className="space-y-1">
                            {exp.map((e: any, i: number) => (
                              <div key={i} className="flex justify-between gap-3 text-xs">
                                <span className="text-gray-600 dark:text-gray-400 min-w-0 break-words">• {e.label}</span>
                                <span className="font-medium tabular-nums whitespace-nowrap">{fmtLe(e.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {(s.min_percent_new || s.min_percent_continuing || s.min_percent_term) && (
                          <div className="mt-3">
                            <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1 text-xs uppercase">Payment Policy</div>
                            {s.min_percent_new && <div className="text-xs text-gray-500">New enrolment: min {s.min_percent_new}%</div>}
                            {s.min_percent_continuing && <div className="text-xs text-gray-500">Continuing: min {s.min_percent_continuing}%</div>}
                            {s.min_percent_term && <div className="text-xs text-gray-500">Per-term clearance: {s.min_percent_term}%</div>}
                            {s.late_fee_percent && <div className="text-xs text-gray-500">Late fee surcharge: {s.late_fee_percent}%</div>}
                            {s.allow_installments !== false && <div className="text-xs text-emerald-600">Instalments allowed</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <TablePager {...pg.pager} label="classes" />
          </div>
        )}

        {configClass && (
          <FeeStructureModal
            cls={configClass}
            year={year}
            onClose={() => setConfigClass(null)}
            onSaved={async () => {
              const savedClassId = configClass.id;
              setConfigClass(null);
              await queryClient.invalidateQueries({ queryKey: ['fee-structures', year] });
              queryClient.invalidateQueries({ queryKey: ['finance-overview'] });
              // Immediately offer to BILL the structure so charges actually get
              // created — a saved structure alone does not bill any student.
              const fresh: any = await feeStructureService.list(year);
              const list = fresh?.data?.data ?? fresh?.data ?? [];
              const justSaved = list.find((s: any) => (s.classId || s.class_id) === savedClassId);
              if (justSaved) setBillTarget(justSaved);
            }}
          />
        )}
        {billTarget && (
          <BillTermModal
            structure={billTarget}
            onClose={() => setBillTarget(null)}
            onDone={() => {
              setBillTarget(null);
              // Refresh staff finance views AND the portal ledgers so newly
              // billed charges appear for students/parents immediately.
              ['fee-structures', 'finance-fees', 'finance-overview', 'finance-analytics',
               'student-ledger', 'my-ledger', 'child-ledger',
               'student-dashboard', 'parent-dashboard', 'parent-child-detail']
                .forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
            }}
          />
        )}
        {unbillTarget && (
          <UnbillModal
            structure={unbillTarget}
            onClose={() => setUnbillTarget(null)}
            onDone={() => {
              setUnbillTarget(null);
              ['fee-structures', 'finance-fees', 'finance-overview', 'finance-analytics',
               'student-ledger', 'my-ledger', 'child-ledger',
               'student-dashboard', 'parent-dashboard', 'parent-child-detail']
                .forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
            }}
          />
        )}
      </PageShell>
    </MainLayout>
  );
};

/* ── KPI tile ────────────────────────────────────────────────────────────── */
/** apiClient never throws: turn {success:false} into a query error. */
async function okOrThrow<T>(p: Promise<T>): Promise<T> {
  const r: any = await p;
  if (r?.success === false) throw new Error(r.error || 'Could not load fee data.');
  return r;
}

const KCOLORS: Record<string, string> = {
  blue:    'text-blue-600   bg-blue-500/10',
  indigo:  'text-indigo-600 bg-indigo-500/10',
  emerald: 'text-emerald-600 bg-emerald-500/10',
  rose:    'text-rose-600   bg-rose-500/10',
};
const KPITile: React.FC<{ label: string; value: React.ReactNode; sub?: string; color: string }> = ({ label, value, sub, color }) => (
  <div className={`min-w-0 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 sm:p-4`}>
    {/* Large Le amounts in a half-width phone tile: smaller type and allowed
        to wrap rather than spill out of the card. */}
    <div className={`text-base sm:text-xl font-black leading-tight tabular-nums [overflow-wrap:anywhere] ${KCOLORS[color]?.split(' ')[0] ?? ''}`}>{value}</div>
    <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-0.5">{label}</div>
    {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
  </div>
);

import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const feeStructureSchema = z.object({
  term1Tuition: z.string().min(1, 'Term 1 tuition is required'),
  term2Tuition: z.string(),
  term3Tuition: z.string(),
  applyT1: z.boolean().default(false),
  minPercentNew: z.string().optional(),
  minPercentContinuing: z.string().optional(),
  minPercentTerm: z.string().optional(),
  lateFeePercent: z.string().optional(),
  allowInstallments: z.boolean().default(true),
  chargesCompulsoryFirstTerm: z.boolean().default(false),
  policyNotes: z.string().optional(),
  expenses: z.array(z.object({
    label: z.string(),
    amount: z.union([z.string(), z.number()]),
    required: z.boolean().default(true),
  })).default([]),
});

type FeeStructureForm = z.infer<typeof feeStructureSchema>;

/* ── Fee Structure Modal ──────────────────────────────────────────────────── */
const FeeStructureModal: React.FC<{
  cls: any; year: string;
  onClose: () => void; onSaved: () => void;
}> = ({ cls, year, onClose, onSaved }) => {
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | undefined>(undefined);

  const { control, handleSubmit, watch, reset, formState: { errors } } = useForm<FeeStructureForm>({
    resolver: zodResolver(feeStructureSchema),
    defaultValues: {
      term1Tuition: '',
      term2Tuition: '',
      term3Tuition: '',
      applyT1: false,
      minPercentNew: '',
      minPercentContinuing: '',
      minPercentTerm: '',
      lateFeePercent: '',
      allowInstallments: true,
      chargesCompulsoryFirstTerm: false,
      policyNotes: '',
      expenses: [],
    },
  });

  const { fields: expenseFields, append: addExpense, remove: removeExpense } = useFieldArray({
    control,
    name: 'expenses',
  });

  // Load existing structure
  const { data: existingResp, isLoading: existingLoading, error: existingError } = useQuery({
    queryKey: ['fee-struct', cls.id, year],
    queryFn: () => okOrThrow(feeStructureService.get(cls.id, year)),
    enabled: !!year && !!cls.id,
    staleTime: 0,
  });

  useEffect(() => {
    const s: any = (existingResp as any)?.data?.data ?? (existingResp as any)?.data;
    if (!s) return;
    setExistingId(s.id);
    reset({
      term1Tuition: String(s.term1Tuition ?? s.term1_tuition ?? ''),
      term2Tuition: String(s.term2Tuition ?? s.term2_tuition ?? ''),
      term3Tuition: String(s.term3Tuition ?? s.term3_tuition ?? ''),
      applyT1: false,
      expenses: (s.expenses || []).map((e: any) => ({ 
        label: e.label, 
        amount: Number(e.amount) || 0, 
        required: e.required !== false 
      })),
      minPercentNew: String(s.minPercentNew ?? s.min_percent_new ?? ''),
      minPercentContinuing: String(s.minPercentContinuing ?? s.min_percent_continuing ?? ''),
      minPercentTerm: String(s.minPercentTerm ?? s.min_percent_term ?? ''),
      lateFeePercent: String(s.lateFeePercent ?? s.late_fee_percent ?? ''),
      allowInstallments: s.allowInstallments ?? s.allow_installments ?? true,
      chargesCompulsoryFirstTerm: s.chargesCompulsoryFirstTerm ?? s.charges_compulsory_first_term ?? false,
      policyNotes: s.policyNotes ?? s.policy_notes ?? '',
    });
  }, [existingResp, reset]);

  const term1Tuition = watch('term1Tuition');
  const term2Tuition = watch('term2Tuition');
  const term3Tuition = watch('term3Tuition');
  const applyT1 = watch('applyT1');
  const expenses = watch('expenses');

  const n = (v: any) => Number(v) || 0;
  const t1v = n(term1Tuition), t2v = applyT1 ? t1v : n(term2Tuition), t3v = applyT1 ? t1v : n(term3Tuition);
  const expTotal = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const fullYear = t1v + t2v + t3v + expTotal;

  const submit = async (data: FeeStructureForm) => {
    setSaving(true);
    try {
      const res: any = await feeStructureService.save({
        id: existingId,
        classId: cls.id, 
        academicYear: year,
        term1Tuition: t1v, 
        term2Tuition: t2v, 
        term3Tuition: t3v,
        minPercentNew: data.minPercentNew ? Number(data.minPercentNew) : null,
        minPercentContinuing: data.minPercentContinuing ? Number(data.minPercentContinuing) : null,
        minPercentTerm: data.minPercentTerm ? Number(data.minPercentTerm) : null,
        allowInstallments: data.allowInstallments,
        chargesCompulsoryFirstTerm: data.chargesCompulsoryFirstTerm,
        lateFeePercent: data.lateFeePercent ? Number(data.lateFeePercent) : null,
        policyNotes: data.policyNotes || null,
        expenses: data.expenses.filter((e) => e.label),
      });
      if (res?.success === false) {
        showToast.error(res?.error || 'Failed to save fee structure');
        return;
      }
      showToast.success('Fee structure saved');
      onSaved();
    } catch (err: any) {
      showToast.error(err?.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  // Shared Modal (portal on <body>, header/footer pinned, body scrolls and
  // opens at the top). The old overlay centred a taller-than-screen card in
  // an `overflow-y-auto` flex box, which pushes its top out of reach on
  // phones, so it appeared scrolled to the end.
  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Configure Academic Year Fees"
      size="xl"
      footer={
        <>
          {existingError && <span role="alert" className="w-full sm:w-auto sm:mr-auto text-xs text-red-600">{(existingError as Error).message} Close and try again.</span>}
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="create" size="sm" onClick={handleSubmit(submit)} disabled={saving || existingLoading || !!existingError}>{saving ? 'Saving…' : existingLoading ? 'Loading…' : 'Save Academic Year Fees'}</Button>
        </>
      }
    >
        <p className="text-xs text-gray-500 -mt-2 mb-4 break-words">{cls.name} · {year}</p>
        <form onSubmit={handleSubmit(submit)} className="space-y-6">
          {/* Term tuition */}
          <Section title="Sub-Terms Tuition Fees">
            <Controller
              control={control}
              name="applyT1"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 mb-3 cursor-pointer">
                  <input type="checkbox" {...field} checked={field.value} className="rounded" />
                  Apply Term 1 tuition to Terms 2 & 3
                </label>
              )}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-0">
              <Controller
                control={control}
                name="term1Tuition"
                render={({ field }) => <AmtField label="Term 1 Tuition" {...field} onChange={(v) => field.onChange(v)} error={errors.term1Tuition?.message} />}
              />
              <Controller
                control={control}
                name="term2Tuition"
                render={({ field }) => <AmtField label="Term 2 Tuition" {...field} onChange={(v) => field.onChange(v)} disabled={applyT1} error={errors.term2Tuition?.message} />}
              />
              <Controller
                control={control}
                name="term3Tuition"
                render={({ field }) => <AmtField label="Term 3 Tuition" {...field} onChange={(v) => field.onChange(v)} disabled={applyT1} error={errors.term3Tuition?.message} />}
              />
            </div>
          </Section>

          {/* Year expenses */}
          <Section title="General Academic Year Expenses" hint="One-off full-year charges billed in Term 1 only (Uniform, Exams Levy, ID Card, Development Levy…)">
            {expenseFields.map((field, i) => (
              <div key={field.id} className="flex flex-wrap gap-2 items-center mb-2">
                <Controller
                  control={control}
                  name={`expenses.${i}.label`}
                  render={({ field: f }) => (
                    <input {...f} placeholder="Expense label" style={{ maxWidth: '500px' }} className="w-full sm:w-auto sm:flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
                  )}
                />
                <Controller
                  control={control}
                  name={`expenses.${i}.amount`}
                  render={({ field: f }) => (
                    <input type="number" {...f} value={f.value || ''} placeholder="Le" style={{ maxWidth: '160px' }} className="w-full sm:w-auto sm:flex-1 px-2 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
                  )}
                />
                <div className="flex gap-2 text-xs text-gray-600 dark:text-gray-300 flex-shrink-0">
                  <Controller
                    control={control}
                    name={`expenses.${i}.required`}
                    render={({ field: f }) => (
                      <>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="radio" checked={f.value !== false} onChange={() => f.onChange(true)} />
                          Required
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="radio" checked={f.value === false} onChange={() => f.onChange(false)} />
                          Optional
                        </label>
                      </>
                    )}
                  />
                </div>
                <button type="button" onClick={() => removeExpense(i)} className="p-1.5 text-gray-400 hover:text-rose-600 flex-shrink-0"><Trash2 size={15} /></button>
              </div>
            ))}
            <Button type="button" size="sm" variant="create" className="mt-1" onClick={() => addExpense({ label: '', amount: '', required: true })}><Plus size={14} /> Add Charge Item</Button>
            {expTotal > 0 && <p className="text-xs text-gray-500 mt-2">Total Academic Year Expenses: <span className="font-bold">{fmtLe(expTotal)}</span></p>}
          </Section>

          {/* Payment policy — per-class OVERRIDE of the school-wide policy. */}
          <Section title="Payment Policy Rules" hint="Per-class override. Leave a field blank to use the school-wide policy from Settings → Financial.">
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
              <Controller
                control={control}
                name="minPercentNew"
                render={({ field }) => <PolicyField label="Newly enrolled — min %" {...field} />}
              />
              <Controller
                control={control}
                name="minPercentContinuing"
                render={({ field }) => <PolicyField label="Continuing student — min %" {...field} />}
              />
              <Controller
                control={control}
                name="minPercentTerm"
                render={({ field }) => <PolicyField label="Per-term clearance %" {...field} />}
              />
              <Controller
                control={control}
                name="lateFeePercent"
                render={({ field }) => <PolicyField label="Late-fee surcharge %" {...field} />}
              />
            </div>
            <Controller
              control={control}
              name="allowInstallments"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mt-3 cursor-pointer">
                  <input type="checkbox" {...field} checked={field.value} className="rounded" />
                  Allow instalment payments
                </label>
              )}
            />
            <Controller
              control={control}
              name="chargesCompulsoryFirstTerm"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mt-2 cursor-pointer">
                  <input type="checkbox" {...field} checked={field.value} className="rounded" />
                  Charges must be paid in the First Term (require charges before part-payments)
                </label>
              )}
            />
            <Controller
              control={control}
              name="policyNotes"
              render={({ field }) => (
                <textarea {...field} placeholder="Additional policy notes (optional)…" rows={2} className="w-full mt-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm resize-none" />
              )}
            />
          </Section>

          {/* Live summary */}
          <div className="rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-xs font-bold uppercase text-gray-500 mb-3">Academic Year Unified Financial Summary</div>
            {/* Phones: one row per term (label left, amount right) so long
                amounts stay readable; sm+: the original three columns. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-3">
              {[
                ['Term 1 (Tuition + Expenses)', t1v + expTotal],
                ['Term 2 (Tuition)', t2v],
                ['Term 3 (Tuition)', t3v],
              ].map(([l, v]) => (
                <div key={l as string} className="flex items-baseline justify-between gap-3 min-w-0 sm:block sm:text-center">
                  <div className="order-2 sm:order-none text-sm font-black text-gray-900 dark:text-white tabular-nums whitespace-nowrap sm:whitespace-normal sm:[overflow-wrap:anywhere]">{fmtLe(v)}</div>
                  <div className="order-1 sm:order-none min-w-0 text-[11px] sm:text-[10px] text-gray-500 sm:text-gray-400 sm:mt-0.5">{l}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-gray-200 dark:border-gray-700 pt-3">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Full Year Total</span>
              <span className="text-lg font-black text-indigo-600 tabular-nums [overflow-wrap:anywhere]">{fmtLe(fullYear)}</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              Parents searching in Term 1 will see their Term 1 tuition + itemised year expenses ({fmtLe(t1v + expTotal)}).
            </p>
          </div>
        </form>
    </Modal>
  );
};

/* ── Bill term modal ─────────────────────────────────────────────────────── */
type BillScope = 1 | 2 | 3 | 'year';
const BillTermModal: React.FC<{ structure: any; onClose: () => void; onDone: () => void }> = ({ structure, onClose, onDone }) => {
  const [term, setTerm] = useState<BillScope>('year');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const t1 = Number(structure.term1_tuition) || 0;
  const t2 = Number(structure.term2_tuition) || 0;
  const t3 = Number(structure.term3_tuition) || 0;
  const expTotal = (structure.expenses ?? []).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
  // Per-student amount for the chosen scope. Full year = all tuition + expenses once.
  const scopeAmt = term === 'year' ? t1 + t2 + t3 + expTotal : [0, t1 + expTotal, t2, t3][term];
  const scopeLabel = term === 'year' ? 'the full academic year (all terms)' : `Term ${term}`;

  const submit = async () => {
    if (!dueDate) { showToast.error('Set a due date'); return; }
    setSaving(true);
    try {
      const res: any = await feeStructureService.billTerm(structure.id, term, dueDate);
      if (res?.success === false) { showToast.error(res?.error || 'Billing failed'); return; }
      // apiClient returns the body; reading res.data.data made this always 0,
      // so every billing said "No new charges added".
      const billed = Number(res?.data?.billed ?? 0);
      if (billed === 0) {
        showToast.info('No new charges added — students may already be billed, or the class has no active students.');
      } else {
        showToast.success(`Billed ${billed} student${billed === 1 ? '' : 's'} for ${term === 'year' ? 'the full year' : `Term ${term}`}`);
      }
      onDone();
    } catch (err: any) {
      showToast.error(err?.response?.data?.error || 'Billing failed');
    } finally { setSaving(false); }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Bill Fees — ${structure.class_name}`}
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="create" size="sm" onClick={submit} disabled={saving}>{saving ? 'Billing…' : term === 'year' ? 'Bill Full Year' : `Bill Term ${term}`}</Button>
        </>
      }
    >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">What to bill</label>
            <div className="grid grid-cols-2 gap-1 mt-1 bg-gray-100 dark:bg-gray-900/50 rounded-xl p-1">
              <button onClick={() => setTerm('year')} className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${term === 'year' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}>Full Year</button>
              {([1, 2, 3] as const).map((t) => (
                <button key={t} onClick={() => setTerm(t)} className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${term === t ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}>Term {t}</button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {term === 'year'
                ? 'Bills all three terms at once. Year expenses are charged once (with Term 1).'
                : term === 1 ? 'Term 1 also charges the itemised year expenses.' : `Term ${term} tuition only.`}
            </p>
          </div>
          <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 px-4 py-3 text-sm">
            <div className="text-xs text-indigo-500 mb-1">Total to bill per student</div>
            <div className="text-xl font-black text-indigo-700 dark:text-indigo-400">{fmtLe(scopeAmt)}</div>
            {expTotal > 0 && (term === 'year' || term === 1) && <div className="text-xs text-indigo-400 mt-0.5">inc. {fmtLe(expTotal)} year expenses</div>}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          </div>
          <p className="text-xs text-gray-400">This creates individual fee records for every active student in the class for {scopeLabel}, ready to collect.</p>
        </div>
    </Modal>
  );
};

/* ── Unbill modal ────────────────────────────────────────────────────────── */
const UnbillModal: React.FC<{ structure: any; onClose: () => void; onDone: () => void }> = ({ structure, onClose, onDone }) => {
  const [scope, setScope] = useState<'all' | 1 | 2 | 3>('all');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const res: any = await feeStructureService.unbill(structure.id, scope === 'all' ? undefined : scope);
      if (res?.success === false) { showToast.error(res?.error || 'Unbill failed'); return; }
      const removed = Number(res?.data?.removed ?? 0);
      showToast.success(removed > 0 ? `Removed ${removed} unpaid charge${removed === 1 ? '' : 's'}` : 'Nothing to remove: charges with a payment or on an invoice are kept.');
      onDone();
    } catch (err: any) {
      showToast.error(err?.response?.data?.error || 'Unbill failed');
    } finally { setSaving(false); }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Unbill — ${structure.class_name}`}
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={saving} className="bg-red-600 hover:bg-red-700">{saving ? 'Removing…' : 'Unbill'}</Button>
        </>
      }
    >
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            <Info size={14} className="flex-shrink-0 mt-0.5" />
            <span>Only this structure's <strong>unpaid</strong> charges are removed. Charges with a payment, or already on an invoice, are kept so history is never lost.</span>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Scope</label>
            <div className="grid grid-cols-2 gap-1 mt-1 bg-gray-100 dark:bg-gray-900/50 rounded-xl p-1">
              <button onClick={() => setScope('all')} className={`py-1.5 text-xs font-semibold rounded-lg ${scope === 'all' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}>All Terms</button>
              {([1, 2, 3] as const).map((t) => (
                <button key={t} onClick={() => setScope(t)} className={`py-1.5 text-xs font-semibold rounded-lg ${scope === t ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}>Term {t}</button>
              ))}
            </div>
          </div>
        </div>
    </Modal>
  );
};

/* ── Small sub-components ────────────────────────────────────────────────── */
const BilledBadge: React.FC<{ s: any }> = ({ s }) => (s.billed ? (
  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" title={`Billed: ${(s.billedTerms || []).join(', ') || 'yes'}`}>BILLED</span>
) : (
  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400" title="Not billed yet">NOT BILLED</span>
));

const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <div>
    <div className="flex items-center gap-1.5 mb-2">
      <h4 className="text-xs font-bold uppercase text-gray-600 dark:text-gray-400">{title}</h4>
      {hint && <span title={hint}><Info size={13} className="text-gray-300 cursor-help" /></span>}
    </div>
    {children}
  </div>
);

const AmtField: React.FC<{ label: string; value: string; onChange: (v: string) => void; disabled?: boolean; error?: string }> = ({ label, value, onChange, disabled, error }) => (
  <div>
    <label className="text-[11px] text-gray-400 uppercase font-semibold">{label}</label>
    <div className="relative mt-1">
      {!value && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Le</span>}
      <input type="number" min={0} placeholder="e.g. 1500" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={`w-full py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm disabled:opacity-50 disabled:cursor-not-allowed ${!value ? 'pl-8 pr-3' : 'px-3'} ${error ? 'border-red-500' : ''}`} />
    </div>
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
);

const PolicyField: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div>
    <label className="text-[11px] text-gray-400 uppercase font-semibold">{label}</label>
    <div className="relative mt-1">
      <input type="number" placeholder="e.g. 50" value={value} onChange={(e) => onChange(e.target.value)} min={0} max={100} className="w-full pl-3 pr-8 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
    </div>
  </div>
);

export default FeesPage;
