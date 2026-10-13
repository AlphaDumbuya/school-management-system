/**
 * HousesPage: /students/houses
 * School houses and the house ballot.
 *
 * Principal and admissions officer (managers):
 *  - Ballot: draw a house for each new student (live, one by one) or all at once.
 *  - Houses & rules: add, recolour and switch off houses; set the ballot rules.
 *  - Teachers: house masters / mistresses and house teachers; which teachers may draw.
 *  - House lists: who is in which house, counts by class, moves and exports.
 *  - History: every draw and change.
 *
 * Teachers see only what they were given: their house's students (view only)
 * and, if allowed, a ballot for their own classes.
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import useAuth from '@hooks/useAuth';
import { houseService } from '@services/houseService';
import { BallotTab } from './components/houses/BallotTab';
import { HousesTab } from './components/houses/HousesTab';
import { TeachersTab } from './components/houses/TeachersTab';
import { ListsTab } from './components/houses/ListsTab';
import { HistoryTab } from './components/houses/HistoryTab';
import { TeacherHousesView } from './components/houses/TeacherHousesView';
import { unwrap } from './components/houses/houseUi';

type Tab = 'ballot' | 'houses' | 'teachers' | 'lists' | 'history';
const TABS: { id: Tab; label: string }[] = [
  { id: 'ballot', label: 'Ballot' },
  { id: 'houses', label: 'Houses & rules' },
  { id: 'teachers', label: 'Teachers' },
  { id: 'lists', label: 'House lists' },
  { id: 'history', label: 'History' },
];

const ManagerHouses: React.FC = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('ballot');

  const summaryQ = useQuery({
    queryKey: ['houses', 'summary'],
    queryFn: async () => unwrap(await houseService.summary()),
    staleTime: 15_000,
  });
  const summary = summaryQ.data;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['houses'] });

  return (
    <PageShell
      title="Sport House"
      subtitle={summary ? `${summary.houses.filter((h) => h.is_active).length} houses · ${summary.unassigned} student${summary.unassigned === 1 ? '' : 's'} waiting for a house` : 'School houses and the house ballot'}
      breadcrumbs={[{ label: 'Admissions', href: '/students/admissions' }, { label: 'Sport House' }]}
      onRefresh={() => summaryQ.refetch().then(refresh)}
      isRefreshing={summaryQ.isFetching}
    >
      {summaryQ.error && (
        <p role="alert" className="mb-4 text-sm text-red-600">{(summaryQ.error as Error).message} <button type="button" className="font-bold underline" onClick={() => summaryQ.refetch()}>Retry</button></p>
      )}

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Houses sections">
        {TABS.map((t) => (
          <button key={t.id} id={`houses-tab-${t.id}`} type="button" role="tab" aria-selected={tab === t.id} aria-controls={`houses-panel-${t.id}`} onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-semibold ${tab === t.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
            {t.label}
            {t.id === 'ballot' && summary && summary.unassigned > 0 && <span className="ml-1.5 rounded-full bg-white/25 px-1.5 text-xs">{summary.unassigned}</span>}
          </button>
        ))}
      </div>

      <div id={`houses-panel-${tab}`} role="tabpanel" aria-labelledby={`houses-tab-${tab}`}>
        {tab === 'ballot' && <BallotTab summary={summary} onChanged={refresh} onGoHouses={() => setTab('houses')} />}
        {tab === 'houses' && <HousesTab summary={summary} onChanged={refresh} onGoTeachers={() => setTab('teachers')} />}
        {tab === 'teachers' && <TeachersTab summary={summary} onChanged={refresh} />}
        {tab === 'lists' && <ListsTab summary={summary} onChanged={refresh} />}
        {tab === 'history' && <HistoryTab />}
      </div>
    </PageShell>
  );
};

const TeacherHouses: React.FC = () => {
  const accessQ = useQuery({ queryKey: ['houses', 'me'], queryFn: async () => unwrap(await houseService.myAccess()), staleTime: 30_000 });
  const access = accessQ.data;
  return (
    <PageShell
      title={access && access.houses.length === 1 ? access.houses[0].name : 'Sport House'}
      subtitle="Your house and the students in it"
      breadcrumbs={[{ label: 'Sport House' }]}
      onRefresh={() => accessQ.refetch()}
      isRefreshing={accessQ.isFetching}
    >
      {accessQ.error ? (
        <p role="alert" className="text-sm text-red-600">{(accessQ.error as Error).message} <button type="button" className="font-bold underline" onClick={() => accessQ.refetch()}>Retry</button></p>
      ) : accessQ.isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : access && access.has_access ? (
        <TeacherHousesView access={access} />
      ) : (
        <EmptyState message="Houses are not open to you" description="The principal or the admissions officer decides who sees this page. Ask them if you should have access." />
      )}
    </PageShell>
  );
};

export const HousesPage: React.FC = () => {
  const { user } = useAuth();
  const duties = (((user as any)?.staffDuties ?? []) as string[]);
  const isManager = ['principal', 'super_admin', 'admissions_officer'].includes(String(user?.role)) || duties.includes('admissions_officer');
  return <MainLayout>{isManager ? <ManagerHouses /> : <TeacherHouses />}</MainLayout>;
};

export default HousesPage;
