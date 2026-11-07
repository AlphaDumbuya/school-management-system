/**
 * ClassRatingsPanel: the Affective & Psychomotor work of a whole class for one term.
 *
 * Lists EVERY student of the class with how many of the 12 affective traits and 12 psychomotor skills are rated and the
 * conduct. "Rate" opens the existing one-student window. "Apply to many" opens the bulk dialog to give the same ratings
 * to the whole class (or to the students ticked).
 */
import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Star, Users, Search, CheckCircle2 } from 'lucide-react';
import { Button } from '@components/ui/button';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { reportCardService, SLTerm, SL_TERMS } from '@services/reportCardService';
import { BulkRatingsDialog } from './BulkRatingsDialog';

interface Props {
  classId: string;
  className: string;
  academicYear: string;
  term: SLTerm;
  /** Open the one-student ratings window for this student. */
  onRate: (studentId: string) => void;
}

const Progress: React.FC<{ done: number; of: number }> = ({ done, of }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className="h-1.5 w-14 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden" aria-hidden="true">
      <span className={`block h-full ${done >= of ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.round((done / of) * 100)}%` }} />
    </span>
    <span className="text-xs font-mono text-gray-700 dark:text-gray-300">{done}/{of}</span>
  </span>
);

export const ClassRatingsPanel: React.FC<Props> = ({ classId, className, academicYear, term, onRate }) => {
  const queryClient = useQueryClient();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['class-ratings', classId, term, academicYear],
    queryFn: () => reportCardService.getClassRatings({ class_id: classId, term, academic_year: academicYear }),
    enabled: !!classId && !!academicYear,
    staleTime: 0,
  });
  const students = useMemo(() => ((data as any)?.data ?? []) as import('@services/reportCardService').ClassRatingsRow[], [data]);
  const failed = (data as any)?.success === false;
  const termLabel = SL_TERMS.find((t) => t.value === term)?.label ?? term;

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? students.filter((s) => `${s.student_name} ${s.roll_number ?? ''}`.toLowerCase().includes(q)) : students;
  }, [students, search]);

  const complete = students.filter((s) => s.affective >= 12 && s.psychomotor >= 12).length;

  if (isLoading) return <div className="grid gap-3"><SkeletonCard /><SkeletonCard /></div>;
  if (failed) {
    return (
      <div className="p-8 text-center text-sm text-red-700 border border-red-200 bg-red-50 rounded-xl">
        {(data as any)?.error || 'Could not load the class.'}
      </div>
    );
  }
  if (students.length === 0) {
    return <div className="p-8 text-center text-sm text-gray-500 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">No active students enrolled in this class.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <strong className="text-gray-900 dark:text-white">{students.length}</strong> students in {className}
          <span className="mx-1.5 text-gray-300">·</span>
          <CheckCircle2 size={13} className="inline -mt-0.5 text-emerald-600" /> {complete} fully rated for {termLabel}
        </p>
        <Button variant="default" size="sm" onClick={() => setBulkOpen(true)} className="w-full sm:w-auto flex-shrink-0">
          <Users size={15} className="mr-1.5" /> Apply to many students
        </Button>
      </div>

      {students.length > 8 && (
        <div className="relative sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search students" aria-label="Search students"
            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg" />
        </div>
      )}

      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <th className="py-2.5 px-3">Student</th>
              <th className="py-2.5 px-3">Affective</th>
              <th className="py-2.5 px-3">Psychomotor</th>
              <th className="py-2.5 px-3 text-center">Conduct</th>
              <th className="py-2.5 px-3 w-28"><span className="sr-only">Rate</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {shown.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-sm text-gray-500">No student matches “{search}”.</td></tr>}
            {shown.map((s) => (
              <tr key={s.student_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="py-2 px-3">
                  <p className="font-medium text-gray-900 dark:text-white">{s.student_name}</p>
                  <p className="text-[11px] text-gray-500 font-mono">{s.roll_number}</p>
                </td>
                <td className="py-2 px-3"><Progress done={s.affective} of={12} /></td>
                <td className="py-2 px-3"><Progress done={s.psychomotor} of={12} /></td>
                <td className="py-2 px-3 text-center font-mono text-xs">{s.conduct ?? '—'}</td>
                <td className="py-2 px-3 text-right">
                  <Button variant="outline" size="sm" onClick={() => onRate(s.student_id)} aria-label={`Rate ${s.student_name}`}>
                    <Star size={13} className="mr-1" /> Rate
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BulkRatingsDialog
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onDone={() => {
          queryClient.invalidateQueries({ queryKey: ['class-ratings'] });
          queryClient.invalidateQueries({ queryKey: ['report-card'] });
          queryClient.invalidateQueries({ queryKey: ['class-ranking'] });
        }}
        students={students}
        classId={classId}
        className={className}
        academicYear={academicYear}
        term={term}
        termLabel={termLabel}
      />
    </div>
  );
};

export default ClassRatingsPanel;
