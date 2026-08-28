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
import { BookletContent } from './components/BookletContent';
import { Printer, Download } from 'lucide-react';

export const ReportCardsPage: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [academicYear, setAcademicYear] = useState(`${currentYear}/${currentYear + 1}`);
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [spread, setSpread] = useState<'all' | 'cover' | 'inner'>('all');

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
    staleTime: 60_000,
  });
  const classes = (classesData as any)?.data ?? [];
  const classOptions = useMemo(() => classes.map((c: any) => ({ value: String(c.id), label: c.name, sublabel: c.level })), [classes]);

  const { data: studentsData } = useQuery({
    queryKey: ['report-card-students', classId],
    queryFn: () => classesService.getClassStudents(classId),
    enabled: !!classId,
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
  const printBooklet = () => {
    if (!card) return;
    setExporting(true);

    const prevSpread = spread;
    setSpread('all');

    // Wait a tick for the DOM to reflect the 'all' spread, then print.
    setTimeout(() => {
      const restore = () => {
        setSpread(prevSpread);
        setExporting(false);
        window.removeEventListener('afterprint', restore);
      };
      window.addEventListener('afterprint', restore);
      window.print();
      // Safety restore in case afterprint doesn't fire (some browsers)
      setTimeout(restore, 1500);
    }, 150);
  };

  const handlePrint = () => printBooklet();

  /**
   * Download PDF: try the server-side generator first (clean, no browser
   * header/footer, guaranteed 2 pages). If it's unavailable (e.g. serverless
   * without Chromium), fall back to the client-side print flow.
   */
  const handleExportPdf = async () => {
    if (!card) return;
    setExporting(true);
    try {
      const blob = await reportCardService.downloadPdf(studentId, { class_id: classId, academic_year: academicYear });
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Report_${(card.student.name || 'student').replace(/\s+/g, '_')}_${card.academic_year.replace('/', '-')}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setExporting(false);
        return;
      }
      // Fallback: browser print (user chooses Save as PDF)
      showToast.info('Preparing printable version...');
      printBooklet();
    } catch {
      printBooklet();
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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={!card || exporting}>
              <Download size={15} className="mr-1.5" /> {exporting ? 'Preparing...' : 'Download PDF'}
            </Button>
            <Button variant="default" size="sm" onClick={handlePrint} disabled={!card || exporting} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Printer size={15} className="mr-1.5" /> Print
            </Button>
          </div>
        }
      >
        {/* Selection toolbar (hidden on print) */}
        <div className="p-4 mb-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SearchableSelect label="Class" options={classOptions} value={classId} onChange={(v) => { setClassId(v); setStudentId(''); }} placeholder="Select class..." />
            <SearchableSelect label="Student" options={studentOptions} value={studentId} onChange={setStudentId} placeholder="Select student..." />
            <SearchableSelect label="Academic Year" options={yearOptions} value={academicYear} onChange={setAcademicYear} placeholder="Academic year" />
          </div>

          {/* Spread toggle */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Booklet view:</span>
            {([
              { key: 'all', label: 'Full Booklet (2 sheets)' },
              { key: 'cover', label: 'Sheet 1 — Covers' },
              { key: 'inner', label: 'Sheet 2 — Results' },
            ] as const).map((o) => (
              <button
                key={o.key}
                onClick={() => setSpread(o.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${spread === o.key ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {!canLoad && <EmptyState message="Select a student" description="Choose a class, student and academic year to generate the report booklet." />}
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
          <div id="booklet-print-root" ref={bookletRef} className="space-y-6 print:space-y-0">
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
        )}
      </PageShell>
    </MainLayout>
  );
};

export default ReportCardsPage;
