/** Search-and-pick a student (by name or admission number) for finance forms. */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { studentsService } from '@services/studentsService';

export interface PickedStudent { id: string; name: string; admissionNo: string }

export const StudentPicker: React.FC<{ value: PickedStudent | null; onChange: (s: PickedStudent | null) => void; label?: string; id?: string }> = ({ value, onChange, label = 'Student', id = 'student-picker' }) => {
  const [q, setQ] = useState('');
  const { data, isFetching } = useQuery({
    queryKey: ['finance-student-search', q],
    queryFn: () => studentsService.listStudents({ search: q, limit: 10 } as any),
    enabled: q.trim().length > 1 && !value,
    staleTime: 30_000,
  });
  const list = (((data as any)?.data?.data ?? (data as any)?.data) ?? []) as any[];
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold text-gray-500 uppercase">{label}</label>
      {value ? (
        <div className="mt-1 flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 text-sm">
          <span className="font-medium text-gray-900 dark:text-white">{value.name} <span className="font-mono text-xs text-gray-500">{value.admissionNo}</span></span>
          <button type="button" onClick={() => { onChange(null); setQ(''); }} className="text-xs font-semibold text-blue-600 hover:underline">Change</button>
        </div>
      ) : (
        <>
          <input id={id} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or admission #…" autoComplete="off"
            className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          {q.trim().length > 1 && (
            <div className="mt-1 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-56 overflow-y-auto" role="listbox">
              {isFetching && <p className="px-3 py-2 text-xs text-gray-400">Searching…</p>}
              {!isFetching && list.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">No students found.</p>}
              {list.map((s: any) => (
                <button key={s.id} type="button" role="option" aria-selected={false}
                  onClick={() => onChange({ id: s.id, name: `${s.first_name} ${s.last_name}`, admissionNo: s.student_id })}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between gap-3 border-b border-gray-50 dark:border-gray-700/40 last:border-0">
                  <span className="text-sm text-gray-900 dark:text-white truncate">{s.first_name} {s.last_name}</span>
                  <span className="text-[11px] font-mono font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">{s.student_id}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StudentPicker;
