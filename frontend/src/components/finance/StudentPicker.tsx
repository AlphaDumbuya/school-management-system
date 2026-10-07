/**
 * Search-and-pick a student for finance forms (Record Payment, Give a
 * discount). Type any part of a name, the admission number, the class, or a
 * parent's name or phone: results appear as you type, with the class, what
 * the student owes and the guardian, so the right child is easy to pick. Arrow
 * keys move through the list, Enter picks, Esc clears.
 */
import React, { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search, X } from 'lucide-react';
import { bursarService, type StudentHit } from '@services/bursarService';

export interface PickedStudent { id: string; name: string; admissionNo: string; className?: string | null; outstanding?: number }

const le = (n: number) => `Le ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Bold the parts of `text` that match any typed word. */
const Mark: React.FC<{ text: string; words: string[] }> = ({ text, words }) => {
  const w = words.filter((x) => x.length > 0).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!w.length || !text) return <>{text}</>;
  const parts = String(text).split(new RegExp(`(${w.join('|')})`, 'ig'));
  return <>{parts.map((p, i) => (i % 2 === 1 ? <mark key={i} className="bg-yellow-100 dark:bg-yellow-900/40 text-inherit rounded px-0.5">{p}</mark> : <React.Fragment key={i}>{p}</React.Fragment>))}</>;
};

export const StudentPicker: React.FC<{
  value: PickedStudent | null; onChange: (s: PickedStudent | null) => void; label?: string; id?: string; autoFocus?: boolean;
}> = ({ value, onChange, label = 'Student', id, autoFocus }) => {
  const autoId = useId();
  const inputId = id || `student-picker-${autoId}`;
  const listId = `${inputId}-list`;
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Wait for a short pause in typing before searching.
  useEffect(() => { const t = window.setTimeout(() => setQ(text.trim()), 220); return () => window.clearTimeout(t); }, [text]);
  useEffect(() => { setActive(0); }, [q]);

  const search = useQuery({
    queryKey: ['finance-student-search', q],
    queryFn: async () => { const r: any = await bursarService.searchStudents(q); if (r?.success === false) throw new Error(r.error || 'Search failed'); return (r.data || []) as StudentHit[]; },
    enabled: q.length >= 2 && !value,
    staleTime: 30_000,
  });
  const list = search.data || [];
  const words = q.split(/\s+/);
  const pick = (s: StudentHit) => {
    onChange({ id: s.id, name: s.name, admissionNo: s.admission_no, className: s.class_name, outstanding: s.outstanding });
    setText(''); setQ('');
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, list.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && list[active]) { e.preventDefault(); pick(list[active]); }
    else if (e.key === 'Escape') { setText(''); setQ(''); }
  };
  const open = q.length >= 2 && !value;

  return (
    <div>
      <label htmlFor={inputId} className="text-xs font-semibold text-gray-500 uppercase">{label}</label>
      {value ? (
        <div className="mt-1 flex items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 text-sm">
          <span className="min-w-0">
            <span className="font-semibold text-gray-900 dark:text-white">{value.name}</span>{' '}
            <span className="font-mono text-xs text-gray-500">{value.admissionNo}</span>
            {(value.className || value.outstanding !== undefined) && (
              <span className="block text-[11px] text-gray-600 dark:text-gray-400">
                {value.className || 'No class'}{value.outstanding !== undefined ? ` · owes ${le(value.outstanding)}` : ''}
              </span>
            )}
          </span>
          <button type="button" onClick={() => { onChange(null); window.setTimeout(() => inputRef.current?.focus(), 0); }} className="shrink-0 text-xs font-semibold text-blue-600 hover:underline">Change</button>
        </div>
      ) : (
        <>
          <div className="relative mt-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input id={inputId} ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} autoFocus={autoFocus}
              placeholder="Name, admission no., class or parent's phone…" autoComplete="off"
              role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
              aria-activedescendant={open && list[active] ? `${listId}-${list[active].id}` : undefined}
              className="w-full pl-9 pr-9 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
            {search.isFetching ? <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
              : text && <button type="button" aria-label="Clear search" onClick={() => { setText(''); setQ(''); inputRef.current?.focus(); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={15} /></button>}
          </div>
          {text.trim().length === 1 && <p className="mt-1 text-[11px] text-gray-400">Keep typing…</p>}
          {open && (
            <div id={listId} role="listbox" className="mt-1 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-72 overflow-y-auto bg-white dark:bg-gray-900 shadow-sm">
              {search.isError && <p className="px-3 py-2 text-xs text-red-600">{(search.error as Error).message}</p>}
              {!search.isFetching && !search.isError && list.length === 0 && (
                <p className="px-3 py-3 text-xs text-gray-500">No student matches “{q}”. Try part of the name, the admission number or a parent's phone.</p>
              )}
              {list.map((s, i) => (
                <button key={s.id} id={`${listId}-${s.id}`} type="button" role="option" aria-selected={i === active}
                  onMouseEnter={() => setActive(i)} onClick={() => pick(s)}
                  className={`w-full text-left px-3 py-2 flex items-start justify-between gap-3 border-b border-gray-50 dark:border-gray-800 last:border-0 ${i === active ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-900 dark:text-white truncate"><Mark text={s.name} words={words} /></span>
                    <span className="block text-[11px] text-gray-500 truncate">
                      <Mark text={s.class_name || 'No class'} words={words} />
                      {s.guardian_name ? <> · <Mark text={s.guardian_name} words={words} /></> : null}
                      {s.guardian_phone ? ` · ${s.guardian_phone}` : ''}
                      {s.left_school ? <span className="ml-1 text-amber-700">· {s.status}</span> : null}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[11px] font-mono font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded"><Mark text={s.admission_no || ''} words={words} /></span>
                    <span className={`block mt-0.5 text-[11px] ${s.outstanding > 0 ? 'text-rose-600 font-semibold' : 'text-gray-400'}`}>{s.outstanding > 0 ? `owes ${le(s.outstanding)}` : 'nothing owed'}</span>
                  </span>
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
