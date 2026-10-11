/**
 * TermResultSheet — the single-term result sheet (Term 1 / Term 2): one fixed
 * A4 portrait page with the school letterhead, the student's photo, a document
 * reference, the subjects table, performance and attendance summaries, the
 * teacher's and principal's remarks with signatures, the grading key, the
 * official stamp and a verification QR. The full folded booklet is used for
 * Term 3.
 *
 * Mirrors the server renderer (backend renderTermResultSheetHtml) using the
 * same stylesheet (lib/termSheetLayout.ts), so the preview, the browser print
 * and the downloaded PDF match. Rendered as a `.term-sheet` node so the
 * ReportCardsPage capture/print flow can find it.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { ReportCard, SLTerm, getGradingMethod, SL_GRADING_METHOD_DEFAULT } from '@services/reportCardService';
import { TERM_SHEET_CSS, termSheetRowSizing, termSheetRef, TERM_NAME, fitTermSheet } from '@lib/termSheetLayout';

function ordinal(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return '—';
  const num = Number(n), v = num % 100, u = num % 10;
  const suf = v >= 11 && v <= 13 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th';
  return `${num}${suf}`;
}

type GradeBand = { letter?: string; remark: string; min: number; max: number; isFail: boolean };

interface Props {
  card: ReportCard;
  term: SLTerm;
  school: any;
  schoolName: string;
  schoolAddress: string;
  schoolLogo?: string;
  shortName: string;
  showStudentPhoto?: boolean;
  showWatermark?: boolean;
  stampUrl?: string;
  signatureUrl?: string;
}

export const TermResultSheet: React.FC<Props> = ({
  card, term, school, schoolName, schoolAddress, schoolLogo, shortName,
  showStudentPhoto = true, showWatermark = true, stampUrl, signatureUrl,
}) => {
  // The school's own grading scale (falls back to the standard one).
  const [gm, setGm] = useState<GradeBand[]>(SL_GRADING_METHOD_DEFAULT);
  useEffect(() => { getGradingMethod().then((g) => { if (g?.length) setGm(g as GradeBand[]); }).catch(() => {}); }, []);

  const s: any = card.student || {};
  const sm: any = (card.term_summaries as any)?.[term] || {};

  const [qr, setQr] = useState('');
  useEffect(() => {
    const url = card.verify_url || '';
    if (!url) return;
    const full = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    QRCode.toDataURL(full, { width: 240, margin: 0, color: { dark: '#0f2a5c', light: '#ffffff' } })
      .then(setQr).catch(() => {});
  }, [card.verify_url]);

  const gradeFor = (mean: number | null | undefined) => {
    if (mean == null) return { grade: '—', remark: '', fail: false };
    const idx = gm.findIndex((x) => mean >= x.min && mean <= x.max);
    const i = idx >= 0 ? idx : gm.length - 1;
    const g = gm[i];
    return { grade: g.letter || String.fromCharCode(65 + Math.min(i, 5)), remark: g.remark, fail: g.isFail || mean < 50 };
  };

  const subjects: any[] = card.subjects || [];
  const { rowH, rowFs, remarkH } = termSheetRowSizing(subjects.length);

  // Fit the sheet to one A4 page after layout (long names, many subjects).
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rowh', rowH);
    el.style.setProperty('--rowfs', rowFs);
    el.style.setProperty('--rmkh', remarkH);
    fitTermSheet(el);
  }, [rowH, rowFs, remarkH, subjects.length, card.meta?.principal_comment, sm.teacher_comment, gm]);

  const docRef = termSheetRef(shortName, card.academic_year, term, s.admission_no || '');
  const issued = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const termName = TERM_NAME[term] || term;
  const gender = s.gender ? String(s.gender).charAt(0).toUpperCase() + String(s.gender).slice(1).toLowerCase() : '—';
  const classSize = sm.class_size ?? s.number_in_form ?? null;
  const pctFail = sm.percentage != null && Number(sm.percentage) < 50;
  const contact = [school?.phone, school?.email, school?.website].filter(Boolean).join('  ·  ');

  return (
    <>
      <style>{TERM_SHEET_CSS}</style>
      <div ref={ref} className="term-sheet trs mx-auto shadow-lg print:shadow-none">
        <div className="topbar"><i /></div>
        {showWatermark && (
          <div className="wm" aria-hidden="true">{schoolLogo ? <img src={schoolLogo} alt="" /> : <span>{shortName}</span>}</div>
        )}
        <div className="c">
          <header className="head">
            <div>{schoolLogo ? <img className="logo" src={schoolLogo} alt={`${schoolName} logo`} /> : <div className="logo-fb">{shortName}</div>}</div>
            <div className="ht">
              <h1>{schoolName}</h1>
              {schoolAddress && <div className="sub">{schoolAddress}</div>}
              {contact && <div className="sub">{contact}</div>}
              {school?.motto && <div className="motto">“{school.motto}”</div>}
            </div>
            <div>
              {showStudentPhoto && (
                <div className="photo">
                  {s.photo_url && String(s.photo_url).length > 10
                    ? <img src={s.photo_url} alt={`Photo of ${s.name}`} />
                    : <div className="ph">Student<br />photo</div>}
                </div>
              )}
            </div>
          </header>
          <div className="rule" />

          <div className="titlebar">
            <div>
              <div className="doc">Terminal Report</div>
              <div className="term">{termName} &nbsp;·&nbsp; {card.academic_year} Academic Year</div>
            </div>
            <div className="ref">Ref: <b>{docRef}</b><br />Issued: {issued}</div>
          </div>

          <section className="info" aria-label="Student details">
            <div><span className="lab">Student name</span><span className="val">{s.name || '—'}</span></div>
            <div><span className="lab">Admission no.</span><span className="val">{s.admission_no || '—'}</span></div>
            <div><span className="lab">Class</span><span className="val">{s.class_name || '—'}</span></div>
            <div><span className="lab">No. in class</span><span className="val">{classSize ?? '—'}</span></div>
            <div><span className="lab">Class teacher</span><span className="val">{s.form_teacher_name || '—'}</span></div>
            <div><span className="lab">Gender</span><span className="val">{gender}</span></div>
            <div><span className="lab">Age</span><span className="val">{s.pupil_age != null ? `${s.pupil_age} yrs` : '—'}</span></div>
            <div><span className="lab">Conduct</span><span className="val">{sm.conduct || '—'}</span></div>
          </section>

          <div className="sec">Academic performance</div>
          <table className="res">
            <thead>
              <tr>
                <th scope="col">S/N</th><th scope="col" className="l">Subject</th><th scope="col">1st Test</th><th scope="col">2nd Test</th>
                <th scope="col">Average</th><th scope="col">Grade</th><th scope="col" className="l">Remark</th><th scope="col">Position</th>
              </tr>
            </thead>
            <tbody>
              {subjects.length === 0 ? (
                <tr><td colSpan={8} className="empty">No subject scores recorded for this term.</td></tr>
              ) : subjects.map((subj, i) => {
                const t = subj.terms?.[term] || {};
                const mean = t.mean ?? null;
                const g = gradeFor(mean);
                return (
                  <tr key={subj.subject_id ?? i}>
                    <td className="n">{i + 1}</td>
                    <td className="l s">{subj.subject_name}</td>
                    <td>{t.test1 ?? '—'}</td>
                    <td>{t.test2 ?? '—'}</td>
                    <td className={`m ${g.fail ? 'fail' : ''}`}>{mean ?? '—'}</td>
                    <td><span className={`gb ${g.fail ? 'fail' : ''}`}>{g.grade}</span></td>
                    <td className="l rm">{g.remark}</td>
                    <td>{t.rank ? ordinal(t.rank) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="panels">
            <div className="panel">
              <div className="ptitle">Performance summary</div>
              <div className="stats">
                <div className="stat"><div className="v">{sm.combined_score ?? '—'}</div><div className="k">Total score</div></div>
                <div className="stat"><div className={`v ${pctFail ? 'red' : ''}`}>{sm.percentage != null ? `${sm.percentage}%` : '—'}</div><div className="k">Average</div></div>
                <div className="stat">
                  <div className="v">{sm.position ? ordinal(sm.position) : '—'}{sm.position && classSize ? <> <small>of {classSize}</small></> : null}</div>
                  <div className="k">Class position</div>
                </div>
              </div>
            </div>
            <div className="panel">
              <div className="ptitle">Attendance</div>
              <div className="stats">
                <div className="stat"><div className="v">{sm.on_time ?? 0}</div><div className="k">On time</div></div>
                <div className="stat"><div className="v">{sm.late ?? 0}</div><div className="k">Late</div></div>
                <div className="stat"><div className={`v ${Number(sm.absent) > 0 ? 'red' : ''}`}>{sm.absent ?? 0}</div><div className="k">Absent</div></div>
              </div>
            </div>
          </div>

          <div className="remarks">
            <div className="rmk">
              <div className="ptitle">Class teacher's remark</div>
              <p>{sm.teacher_comment || ''}</p>
              <div className="by">
                <span>{s.form_teacher_name ? <><b>{s.form_teacher_name}</b> · </> : null}Class Teacher</span>
                <span className="sg"><span className="sign" /><span className="cap">Signature &amp; date</span></span>
              </div>
            </div>
            <div className="rmk">
              <div className="ptitle">Principal's remark</div>
              <p>{card.meta?.principal_comment || ''}</p>
              <div className="by">
                <span>{school?.principal_name ? <><b>{school.principal_name}</b> · </> : null}Principal</span>
                <span className="sg"><span className="sign">{signatureUrl ? <img src={signatureUrl} alt="Principal's signature" /> : null}</span><span className="cap">Signature &amp; date</span></span>
              </div>
            </div>
          </div>

          <div className="key">
            <span className="kt">Grading key</span>
            {gm.map((g, i) => (
              <span key={`${g.remark}${i}`} className={`g ${g.isFail ? 'fail' : ''}`}>
                <b>{g.letter || String.fromCharCode(65 + Math.min(i, 5))}</b> {g.min}–{g.max} {g.remark}
              </span>
            ))}
          </div>

          <div className="spacer" />

          <footer className="foot">
            <div className="verify">
              {qr && <img src={qr} alt="Verification QR code" />}
              <div className="t"><b>Verify this result</b>Scan the code with a phone camera to confirm this result is genuine.<br />Reference {docRef}</div>
            </div>
            <div className="stampbox">
              <div className={`stamp ${stampUrl ? 'has' : ''}`}>{stampUrl ? <img src={stampUrl} alt="Official school stamp" /> : 'Official stamp'}</div>
            </div>
          </footer>
          <div className="fine">
            Official result of {schoolName} for the {termName.toLowerCase()}. Not valid without the school stamp and the principal's signature. The full report booklet is issued at the end of the academic year.
          </div>
        </div>
      </div>
    </>
  );
};

export default TermResultSheet;
