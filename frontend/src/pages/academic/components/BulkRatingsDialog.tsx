/**
 * BulkRatingsDialog: give the SAME Affective / Psychomotor ratings (and conduct) to many students of a class at once.
 *
 * Every student of the class is listed with a tick (all ticked to start, with Select all and a search), then you set the
 * ratings to apply. A trait you leave blank is not touched, so existing ratings are never wiped. Students can still be
 * adjusted one by one afterwards from the class list.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import {
  reportCardService, SLTerm, ClassRatingsRow, AFFECTIVE_TRAITS, PSYCHOMOTOR_SKILLS, RATING_LEGEND, CONDUCT_CODES,
} from '@services/reportCardService';

interface Pair { r1: number | null; r2: number | null }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
  students: ClassRatingsRow[];
  classId: string;
  className: string;
  academicYear: string;
  term: SLTerm;
  termLabel: string;
}

const Pick: React.FC<{ value: number | null; onChange: (v: number | null) => void; label: string }> = ({ value, onChange, label }) => (
  <select
    aria-label={label} value={value ?? ''}
    onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    className="w-14 text-center px-1 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
  >
    <option value="">–</option>
    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
  </select>
);

const blank = (n: number): Record<number, Pair> => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, { r1: null, r2: null }]));
const countSet = (s: Record<number, Pair>) => Object.values(s).filter((p) => p.r1 != null || p.r2 != null).length;

export const BulkRatingsDialog: React.FC<Props> = ({ isOpen, onClose, onDone, students, classId, className, academicYear, term, termLabel }) => {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [aff, setAff] = useState<Record<number, Pair>>(blank(AFFECTIVE_TRAITS.length));
  const [psy, setPsy] = useState<Record<number, Pair>>(blank(PSYCHOMOTOR_SKILLS.length));
  const [conduct, setConduct] = useState('');
  const [saving, setSaving] = useState(false);
  const [failedNames, setFailedNames] = useState<string[]>([]);

  // Every opening starts clean with everybody ticked.
  useEffect(() => {
    if (!isOpen) return;
    setPicked(new Set(students.map((s) => s.student_id)));
    setSearch(''); setAff(blank(AFFECTIVE_TRAITS.length)); setPsy(blank(PSYCHOMOTOR_SKILLS.length)); setConduct(''); setFailedNames([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? students.filter((s) => `${s.student_name} ${s.roll_number ?? ''}`.toLowerCase().includes(q)) : students;
  }, [students, search]);

  const allShownPicked = shown.length > 0 && shown.every((s) => picked.has(s.student_id));
  const toggleAll = () => setPicked((prev) => {
    const next = new Set(prev);
    if (allShownPicked) shown.forEach((s) => next.delete(s.student_id)); else shown.forEach((s) => next.add(s.student_id));
    return next;
  });
  const toggleOne = (id: string) => setPicked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const nAff = countSet(aff); const nPsy = countSet(psy);
  const whatCount = nAff + nPsy + (conduct ? 1 : 0);
  const canApply = picked.size > 0 && whatCount > 0 && !saving;

  // "Set a whole column": same rating for every trait of a domain, as a quick start.
  const setAllTraits = (domain: 'aff' | 'psy', key: 'r1' | 'r2', v: number | null) => {
    const setter = domain === 'aff' ? setAff : setPsy;
    setter((p) => Object.fromEntries(Object.entries(p).map(([i, pair]) => [i, { ...pair, [key]: v }])) as Record<number, Pair>);
  };

  const apply = async () => {
    setSaving(true); setFailedNames([]);
    const strip = (s: Record<number, Pair>) => Object.fromEntries(Object.entries(s).filter(([, p]) => p.r1 != null || p.r2 != null));
    const res: any = await reportCardService.saveBulkRatings({
      class_id: classId, academic_year: academicYear, term, student_ids: Array.from(picked),
      affective: strip(aff) as Record<number, Pair>, psychomotor: strip(psy) as Record<number, Pair>, conduct: conduct || undefined,
    });
    setSaving(false);
    if (res?.success === false) { showToast.apiError(res.error); return; }
    const failed: Array<{ student_id: string; error: string }> = res?.data?.failed ?? [];
    if (failed.length) {
      setFailedNames(failed.map((f) => students.find((s) => s.student_id === f.student_id)?.student_name ?? f.student_id));
      showToast.warning(`Saved for ${res.data.saved}, but ${failed.length} could not be saved.`);
      onDone();
      return;
    }
    showToast.success(`Ratings applied to ${res?.data?.saved ?? picked.size} students`);
    onDone();
    onClose();
  };

  const domain = (title: string, color: string, traits: string[], state: Record<number, Pair>, which: 'aff' | 'psy') => {
    const setOne = (idx: number, key: 'r1' | 'r2', v: number | null) => (which === 'aff' ? setAff : setPsy)((p) => ({ ...p, [idx]: { ...p[idx], [key]: v } }));
    return (
      <div>
        <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${color}`}>{title}</h3>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="text-left py-1.5 px-2 font-bold text-[10px] text-gray-500 uppercase">Trait</th>
                <th className="py-1.5 px-1 font-bold text-[10px] text-gray-500 uppercase w-16">Test 1</th>
                <th className="py-1.5 px-1 font-bold text-[10px] text-gray-500 uppercase w-16">Test 2</th>
              </tr>
              <tr className="bg-blue-50/60 dark:bg-blue-950/20">
                <td className="py-1 px-2 text-[11px] font-semibold text-blue-800 dark:text-blue-300">Same for every trait</td>
                <td className="py-1 px-1 text-center"><Pick label={`${title}: Test 1 for every trait`} value={null} onChange={(v) => setAllTraits(which, 'r1', v)} /></td>
                <td className="py-1 px-1 text-center"><Pick label={`${title}: Test 2 for every trait`} value={null} onChange={(v) => setAllTraits(which, 'r2', v)} /></td>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {traits.map((trait, i) => {
                const idx = i + 1; const pair = state[idx] ?? { r1: null, r2: null };
                return (
                  <tr key={trait} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-1 px-2 text-gray-700 dark:text-gray-300">{idx}. {trait}</td>
                    <td className="py-1 px-1 text-center"><Pick label={`${trait} Test 1`} value={pair.r1} onChange={(v) => setOne(idx, 'r1', v)} /></td>
                    <td className="py-1 px-1 text-center"><Pick label={`${trait} Test 2`} value={pair.r2} onChange={(v) => setOne(idx, 'r2', v)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Apply ratings to many students"
      size="2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Close</Button>
          <Button variant="default" onClick={apply} disabled={!canApply}>
            {saving ? 'Applying...' : `Apply to ${picked.size} ${picked.size === 1 ? 'student' : 'students'}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/20 px-4 py-2.5">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{className} · {termLabel} · {academicYear}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Choose the students, then the ratings they should all get. Traits you leave blank are not changed, so ratings already saved stay as they are.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-4">
          {/* students */}
          <section aria-label="Students">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Students ({picked.size}/{students.length})</h3>
              <label className="flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 cursor-pointer">
                <input type="checkbox" checked={allShownPicked} onChange={toggleAll} /> Select all
              </label>
            </div>
            {students.length > 8 && (
              <div className="relative mb-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search students" aria-label="Search students"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg" />
              </div>
            )}
            <ul className="max-h-[50vh] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
              {shown.length === 0 && <li className="p-4 text-center text-sm text-gray-500">No student matches “{search}”.</li>}
              {shown.map((s) => (
                <li key={s.student_id}>
                  <label className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <input type="checkbox" checked={picked.has(s.student_id)} onChange={() => toggleOne(s.student_id)} aria-label={s.student_name} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-gray-900 dark:text-white truncate">{s.student_name}</span>
                      <span className="block text-[11px] text-gray-500 font-mono">{s.roll_number}</span>
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 flex-shrink-0">A {s.affective}/12 · P {s.psychomotor}/12</span>
                  </label>
                </li>
              ))}
            </ul>
            {failedNames.length > 0 && (
              <p role="alert" className="mt-2 text-xs rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-red-800">
                Could not save for: {failedNames.join(', ')}.
              </p>
            )}
          </section>

          {/* what to apply */}
          <section aria-label="Ratings to apply" className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg">
              {RATING_LEGEND.map((r) => <span key={r.value} className="mr-3"><b>{r.value}</b> = {r.label}</span>)}
            </div>
            {domain('Affective Domain', 'text-purple-700 dark:text-purple-400', AFFECTIVE_TRAITS, aff, 'aff')}
            {domain('Psychomotor Domain', 'text-green-700 dark:text-green-400', PSYCHOMOTOR_SKILLS, psy, 'psy')}
            <div>
              <label htmlFor="bulk-conduct" className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">Conduct (optional)</label>
              <select id="bulk-conduct" value={conduct} onChange={(e) => setConduct(e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm">
                <option value="">Do not change</option>
                {CONDUCT_CODES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
              </select>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {whatCount === 0 ? 'Nothing chosen yet.' : `Will set ${nAff} affective trait${nAff === 1 ? '' : 's'}, ${nPsy} psychomotor skill${nPsy === 1 ? '' : 's'}${conduct ? ' and the conduct' : ''} for ${picked.size} ${picked.size === 1 ? 'student' : 'students'}.`}
            </p>
          </section>
        </div>
      </div>
    </Modal>
  );
};

export default BulkRatingsDialog;
