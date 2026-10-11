/**
 * TermResultSheet — a single portrait A4 "terminal result sheet" for ONE term
 * (Term 1 / Term 2). WAEC/WASSCE-styled and authentic. Mirrors the server
 * renderer (backend renderTermResultSheetHtml) so the on-screen preview and the
 * printed/exported PDF match. The full folded booklet is used for Term 3.
 *
 * Rendered as a `.term-sheet` node so the ReportCardsPage capture/print flow can
 * find it (same convention as `.booklet-sheet`).
 */
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ReportCard, SLTerm, SL_GRADING_METHOD, getGradingMethod } from '@services/reportCardService';

const TERM_LABELS: Record<SLTerm, string> = {
  first_term: 'First Term', second_term: 'Second Term', third_term: 'Third Term',
};

function ordinal(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return '—';
  const num = Number(n), v = num % 100, u = num % 10;
  const suf = v >= 11 && v <= 13 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th';
  return `${num}${suf}`;
}

interface Props {
  card: ReportCard;
  term: SLTerm;
  school: any;
  schoolName: string;
  schoolAddress: string;
  schoolLogo?: string;
  shortName: string;
}

export const TermResultSheet: React.FC<Props> = ({ card, term, school, schoolName, schoolAddress, schoolLogo, shortName }) => {
  useEffect(() => { getGradingMethod(); }, []);
  const gm = SL_GRADING_METHOD;
  const s = card.student;
  const sm = (card.term_summaries as any)?.[term] || {};

  const [qr, setQr] = useState('');
  useEffect(() => {
    const url = card.verify_url || '';
    if (!url) return;
    QRCode.toDataURL(url, { width: 200, margin: 1, color: { dark: '#111827', light: '#ffffff' } })
      .then(setQr).catch(() => {});
  }, [card.verify_url]);

  const gradeFor = (mean: number | null | undefined) => {
    if (mean == null) return { grade: '—', remark: '', fail: false };
    const idx = gm.findIndex((x) => mean >= x.min && mean <= x.max);
    const g = idx >= 0 ? gm[idx] : gm[gm.length - 1];
    const letter = String.fromCharCode(65 + Math.min(idx < 0 ? gm.length - 1 : idx, 5));
    return { grade: letter, remark: g.remark, fail: g.isFail || mean < 50 };
  };

  return (
    <div
      className="term-sheet bg-white text-gray-900 mx-auto shadow-lg"
      style={{ width: 794, minHeight: 1123, fontFamily: "'Times New Roman', Georgia, serif" }}
    >
      <div className="m-[46px] border-[3px] border-double border-[#1e3a8a] p-8 flex flex-col" style={{ minHeight: 1030 }}>
        {/* Header */}
        <div className="flex items-center gap-3 border-b-2 border-[#1e3a8a] pb-3">
          {schoolLogo
            ? <img src={schoolLogo} alt="" className="w-20 h-20 object-contain" />
            : <div className="w-20 h-20 rounded-full bg-[#1e3a8a] text-white font-extrabold text-2xl flex items-center justify-center">{shortName}</div>}
          <div className="flex-1 text-center">
            <h1 className="text-[26px] font-extrabold uppercase tracking-wide text-[#1e3a8a] m-0">{schoolName}</h1>
            {schoolAddress && <div className="text-[13px] text-gray-700 mt-1">{schoolAddress}</div>}
            {school?.motto && <div className="text-[13px] italic text-gray-500">Motto: {school.motto}</div>}
          </div>
          {schoolLogo && <div className="w-20" />}
        </div>

        {/* Title */}
        <div className="text-center my-5">
          <span className="inline-block bg-[#1e3a8a] text-white font-bold uppercase text-[15px] tracking-widest px-5 py-1.5">
            {TERM_LABELS[term]} Terminal Result
          </span>
          <div className="text-[14px] text-gray-700 mt-2">Academic Year {card.academic_year}</div>
        </div>

        {/* Student meta */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[14px] my-4 py-3 border-y border-gray-300">
          <div><b className="inline-block min-w-[112px] text-gray-700">Name:</b> {s.name}</div>
          <div><b className="inline-block min-w-[112px] text-gray-700">Admission No:</b> {s.admission_no}</div>
          <div><b className="inline-block min-w-[112px] text-gray-700">Class / Form:</b> {s.class_name || '—'}</div>
          <div><b className="inline-block min-w-[112px] text-gray-700">No. in Class:</b> {s.number_in_form ?? sm.class_size ?? '—'}</div>
          <div><b className="inline-block min-w-[112px] text-gray-700">Class Teacher:</b> {s.form_teacher_name || '—'}</div>
          <div><b className="inline-block min-w-[112px] text-gray-700">Term Position:</b> {sm.position ? `${ordinal(sm.position)}${sm.class_size ? ` of ${sm.class_size}` : ''}` : '—'}</div>
        </div>

        {/* Subjects table */}
        <table className="w-full border-collapse text-[14px] mt-2">
          <thead>
            <tr>
              {['#', 'Subject', 'Test 1', 'Test 2', 'Mean', 'Grade', 'Remark', 'Pos.'].map((h, i) => (
                <th key={h} className={`border border-gray-700 bg-[#1e3a8a] text-white text-[13px] uppercase px-1.5 py-1 ${i === 1 || i === 6 ? 'text-left' : 'text-center'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {card.subjects.length === 0 ? (
              <tr><td colSpan={8} className="border border-gray-700 py-3 text-center text-gray-400">No subject scores recorded for this term.</td></tr>
            ) : card.subjects.map((subj: any, i: number) => {
              const t = subj.terms?.[term] || {};
              const mean = t.mean ?? null;
              const g = gradeFor(mean);
              return (
                <tr key={subj.subject_id} className={i % 2 ? 'bg-slate-50' : ''}>
                  <td className="border border-gray-700 text-center text-gray-500 px-1.5 py-[5px]">{i + 1}</td>
                  <td className="border border-gray-700 text-left font-semibold px-1.5 py-[5px]">{subj.subject_name}</td>
                  <td className="border border-gray-700 text-center px-1.5 py-[5px]">{t.test1 ?? '—'}</td>
                  <td className="border border-gray-700 text-center px-1.5 py-[5px]">{t.test2 ?? '—'}</td>
                  <td className={`border border-gray-700 text-center font-bold px-1.5 py-[5px] ${g.fail ? 'text-red-700' : ''}`}>{mean ?? '—'}</td>
                  <td className={`border border-gray-700 text-center px-1.5 py-[5px] ${g.fail ? 'text-red-700 font-bold' : ''}`}>{g.grade}</td>
                  <td className="border border-gray-700 text-left text-[13px] text-gray-700 px-1.5 py-[5px]">{g.remark}</td>
                  <td className="border border-gray-700 text-center px-1.5 py-[5px]">{t.rank ? ordinal(t.rank) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Summary boxes */}
        <div className="grid grid-cols-4 gap-2 my-3">
          {[
            { v: sm.combined_score ?? '—', l: 'Total Score' },
            { v: sm.percentage != null ? `${sm.percentage}%` : '—', l: 'Average' },
            { v: sm.position ? ordinal(sm.position) : '—', l: 'Position' },
            { v: sm.conduct || '—', l: 'Conduct' },
          ].map((b) => (
            <div key={b.l} className="border border-gray-300 rounded-md p-1.5 text-center">
              <div className="text-xl font-extrabold text-[#1e3a8a]">{b.v}</div>
              <div className="text-[12px] text-gray-500 uppercase tracking-wide">{b.l}</div>
            </div>
          ))}
        </div>
        <div className="text-[14px] text-center text-gray-700 mb-2">
          Attendance — On Time <b>{sm.on_time ?? 0}</b> · Late <b>{sm.late ?? 0}</b> · Absent <b>{sm.absent ?? 0}</b>
        </div>

        {/* Comments */}
        <div className="text-[14px] mt-1.5 space-y-1.5">
          <div className="flex gap-1.5 items-baseline">
            <span className="font-bold whitespace-nowrap text-gray-700">Class Teacher's Remark:</span>
            <span className="flex-1 border-b border-dotted border-gray-500 italic px-1 min-h-[15px]">{sm.teacher_comment || ''}</span>
          </div>
          <div className="flex gap-1.5 items-baseline">
            <span className="font-bold whitespace-nowrap text-gray-700">Principal's Remark:</span>
            <span className="flex-1 border-b border-dotted border-gray-500 italic px-1 min-h-[15px]">{card.meta?.principal_comment || ''}</span>
          </div>
        </div>

        {/* Grade key */}
        <div className="mt-4 text-[12px]">
          <div className="font-bold uppercase text-gray-700 mb-1">Grading Key</div>
          {gm.map((g) => (
            <span key={g.remark} className={`inline-block border rounded-full px-2 py-0.5 mr-1 mb-1 ${g.isFail ? 'text-red-700 border-red-300' : 'border-gray-300'}`}>
              {g.remark}: {g.min}–{g.max}
            </span>
          ))}
        </div>

        {/* Flexible spacer — pushes signatures/footer to the bottom so a short
            result sheet fills the A4 page instead of leaving a big blank gap. */}
        <div className="flex-1 min-h-[24px]" />

        {/* Footer: signatures + QR */}
        <div className="flex items-end justify-between mt-4">
          <div className="text-center text-[13px]">
            <div className="border-t border-gray-700 w-[150px] mx-auto mb-1 pt-1" />
            Class Teacher's Signature
          </div>
          <div className="text-center text-[11px] text-gray-500">
            {qr && <img src={qr} alt="QR" className="w-[80px] h-[80px] mx-auto mb-1" />}
            Scan to verify
          </div>
          <div className="text-center text-[13px]">
            <div className="border-t border-gray-700 w-[150px] mx-auto mb-1 pt-1 italic">{school?.principal_name || ''}</div>
            Principal's Signature
          </div>
        </div>

        <div className="text-center text-[12px] italic text-gray-500 mt-3 border-t border-gray-200 pt-2">
          This is an official single-term result. The complete report booklet is issued at the end of the academic year.
        </div>
      </div>
    </div>
  );
};

export default TermResultSheet;
