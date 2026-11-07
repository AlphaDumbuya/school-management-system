/**
 * The subjects a user can enter or view grades for in one class and term, with how far along each one is.
 *  - From the server's per-class progress when it has subjects for the class.
 *  - Otherwise (a class with no subjects mapped, or the call failed) from the list of all active subjects,
 *    narrowed to what a teacher is assigned to, exactly as the page always did.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { subjectsService } from '@services/subjectsService';
import { reportCardService, SLTerm } from '@services/reportCardService';

export interface EntrySubject {
  value: string;
  label: string;
  code: string | null;
  /** Null when the progress numbers are not known (fallback list). */
  entered: number | null;
  total: number | null;
  locked: number;
  drafts: number;
}

export function useEntrySubjects(classId: string, term: SLTerm, academicYear: string) {
  const enabled = !!classId && !!academicYear;

  const progress = useQuery({
    queryKey: ['subject-progress', classId, term, academicYear],
    queryFn: () => reportCardService.getSubjectProgress({ class_id: classId, term, academic_year: academicYear }),
    enabled,
    staleTime: 0,
  });

  const all = useQuery({
    queryKey: ['subjects-dropdown'],
    queryFn: () => subjectsService.listSubjects({ limit: 100, status: 'active' }),
    staleTime: 60_000,
  });

  const mine = useQuery({
    queryKey: ['my-subjects', classId],
    queryFn: () => reportCardService.getMySubjects(classId),
    enabled: !!classId,
    staleTime: 60_000,
  });

  const subjects: EntrySubject[] = useMemo(() => {
    const fromServer = (progress.data as any)?.data;
    if (Array.isArray(fromServer) && fromServer.length > 0) {
      return fromServer.map((s: any) => ({
        value: String(s.subject_id), label: s.name, code: s.code ?? null,
        entered: s.entered, total: s.total, locked: s.locked, drafts: s.drafts,
      }));
    }
    const allowed: string[] | null = (mine.data as any)?.data?.data ?? (mine.data as any)?.data ?? null;
    const list: any[] = (all.data as any)?.data ?? [];
    const visible = Array.isArray(allowed) ? list.filter((s) => allowed.map(String).includes(String(s.id))) : list;
    return visible.map((s) => ({ value: String(s.id), label: s.name, code: s.code ?? null, entered: null, total: null, locked: 0, drafts: 0 }));
  }, [progress.data, all.data, mine.data]);

  return {
    subjects,
    isLoading: enabled && (progress.isLoading || all.isLoading || mine.isLoading),
    refetch: progress.refetch,
  };
}
