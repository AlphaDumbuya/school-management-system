/**
 * BookletContent — the two-sheet Sierra Leone report booklet markup.
 * Rendered both in the on-screen preview and in the hidden print portal so the
 * printed output is byte-for-byte identical to what the user sees.
 */

import React from 'react';
import {
  ReportCard, SLTerm,
  AFFECTIVE_TRAITS, PSYCHOMOTOR_SKILLS, RATING_LEGEND, SL_GRADING_METHOD,
} from '@services/reportCardService';

const TERM_KEYS: SLTerm[] = ['first_term', 'second_term', 'third_term'];
const TERM_SHORT: Record<SLTerm, string> = { first_term: 'TERM 1', second_term: 'TERM 2', third_term: 'TERM 3' };

// Cognitive cell — red if a fail (<50)
const Num: React.FC<{ v: number | null | undefined; bold?: boolean }> = ({ v, bold }) => {
  if (v == null) return <span className="text-gray-400">–</span>;
  const fail = v < 50;
  return <span className={`${fail ? 'text-red-600 font-bold' : ''} ${bold ? 'font-bold' : ''}`}>{v}</span>;
};

export interface BookletContentProps {
  card: ReportCard;
  school: any;
  schoolName: string;
  schoolAddress: string;
  schoolLogo?: string;
  shortName: string;
  showCover: boolean;
  showInner: boolean;
}

export const BookletContent: React.FC<BookletContentProps> = ({
  card, school, schoolName, schoolAddress, schoolLogo, shortName, showCover, showInner,
}) => {
  return (
    <>
      {/* ══════════════════ SHEET 1 — OUTER (BACK | FRONT covers) ══════════════════ */}
      {showCover && (
        <div className="booklet-sheet bg-white text-gray-900 mx-auto rounded-lg shadow-lg w-full max-w-[1123px] min-h-[794px] grid grid-cols-2 divide-x-2 divide-dashed divide-gray-500">
          {/* ── LEFT: BACK COVER (legends) ── */}
          <div className="p-5 flex flex-col justify-between text-[12px] leading-snug">
            <div className="text-center font-bold text-[13px] border-b-2 border-gray-500 pb-1.5 mb-1">
              Key: Mn = Average &nbsp;·&nbsp; Rnk = Position
            </div>
            <div className="flex-1 py-1">
              <p className="font-bold uppercase text-purple-800 border-b border-purple-300 mb-1 text-[12px]">Affective</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {AFFECTIVE_TRAITS.map((t, i) => <div key={t}><b>{i + 1}</b> - {t}</div>)}
              </div>
            </div>
            <div className="flex-1 py-1">
              <p className="font-bold uppercase text-green-800 border-b border-green-300 mb-1 text-[12px]">Psychomotor</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {PSYCHOMOTOR_SKILLS.map((t, i) => <div key={t}><b>{i + 1}</b> - {t}</div>)}
              </div>
            </div>
            <div className="py-1">
              <p className="font-bold uppercase border-b border-gray-400 mb-1 text-[12px]">Cognitive — Mark / Scores</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {SL_GRADING_METHOD.map((g) => (
                  <div key={g.letter} className={g.isFail ? 'text-red-700 font-bold' : ''}>
                    {g.remark}: {g.min}–{g.max}
                  </div>
                ))}
              </div>
              <p className="italic text-gray-600 mt-1">Above 50% — reasonable but must maintain effort. Below 50% — improvement needed; discuss with the teacher.</p>
            </div>
            <div className="py-1">
              <p className="font-bold uppercase border-b border-gray-400 mb-1 text-[12px]">Affective & Psychomotor Rating</p>
              <div className="grid grid-cols-1 gap-y-0.5">
                {RATING_LEGEND.map((r) => <div key={r.value}><b>{r.value}</b> - {r.label}</div>)}
              </div>
            </div>
            <div className="border-2 border-gray-500 rounded p-2 mt-1">
              <p className="font-bold uppercase mb-1 text-[12px]">Note to Parents / Guardian</p>
              <p className="italic text-gray-700">
                This card reports on the whole pupil, not just the academic or the cognitive. Look at it carefully and discuss
                what you do not understand with the teacher. Keep in constant touch with the school. Encourage your child to be
                honest, truthful, hardworking, tidy, considerate of others and disciplined.
              </p>
            </div>
          </div>

          {/* ── RIGHT: FRONT COVER (branding) ── */}
          <div className="p-6 flex flex-col justify-between text-center">
            <div className="space-y-3">
              {schoolLogo ? (
                <img src={schoolLogo} alt="School logo" className="w-32 h-32 mx-auto object-contain" />
              ) : (
                <div className="w-32 h-32 mx-auto rounded-full bg-gray-900 text-white flex items-center justify-center text-3xl font-extrabold shadow">
                  {shortName}
                </div>
              )}
              <h1 className="text-2xl font-extrabold uppercase tracking-wide leading-tight">{schoolName}</h1>
              {schoolAddress && <p className="text-[13px] font-semibold text-gray-600">{schoolAddress}</p>}
              <div className="inline-block bg-gray-900 text-white font-bold px-4 py-1.5 rounded text-[14px] uppercase tracking-wider">
                Report Card
              </div>
              {card.student.class_level && (
                <p className="text-[13px] font-bold text-gray-700 uppercase">{card.student.class_level}</p>
              )}
            </div>

            <div className="w-full space-y-3 text-[14px] border-t-2 border-b-2 border-gray-900 py-4 my-2">
              <div className="flex justify-between border-b border-gray-300 pb-1.5">
                <span className="font-bold text-gray-600">Name of pupil:</span>
                <span className="font-bold">{card.student.name}</span>
              </div>
              <div className="flex justify-between border-b border-gray-300 pb-1.5">
                <span className="font-bold text-gray-600">Admission No:</span>
                <span className="font-bold">{card.student.admission_no}</span>
              </div>
              <div className="flex justify-between border-b border-gray-300 pb-1.5">
                <span className="font-bold text-gray-600">Class / Form:</span>
                <span className="font-bold">{card.student.class_name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-gray-600">Academic Year:</span>
                <span className="font-bold">{card.academic_year}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 w-full text-[12px]">
              <div className="border-2 border-dashed border-gray-400 rounded h-28 flex flex-col justify-between p-2">
                <span className="text-[11px] font-bold text-gray-500 uppercase">Official Stamp</span>
                <div className="w-16 h-16 border-2 border-blue-800 rounded-full mx-auto flex items-center justify-center text-[9px] font-bold text-blue-900 uppercase -rotate-12 opacity-70">{shortName} Seal</div>
              </div>
              <div className="border-2 border-dashed border-gray-400 rounded h-28 flex flex-col justify-between p-2">
                <span className="text-[11px] font-bold text-gray-500 uppercase">Principal's Signature</span>
                <span className="italic text-blue-800 font-bold font-serif text-[15px]">{school?.principal_name || 'Principal'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ SHEET 2 — INNER (RESULTS GRID) ══════════════════ */}
      {showInner && (() => {
        const rowCount = Math.max(card.subjects.length, AFFECTIVE_TRAITS.length, PSYCHOMOTOR_SKILLS.length);
        const aff = card.domain_ratings.affective || {};
        const psy = card.domain_ratings.psychomotor || {};
        const combYr = card.yearly_summary?.combined_score ?? null;
        const pctYr = card.yearly_summary?.percentage ?? null;
        const posYr = card.yearly_summary?.position ?? null;
        const posYrSize = card.yearly_summary?.class_size ?? null;

        return (
          <div className={`booklet-sheet bg-white text-gray-900 mx-auto p-4 rounded-lg shadow-lg w-full max-w-[1123px] flex flex-col min-h-[794px]`}>
            {/* Header line */}
            <div className="grid grid-cols-3 gap-2 text-[12px] border-b-2 border-gray-900 pb-2 mb-2">
              <div className="space-y-1">
                <div><span className="font-bold">Name:</span> {card.student.name}</div>
                <div><span className="font-bold">No. in Form:</span> {card.student.number_in_form ?? card.yearly_summary?.class_size ?? '—'}</div>
              </div>
              <div className="text-center space-y-1">
                <div><span className="font-bold">Average Age:</span> {card.student.class_average_age ?? '—'}</div>
                <div><span className="font-bold">Pupil's Age:</span> {card.student.pupil_age ?? '—'}</div>
              </div>
              <div className="text-right space-y-1">
                <div><span className="font-bold">Teacher in charge of class:</span> {card.student.form_teacher_name || '—'}</div>
                <div><span className="font-bold">Form:</span> {card.student.class_name || '—'} &nbsp; <span className="font-bold">Year:</span> {card.academic_year}</div>
              </div>
            </div>

            {/* MAIN UNIFIED GRID */}
            <div className="overflow-x-auto flex-1">
              <table className="w-full h-full border-collapse text-[11px]">
                <thead>
                  <tr className="text-center font-bold uppercase">
                    <th rowSpan={3} className="border border-gray-900 p-1 align-bottom text-left w-[110px]">Subject</th>
                    <th colSpan={14} className="border border-gray-900 p-1 bg-blue-50">* Cognitive</th>
                    <th rowSpan={3} className="border border-gray-900 p-1 align-bottom w-[16px]">#</th>
                    <th colSpan={13} className="border border-gray-900 p-1 bg-purple-50">* Affective</th>
                    <th rowSpan={3} className="border border-gray-900 p-1 align-bottom w-[16px]">#</th>
                    <th colSpan={13} className="border border-gray-900 p-1 bg-green-50">* Psychomotor</th>
                  </tr>
                  <tr className="text-center font-bold text-[10px]">
                    {TERM_KEYS.map((t) => <th key={t} colSpan={4} className="border border-gray-900 p-0.5 bg-blue-50/60">{TERM_SHORT[t]}</th>)}
                    <th colSpan={2} className="border border-gray-900 p-0.5 bg-amber-50">YEARLY</th>
                    {['TEST 1', 'TEST 2', 'TEST 3'].map((t) => <th key={`a${t}`} colSpan={3} className="border border-gray-900 p-0.5 bg-purple-50/60">{t} (Rating)</th>)}
                    <th colSpan={2} className="border border-gray-900 p-0.5 bg-amber-50">YEARLY</th>
                    {['TEST 1', 'TEST 2', 'TEST 3'].map((t) => <th key={`p${t}`} colSpan={3} className="border border-gray-900 p-0.5 bg-green-50/60">{t} (Rating)</th>)}
                    <th colSpan={2} className="border border-gray-900 p-0.5 bg-amber-50">YEARLY</th>
                  </tr>
                  <tr className="text-center font-semibold text-[10px]">
                    {TERM_KEYS.map((t) => (
                      <React.Fragment key={t}>
                        <th className="border border-gray-700 p-0.5 w-[22px]">1</th>
                        <th className="border border-gray-700 p-0.5 w-[22px]">2</th>
                        <th className="border border-gray-700 p-0.5 w-[26px] bg-blue-100/40">Mn</th>
                        <th className="border border-gray-700 p-0.5 w-[22px]">Rnk</th>
                      </React.Fragment>
                    ))}
                    <th className="border border-gray-700 p-0.5 bg-amber-100/40">Mn</th>
                    <th className="border border-gray-700 p-0.5">Rnk</th>
                    {[0, 1, 2].map((i) => (
                      <React.Fragment key={`ah${i}`}>
                        <th className="border border-gray-700 p-0.5 w-[18px]">1</th>
                        <th className="border border-gray-700 p-0.5 w-[18px]">2</th>
                        <th className="border border-gray-700 p-0.5 w-[22px] bg-purple-100/40">Mn</th>
                      </React.Fragment>
                    ))}
                    <th className="border border-gray-700 p-0.5 bg-amber-100/40">Mn</th>
                    <th className="border border-gray-700 p-0.5">Rnk</th>
                    {[0, 1, 2].map((i) => (
                      <React.Fragment key={`ph${i}`}>
                        <th className="border border-gray-700 p-0.5 w-[18px]">1</th>
                        <th className="border border-gray-700 p-0.5 w-[18px]">2</th>
                        <th className="border border-gray-700 p-0.5 w-[22px] bg-green-100/40">Mn</th>
                      </React.Fragment>
                    ))}
                    <th className="border border-gray-700 p-0.5 bg-amber-100/40">Mn</th>
                    <th className="border border-gray-700 p-0.5">Rnk</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: rowCount }).map((_, i) => {
                    const s = card.subjects[i];
                    const affTrait = AFFECTIVE_TRAITS[i];
                    const psyTrait = PSYCHOMOTOR_SKILLS[i];
                    const affR = aff[i + 1] || { terms: {}, yearly_mean: null };
                    const psyR = psy[i + 1] || { terms: {}, yearly_mean: null };
                    const affYr = affR.yearly_mean;
                    const psyYr = psyR.yearly_mean;
                    const affRnk = (affR as any).yearly_rank ?? null;
                    const psyRnk = (psyR as any).yearly_rank ?? null;
                    return (
                      <tr key={i} className="text-center">
                        <td className="border border-gray-700 p-0.5 text-left font-semibold whitespace-nowrap">{s?.subject_name ?? ''}</td>
                        {TERM_KEYS.map((t) => {
                          const ts = s?.terms[t];
                          return (
                            <React.Fragment key={t}>
                              <td className="border border-gray-300 p-0.5"><Num v={ts?.test1} /></td>
                              <td className="border border-gray-300 p-0.5"><Num v={ts?.test2} /></td>
                              <td className="border border-gray-300 p-0.5 bg-blue-50/30"><Num v={ts?.mean} bold /></td>
                              <td className="border border-gray-700 p-0.5">{ts?.rank ?? ''}</td>
                            </React.Fragment>
                          );
                        })}
                        <td className="border border-gray-300 p-0.5 bg-amber-50/30"><Num v={s?.yearly_mean} bold /></td>
                        <td className="border border-gray-700 p-0.5 font-bold">{s?.yearly_rank ?? ''}</td>

                        <td className="border border-gray-700 p-0.5 font-bold bg-purple-50/40">{affTrait ? i + 1 : ''}</td>
                        {TERM_KEYS.map((term, k) => {
                          const cell = affR.terms?.[term];
                          return (
                            <React.Fragment key={`ac${k}`}>
                              <td className="border border-gray-300 p-0.5">{affTrait ? (cell?.r1 ?? '') : ''}</td>
                              <td className="border border-gray-300 p-0.5">{affTrait ? (cell?.r2 ?? '') : ''}</td>
                              <td className="border border-gray-300 p-0.5 bg-purple-50/20 font-semibold">{affTrait ? (cell?.mean ?? '') : ''}</td>
                            </React.Fragment>
                          );
                        })}
                        <td className="border border-gray-300 p-0.5 bg-amber-50/30 font-bold">{affTrait ? (affYr ?? '') : ''}</td>
                        <td className="border border-gray-700 p-0.5">{affTrait ? (affRnk ?? '') : ''}</td>

                        <td className="border border-gray-700 p-0.5 font-bold bg-green-50/40">{psyTrait ? i + 1 : ''}</td>
                        {TERM_KEYS.map((term, k) => {
                          const cell = psyR.terms?.[term];
                          return (
                            <React.Fragment key={`pc${k}`}>
                              <td className="border border-gray-300 p-0.5">{psyTrait ? (cell?.r1 ?? '') : ''}</td>
                              <td className="border border-gray-300 p-0.5">{psyTrait ? (cell?.r2 ?? '') : ''}</td>
                              <td className="border border-gray-300 p-0.5 bg-green-50/20 font-semibold">{psyTrait ? (cell?.mean ?? '') : ''}</td>
                            </React.Fragment>
                          );
                        })}
                        <td className="border border-gray-300 p-0.5 bg-amber-50/30 font-bold">{psyTrait ? (psyYr ?? '') : ''}</td>
                        <td className="border border-gray-700 p-0.5">{psyTrait ? (psyRnk ?? '') : ''}</td>
                      </tr>
                    );
                  })}

                  <tr className="text-center font-bold bg-gray-100">
                    <td className="border border-gray-900 p-0.5 text-left">Comb. Scores</td>
                    {TERM_KEYS.map((t) => (
                      <React.Fragment key={t}>
                        <td className="border border-gray-300 p-0.5" />
                        <td className="border border-gray-300 p-0.5" />
                        <td className="border border-gray-700 p-0.5 bg-blue-100/40">{card.term_summaries[t]?.combined_score ?? ''}</td>
                        <td className="border border-gray-700 p-0.5" />
                      </React.Fragment>
                    ))}
                    <td className="border border-gray-700 p-0.5 bg-amber-100/40">{combYr ?? ''}</td>
                    <td className="border border-gray-700 p-0.5" />
                    <td colSpan={28} className="border border-gray-900 p-0.5 bg-gray-50/60" />
                  </tr>
                  <tr className="text-center font-bold bg-gray-100">
                    <td className="border border-gray-900 p-0.5 text-left">Percentages</td>
                    {TERM_KEYS.map((t) => (
                      <React.Fragment key={t}>
                        <td className="border border-gray-300 p-0.5" />
                        <td className="border border-gray-300 p-0.5" />
                        <td className="border border-gray-700 p-0.5 bg-blue-100/40">{card.term_summaries[t]?.percentage != null ? `${card.term_summaries[t]?.percentage}%` : ''}</td>
                        <td className="border border-gray-700 p-0.5" />
                      </React.Fragment>
                    ))}
                    <td className="border border-gray-700 p-0.5 bg-amber-100/40">{pctYr != null ? `${pctYr}%` : ''}</td>
                    <td className="border border-gray-700 p-0.5" />
                    <td colSpan={28} className="border border-gray-900 p-0.5 bg-gray-50/60" />
                  </tr>
                  <tr className="text-center font-bold bg-gray-200">
                    <td className="border border-gray-900 p-0.5 text-left">Position</td>
                    {TERM_KEYS.map((t) => {
                      const sm = card.term_summaries[t];
                      return (
                        <React.Fragment key={t}>
                          <td className="border border-gray-300 p-0.5" />
                          <td className="border border-gray-300 p-0.5" />
                          <td className="border border-gray-700 p-0.5 bg-blue-100/40">{sm?.position ? `${sm.position}${sm.class_size ? `/${sm.class_size}` : ''}` : ''}</td>
                          <td className="border border-gray-700 p-0.5" />
                        </React.Fragment>
                      );
                    })}
                    <td className="border border-gray-700 p-0.5 bg-amber-100/40">{posYr ? `${posYr}${posYrSize ? `/${posYrSize}` : ''}` : ''}</td>
                    <td className="border border-gray-700 p-0.5" />
                    <td colSpan={28} className="border border-gray-900 p-0.5 bg-gray-50/60" />
                  </tr>
                </tbody>
              </table>
            </div>

            {/* FOOTER */}
            <div className="border-t-2 border-gray-900 mt-2 pt-2 grid grid-cols-12 gap-x-4 text-[11px]">
              <div className="col-span-7">
                <div className="grid grid-cols-3 gap-x-4">
                  {TERM_KEYS.map((t) => {
                    const sm = card.term_summaries[t];
                    return (
                      <div key={t} className="space-y-0.5">
                        <div>On Time: <b>{sm?.on_time ?? 0}</b></div>
                        <div>Late: <b className="text-amber-600">{sm?.late ?? 0}</b></div>
                        <div>Absent: <b className="text-red-600">{sm?.absent ?? 0}</b></div>
                        <div className="pt-1 border-b border-dotted border-gray-500 h-4" />
                        <div className="text-[10px] text-gray-600">Teacher's Sign and Date</div>
                        <div>CONDUCT: <b>{sm?.conduct || '............'}</b></div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 pt-1 border-t border-gray-300">
                  <p className="italic font-semibold">Guidance and counseling/Continuous Assessment Comments</p>
                  {TERM_KEYS.map((t, i) => (
                    <div key={t} className="flex items-baseline gap-1">
                      <span className="whitespace-nowrap">Term {i + 1}:</span>
                      <span className="flex-1 border-b border-dotted border-gray-500 italic px-1">
                        {card.term_summaries[t]?.teacher_comment || ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="col-span-3 space-y-1 border-l border-gray-300 pl-3">
                <div className="border-b border-dotted border-gray-500 h-4" />
                <div className="text-[10px] text-gray-600">Principal's Signature and date</div>
                <div className="font-bold uppercase text-[10px] pt-1">Terms</div>
                <div className="text-[10px] space-y-0.5">
                  <div>Term 1 <span className="border-b border-dotted border-gray-500 inline-block w-16" /></div>
                  <div>Term 2 <span className="border-b border-dotted border-gray-500 inline-block w-16" /></div>
                  <div>Term 3 <span className="border-b border-dotted border-gray-500 inline-block w-16" /></div>
                </div>
                <div className="pt-1">
                  <span className="italic">Principal's End of Year Comments:</span>
                  <span className="border-b border-dotted border-gray-500 italic px-1">{card.meta?.principal_comment || ''}</span>
                </div>
                <div className="pt-1 font-bold uppercase text-[10px]">
                  Promoted to / to repeat:
                  {(() => {
                    const auto = card.yearly_summary?.promotion_recommendation;
                    const outcome = card.yearly_summary?.outcome;
                    const text = card.meta?.promotion_status || auto || '............';
                    const cls = outcome === 'fail' ? 'text-red-600'
                      : outcome === 'promoted_effort' ? 'text-amber-600'
                      : outcome === 'promoted' ? 'text-green-700' : '';
                    return <span className={`font-extrabold normal-case ml-1 ${cls}`}>{text}</span>;
                  })()}
                </div>
                {card.yearly_summary?.percentage != null && (
                  <div className="text-[9px] text-gray-500 normal-case">
                    Yearly: {card.yearly_summary.percentage}% · Position {card.yearly_summary.position}/{card.yearly_summary.class_size}
                  </div>
                )}
              </div>

              <div className="col-span-2 space-y-1 border-l border-gray-300 pl-3">
                <div className="border-b border-dotted border-gray-500 h-4" />
                <div className="text-[10px] text-gray-600">Parent's Signature and date</div>
                <div className="font-bold uppercase text-[10px] pt-1">Terms</div>
                <div className="text-[10px] space-y-0.5">
                  <div>Term 1 <span className="border-b border-dotted border-gray-500 inline-block w-12" /></div>
                  <div>Term 2 <span className="border-b border-dotted border-gray-500 inline-block w-12" /></div>
                </div>
              </div>
            </div>

            <p className="text-[9px] italic text-gray-400 mt-1">*See key at the back.</p>
          </div>
        );
      })()}
    </>
  );
};

export default BookletContent;
