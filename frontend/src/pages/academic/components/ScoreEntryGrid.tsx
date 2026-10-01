/**
 * ScoreEntryGrid — Booklet-style cognitive score entry
 * Teacher picks Class + Subject + Term, then enters Test 1 & Test 2 for every
 * student. Mean = (Test1 + Test2)/2 is shown live; ranks/positions are computed
 * on the server after save.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Save, Calculator } from 'lucide-react';
import { SearchableSelect } from '@components/admin/forms/SearchableSelect';
import { Button } from '@components/ui/button';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { showToast } from '@utils/toast';
import { classesService } from '@services/classesService';
import { subjectsService } from '@services/subjectsService';
import {
  reportCardService, SL_TERMS, SLTerm, ScoreGridRow, getGrade,
} from '@services/reportCardService';

interface Props {
  academicYear: string;
}

interface EditableRow extends ScoreGridRow {
  _t1: string;
  _t2: string;
}

function liveMean(t1: string, t2: string): number | null {
  const a = t1 === '' ? null : Number(t1);
  const b = t2 === '' ? null : Number(t2);
  if (a == null && b == null) return null;
  if (a != null && b != null) return Math.round(((a + b) / 2) * 10) / 10;
  return Math.round((a ?? b)! * 10) / 10;
}

export const ScoreEntryGrid: React.FC<Props> = ({ academicYear }) => {
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [term, setTerm] = useState<SLTerm>('first_term');
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [saving, setSaving] = useState(false);

  // Dropdown data
  // Classes of the selected year — scores are keyed by that year's class rows.
  const { data: classesData } = useQuery({
    queryKey: ['score-classes', academicYear],
    queryFn: () => classesService.listClasses({ limit: 100, academic_year: academicYear }),
    enabled: !!academicYear,
    staleTime: 60_000,
  });
  const classes = (classesData as any)?.data ?? [];
  // Changing the year drops a class picked from another year.
  useEffect(() => { setClassId(''); setRows([]); }, [academicYear]);
  const classOptions = useMemo(
    () => classes.map((c: any) => ({ value: String(c.id), label: c.name, sublabel: c.level })),
    [classes],
  );

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects-dropdown'],
    queryFn: () => subjectsService.listSubjects({ limit: 100, status: 'active' }),
    staleTime: 60_000,
  });
  const subjects = (subjectsData as any)?.data ?? [];

  // Restrict subjects to what the teacher may enter for the selected class.
  // For staff-admins the endpoint returns null (no restriction).
  const { data: mySubjectsData } = useQuery({
    queryKey: ['my-subjects', classId],
    queryFn: () => reportCardService.getMySubjects(classId),
    enabled: !!classId,
    staleTime: 60_000,
  });
  const allowedSubjectIds: string[] | null = (mySubjectsData as any)?.data?.data
    ?? (mySubjectsData as any)?.data
    ?? null;

  const subjectOptions = useMemo(() => {
    const list = Array.isArray(allowedSubjectIds)
      ? subjects.filter((s: any) => allowedSubjectIds.map(String).includes(String(s.id)))
      : subjects;
    return list.map((s: any) => ({ value: String(s.id), label: s.name, sublabel: s.code }));
  }, [subjects, allowedSubjectIds]);

  // If the chosen subject isn't valid for the current class, clear it.
  useEffect(() => {
    if (subjectId && subjectOptions.length > 0 && !subjectOptions.some((o: any) => o.value === subjectId)) {
      setSubjectId('');
    }
  }, [subjectOptions, subjectId]);

  // Grid data
  const canLoad = !!(classId && subjectId && term && academicYear);
  const { data: gridData, isLoading, refetch } = useQuery({
    queryKey: ['score-grid', classId, subjectId, term, academicYear],
    queryFn: () => reportCardService.getGrid({ class_id: classId, subject_id: subjectId, term, academic_year: academicYear }),
    enabled: canLoad,
    staleTime: 0,
  });

  useEffect(() => {
    const list = (gridData as any)?.data ?? [];
    setRows(
      list.map((r: ScoreGridRow) => ({
        ...r,
        _t1: r.test1 == null ? '' : String(r.test1),
        _t2: r.test2 == null ? '' : String(r.test2),
      })),
    );
  }, [gridData]);

  const updateCell = (studentId: string, field: '_t1' | '_t2', value: string) => {
    // Clamp 0-100, allow empty
    if (value !== '' && (Number(value) < 0 || Number(value) > 100 || isNaN(Number(value)))) return;
    setRows((prev) => prev.map((r) => (r.student_id === studentId ? { ...r, [field]: value } : r)));
  };

  const handleSave = async () => {
    if (!canLoad) {
      showToast.error('Select class, subject and term first');
      return;
    }
    const scores = rows.map((r) => ({
      student_id: r.student_id,
      test1: r._t1 === '' ? null : Number(r._t1),
      test2: r._t2 === '' ? null : Number(r._t2),
    }));

    setSaving(true);
    const res = await reportCardService.saveScores({ class_id: classId, subject_id: subjectId, academic_year: academicYear, term, scores });
    setSaving(false);

    if ((res as any).success === false) {
      showToast.apiError((res as any).error);
    } else {
      showToast.success((res as any).message || 'Scores saved');
      refetch();
    }
  };

  const enteredCount = rows.filter((r) => r._t1 !== '' || r._t2 !== '').length;

  return (
    <div className="space-y-4">
      {/* Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <SearchableSelect label="Class" options={classOptions} value={classId} onChange={setClassId} placeholder="Select class..." />
        <SearchableSelect label="Subject" options={subjectOptions} value={subjectId} onChange={setSubjectId} placeholder="Select subject..." />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Term</label>
          <select
            value={term}
            onChange={(e) => setTerm(e.target.value as SLTerm)}
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
          >
            {SL_TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {!canLoad && (
        <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
          Select a class, subject and term to begin entering scores.
        </div>
      )}

      {canLoad && isLoading && (
        <div className="grid grid-cols-1 gap-3"><SkeletonCard /><SkeletonCard /></div>
      )}

      {canLoad && !isLoading && rows.length === 0 && (
        <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
          No active students enrolled in this class.
        </div>
      )}

      {canLoad && !isLoading && rows.length > 0 && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <Calculator size={12} className="inline mr-1" />
              Mean = (Test 1 + Test 2) ÷ 2 · <span className="text-red-600 dark:text-red-400 font-semibold">Below 50 = Fail</span> · {enteredCount}/{rows.length} entered
            </p>
            <Button variant="default" size="sm" onClick={handleSave} disabled={saving} className="w-full sm:w-auto flex-shrink-0">
              <Save size={15} className="mr-1.5" /> {saving ? 'Saving...' : 'Save Scores'}
            </Button>
          </div>

          <p className="sm:hidden text-[11px] text-gray-400">Swipe sideways if the table is wider than your screen.</p>
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl">
            <table className="w-full text-sm min-w-[540px]">
              <thead className="bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] border-b border-blue-700">
                <tr>
                  <th className="text-left py-3 px-3 font-bold text-xs text-white uppercase tracking-wider min-w-[140px]">Student</th>
                  <th className="text-center py-3 px-3 font-bold text-xs text-white uppercase tracking-wider w-32 sm:w-40">Test 1</th>
                  <th className="text-center py-3 px-3 font-bold text-xs text-white uppercase tracking-wider w-32 sm:w-40">Test 2</th>
                  <th className="text-center py-3 px-3 font-bold text-xs text-white uppercase tracking-wider w-20">Mean</th>
                  <th className="text-center py-3 px-3 font-bold text-xs text-white uppercase tracking-wider w-16">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {rows.map((r, rowIndex) => {
                  const mean = liveMean(r._t1, r._t2);
                  const g = getGrade(mean);
                  return (
                    <tr key={r.student_id} className={`transition-colors hover:bg-sky-100 dark:hover:bg-gray-800/50 ${rowIndex % 2 === 1 ? 'bg-sky-50 dark:bg-gray-900/40' : 'bg-white dark:bg-transparent'}`}>
                      <td className="py-2 px-3">
                        <p className="font-medium text-gray-900 dark:text-white">{r.student_name}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">{r.roll_number}</p>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text" inputMode="numeric" maxLength={3}
                          value={r._t1}
                          onChange={(e) => updateCell(r.student_id, '_t1', e.target.value)}
                          className="w-full text-center px-2 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text" inputMode="numeric" maxLength={3}
                          value={r._t2}
                          onChange={(e) => updateCell(r.student_id, '_t2', e.target.value)}
                          className="w-full text-center px-2 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className={`font-mono font-bold ${mean != null && mean < 50 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                          {mean ?? '—'}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        {mean != null && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${g.isFail ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'}`}>
                            {g.letter}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <Button variant="default" size="sm" onClick={handleSave} disabled={saving}>
              <Save size={15} className="mr-1.5" /> {saving ? 'Saving...' : 'Save Scores'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default ScoreEntryGrid;
