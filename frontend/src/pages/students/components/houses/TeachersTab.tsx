/**
 * Teachers tab: who looks after each house, and which teachers may run the
 * ballot. Nothing here is on by default: a teacher sees the Houses page only
 * after being put on a house or allowed to draw.
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { Modal } from '@components/admin/feedback/Modal';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { houseService, type House, type HouseSummary } from '@services/houseService';
import { selectClass, textOn, unwrap } from './houseUi';

export const TeachersTab: React.FC<{ summary?: HouseSummary; onChanged: () => void }> = ({ summary, onChanged }) => {
  const queryClient = useQueryClient();
  const houses = summary?.houses || [];
  const teachersQ = useQuery({ queryKey: ['houses', 'teachers'], queryFn: async () => unwrap(await houseService.teachers()), staleTime: 30_000 });
  const teachers = teachersQ.data || [];

  const [adding, setAdding] = useState<House | null>(null);
  const [teacherId, setTeacherId] = useState('');
  const [position, setPosition] = useState<'master' | 'staff'>('staff');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = () => { queryClient.invalidateQueries({ queryKey: ['houses'] }); onChanged(); };

  const openAdd = (h: House) => {
    setAdding(h); setTeacherId(''); setPosition(h.staff.some((s) => s.position === 'master') ? 'staff' : 'master');
  };
  const save = async () => {
    if (!adding || !teacherId) return;
    setSaving(true);
    try {
      const r = await houseService.assignStaff(adding.id, { user_id: teacherId, position });
      if (r.success === false) { showToast.error(r.error || 'Could not add the teacher'); return; }
      showToast.success('Teacher added to the house');
      setAdding(null); refresh();
    } finally { setSaving(false); }
  };
  const remove = async (h: House, userId: string) => {
    setBusyId(`${h.id}:${userId}`);
    try {
      const r = await houseService.removeStaff(h.id, userId);
      if (r.success === false) return showToast.error(r.error || 'Could not remove the teacher');
      showToast.success('Teacher removed from the house'); refresh();
    } finally { setBusyId(null); }
  };
  const togglePermission = async (userId: string, can: boolean) => {
    setBusyId(`perm:${userId}`);
    try {
      const r = await houseService.setBallotPermission(userId, can);
      if (r.success === false) return showToast.error(r.error || 'Could not save the permission');
      showToast.success(can ? 'Teacher can now draw for their own classes' : 'Permission removed');
      queryClient.invalidateQueries({ queryKey: ['houses', 'teachers'] });
    } finally { setBusyId(null); }
  };

  if (summary && houses.length === 0) {
    return <EmptyState message="Add the houses first" description="Then you can put a house master or mistress and teachers on each house." />;
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="staff-h">
        <h2 id="staff-h" className="text-base font-bold text-gray-900 dark:text-white">House masters, mistresses and teachers</h2>
        <p className="mb-3 text-xs text-gray-500">Each house has one master or mistress and as many teachers as it needs. A teacher on a house can see that house's students (view only). Teachers cannot draw unless you allow it below.</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {houses.map((h) => (
            <div key={h.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center justify-between gap-2 px-4 py-2.5" style={{ backgroundColor: h.color, color: textOn(h.color) }}>
                <p className="font-black">{h.name}</p>
                <Button size="sm" variant="outline" onClick={() => openAdd(h)} aria-label={`Add a teacher to ${h.name}`}><Plus size={13} className="mr-1" aria-hidden="true" /> Add teacher</Button>
              </div>
              {h.staff.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-500">No teachers on this house yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {h.staff.map((s) => (
                    <li key={s.user_id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.position === 'master' ? 'House master / mistress' : 'House teacher'}</p>
                      </div>
                      <Button size="sm" variant="ghost" disabled={busyId === `${h.id}:${s.user_id}`} onClick={() => remove(h, s.user_id)} aria-label={`Remove ${s.name} from ${h.name}`}><X size={14} aria-hidden="true" /></Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="perm-h">
        <h2 id="perm-h" className="text-base font-bold text-gray-900 dark:text-white">Teachers who may draw houses</h2>
        <p className="mb-3 text-xs text-gray-500">A teacher you allow here can draw a house for students in their own classes only, one student at a time. They cannot change a house afterwards. Everyone else sees no ballot at all.</p>
        {teachersQ.error ? (
          <p role="alert" className="text-sm text-red-600">{(teachersQ.error as Error).message} <button type="button" className="font-bold underline" onClick={() => teachersQ.refetch()}>Retry</button></p>
        ) : teachersQ.isLoading ? (
          <p className="text-sm text-gray-500">Loading teachers…</p>
        ) : teachers.length === 0 ? (
          <EmptyState message="No active teachers found" />
        ) : (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
            {teachers.map((t) => (
              <li key={t.user_id}>
                <label htmlFor={`perm-${t.user_id}`} className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0 truncate text-sm font-semibold text-gray-900 dark:text-white">{t.name}</span>
                  <span className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    {t.can_draw ? 'Can draw for own classes' : 'Cannot draw'}
                    <input id={`perm-${t.user_id}`} type="checkbox" checked={t.can_draw} disabled={busyId === `perm:${t.user_id}`}
                      onChange={(e) => togglePermission(t.user_id, e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal isOpen={!!adding} onClose={() => !saving && setAdding(null)} title={adding ? `Add a teacher to ${adding.name}` : ''} size="sm"
        footer={<div className="flex w-full justify-end gap-2"><Button variant="outline" onClick={() => setAdding(null)} disabled={saving}>Cancel</Button><Button onClick={save} disabled={saving || !teacherId}>{saving ? 'Saving…' : 'Add'}</Button></div>}>
        {adding && (
          <div className="space-y-4">
            <div>
              <label htmlFor="staff-teacher" className="mb-1 block text-sm font-semibold text-gray-800 dark:text-gray-200">Teacher</label>
              <select id="staff-teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={selectClass}>
                <option value="">Choose a teacher</option>
                {teachers.filter((t) => !adding.staff.some((s) => s.user_id === t.user_id)).map((t) => <option key={t.user_id} value={t.user_id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="staff-position" className="mb-1 block text-sm font-semibold text-gray-800 dark:text-gray-200">Role in the house</label>
              <select id="staff-position" value={position} onChange={(e) => setPosition(e.target.value as 'master' | 'staff')} className={selectClass}>
                <option value="master">House master / mistress</option>
                <option value="staff">House teacher</option>
              </select>
              {position === 'master' && adding.staff.some((s) => s.position === 'master') && (
                <p className="mt-1 text-xs text-amber-700">This replaces the current master or mistress, who stays on the house as a teacher.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
