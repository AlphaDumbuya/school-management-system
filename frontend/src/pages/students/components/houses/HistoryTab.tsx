/**
 * History tab: every ballot, automatic draw and change of house, newest first.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { houseService } from '@services/houseService';
import { HouseChip, METHOD_LABEL, fmtDateTime, unwrap } from './houseUi';

export const HistoryTab: React.FC = () => {
  const q = useQuery({ queryKey: ['houses', 'log'], queryFn: async () => unwrap(await houseService.log()), staleTime: 15_000 });
  if (q.error) return <p role="alert" className="text-sm text-red-600">{(q.error as Error).message} <button type="button" className="font-bold underline" onClick={() => q.refetch()}>Retry</button></p>;
  if (q.isLoading) return <p className="text-sm text-gray-500">Loading history…</p>;
  const rows = q.data || [];
  if (!rows.length) return <EmptyState message="Nothing here yet" description="Draws and house changes will be listed here." />;
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <table className="w-full min-w-[640px] text-sm">
        <caption className="sr-only">Latest house draws and changes</caption>
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs text-gray-500 dark:border-gray-700">
            <th scope="col" className="px-4 py-2 font-semibold">When</th>
            <th scope="col" className="px-3 py-2 font-semibold">Student</th>
            <th scope="col" className="px-3 py-2 font-semibold">House</th>
            <th scope="col" className="px-3 py-2 font-semibold">How</th>
            <th scope="col" className="px-3 py-2 font-semibold">By</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-gray-50 align-top last:border-0 dark:border-gray-700/50">
              <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-500">{fmtDateTime(r.created_at)}</td>
              <td className="px-3 py-2"><p className="font-semibold text-gray-900 dark:text-white">{r.first_name} {r.last_name}</p><p className="text-xs text-gray-500">{r.student_number}</p></td>
              <td className="px-3 py-2">
                <HouseChip name={r.house_name} color={r.house_color} />
                {r.previous_house_name && <p className="mt-1 text-xs text-gray-500">was {r.previous_house_name}</p>}
              </td>
              <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{METHOD_LABEL[r.method] || r.method}{r.reason && <p className="text-xs text-gray-500">{r.reason}</p>}</td>
              <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{r.by_name || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
