/**
 * What a teacher sees on the Houses page, and only if the principal or
 * admissions officer allowed it:
 *  - My house: the students of the house(s) they look after (view only).
 *  - Ballot: only when they may draw, and only for students in their own classes.
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { SearchBar } from '@components/admin/table/SearchBar';
import { houseService, type TeacherHouseAccess } from '@services/houseService';
import { BallotTab } from './BallotTab';
import { HouseChip, selectClass, textOn, unwrap } from './houseUi';

export const TeacherHousesView: React.FC<{ access: TeacherHouseAccess }> = ({ access }) => {
  const queryClient = useQueryClient();
  const hasHouse = access.houses.length > 0;
  const [tab, setTab] = useState<'house' | 'ballot'>(hasHouse ? 'house' : 'ballot');
  const [houseId, setHouseId] = useState(access.houses[0]?.id || '');
  const [search, setSearch] = useState('');
  const house = access.houses.find((h) => h.id === houseId) || access.houses[0];

  const q = useQuery({
    queryKey: ['houses', 'my-students', house?.id, search],
    queryFn: async () => unwrap(await houseService.myStudents({ house_id: house?.id, search: search || undefined })),
    enabled: !!house && tab === 'house',
    staleTime: 15_000,
  });
  const rows = q.data || [];

  const tabs = [
    ...(hasHouse ? [{ id: 'house' as const, label: access.houses.length > 1 ? 'My houses' : 'My house' }] : []),
    ...(access.can_draw ? [{ id: 'ballot' as const, label: 'Ballot for my classes' }] : []),
  ];

  return (
    <div className="space-y-5">
      {tabs.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Houses sections">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-semibold ${tab === t.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'house' && house && (
        <div className="space-y-4">
          <div className="rounded-2xl px-5 py-4" style={{ backgroundColor: house.color, color: textOn(house.color) }}>
            <p className="text-xs font-semibold opacity-90">{house.position === 'master' ? 'You are the house master / mistress of' : 'You are a teacher in'}</p>
            <p className="text-2xl font-black">{house.name}</p>
            {house.motto && <p className="text-sm italic opacity-90">“{house.motto}”</p>}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
            <SearchBar placeholder="Search name or student number…" onSearch={setSearch} isLoading={q.isFetching} className="w-full" />
            {access.houses.length > 1 && (
              <div>
                <label htmlFor="my-house" className="sr-only">House</label>
                <select id="my-house" value={house.id} onChange={(e) => setHouseId(e.target.value)} className={selectClass}>
                  {access.houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
            )}
          </div>
          {q.error ? (
            <p role="alert" className="text-sm text-red-600">{(q.error as Error).message} <button type="button" className="font-bold underline" onClick={() => q.refetch()}>Retry</button></p>
          ) : q.isLoading ? (
            <p className="text-sm text-gray-500">Loading students…</p>
          ) : rows.length === 0 ? (
            <EmptyState message="No students in this house yet" description={search ? 'Try another name.' : 'Students appear here after the house ballot.'} />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <table className="w-full min-w-[480px] text-sm">
                <caption className="sr-only">Students in {house.name}</caption>
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500 dark:border-gray-700">
                    <th scope="col" className="px-4 py-2 font-semibold">Student</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Class</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Sex</th>
                    <th scope="col" className="px-3 py-2 font-semibold">House</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} className="border-b border-gray-50 last:border-0 dark:border-gray-700/50">
                      <td className="px-4 py-2"><p className="font-semibold text-gray-900 dark:text-white">{s.first_name} {s.last_name}</p><p className="text-xs text-gray-500">{s.student_number}</p></td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{s.class_name || '—'}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{s.gender || '—'}</td>
                      <td className="px-3 py-2"><HouseChip name={s.house_name} color={s.house_color} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-gray-500">{rows.length} student{rows.length === 1 ? '' : 's'}. This list is view only.</p>
        </div>
      )}

      {tab === 'ballot' && access.can_draw && (
        <BallotTab teacher={{ houses: access.draw_houses }} onChanged={() => queryClient.invalidateQueries({ queryKey: ['houses'] })} />
      )}
    </div>
  );
};
