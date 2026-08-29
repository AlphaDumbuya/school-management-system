/**
 * ReportCardsPage — /academic/report-cards
 * Real, data-bound Sierra Leone terminal report BOOKLET.
 *
 * Physical form = one A4 LANDSCAPE sheet folded in half → 4 pages:
 *   SHEET 1 (outer): [ left = BACK COVER / legends ] | [ right = FRONT COVER / branding ]
 *   SHEET 2 (inner): the full RESULTS GRID (cognitive + affective + psychomotor + summaries)
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
import { Printer, Download, Users } from 'lucide-react';

export const ReportCardsPage: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const { user } = useAuth();
  const isStudent = user?.role === 'student';
  const isParent = user?.role === 'parent' || user?.role === 'guardian';
  const [academicYear, setAcademicYear] = useState(`${currentYear}/${currentYear + 1}`);
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [spread, setSpread] = useState<'all' | 'cover' | 'inner'>('all');

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

  const yearOptions = useMemo(() => {
    const arr = [];
    for (let y = currentYear + 1; y >= currentYear - 3; y--) arr.push({ value: `${y}/${y + 1}`, label: `${y}/${y + 1}` });
    return arr;
  }, [currentYear]);

  // School branding for the front cover
  const { data: schoolResp } = useQuery({
    queryKey: ['school-info'],
    queryFn: () => schoolConfigService.getSchoolInfo(),
    staleTime: 300_000,
  });
  const school = (schoolResp as any)?.data ?? (schoolResp as any) ?? {};

  const { data: classesData } = useQuery({
    queryKey: ['report-card-classes'],
    queryFn: () => classesService.listClasses({ limit: 100 }),
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
    const prevSpread = spread;
    setSpread('all');
    await new Promise((r) => setTimeout(r, 200));
    try {
      const blob = await buildBookletPdfBlob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Revoke later so the new tab can load it first.
      setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch {
      printBooklet();
      return;
    } finally {
      setSpread(prevSpread);
      setExporting(false);
    }
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
    const fileName = `Report_${(card.student.name || 'student').replace(/\s+/g, '_')}_${card.academic_year.replace('/', '-')}.pdf`;
    try {
      const blob = await reportCardService.downloadPdf(studentId, { class_id: classId, academic_year: academicYear });
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setExporting(false);
        return;
      }
    } catch {
      /* fall through to client-side generation */
    }

    // Client-side clean PDF (no browser chrome). Force both sheets to render.
    const prevSpread = spread;
    setSpread('all');
    // Wait for the DOM to reflect the full spread.
    await new Promise((r) => setTimeout(r, 200));
    try {
      const blob = await buildBookletPdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast.success('Report PDF downloaded');
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
   * Capture each .booklet-sheet as a high-res PNG and place one per A4-landscape
   * page in a jsPDF document. Returns the PDF as a Blob — pixel-faithful and
   * completely free of any browser header/footer or site URL.
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
   * Capture every .booklet-sheet inside `root` as a high-res PNG and add one per
   * A4-landscape page to the given jsPDF. Reused for both single-student and
   * whole-class batch export. Returns the number of sheets added.
   */
  const appendBookletSheetsToPdf = async (root: HTMLElement, pdf: any, isFirst: boolean): Promise<number> => {
    const { toPng } = await import('html-to-image');

    const sheets = Array.from(root.querySelectorAll<HTMLElement>('.booklet-sheet'));
    if (sheets.length === 0) return 0;

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    // A4 landscape aspect at ~96dpi — pin sheets to full size before capture so
    // the WHOLE sheet renders (not just the visible region in a scroll wrapper).
    const SHEET_W = 1123; // 297mm
    const SHEET_H = 794;  // 210mm

    let added = 0;
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

      if (!(isFirst && i === 0)) pdf.addPage('a4', 'landscape');

      const imgRatio = fullW / fullH;
      const pageRatio = pageW / pageH;
      let drawW = pageW, drawH = pageH;
      if (imgRatio > pageRatio) drawH = pageW / imgRatio;
      else drawW = pageH * imgRatio;
      const offX = (pageW - drawW) / 2;
      const offY = (pageH - drawH) / 2;
      pdf.addImage(dataUrl, 'PNG', offX, offY, drawW, drawH, undefined, 'FAST');
      added++;
    }
    return added;
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
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Report_Cards_${className.replace(/\s+/g, '_')}_${academicYear.replace('/', '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
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

          {/* Spread toggle */}
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider w-full sm:w-auto">Booklet view:</span>
            {([
              { key: 'all', short: 'Full', label: 'Full Booklet (2 sheets)' },
              { key: 'cover', short: 'Covers', label: 'Sheet 1 — Covers' },
              { key: 'inner', short: 'Results', label: 'Sheet 2 — Results' },
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
        </div>

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
            @page { size: A4 landscape; margin: 0; }

            html, body {
              background: #fff !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            /* Hide the entire application */
            #root { display: none !important; }

            /* Show ONLY the portaled booklet */
            #booklet-print-portal {
              display: block !important;
              position: static !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            #booklet-print-portal > * { margin: 0 !important; }

            /* Each sheet fills the full A4 landscape page. Height auto → no blank page. */
            #booklet-print-portal .booklet-sheet {
              box-shadow: none !important;
              border: none !important;
              border-radius: 0 !important;
              margin: 0 !important;
              padding: 6mm !important;
              width: 297mm !important;
              max-width: 297mm !important;
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
            style={{ position: 'fixed', left: -100000, top: 0, width: 1123, pointerEvents: 'none', opacity: 1, zIndex: -1, background: '#fff' }}
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
              />
            </div>
          </div>,
          document.body,
        )}

        {/* Portaled print copy — rendered to <body>, only visible during print */}
        {canLoad && card && createPortal(
          <div id="booklet-print-portal">
            <BookletContent
              card={card}
              school={school}
              schoolName={schoolName}
              schoolAddress={schoolAddress}
              schoolLogo={schoolLogo}
              shortName={shortName}
              showCover
              showInner
            />
          </div>,
          document.body,
        )}

        {canLoad && card && (
          <>
            {/* On small screens the A4-landscape booklet is wider than the
                viewport, so allow horizontal scroll (disabled on print). */}
            <p className="sm:hidden text-[11px] text-gray-400 mb-2 print:hidden">
              Tip: swipe sideways to view the full booklet, or use Download PDF.
            </p>
            <div className="overflow-x-auto -mx-2 px-2 print:overflow-visible print:mx-0 print:px-0">
              <div id="booklet-print-root" ref={bookletRef} className="space-y-6 print:space-y-0 w-max mx-auto print:w-auto">
                <BookletContent
                  card={card}
                  school={school}
                  schoolName={schoolName}
                  schoolAddress={schoolAddress}
                  schoolLogo={schoolLogo}
                  shortName={shortName}
                  showCover={showCover}
                  showInner={showInner}
                />
              </div>
            </div>
          </>
        )}
      </PageShell>
    </MainLayout>
  );
};

export default ReportCardsPage;
