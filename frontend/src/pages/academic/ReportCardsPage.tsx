/**
 * ReportCardsPage — /academic/report-cards
 * Real, data-bound Sierra Leone terminal report BOOKLET.
 *
 * The booklet is 6 logical pages in reading order:
 *   Page 1: Front cover
 *   Page 2: Grading system
 *   Page 3–4: Results (subjects/cognitive + affective/psychomotor/footer)
 *   Page 5: Blank (inside back)
 *   Page 6: Back cover
 *
 * Physical output = 3 landscape sheets, printed double-sided and folded
 * (saddle-stitch imposition). On screen we render exactly 3 `.booklet-sheet`
 * nodes (matching the export):
 *   Sheet 1: [ back cover | front cover ]
 *   Sheet 2: [ grading    | blank        ]
 *   Sheet 3: results as ONE continuous full-width spread (innermost fold, so
 *            the grade table is never cut at the centre).
 *
 * Server PDF path imposes the same content as [6|1], [2|5], [4|3] onto A3
 * sheets (see slReportCardHtml.imposeBooklet). Client PDF path captures the
 * 3 rendered sheets directly. Both produce the identical folded booklet.
 *
 * Attendance (On Time / Late / Absent) is sourced live from the attendance system.
 */

import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { SearchableSelect } from '@components/admin/forms/SearchableSelect';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { showToast } from '@utils/toast';
import { classesService } from '@services/classesService';
import { schoolConfigService } from '@services/schoolConfigService';
import { reportCardService, ReportCard } from '@services/reportCardService';
import { studentDashboardService } from '@services/studentDashboardService';
import { parentDashboardService } from '@services/parentDashboardService';
import { useAuth } from '@hooks/useAuth';
import { BookletContent } from './components/BookletContent';
import { TermResultSheet } from './components/TermResultSheet';
import type { SLTerm } from '@services/reportCardService';
import { Printer, Download, Users } from 'lucide-react';
import { saveBlob, previewBlob } from '@lib/download';

type ViewTerm = SLTerm | 'full';

export const ReportCardsPage: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const { user } = useAuth();
  const isStudent = user?.role === 'student';
  const isParent = user?.role === 'parent' || user?.role === 'guardian';
  const [academicYear, setAcademicYear] = useState(`${currentYear}/${currentYear + 1}`);
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [spread, setSpread] = useState<'all' | 'cover' | 'inner'>('all');
  // Which result to view: a single term sheet (Term 1/2) or the full-year booklet.
  const [viewTerm, setViewTerm] = useState<ViewTerm>('full');

  // Students: auto-resolve their OWN student id, class and academic year from
  // the dashboard endpoint so no selectors are needed (and they can only ever
  // load their own report card — the backend also enforces this).
  const { data: selfResp } = useQuery({
    queryKey: ['report-card-self'],
    queryFn: () => studentDashboardService.getDashboard(),
    enabled: isStudent,
    staleTime: 60_000,
  });
  const selfProfile = ((selfResp as any)?.data ?? (selfResp as any))?.profile ?? null;
  React.useEffect(() => {
    if (!isStudent || !selfProfile) return;
    if (selfProfile.id) setStudentId(String(selfProfile.id));
    if (selfProfile.class_id) setClassId(String(selfProfile.class_id));
    if (selfProfile.academic_year) setAcademicYear(String(selfProfile.academic_year));
  }, [isStudent, selfProfile]);

  // Parents: resolve their children (with class) and let them pick one.
  const { data: parentResp } = useQuery({
    queryKey: ['report-card-parent-children'],
    queryFn: () => parentDashboardService.getDashboard(),
    enabled: isParent,
    staleTime: 60_000,
  });
  const parentChildren = ((parentResp as any)?.data ?? (parentResp as any))?.children ?? [];
  const [selectedChildId, setSelectedChildId] = useState('');
  const activeChildId = selectedChildId || parentChildren[0]?.id || '';
  React.useEffect(() => {
    if (!isParent || parentChildren.length === 0) return;
    const child = parentChildren.find((c: any) => String(c.id) === String(activeChildId)) || parentChildren[0];
    if (!child) return;
    if (child.id) setStudentId(String(child.id));
    if (child.class_id) setClassId(String(child.class_id));
    // parent summary doesn't carry academic_year; keep the currently selected year.
  }, [isParent, parentChildren, activeChildId]);

  // Real academic years the school actually has (from academic_sessions), so
  // staff can retrieve ANY past year — not a fabricated date list. Students/
  // parents don't need the picker (their year is auto-resolved).
  const { data: sessionsResp } = useQuery({
    queryKey: ['academic-sessions'],
    queryFn: () => schoolConfigService.listAcademicSessions(),
    enabled: !isStudent && !isParent,
    staleTime: 60_000,
  });
  const academicSessions: Array<{ name: string; is_active: boolean }> =
    ((sessionsResp as any)?.data ?? []) as any;

  const yearOptions = useMemo(() => {
    // Prefer the tenant's real sessions (covers decades of history).
    const fromDb = academicSessions
      .map((s) => String(s.name))
      .filter((n) => /^\d{4}\/\d{4}$/.test(n));
    const set = new Set<string>(fromDb);
    // Always include a sensible current-year span so a brand-new school (no
    // sessions yet) still has selectable years.
    for (let y = currentYear + 1; y >= currentYear - 3; y--) set.add(`${y}/${y + 1}`);
    return Array.from(set)
      .sort((a, b) => b.localeCompare(a))
      .map((v) => ({ value: v, label: v }));
  }, [academicSessions, currentYear]);

  // Default staff to the active session's year when it loads (so the page opens
  // on the current year, but they can freely switch to any past year).
  React.useEffect(() => {
    if (isStudent || isParent) return;
    const active = academicSessions.find((s) => s.is_active)?.name;
    if (active && /^\d{4}\/\d{4}$/.test(active)) setAcademicYear(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicSessions.length]);

  // When staff switch the year, clear the class/student picks — that year has
  // its own classes, so a stale selection wouldn't resolve.
  React.useEffect(() => {
    if (isStudent || isParent) return;
    setClassId('');
    setStudentId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear]);

  // School branding for the front cover. Kept fresh so name/logo edits made in
  // Settings show on the report card immediately — refetch on mount and treat
  // the small payload as stale quickly (Settings also invalidates this key).
  const { data: schoolResp } = useQuery({
    queryKey: ['school-info'],
    queryFn: () => schoolConfigService.getSchoolInfo(),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  const school = (schoolResp as any)?.data ?? (schoolResp as any) ?? {};

  // Fetch tenant-configured report card border style from Settings
  const { data: borderStyle } = useQuery({
    queryKey: ['report-card-border-style'],
    queryFn: () => schoolConfigService.getSetting('report_card_border_style'),
    staleTime: 30_000,
    refetchOnMount: 'always',
  });

  // Fetch tenant-configured report card display options (watermark, student photo)
  const { data: displayOpts } = useQuery({
    queryKey: ['report-card-display-opts'],
    queryFn: () => schoolConfigService.getSetting('report_card_display_opts'),
    staleTime: 30_000,
    refetchOnMount: 'always',
  });
  const showWatermark = displayOpts?.show_watermark !== false; // default true
  const watermarkOpacity = typeof displayOpts?.watermark_opacity === 'number' ? displayOpts.watermark_opacity : 0.06;
  const watermarkSize = typeof displayOpts?.watermark_size === 'number' ? displayOpts.watermark_size : 450;
  const showStudentPhoto = displayOpts?.show_student_photo !== false; // default true
  const photoFrame = (typeof displayOpts?.photo_frame === 'string' ? displayOpts.photo_frame : 'gold') as any;
  // Uploaded front-cover stamp/seal and principal's signature (optional).
  const stampUrl = typeof displayOpts?.stamp_url === 'string' ? displayOpts.stamp_url : undefined;
  const signatureUrl = typeof displayOpts?.signature_url === 'string' ? displayOpts.signature_url : undefined;
  const stampScale = typeof displayOpts?.stamp_scale === 'number' ? displayOpts.stamp_scale : 1;
  const signatureScale = typeof displayOpts?.signature_scale === 'number' ? displayOpts.signature_scale : 1;

  const { data: classesData } = useQuery({
    // Scope classes to the selected academic year so a principal viewing a past
    // year sees THAT year's classes (each year has its own class rows).
    queryKey: ['report-card-classes', academicYear],
    queryFn: () => classesService.listClasses({ limit: 100, academic_year: academicYear }),
    enabled: !isStudent && !isParent,
    staleTime: 60_000,
  });
  const classes = (classesData as any)?.data ?? [];
  const classOptions = useMemo(() => classes.map((c: any) => ({ value: String(c.id), label: c.name, sublabel: c.level })), [classes]);

  const { data: studentsData } = useQuery({
    queryKey: ['report-card-students', classId],
    queryFn: () => classesService.getClassStudents(classId),
    enabled: !!classId && !isStudent && !isParent,
    staleTime: 30_000,
  });
  const students = (studentsData as any)?.data?.students ?? (studentsData as any)?.students ?? [];
  const studentOptions = useMemo(
    () => students.map((s: any) => ({ value: String(s.id), label: `${s.first_name} ${s.last_name}`, sublabel: s.roll_number || s.student_id })),
    [students],
  );

  const canLoad = !!(studentId && classId && academicYear);
  const { data: cardResp, isLoading, error } = useQuery({
    queryKey: ['report-card', studentId, classId, academicYear],
    queryFn: () => reportCardService.getReportCard(studentId, { class_id: classId, academic_year: academicYear }),
    enabled: canLoad,
    staleTime: 15_000,
  });
  const card: ReportCard | null = (cardResp as any)?.data ?? null;

  // Released terms for the current card. Staff (no publish gate) may view any
  // term; students/parents only see released ones.
  const isStaff = !isStudent && !isParent;
  const publishedTerms: SLTerm[] = ((card?.published_terms as SLTerm[]) || []);
  const yearReleased = !!card?.year_released;
  const allTerms: SLTerm[] = ['first_term', 'second_term', 'third_term'];
  // Which terms this viewer may open.
  const availableTerms: SLTerm[] = isStaff ? allTerms : (yearReleased ? allTerms : publishedTerms);
  const canViewFull = isStaff || yearReleased;

  // Auto-pick a sensible default view once the card loads:
  //  - full booklet if the year is released (or staff);
  //  - otherwise the latest released single term.
  React.useEffect(() => {
    if (!card) return;
    if (canViewFull) { setViewTerm('full'); return; }
    const latest = [...allTerms].reverse().find((t) => publishedTerms.includes(t));
    if (latest) setViewTerm(latest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id, yearReleased, publishedTerms.join(',')]);

  const isSingleTerm = viewTerm !== 'full';

  const schoolName = school?.name || 'SCHOOL NAME';
  const schoolAddress = [school?.address, school?.city, school?.state, school?.country].filter(Boolean).join(', ');
  const schoolLogo = school?.logo_url;
  const shortName = school?.short_name || schoolName.split(' ').map((w: string) => w[0]).join('').slice(0, 4).toUpperCase();

  const bookletRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  // ── Whole-class batch export state ──────────────────────────────────────────
  const batchRef = useRef<HTMLDivElement>(null);
  const [batchCard, setBatchCard] = useState<ReportCard | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  // Roster of students in the selected class (staff only), used by the batch.
  const batchRoster = useMemo(
    () => (isStudent || isParent ? [] : students),
    [isStudent, isParent, students],
  );

  /**
   * Print/export the booklet.
   *
   * We print the CURRENT page directly (window.print) because the app's CSS is
   * already loaded here — this guarantees crisp vector output and the correct
   * layout with no style-timing issues. A dedicated print stylesheet (in the
   * JSX below) hides all app chrome so ONLY the two booklet sheets appear, and
   * `@page { margin: 0 }` drops the browser header/footer in Chromium browsers.
   *
   * To force the "Full Booklet" view (both sheets) regardless of the on-screen
   * toggle, we temporarily switch the spread to 'all' for the print, then
   * restore it afterwards.
   */
  /**
   * Last-resort browser print. Only used if client-side PDF capture fails.
   * The @page { margin: 0 } rule minimises browser chrome, but some browsers
   * still add a header/footer here — which is exactly why the PDF/print flows
   * below prefer the chrome-free canvas→PDF path.
   */
  const printBooklet = () => {
    if (!card) return;
    setExporting(true);

    const prevSpread = spread;
    setSpread('all');

    setTimeout(() => {
      const restore = () => {
        setSpread(prevSpread);
        setExporting(false);
        window.removeEventListener('afterprint', restore);
      };
      window.addEventListener('afterprint', restore);
      window.print();
      setTimeout(restore, 1500);
    }, 150);
  };

  /**
   * Print: build the clean, chrome-free PDF and open it in a new tab. We do NOT
   * auto-trigger the browser print dialog — the native PDF viewer renders the
   * COMPLETE multi-page document, and the user prints/saves from there with its
   * own controls. (Auto window.print() on a freshly-opened PDF often previews
   * before the document finishes rendering, cutting off pages.)
   */
  const handlePrint = async () => {
    if (!card) return;
    setExporting(true);

    // Single-term sheet: prefer the clean server PDF (term-aware), fall back to
    // capturing the on-screen .term-sheet node.
    if (isSingleTerm) {
      try {
        const nm = (card.student.name || 'student').replace(/\s+/g, '_');
        const yr = card.academic_year.replace('/', '-');
        const fname = `Result_${nm}_${(viewTerm as string).replace('_term', 'T')}_${yr}.pdf`;
        const blob = await reportCardService.downloadPdf(studentId, {
          class_id: classId, academic_year: academicYear, term: viewTerm as string,
        });
        if (blob) {
          await previewBlob(blob, fname);
          setExporting(false);
          return;
        }
        const cblob = await buildTermSheetPdfBlob();
        await previewBlob(cblob, fname);
      } catch {
        printBooklet();
      } finally {
        setExporting(false);
      }
      return;
    }

    const prevSpread = spread;
    setSpread('all');
    await new Promise((r) => setTimeout(r, 200));
    try {
      const blob = await buildBookletPdfBlob();
      const nm = (card.student.name || 'student').replace(/\s+/g, '_');
      const yr = card.academic_year.replace('/', '-');
      await previewBlob(blob, `Report_${nm}_${yr}.pdf`);
    } catch {
      printBooklet();
      return;
    } finally {
      setSpread(prevSpread);
      setExporting(false);
    }
  };

  /** Capture the single .term-sheet node into a portrait A4 PDF (client fallback). */
  const buildTermSheetPdfBlob = async (): Promise<Blob> => {
    const root = bookletRef.current;
    if (!root) throw new Error('Sheet not rendered');
    const node = root.querySelector<HTMLElement>('.term-sheet');
    if (!node) throw new Error('Term sheet not found');
    const { toPng } = await import('html-to-image');
    const { jsPDF } = await import('jspdf');
    const imgs = Array.from(node.querySelectorAll('img'));
    await Promise.all(imgs.map((img) => img.complete ? Promise.resolve() : new Promise<void>((r) => { img.onload = () => r(); img.onerror = () => r(); })));
    const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 3, backgroundColor: '#ffffff', width: 794, height: node.scrollHeight });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    pdf.addImage(dataUrl, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
    return pdf.output('blob');
  };

  /**
   * Download PDF. Order of preference:
   *  1. Server-side Chromium PDF (cleanest, true vector). May be unavailable on
   *     serverless hosts (no Chromium) → returns null.
   *  2. Client-side PDF built from the on-page booklet sheets via html-to-image
   *     + jsPDF. This produces a clean A4-landscape PDF with NO browser
   *     header/footer or site URL — the robust cross-browser fallback.
   *  3. window.print() only as a last resort if capture fails.
   */
  const handleExportPdf = async () => {
    if (!card) return;
    setExporting(true);
    const nm = (card.student.name || 'student').replace(/\s+/g, '_');
    const yr = card.academic_year.replace('/', '-');
    const fileName = isSingleTerm
      ? `Result_${nm}_${(viewTerm as string).replace('_term', 'T')}_${yr}.pdf`
      : `Report_${nm}_${yr}.pdf`;
    try {
      const blob = await reportCardService.downloadPdf(studentId, {
        class_id: classId, academic_year: academicYear,
        ...(isSingleTerm ? { term: viewTerm as string } : {}),
      });
      if (blob) {
        await saveBlob(blob, fileName);
        setExporting(false);
        return;
      }
    } catch {
      /* fall through to client-side generation */
    }

    // Client-side clean PDF (no browser chrome).
    const prevSpread = spread;
    if (!isSingleTerm) setSpread('all');
    await new Promise((r) => setTimeout(r, 200));
    try {
      const blob = isSingleTerm ? await buildTermSheetPdfBlob() : await buildBookletPdfBlob();
      await saveBlob(blob, fileName);
      showToast.success(isSingleTerm ? 'Result sheet downloaded' : 'Report PDF downloaded');
    } catch (err) {
      // Absolute last resort — browser print (may add header/footer).
      showToast.info('Preparing printable version...');
      printBooklet();
    } finally {
      setSpread(prevSpread);
      setExporting(false);
    }
  };

  /**
   * Capture each .booklet-sheet as a high-res PNG and write it to one A4
   * landscape PDF page. The sheets are already rendered in booklet order:
   *   Sheet 1 outside: [8 | 1]
   *   Sheet 1 inside:  [2 | 7]
   *   Sheet 2 outside: [6 | 3]
   *   Sheet 2 inside:  [4 | 5]
   *
   * Returns the PDF as a Blob — pixel-faithful and completely free of any
   * browser header/footer or site URL.
   */
  const buildBookletPdfBlob = async (): Promise<Blob> => {
    const root = bookletRef.current;
    if (!root) throw new Error('Booklet not rendered');

    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const added = await appendBookletSheetsToPdf(root, pdf, true);
    if (added === 0) throw new Error('No booklet sheets found');
    return pdf.output('blob');
  };

  /**
   * Capture every .booklet-sheet inside `root` as a high-res PNG and add it as
   * one full A4-landscape PDF page. Reused for both single-student and
   * whole-class batch export. Returns the number of sheets captured.
   */
  const appendBookletSheetsToPdf = async (root: HTMLElement, pdf: any, isFirst: boolean): Promise<number> => {
    const { toPng } = await import('html-to-image');

    const sheets = Array.from(root.querySelectorAll<HTMLElement>('.booklet-sheet'));
    if (sheets.length === 0) return 0;

    // Each sheet is rendered at A4-landscape dimensions on screen
    const SHEET_W = 1123;
    const SHEET_H = 794;

    const sheetImages: string[] = [];
    for (let i = 0; i < sheets.length; i++) {
      const node = sheets[i];

      const imgs = Array.from(node.querySelectorAll('img'));
      await Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); })
        )
      );

      const prev = {
        width: node.style.width, maxWidth: node.style.maxWidth, minHeight: node.style.minHeight,
        height: node.style.height, boxShadow: node.style.boxShadow, borderRadius: node.style.borderRadius,
        margin: node.style.margin, overflow: node.style.overflow,
      };
      node.style.width = `${SHEET_W}px`;
      node.style.maxWidth = 'none';
      node.style.minHeight = `${SHEET_H}px`;
      node.style.height = `${SHEET_H}px`;
      node.style.boxShadow = 'none';
      node.style.borderRadius = '0';
      node.style.margin = '0';
      node.style.overflow = 'visible';

      const fullW = Math.max(SHEET_W, node.scrollWidth);
      const fullH = Math.max(SHEET_H, node.scrollHeight);

      const MAX_SIDE = 16000;
      const MAX_AREA = 260_000_000;
      let pixelRatio = 3;
      const wouldExceed = (r: number) =>
        fullW * r > MAX_SIDE || fullH * r > MAX_SIDE || fullW * r * fullH * r > MAX_AREA;
      while (pixelRatio > 1 && wouldExceed(pixelRatio)) pixelRatio -= 0.5;

      let dataUrl: string;
      try {
        dataUrl = await toPng(node, {
          cacheBust: true,
          pixelRatio,
          backgroundColor: '#ffffff',
          width: fullW,
          height: fullH,
        });
      } finally {
        node.style.width = prev.width;
        node.style.maxWidth = prev.maxWidth;
        node.style.minHeight = prev.minHeight;
        node.style.height = prev.height;
        node.style.boxShadow = prev.boxShadow;
        node.style.borderRadius = prev.borderRadius;
        node.style.margin = prev.margin;
        node.style.overflow = prev.overflow;
      }
      sheetImages.push(dataUrl);
    }

    const sheetW = pdf.internal.pageSize.getWidth();   // 297mm
    const sheetH = pdf.internal.pageSize.getHeight();  // 210mm

    for (let i = 0; i < sheetImages.length; i++) {
      if (!(isFirst && i === 0)) pdf.addPage('a4', 'landscape');
      pdf.addImage(sheetImages[i], 'PNG', 0, 0, sheetW, sheetH, undefined, 'FAST');
    }

    return sheetImages.length;
  };

  /**
   * WHOLE-CLASS batch: generate one combined PDF containing every student's
   * booklet (2 landscape pages each). Fetches each student's report card,
   * renders it into a hidden off-screen node, captures it, and appends.
   */
  const handleClassBatch = async () => {
    if (!classId) { showToast.error('Select a class first'); return; }
    if (batchRoster.length === 0) { showToast.error('No students found in this class'); return; }

    setBatchRunning(true);
    setBatchProgress({ done: 0, total: batchRoster.length });
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    let first = true;
    let ok = 0;

    try {
      const className = classOptions.find((c: any) => String(c.value) === String(classId))?.label || 'Class';
      for (let idx = 0; idx < batchRoster.length; idx++) {
        const stu = batchRoster[idx];
        try {
          const resp: any = await reportCardService.getReportCard(String(stu.id), { class_id: classId, academic_year: academicYear });
          const stuCard: ReportCard | null = resp?.data ?? null;
          if (stuCard) {
            // Render into the hidden batch node and wait for a commit.
            setBatchCard(stuCard);
            await new Promise((r) => setTimeout(r, 250));
            const node = batchRef.current;
            if (node) {
              const added = await appendBookletSheetsToPdf(node, pdf, first);
              if (added > 0) { first = false; ok++; }
            }
          }
        } catch { /* skip a student who has no data, continue the batch */ }
        setBatchProgress({ done: idx + 1, total: batchRoster.length });
      }

      if (ok === 0) { showToast.error('No report cards could be generated for this class'); return; }
      const blob = pdf.output('blob');
      await saveBlob(blob, `Report_Cards_${className.replace(/\s+/g, '_')}_${academicYear.replace('/', '-')}.pdf`);
      showToast.success(`Generated ${ok} of ${batchRoster.length} report card${batchRoster.length === 1 ? '' : 's'}`);
    } finally {
      setBatchCard(null);
      setBatchRunning(false);
    }
  };

  const showCover = spread === 'all' || spread === 'cover';
  const showInner = spread === 'all' || spread === 'inner';

  return (
    <MainLayout>
      <PageShell
        title="Report Cards"
        subtitle="Sierra Leone terminal report booklet — A4 landscape, folds into a 4-page booklet"
        breadcrumbs={[{ label: 'Report Cards' }]}
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Whole-class batch — staff only, once a class is selected. */}
            {!isStudent && !isParent && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClassBatch}
                disabled={!classId || batchRoster.length === 0 || batchRunning || exporting}
                className="px-2 sm:px-3"
                title="Generate a single PDF with every student's report card in this class"
              >
                <Users size={15} className="sm:mr-1.5" />
                <span className="hidden sm:inline">
                  {batchRunning ? `Generating ${batchProgress.done}/${batchProgress.total}…` : 'Download Whole Class'}
                </span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={!card || exporting || batchRunning} className="px-2 sm:px-3">
              <Download size={15} className="sm:mr-1.5" />
              <span className="hidden sm:inline">{exporting ? 'Preparing...' : 'Download PDF'}</span>
            </Button>
            <Button variant="default" size="sm" onClick={handlePrint} disabled={!card || exporting || batchRunning} className="bg-blue-600 hover:bg-blue-700 text-white px-2 sm:px-3">
              <Printer size={15} className="sm:mr-1.5" />
              <span className="hidden sm:inline">Print</span>
            </Button>
          </div>
        }
      >
        {/* Selection toolbar (hidden on print) */}
        <div className="p-4 mb-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 print:hidden">
          {isStudent ? (
            // Students: no class/student pickers — just choose the academic year.
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 flex flex-col justify-center">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Report Card</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {selfProfile?.full_name || `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim()}
                  {selfProfile?.class_name ? ` — ${selfProfile.class_name}` : ''}
                </span>
              </div>
              <SearchableSelect label="Academic Year" options={yearOptions} value={academicYear} onChange={setAcademicYear} placeholder="Academic year" />
            </div>
          ) : isParent ? (
            // Parents: pick a child + academic year (no class/student staff pickers).
            <div className="space-y-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {parentChildren.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedChildId(c.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm whitespace-nowrap transition ${
                      activeChildId === c.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300'
                    }`}
                  >
                    <span className="font-medium">{c.name}</span>
                    {c.class_name && <span className="text-xs text-gray-400">· {c.class_name}</span>}
                  </button>
                ))}
                {parentChildren.length === 0 && (
                  <span className="text-sm text-gray-500">No children linked to your account.</span>
                )}
              </div>
              <div className="sm:max-w-xs">
                <SearchableSelect label="Academic Year" options={yearOptions} value={academicYear} onChange={setAcademicYear} placeholder="Academic year" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <SearchableSelect label="Class" options={classOptions} value={classId} onChange={(v) => { setClassId(v); setStudentId(''); }} placeholder="Select class..." />
              <SearchableSelect label="Student" options={studentOptions} value={studentId} onChange={setStudentId} placeholder="Select student..." />
              <SearchableSelect label="Academic Year" options={yearOptions} value={academicYear} onChange={setAcademicYear} placeholder="Academic year" />
            </div>
          )}

          {/* Term selector — single-term sheet (Term 1/2) vs full-year booklet.
              Only terms that are released show for students/parents. */}
          {canLoad && card && (
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider w-full sm:w-auto">Result:</span>
              {([
                { key: 'first_term',  label: 'Term 1', avail: availableTerms.includes('first_term') },
                { key: 'second_term', label: 'Term 2', avail: availableTerms.includes('second_term') },
                { key: 'third_term',  label: 'Term 3', avail: availableTerms.includes('third_term') },
              ] as const).map((o) => (
                <button
                  key={o.key}
                  onClick={() => o.avail && setViewTerm(o.key)}
                  disabled={!o.avail}
                  title={o.avail ? `${o.label} result sheet` : `${o.label} not released yet`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    viewTerm === o.key ? 'bg-blue-600 text-white shadow-sm'
                    : o.avail ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  }`}
                >
                  {o.label}
                </button>
              ))}
              <button
                onClick={() => canViewFull && setViewTerm('full')}
                disabled={!canViewFull}
                title={canViewFull ? 'Full-year report booklet' : 'Full booklet available at year-end'}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  viewTerm === 'full' ? 'bg-[#1d4ed8] text-white shadow-sm'
                  : canViewFull ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                }`}
              >
                Full Booklet
              </button>
            </div>
          )}

          {/* Spread toggle — only in full booklet mode */}
          {!isSingleTerm && (
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider w-full sm:w-auto">Booklet view:</span>
              {([
                { key: 'all', short: 'Full', label: 'Full Booklet (8 pages)' },
                { key: 'cover', short: 'Covers', label: 'Cover + Grading (pages 1-3, 8)' },
                { key: 'inner', short: 'Results', label: 'Results (pages 4-5)' },
              ] as const).map((o) => (
                <button
                  key={o.key}
                  onClick={() => setSpread(o.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${spread === o.key ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'}`}
                >
                  <span className="sm:hidden">{o.short}</span>
                  <span className="hidden sm:inline">{o.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Draft banner — staff only, when the selected card isn't released yet. */}
        {canLoad && card && !isStudent && !isParent && card.is_published === false && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300 print:hidden">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold">!</span>
            <span>
              <strong>Draft — not yet released.</strong> Parents and students can't see this report until you publish it in Settings → Grading &amp; Results.
            </span>
          </div>
        )}

        {!canLoad && (
          <EmptyState
            message={isStudent || isParent ? 'Report card unavailable' : 'Select a student'}
            description={isStudent
              ? 'Your report card will appear here once your results are published.'
              : isParent
                ? 'Select a child. The report card appears once results are published.'
                : 'Choose a class, student and academic year to generate the report booklet.'}
          />
        )}
        {canLoad && isLoading && <div className="grid gap-3"><SkeletonCard /><SkeletonCard /></div>}
        {canLoad && error && <EmptyState message="Failed to load report" description="There was an error generating this report card." />}

        {/* Print CSS — hide the whole app (#root) and print ONLY the portaled booklet.
            The booklet is portaled to <body> so no layout ancestor can clip or blank it. */}
        <style>{`
          /* On screen, the portaled print booklet stays hidden — the in-page
             preview below is what the user sees. */
          #booklet-print-portal { display: none; }

          @media print {
            @page { size: ${isSingleTerm ? 'A4 portrait' : '148mm 210mm'}; margin: 0; }

            html, body {
              background: #fff !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            /* Hide the entire application */
            #root { display: none !important; }

            /* Single-term sheet — one A4 portrait page */
            #booklet-print-portal .term-sheet {
              box-shadow: none !important;
              width: 210mm !important;
              min-height: 297mm !important;
              margin: 0 !important;
            }

            /* Show ONLY the portaled booklet */
            #booklet-print-portal {
              display: block !important;
              position: static !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            #booklet-print-portal > * { margin: 0 !important; }

            /* Each page = A5 portrait (148mm × 210mm). One per printed page. */
            #booklet-print-portal .booklet-sheet {
              box-shadow: none !important;
              border-radius: 0 !important;
              margin: 0 !important;
              width: 148mm !important;
              max-width: 148mm !important;
              min-height: 0 !important;
              height: auto !important;
              overflow: hidden !important;
              page-break-inside: avoid;
              break-inside: avoid;
              page-break-after: always;
              break-after: page;
            }
            #booklet-print-portal .booklet-sheet:last-child {
              page-break-after: avoid !important;
              break-after: avoid !important;
            }
          }
        `}</style>

        {/* Hidden off-screen batch render target — one student at a time during
            a whole-class export. Positioned far off-screen (not display:none) so
            html-to-image can measure & capture it. */}
        {batchCard && createPortal(
          <div
            aria-hidden
            style={{ position: 'fixed', left: -100000, top: 0, width: 560, pointerEvents: 'none', opacity: 1, zIndex: -1, background: '#fff' }}
          >
            <div ref={batchRef} className="w-max">
              <BookletContent
                card={batchCard}
                school={school}
                schoolName={schoolName}
                schoolAddress={schoolAddress}
                schoolLogo={schoolLogo}
                shortName={shortName}
                showCover
                showInner
                showGrading
                borderStyle={borderStyle}
                showWatermark={showWatermark}
                watermarkOpacity={watermarkOpacity}
                watermarkSize={watermarkSize}
                showStudentPhoto={showStudentPhoto}
                photoFrame={photoFrame}
                stampUrl={stampUrl}
                signatureUrl={signatureUrl}
                stampScale={stampScale}
                signatureScale={signatureScale}
              />
            </div>
          </div>,
          document.body,
        )}

        {/* Portaled print copy — rendered to <body>, only visible during print */}
        {canLoad && card && createPortal(
          <div id="booklet-print-portal">
            {isSingleTerm ? (
              <TermResultSheet
                card={card}
                term={viewTerm as SLTerm}
                school={school}
                schoolName={schoolName}
                schoolAddress={schoolAddress}
                schoolLogo={schoolLogo}
                shortName={shortName}
              />
            ) : (
              <BookletContent
                card={card}
                school={school}
                schoolName={schoolName}
                schoolAddress={schoolAddress}
                schoolLogo={schoolLogo}
                shortName={shortName}
                showCover
                showInner
                showGrading
                borderStyle={borderStyle}
                showWatermark={showWatermark}
                watermarkOpacity={watermarkOpacity}
                watermarkSize={watermarkSize}
                showStudentPhoto={showStudentPhoto}
                photoFrame={photoFrame}
                stampUrl={stampUrl}
                signatureUrl={signatureUrl}
                stampScale={stampScale}
                signatureScale={signatureScale}
              />
            )}
          </div>,
          document.body,
        )}

        {canLoad && card && (
          <>
            {/* On small screens the A4-landscape booklet is wider than the
                viewport, so allow horizontal scroll (disabled on print). */}
            <p className="sm:hidden text-[11px] text-gray-400 mb-2 print:hidden">
              Tip: use Download PDF for the best print-ready booklet.
            </p>
            <div className="overflow-x-auto -mx-2 px-2 print:overflow-visible print:mx-0 print:px-0">
              <div id="booklet-print-root" ref={bookletRef} className="space-y-6 print:space-y-0 mx-auto print:w-auto">
                {isSingleTerm ? (
                  <TermResultSheet
                    card={card}
                    term={viewTerm as SLTerm}
                    school={school}
                    schoolName={schoolName}
                    schoolAddress={schoolAddress}
                    schoolLogo={schoolLogo}
                    shortName={shortName}
                  />
                ) : (
                  <BookletContent
                    card={card}
                    school={school}
                    schoolName={schoolName}
                    schoolAddress={schoolAddress}
                    schoolLogo={schoolLogo}
                    shortName={shortName}
                    showCover={showCover}
                    showInner={showInner}
                    showGrading={spread === 'all' || spread === 'cover'}
                    borderStyle={borderStyle}
                    showWatermark={showWatermark}
                    watermarkOpacity={watermarkOpacity}
                    watermarkSize={watermarkSize}
                    showStudentPhoto={showStudentPhoto}
                    photoFrame={photoFrame}
                    stampUrl={stampUrl}
                    signatureUrl={signatureUrl}
                    stampScale={stampScale}
                    signatureScale={signatureScale}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </PageShell>
    </MainLayout>
  );
};

export default ReportCardsPage;
