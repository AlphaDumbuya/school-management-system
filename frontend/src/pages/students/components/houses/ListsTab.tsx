/**
 * House lists tab: who is in which house (filter, search, export for sports
 * day), counts by class, and moving a student to another house with a reason.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@components/admin/feedback/Modal';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { SearchBar } from '@components/admin/table/SearchBar';
import { ExportButton } from '@components/admin/common/ExportButton';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { houseService, type HouseStudent, type HouseSummary } from '@services/houseService';
import { HouseChip, inputClass, selectClass, textOn, unwrap } from './houseUi';
import { SearchableMultiSelect } from './SearchableMultiSelect';

export const ListsTab: React.FC<{ summary?: HouseSummary; onChanged: () => void }> = ({ summary, onChanged }) => {
  const [houseId, setHouseId] = useState('');
  const [classIds, setClassIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [moving, setMoving] = useState<HouseStudent | null>(null);
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const houses = summary?.houses || [];
  const q = useQuery({
    queryKey: ['houses', 'students', houseId, classIds.join(','), search],
    queryFn: async () => unwrap(await houseService.students({ house_id: houseId || undefined, class_ids: classIds.length ? classIds.join(',') : undefined, search: search || undefined, limit: 500 })),
    staleTime: 15_000,
  });
  const rows = q.data || [];

  const startMove = (s: HouseStudent) => { setMoving(s); setTarget(s.house_id || ''); setReason(''); };
  const save = async () => {
    if (!moving) return;
    setSaving(true);
    try {
      const r = await houseService.assign({ student_id: moving.id, house_id: target || null, reason: reason.trim() || undefined });
      if (r.success === false) { showToast.error(r.error || 'Could not change the house'); return; }
      showToast.success(r.data?.unchanged ? 'No change' : 'House updated');
      setMoving(null); onChanged();
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      {summary && summary.by_class.length > 0 && houses.length > 0 && (
        <section aria-labelledby="by-class-h" className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <h2 id="by-class-h" className="px-4 pt-3 text-base font-bold text-gray-900 dark:text-white">Students by class and house</h2>
          <table className="mt-2 w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 dark:border-gray-700">
                <th scope="col" className="px-4 py-2 font-semibold">Class</th>
                {houses.map((h) => (
                  <th key={h.id} scope="col" className="px-3 py-2 text-center font-semibold">
                    <span className="inline-block rounded-full px-2 py-0.5" style={{ backgroundColor: h.color, color: textOn(h.color) }}>{h.name}</span>
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 text-center font-semibold">No house</th>
                <th scope="col" className="px-3 py-2 text-center font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {summary.by_class.map((c) => (
                <tr key={c.class_id || 'none'} className="border-b border-gray-50 last:border-0 dark:border-gray-700/50">
                  <th scope="row" className="px-4 py-2 text-left font-semibold text-gray-900 dark:text-white">{c.class_name}</th>
                  {houses.map((h) => <td key={h.id} className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">{c.houses[h.id] || 0}</td>)}
                  <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">{c.unassigned}</td>
                  <td className="px-3 py-2 text-center font-bold text-gray-900 dark:text-white">{c.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section aria-labelledby="who-h" className="space-y-3">
        <h2 id="who-h" className="text-base font-bold text-gray-900 dark:text-white">Who is in which house</h2>
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_180px_200px_auto]">
          <SearchBar placeholder="Search name or student number…" onSearch={setSearch} isLoading={q.isFetching} className="w-full" />
          <div>
            <label htmlFor="list-house" className="sr-only">House</label>
            <select id="list-house" value={houseId} onChange={(e) => setHouseId(e.target.value)} className={selectClass}>
              <option value="">All houses</option>
              {houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              <option value="none">No house yet</option>
            </select>
          </div>
          <SearchableMultiSelect id="list-classes" label="Classes" allLabel="All classes" noun="classes"
            options={(summary?.by_class || []).filter((c) => c.class_id).map((c) => ({ value: c.class_id as string, label: c.class_name, hint: `${c.total} students` }))}
            selected={classIds} onChange={setClassIds} />
          <ExportButton endpoint="/api/v1/admissions/houses/export" params={{ house_id: houseId || undefined, class_ids: classIds.length ? classIds.join(',') : undefined }} filename="house_lists" />
        </div>

        {q.error ? (
          <p role="alert" className="text-sm text-red-600">{(q.error as Error).message} <button type="button" className="font-bold underline" onClick={() => q.refetch()}>Retry</button></p>
        ) : q.isLoading ? (
          <p className="text-sm text-gray-500">Loading students…</p>
        ) : rows.length === 0 ? (
          <EmptyState message="No students found" description="Change the house, class or search." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="sr-only">Students and their houses</caption>
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500 dark:border-gray-700">
                  <th scope="col" className="px-4 py-2 font-semibold">Student</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Class</th>
                  <th scope="col" className="px-3 py-2 font-semibold">House</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 last:border-0 dark:border-gray-700/50">
                    <td className="px-4 py-2"><p className="font-semibold text-gray-900 dark:text-white">{s.first_name} {s.last_name}</p><p className="text-xs text-gray-500">{s.student_number}</p></td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{s.class_name || '—'}</td>
                    <td className="px-3 py-2"><HouseChip name={s.house_name} color={s.house_color} /></td>
                    <td className="px-3 py-2 text-right"><Button size="sm" variant="outline" onClick={() => startMove(s)} aria-label={`Change house for ${s.first_name} ${s.last_name}`}>{s.house_id ? 'Change' : 'Assign'}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length >= 500 && <p className="text-xs text-gray-500">Showing the first 500. Narrow the list with a house or class. Exports include everyone.</p>}
      </section>

      <Modal isOpen={!!moving} onClose={() => !saving && setMoving(null)} title={moving ? `${moving.first_name} ${moving.last_name}` : ''} size="sm"
        footer={<div className="flex w-full justify-end gap-2"><Button variant="outline" onClick={() => setMoving(null)} disabled={saving}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></div>}>
        {moving && (
          <div className="space-y-4">
            <div>
              <label htmlFor="move-house" className="mb-1 block text-sm font-semibold text-gray-800 dark:text-gray-200">House</label>
              <select id="move-house" value={target} onChange={(e) => setTarget(e.target.value)} className={selectClass}>
                <option value="">No house</option>
                {houses.map((h) => <option key={h.id} value={h.id}>{h.name}{h.is_active ? '' : ' (switched off)'}</option>)}
              </select>
            </div>
            {moving.house_id && (
              <div>
                <label htmlFor="move-reason" className="mb-1 block text-sm font-semibold text-gray-800 dark:text-gray-200">Reason for the change</label>
                <input id="move-reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Joins her sister in Red House" className={inputClass} />
                <p className="mt-1 text-xs text-gray-500">A house is kept for the whole time a student is at the school, so changes are recorded in the history.</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
