/**
 * Financial Reports (bursar Phase C, R5): trial balance, income statement,
 * balance sheet, cash flow and general ledger, for an academic year or dates,
 * each exportable (CSV / Excel / PDF), with the books' integrity checks.
 */
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { ExportButton } from '@components/admin/common/ExportButton';
import { usePaged, TablePager } from '@components/admin/table/TablePager';
import { useAcademicYears } from '@hooks/useAcademicYears';
import { bursarC, type GLAccount } from '@services/bursarService';
import { unwrap, PeriodPicker, periodQuery, AccountSelect, Money, CheckBadge, todayLocal, HEADER_EXPORT, type Period } from '@components/finance/AccountingUi';
import { ChartCard } from '@components/admin/charts/ChartCard';
import { fmtLeShort, NO_SERIES } from '@lib/chartFormat';

/** Top-N accounts by amount, the rest grouped as "Other" (donut stays readable). */
function topSlices(rows: { name: string; amount: number }[], n = 6) {
  const pos = rows.filter((r) => Number(r.amount) > 0).sort((a, b) => Number(b.amount) - Number(a.amount));
  if (!pos.length) return NO_SERIES;
  const top = pos.slice(0, n);
  const rest = pos.slice(n).reduce((s, r) => s + Number(r.amount), 0);
  return {
    labels: [...top.map((r) => r.name), ...(rest > 0 ? ['Other'] : [])],
    series: [{ name: 'Le', data: [...top.map((r) => Number(r.amount)), ...(rest > 0 ? [rest] : [])] }],
  };
}

const TABS = [
  ['trial-balance', 'Trial balance'], ['income-statement', 'Income statement'], ['balance-sheet', 'Balance sheet'],
  ['cash-flow', 'Cash flow'], ['ledger', 'General ledger'],
] as const;
type Tab = typeof TABS[number][0];

const Card: React.FC<{ title: string; right?: React.ReactNode; children: React.ReactNode }> = ({ title, right, children }) => (
  <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800"><h2 className="text-sm font-bold">{title}</h2>{right}</div>
    {children}
  </section>
);
const Row: React.FC<{ label: React.ReactNode; v: number; bold?: boolean; indent?: boolean; code?: string }> = ({ label, v, bold, indent, code }) => (
  <tr className={`border-t border-gray-100 dark:border-gray-800 ${bold ? 'font-bold bg-gray-50/70 dark:bg-gray-900/30' : ''}`}>
    <td className={`px-4 py-2 ${indent ? 'pl-8' : ''}`}>{code && <span className="font-mono text-xs text-gray-400 mr-2">{code}</span>}{label}</td>
    <td className="px-4 py-2 text-right whitespace-nowrap"><Money v={v} zero={bold ? 'Le 0.00' : '—'} className={v < 0 ? 'text-red-600' : undefined} /></td>
  </tr>
);
/** Honest empty state inside a statement card: nothing is invented for an empty period. */
const Nothing: React.FC<{ title: string; hint: string }> = ({ title, hint }) => (
  <div className="px-4 py-8 text-center">
    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</p>
    <p className="mt-1 text-xs text-gray-500 max-w-md mx-auto">{hint}</p>
  </div>
);
const Loading = () => <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;
const Err: React.FC<{ e: unknown; retry: () => void }> = ({ e, retry }) => <p role="alert" className="p-4 text-sm text-red-600">{(e as Error).message} <button type="button" className="font-bold underline" onClick={retry}>Retry</button></p>;

export const FinancialReportsPage: React.FC = () => {
  const [sp, setSp] = useSearchParams();
  const tab = (TABS.find(([k]) => k === sp.get('tab'))?.[0] || 'trial-balance') as Tab;
  const account = sp.get('account') || '';
  const { activeYear } = useAcademicYears();
  const [period, setPeriod] = useState<Period>({ mode: 'year', year: '', from: '', to: todayLocal() });
  const rq = periodQuery(period, activeYear);
  const ready = period.mode === 'dates' || !!rq.academic_year;
  const setTab = (t: Tab) => { const n = new URLSearchParams(sp); n.set('tab', t); setSp(n, { replace: true }); };
  const setAccount = (id: string) => { const n = new URLSearchParams(sp); id ? n.set('account', id) : n.delete('account'); setSp(n, { replace: true }); };

  const integrity = useQuery({ queryKey: ['fin-gl-integrity'], queryFn: () => unwrap<any>(bursarC.integrity()) });
  const accounts = useQuery({ queryKey: ['fin-gl-accounts'], queryFn: () => unwrap<GLAccount[]>(bursarC.accounts()), enabled: tab === 'ledger' });
  const report = useQuery({
    queryKey: ['fin-gl-report', tab, rq], enabled: ready && tab !== 'ledger',
    queryFn: () => unwrap<any>(bursarC.report(tab as any, period.mode === 'dates' && tab === 'balance-sheet' ? { to: rq.to } : rq), 'Could not build the report.'),
  });
  const ledger = useQuery({ queryKey: ['fin-gl-ledger', account, rq], enabled: ready && tab === 'ledger' && !!account, queryFn: () => unwrap<any>(bursarC.ledger(account, rq), 'Could not load the ledger.') });
  const ledgerPg = usePaged<any>(ledger.data?.lines || [], [account, JSON.stringify(rq)], 50);
  const d = report.data;
  const exportParams = Object.fromEntries(Object.entries(rq).filter(([, v]) => v)) as Record<string, string>;
  const exportFor = (endpoint: string, filename: string) => <ExportButton className={HEADER_EXPORT} endpoint={`/api/v1/finance/gl/reports/${endpoint}`} filename={filename} params={exportParams} />;

  return (
    <MainLayout>
      <PageShell title="Financial Statements" subtitle="Statements from the school's books, ready for the board, auditors or the ministry"
        onRefresh={() => { report.refetch(); integrity.refetch(); ledger.refetch(); }} isRefreshing={report.isFetching || ledger.isFetching} mobileLabels
        actions={<PeriodPicker value={period} onChange={setPeriod} activeYear={activeYear} asAt={tab === 'balance-sheet'} />}>

        {integrity.data && (
          <div className="mb-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <div className="flex flex-wrap items-center gap-2 mb-2"><h2 className="text-sm font-bold mr-2">Books check · {integrity.data.as_at}</h2><CheckBadge ok={integrity.data.balanced} okText="Debits equal credits" badText="Books do not balance" /></div>
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              {integrity.data.checks.map((c: any) => (
                <li key={c.label} className={`rounded-xl border px-3 py-2 ${c.ok ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/10' : 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20'}`}>
                  <div className="font-semibold">{c.ok ? '✓' : '!'} {c.label}</div>
                  <div className="text-gray-600 dark:text-gray-400">Books <Money v={c.books} zero="Le 0.00" /> · Records <Money v={c.records} zero="Le 0.00" />{!c.ok && <> · Difference <Money v={c.difference} /></>}</div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div role="tablist" aria-label="Report" className="mb-4 flex flex-wrap gap-1 rounded-xl bg-gray-100 dark:bg-gray-900/50 p-1 w-fit">
          {TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-[40px] sm:min-h-0 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${tab === k ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}>{l}</button>)}
        </div>

        {tab !== 'ledger' && (report.error ? <Err e={report.error} retry={() => report.refetch()} /> : report.isLoading || !d ? <Loading /> : (
          <>
            {tab === 'trial-balance' && (
              <Card title={`Trial balance · ${d.range.label}`} right={<div className="flex flex-wrap items-center gap-2"><CheckBadge ok={d.balanced} okText="Balanced" badText="Not balanced" />{exportFor('trial-balance', 'trial-balance')}</div>}>
                {!d.lines.length ? <Nothing title="Nothing posted in this period" hint="The trial balance fills in by itself as fees are billed, payments come in, expenses are recorded and payroll is paid." /> : (
                <table className="w-full min-w-[30rem] text-sm">
                  <thead className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-900/40"><tr><th className="px-4 py-2 text-left">Account</th><th className="px-4 py-2 text-right">Debit</th><th className="px-4 py-2 text-right">Credit</th></tr></thead>
                  <tbody>
                    {d.lines.map((l: any) => <tr key={l.account_id || l.name} className="border-t border-gray-100 dark:border-gray-800"><td className="px-4 py-2 min-w-[12rem]"><span className="font-mono text-xs text-gray-400 mr-2">{l.code}</span>{l.name}</td><td className="px-4 py-2 text-right whitespace-nowrap"><Money v={l.debit} zero="" /></td><td className="px-4 py-2 text-right whitespace-nowrap"><Money v={l.credit} zero="" /></td></tr>)}
                    <tr className="border-t-2 border-gray-200 dark:border-gray-700 font-bold"><td className="px-4 py-2.5">Total</td><td className="px-4 py-2.5 text-right whitespace-nowrap"><Money v={d.total_debit} zero="Le 0.00" /></td><td className="px-4 py-2.5 text-right whitespace-nowrap"><Money v={d.total_credit} zero="Le 0.00" /></td></tr>
                  </tbody>
                </table>
                )}
              </Card>
            )}

            {tab === 'income-statement' && (Number(d.total_income) > 0 || Number(d.total_expenses) > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                <ChartCard title="Income vs expenses" subtitle={d.range.label} type="bar" height={260}
                  colors={['#10b981', '#ef4444', '#3b82f6']} valueFormatter={fmtLeShort}
                  labels={['Income', 'Expenses', d.surplus >= 0 ? 'Surplus' : 'Deficit']}
                  series={[{ name: 'Le', data: [Number(d.total_income) || 0, Number(d.total_expenses) || 0, Math.abs(Number(d.surplus) || 0)] }]} />
                <ChartCard title="Where income comes from" type="donut" height={260} valueFormatter={fmtLeShort}
                  emptyState={{ message: 'No income in this period' }} {...topSlices(d.income)} />
                <ChartCard title="Where the money goes" type="donut" height={260} valueFormatter={fmtLeShort}
                  emptyState={{ message: 'No expenses in this period' }} {...topSlices(d.expenses)} />
              </div>
            )}

            {tab === 'balance-sheet' && (Number(d.total_assets) > 0 || Number(d.total_liabilities) > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                <div className="lg:col-span-2">
                  <ChartCard title="What the school has and owes" subtitle={`As at ${d.as_at}`} type="bar" height={260}
                    colors={['#3b82f6', '#f59e0b', '#10b981']} valueFormatter={fmtLeShort}
                    labels={['Assets', 'Liabilities', 'Equity']}
                    series={[{ name: 'Le', data: [Number(d.total_assets) || 0, Number(d.total_liabilities) || 0, Number(d.total_equity) || 0] }]} />
                </div>
                <ChartCard title="Assets" subtitle="By account" type="donut" height={260} valueFormatter={fmtLeShort}
                  emptyState={{ message: 'No assets recorded' }} {...topSlices(d.assets)} />
              </div>
            )}

            {tab === 'cash-flow' && (
              Number(d.net_operating) !== 0 || Number(d.net_investing) !== 0 || Number(d.net_financing) !== 0 || Number(d.opening_cash) !== 0 || Number(d.closing_cash) !== 0
            ) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <ChartCard title="Cash movement" subtitle={`Net cash by activity · ${d.range.label}`} type="bar" height={260}
                  colors={['#3b82f6']} valueFormatter={fmtLeShort}
                  labels={['Operating', 'Investing', 'Financing']}
                  series={[{ name: 'Net cash', data: [Number(d.net_operating) || 0, Number(d.net_investing) || 0, Number(d.net_financing) || 0] }]} />
                <ChartCard title="Opening to closing cash" subtitle="Where the school's cash started and ended" type="bar" height={260}
                  colors={['#10b981']} valueFormatter={fmtLeShort}
                  labels={['Opening', 'Closing']}
                  series={[{ name: 'Cash', data: [Number(d.opening_cash) || 0, Number(d.closing_cash) || 0] }]} />
              </div>
            )}

            {tab === 'income-statement' && (
              <Card title={`Income statement · ${d.range.label}`} right={exportFor('income-statement', 'income-statement')}>
                {!d.income.length && !d.expenses.length ? <Nothing title="No income or expenses in this period" hint="Income comes from fees billed (less discounts) and other income journals; expenses from recorded expenses, petty cash spending and paid payroll." /> : <>
                <table className="w-full text-sm"><tbody>
                  <tr><td colSpan={2} className="px-4 pt-3 pb-1 text-xs font-bold uppercase text-gray-500">Income</td></tr>
                  {d.income.map((l: any) => <Row key={l.account_id} code={l.code} label={l.name} v={l.amount} indent />)}
                  <Row label="Total income" v={d.total_income} bold />
                  <tr><td colSpan={2} className="px-4 pt-4 pb-1 text-xs font-bold uppercase text-gray-500">Expenses</td></tr>
                  {d.expenses.map((l: any) => <Row key={l.account_id} code={l.code} label={l.name} v={l.amount} indent />)}
                  <Row label="Total expenses" v={d.total_expenses} bold />
                  <tr className="border-t-2 border-gray-300 dark:border-gray-600 text-base font-black"><td className="px-4 py-3">{d.surplus >= 0 ? 'Surplus' : 'Deficit'}</td><td className={`px-4 py-3 text-right ${d.surplus < 0 ? 'text-red-600' : 'text-emerald-700'}`}><Money v={d.surplus} zero="Le 0.00" /></td></tr>
                </tbody></table>
                {d.discounts > 0 && <p className="px-4 pb-3 text-xs text-gray-500">Fees billed <Money v={d.gross_income} /> less discounts, scholarships and waivers <Money v={d.discounts} />.</p>}
                </>}
              </Card>
            )}

            {tab === 'balance-sheet' && (
              <Card title={`Balance sheet · as at ${d.as_at}`} right={<div className="flex flex-wrap items-center gap-2"><CheckBadge ok={d.balanced} okText="Assets = liabilities + equity" badText="Does not balance" />{exportFor('balance-sheet', 'balance-sheet')}</div>}>
                {!d.assets.length && !d.liabilities.length && !d.equity.length ? <Nothing title={`No balances as at ${d.as_at}`} hint="Fees owed, money received and amounts the school owes appear here once they are recorded. Use a journal for opening balances held before the school started using the system." /> : (
                <table className="w-full text-sm"><tbody>
                  <tr><td colSpan={2} className="px-4 pt-3 pb-1 text-xs font-bold uppercase text-gray-500">Assets</td></tr>
                  {d.assets.map((l: any) => <Row key={l.account_id} code={l.code} label={l.name} v={l.amount} indent />)}
                  <Row label="Total assets" v={d.total_assets} bold />
                  <tr><td colSpan={2} className="px-4 pt-4 pb-1 text-xs font-bold uppercase text-gray-500">Liabilities</td></tr>
                  {d.liabilities.map((l: any) => <Row key={l.account_id} code={l.code} label={l.name} v={l.amount} indent />)}
                  <Row label="Total liabilities" v={d.total_liabilities} bold />
                  <tr><td colSpan={2} className="px-4 pt-4 pb-1 text-xs font-bold uppercase text-gray-500">Equity</td></tr>
                  {d.equity.map((l: any) => <Row key={l.account_id || l.name} code={l.code} label={l.name} v={l.amount} indent />)}
                  <Row label="Total equity" v={d.total_equity} bold />
                  <Row label="Liabilities + equity" v={d.total_liabilities + d.total_equity} bold />
                </tbody></table>
                )}
              </Card>
            )}

            {tab === 'cash-flow' && (
              <Card title={`Cash flow · ${d.range.label}`} right={<div className="flex flex-wrap items-center gap-2"><CheckBadge ok={d.balanced} okText="Agrees with cash accounts" badText="Does not agree" />{exportFor('cash-flow', 'cash-flow')}</div>}>
                {!Number(d.opening_cash) && !Number(d.closing_cash) && !d.operating.length && !d.investing.length && !d.financing.length ? <Nothing title="No money moved in this period" hint="Cash flow counts money in and out of cash on hand, bank, mobile money and petty cash: payments received, refunds, expenses and salaries paid." /> : (
                <table className="w-full text-sm"><tbody>
                  <Row label="Opening cash (cash, bank, mobile money, petty cash)" v={d.opening_cash} bold />
                  <tr><td colSpan={2} className="px-4 pt-3 pb-1 text-xs font-bold uppercase text-gray-500">Operating activities</td></tr>
                  {d.operating.map((l: any) => <Row key={l.label} label={l.label} v={l.amount} indent />)}
                  <Row label="Net cash from operating activities" v={d.net_operating} bold />
                  {d.investing.length > 0 && <><tr><td colSpan={2} className="px-4 pt-3 pb-1 text-xs font-bold uppercase text-gray-500">Investing activities</td></tr>{d.investing.map((l: any) => <Row key={l.label} label={l.label} v={l.amount} indent />)}</>}
                  {d.financing.length > 0 && <><tr><td colSpan={2} className="px-4 pt-3 pb-1 text-xs font-bold uppercase text-gray-500">Financing activities</td></tr>{d.financing.map((l: any) => <Row key={l.label} label={l.label} v={l.amount} indent />)}</>}
                  <Row label="Net change in cash" v={d.net_change} bold />
                  <tr className="border-t-2 border-gray-300 dark:border-gray-600 text-base font-black"><td className="px-4 py-3">Closing cash</td><td className="px-4 py-3 text-right whitespace-nowrap"><Money v={d.closing_cash} zero="Le 0.00" /></td></tr>
                </tbody></table>
                )}
              </Card>
            )}
          </>
        ))}

        {tab === 'ledger' && (
          <Card title={ledger.data ? `${ledger.data.account.code} ${ledger.data.account.name} · ${ledger.data.range.label}` : 'General ledger'}
            right={<div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {accounts.data && <AccountSelect ariaLabel="Account" value={account} onChange={setAccount} accounts={accounts.data} className="min-h-[40px] sm:min-h-0 w-full sm:w-auto px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm sm:max-w-xs" />}
              {account && exportFor(`ledger/${account}`, 'ledger')}
            </div>}>
            {!account ? <p className="p-4 text-sm text-gray-500">Choose an account to see every entry on it with a running balance.</p>
              : ledger.error ? <Err e={ledger.error} retry={() => ledger.refetch()} />
              : ledger.isLoading || !ledger.data ? <Loading />
              : (
                <>
                  <table className="w-full min-w-[44rem] text-sm">
                    <thead className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-900/40"><tr><th className="px-4 py-2 text-left whitespace-nowrap">Date</th><th className="px-4 py-2 text-left whitespace-nowrap">Entry</th><th className="px-4 py-2 text-left min-w-[14rem]">Details</th><th className="px-4 py-2 text-right whitespace-nowrap">Debit</th><th className="px-4 py-2 text-right whitespace-nowrap">Credit</th><th className="px-4 py-2 text-right whitespace-nowrap">Balance</th></tr></thead>
                    <tbody>
                      {ledgerPg.pager.page === 0 && <tr className="border-t border-gray-100 dark:border-gray-800 text-gray-500"><td className="px-4 py-2" colSpan={5}>Opening balance</td><td className="px-4 py-2 text-right font-semibold"><Money v={ledger.data.opening} zero="Le 0.00" /></td></tr>}
                      {ledgerPg.pageRows.map((l: any) => (
                        <tr key={l.id} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="px-4 py-2 whitespace-nowrap text-gray-600">{l.entry_date}</td><td className="px-4 py-2 font-mono text-xs whitespace-nowrap">{l.entry_no}</td>
                          <td className="px-4 py-2">{l.line_memo || l.memo || '—'}</td>
                          <td className="px-4 py-2 text-right whitespace-nowrap"><Money v={l.debit} zero="" /></td><td className="px-4 py-2 text-right whitespace-nowrap"><Money v={l.credit} zero="" /></td>
                          <td className="px-4 py-2 text-right font-semibold whitespace-nowrap"><Money v={l.balance} zero="Le 0.00" /></td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-gray-200 dark:border-gray-700 font-bold"><td className="px-4 py-2.5" colSpan={5}>Closing balance</td><td className="px-4 py-2.5 text-right"><Money v={ledger.data.closing} zero="Le 0.00" /></td></tr>
                    </tbody>
                  </table>
                  <TablePager {...ledgerPg.pager} label="lines" />
                  {ledger.data.truncated && <p className="px-4 pb-3 text-xs text-amber-700">Showing the first 5,000 lines. Narrow the dates to see the rest.</p>}
                </>
              )}
          </Card>
        )}
      </PageShell>
    </MainLayout>
  );
};

export default FinancialReportsPage;
