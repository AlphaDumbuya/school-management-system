/**
 * Sierra Leone Report Card — server-side HTML renderer for PDF export.
 *
 * Produces a self-contained HTML document (inline CSS, no Tailwind) that
 * Puppeteer converts to a clean 8-page A4-landscape PDF with NO browser
 * header/footer.
 *
 * The 6 logical pages are in reading order:
 *   Page 1: Front cover (school branding + student details)
 *   Page 2: Complete Grading System / Assessment Key
 *   Page 3: Results sheet — left half (subject + cognitive)
 *   Page 4: Results sheet — right half (affective + psychomotor + footer)
 *   Page 5: BLANK (inside back cover)
 *   Page 6: Back cover (legends + note to parents)
 *
 * Pages 3 and 4 are facing pages of the same results spread: when the
 * booklet is open, page 3 is on the left and page 4 is on the right.
 *
 * After Puppeteer generates the 6-page A4-landscape PDF, the PDF route applies
 * booklet imposition via pdf-lib to arrange the pages on A3 landscape sheets:
 *   Sheet 1 outside: [6 | 1]   Sheet 1 inside: [2 | 5]
 *   Sheet 2 outside: [4 | 3]
 */

import QRCode from 'qrcode';
import {
  AFFECTIVE_TRAITS, PSYCHOMOTOR_SKILLS, SL_TERMS,
} from './slReportCardService.js';

const TERM_SHORT: Record<string, string> = {
  first_term: 'TERM 1', second_term: 'TERM 2', third_term: 'TERM 3',
};

const RATING_LEGEND = [
  { value: 5, label: 'Great / Exceptional / Always' },
  { value: 4, label: 'Good / Often' },
  { value: 3, label: 'Fair / Reasonable' },
  { value: 2, label: 'Some / Sometimes / Little / Rarely' },
  { value: 1, label: 'Negligible / Never / Very Poor' },
];

const GRADING_METHOD = [
  { remark: 'Excellent', min: 85, max: 100, isFail: false },
  { remark: 'Very Good', min: 75, max: 84, isFail: false },
  { remark: 'Good', min: 60, max: 74, isFail: false },
  { remark: 'Satisfactory', min: 50, max: 59, isFail: false },
  { remark: 'Unsatisfactory', min: 0, max: 49, isFail: true },
];

function esc(s: any): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function num(v: number | null | undefined, bold = false): string {
  if (v == null) return '<span style="color:#9ca3af">–</span>';
  const fail = v < 50;
  const style = `${fail ? 'color:#dc2626;font-weight:700;' : ''}${bold ? 'font-weight:700;' : ''}`;
  return `<span style="${style}">${v}</span>`;
}

function ordinal(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return '';
  const num = Number(n);
  const mod100 = num % 100;
  const mod10 = num % 10;
  const suffix =
    mod100 >= 11 && mod100 <= 13 ? 'th'
    : mod10 === 1 ? 'st'
    : mod10 === 2 ? 'nd'
    : mod10 === 3 ? 'rd'
    : 'th';
  return `${num}${suffix}`;
}

interface ReportCardData {
  student: any;
  academic_year: string;
  subjects: any[];
  term_summaries: Record<string, any>;
  yearly_summary: any;
  domain_ratings: { affective: Record<number, any>; psychomotor: Record<number, any> };
  meta: any;
}

interface SchoolInfo {
  name?: string;
  short_name?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  logo_url?: string;
  principal_name?: string;
  motto?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export interface GradingMethodEntry {
  remark: string;
  min: number;
  max: number;
  isFail: boolean;
}

export async function renderReportCardHtml(
  card: ReportCardData,
  school: SchoolInfo,
  gradingMethod?: GradingMethodEntry[],
): Promise<string> {
  const schoolName = school?.name || 'SCHOOL NAME';
  const schoolAddress = [school?.address, school?.city, school?.state, school?.country].filter(Boolean).join(', ');
  const shortName = school?.short_name || schoolName.split(' ').map((w) => w[0]).join('').slice(0, 4).toUpperCase();
  const logo = school?.logo_url;
  const schoolPhone = school?.phone;
  const schoolEmail = school?.email;
  const schoolWebsite = school?.website;
  const gm = gradingMethod?.length ? gradingMethod : GRADING_METHOD;

  // Digital verification QR code for the grading page
  const verificationBaseUrl = process.env.REPORT_CARD_VERIFY_URL || process.env.FRONTEND_URL || 'https://example.com/verify';
  const verifyUrl = `${verificationBaseUrl.replace(/\/$/, '')}/verify-report-card/${card.id || card.student?.admission_no || ''}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 200, margin: 1, color: { dark: '#111827', light: '#ffffff' } }).catch(() => '');
  const ys = card.yearly_summary || {};

  // ── PAGE 1: FRONT COVER ──────────────────────────────────────────────────────
  const page1 = `
  <section class="page cover-front">
    <div class="brand">
      ${logo ? `<img class="logo" src="${esc(logo)}" alt="logo" />` : `<div class="logo-fallback">${esc(shortName)}</div>`}
      <h1>${esc(schoolName)}</h1>
      ${schoolAddress ? `<div class="addr">${esc(schoolAddress)}</div>` : ''}
      ${school?.motto ? `<div class="motto">Motto: ${esc(school.motto)}</div>` : ''}
      ${(schoolPhone || schoolEmail || schoolWebsite) ? `<div class="contact">${[schoolPhone, schoolEmail, schoolWebsite].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ')}</div>` : ''}
    </div>
    <div class="rc-badge">Report Card</div>
    ${card.student.class_level ? `<div class="lvl">${esc(card.student.class_level)}</div>` : ''}
    <div class="pupil">
      <div class="prow"><span>Name of pupil:</span><b>${esc(card.student.name)}</b></div>
      <div class="prow"><span>Admission No:</span><b>${esc(card.student.admission_no)}</b></div>
      <div class="prow"><span>Class / Form:</span><b>${esc(card.student.class_name || '—')}</b></div>
      <div class="prow last"><span>Academic Year:</span><b>${esc(card.academic_year)}</b></div>
    </div>
    <div class="sigrow">
      <div class="sigbox"><span>Official Stamp</span><div class="seal">${esc(shortName)} Seal</div></div>
      <div class="sigbox"><span>Principal's Signature</span><div class="sig">${esc(school?.principal_name || 'Principal')}</div></div>
    </div>
  </section>`;

  // ── PAGE 2: GRADING SYSTEM ────────────────────────────────────────────────────
  const affectiveLegend = AFFECTIVE_TRAITS.map((t, i) => `<div><b>${i + 1}</b> - ${esc(t)}</div>`).join('');
  const psychoLegend = PSYCHOMOTOR_SKILLS.map((t, i) => `<div><b>${i + 1}</b> - ${esc(t)}</div>`).join('');
  const gradeLegend = gm.map((g) =>
    `<div style="${g.isFail ? 'color:#b91c1c;font-weight:700;' : ''}">${g.remark}: ${g.min}–${g.max}</div>`).join('');
  const ratingLegend = RATING_LEGEND.map((r) => `<div><b>${r.value}</b> - ${esc(r.label)}</div>`).join('');

  const gradingRows = gm.map((g) => {
    const range = g.isFail ? `Below ${g.max}` : `${g.min} to ${g.max}`;
    return `<div class="grading-row ${g.isFail ? 'fail' : ''}"><span>${esc(g.remark)}</span><span class="leader"></span><span>${range}</span></div>`;
  }).join('');

  const conductRows = [
    { code: 'V.G', meaning: 'Very Good' },
    { code: 'G', meaning: 'Good' },
    { code: 'S', meaning: 'Satisfactory' },
    { code: 'PT', meaning: 'Play truant must see principal' },
    { code: 'N', meaning: 'Neglected Work' },
    { code: 'Abs', meaning: 'Absent' },
  ].map((c) => `<div class="conduct-row"><span class="code">${esc(c.code)}</span><span class="leader"></span><span>${esc(c.meaning)}</span></div>`).join('');

  const attendanceRows = [
    { code: 'On Time', meaning: 'Punctual to all sessions' },
    { code: 'Late', meaning: 'Arrived after registration' },
    { code: 'Absent', meaning: 'Not present for the session' },
  ].map((a) => `<div class="att-card"><p class="att-code">${esc(a.code)}</p><p class="att-meaning">${esc(a.meaning)}</p></div>`).join('');

  const qrBlock = qrDataUrl
    ? `<div class="verify-box"><img src="${qrDataUrl}" alt="Verification QR" class="verify-qr" /><div class="verify-text"><p class="verify-title">Digital Verification System</p><p>Scan with a smartphone to verify this report card online and view the digital copy.</p><div class="verify-meta-row"><span>Year: <b>${esc(card.academic_year)}</b></span><span>Status: <span class="active">Active</span></span></div></div></div>`
    : '';

  const page3 = `
  <section class="page grading">
    <div class="grading-section">
      <h3 class="gtitle-main">Method of Grading</h3>
      <div class="grading-list">${gradingRows}</div>
    </div>
    <div class="grading-section">
      <h3 class="gtitle-sub">Conduct</h3>
      <div class="conduct-grid">${conductRows}</div>
    </div>
    <div class="grading-section">
      <h3 class="gtitle-sub">Attendance</h3>
      <div class="att-grid">${attendanceRows}</div>
    </div>
    <div class="grading-bottom">
      ${qrBlock}
      <p class="validity">This progress report is not valid unless it is signed by Principal and carries the official school stamp.</p>
    </div>
  </section>`;

  // ── PAGE 4: RESULTS SHEET — LEFT HALF (subject + cognitive) ────────────────────
  const cognitiveRows = card.subjects.map((s) => {
    const cog = SL_TERMS.map((t) => {
      const ts = s.terms?.[t];
      return `<td>${num(ts?.test1)}</td><td>${num(ts?.test2)}</td><td class="mn">${num(ts?.mean, true)}</td><td>${ordinal(ts?.rank)}</td>`;
    }).join('');
    return `<tr><td class="subj">${esc(s.subject_name)}</td>${cog}<td class="mn-y">${num(s.yearly_mean, true)}</td><td class="b">${ordinal(s.yearly_rank)}</td></tr>`;
  }).join('');

  const combRow = (label: string, valueFor: (t: string) => string, yearly: string, cls: string) => `
    <tr class="${cls}"><td class="subj">${label}</td>
      ${SL_TERMS.map((t) => `<td></td><td></td><td class="mn">${valueFor(t)}</td><td></td>`).join('')}
      <td class="mn-y">${yearly}</td><td></td></tr>`;

  const combRowL = combRow('Comb. Scores', (t) => esc(card.term_summaries[t]?.combined_score ?? ''), esc(ys.combined_score ?? ''), 'sum');
  const pctRowL = combRow('Percentages', (t) => card.term_summaries[t]?.percentage != null ? `${card.term_summaries[t].percentage}%` : '', ys.percentage != null ? `${ys.percentage}%` : '', 'sum');
  const posRowL = combRow('Position', (t) => { const sm = card.term_summaries[t]; return sm?.position ? `${ordinal(sm.position)}${sm.class_size ? `/${sm.class_size}` : ''}` : ''; }, ys.position ? `${ordinal(ys.position)}${ys.class_size ? `/${ys.class_size}` : ''}` : '', 'sum2');

  const page4 = `
  <section class="page results results-left">
    <div class="hdr">
      <div><div><b>Name:</b> ${esc(card.student.name)}</div><div><b>No. in Form:</b> ${esc(card.student.admission_no)}</div></div>
      <div class="c"><div><b>Average Age:</b> ${esc(card.student.class_average_age ?? '—')}</div><div><b>Pupil's Age:</b> ${esc(card.student.pupil_age ?? '—')}</div></div>
      <div class="r"><div><b>Teacher in charge of class:</b> ${esc(card.student.form_teacher_name || '—')}</div><div><b>Form:</b> ${esc(card.student.class_name || '—')} &nbsp; <b>Year:</b> ${esc(card.academic_year)}</div></div>
    </div>
    <table class="grid">
      <thead>
        <tr class="banner"><th rowspan="3" class="subj-h">Subject</th><th colspan="14" class="bg-c">* Cognitive</th></tr>
        <tr class="grp">${SL_TERMS.map((t) => `<th colspan="4" class="bg-c2">${TERM_SHORT[t]}</th>`).join('')}<th colspan="2" class="bg-y">YEARLY</th></tr>
        <tr class="sub">${SL_TERMS.map(() => `<th>1</th><th>2</th><th class="mn">Mn</th><th>Rnk</th>`).join('')}<th class="mn-y">Mn</th><th>Rnk</th></tr>
      </thead>
      <tbody>${cognitiveRows}${combRowL}${pctRowL}${posRowL}</tbody>
    </table>
  </section>`;

  // ── PAGE 5: RESULTS SHEET — RIGHT HALF (affective + psychomotor + footer) ──────
  const rowCount = Math.max(card.subjects.length, AFFECTIVE_TRAITS.length, PSYCHOMOTOR_SKILLS.length);
  const aff = card.domain_ratings.affective || {};
  const psy = card.domain_ratings.psychomotor || {};

  const apRows = Array.from({ length: rowCount }).map((_, i) => {
    const affTrait = AFFECTIVE_TRAITS[i];
    const psyTrait = PSYCHOMOTOR_SKILLS[i];
    const affR = aff[i + 1] || { terms: {}, yearly_mean: null };
    const psyR = psy[i + 1] || { terms: {}, yearly_mean: null };

    const affCells = SL_TERMS.map((t) => {
      const c = affR.terms?.[t];
      return `<td>${affTrait ? (c?.r1 ?? '') : ''}</td><td>${affTrait ? (c?.r2 ?? '') : ''}</td><td class="mn-p">${affTrait ? (c?.mean ?? '') : ''}</td>`;
    }).join('');

    const psyCells = SL_TERMS.map((t) => {
      const c = psyR.terms?.[t];
      return `<td>${psyTrait ? (c?.r1 ?? '') : ''}</td><td>${psyTrait ? (c?.r2 ?? '') : ''}</td><td class="mn-g">${psyTrait ? (c?.mean ?? '') : ''}</td>`;
    }).join('');

    return `<tr>
      <td class="hash-a">${affTrait ? i + 1 : ''}</td>${affCells}<td class="mn-y">${affTrait ? (affR.yearly_mean ?? '') : ''}</td><td>${affTrait ? ordinal((affR as any).yearly_rank as any) : ''}</td>
      <td class="hash-p">${psyTrait ? i + 1 : ''}</td>${psyCells}<td class="mn-y">${psyTrait ? (psyR.yearly_mean ?? '') : ''}</td><td>${psyTrait ? ordinal((psyR as any).yearly_rank as any) : ''}</td>
    </tr>`;
  }).join('');

  const attBlocks = SL_TERMS.map((t) => {
    const sm = card.term_summaries[t] || {};
    return `<div class="att"><div>On Time: <b>${sm.on_time ?? 0}</b></div><div>Late: <b class="amber">${sm.late ?? 0}</b></div><div>Absent: <b class="red">${sm.absent ?? 0}</b></div><div class="dot"></div><div class="mini">Teacher's Sign and Date</div><div>CONDUCT: <b>${esc(sm.conduct || '............')}</b></div></div>`;
  }).join('');

  const guidance = SL_TERMS.map((t, i) =>
    `<div class="gline"><span>Term ${i + 1}:</span><span class="gval">${esc(card.term_summaries[t]?.teacher_comment || '')}</span></div>`).join('');

  const promoText = card.meta?.promotion_status || ys.promotion_recommendation || '............';
  const promoColor = ys.outcome === 'fail' ? 'color:#dc2626'
    : ys.outcome === 'promoted_effort' ? 'color:#d97706'
    : ys.outcome === 'promoted' ? 'color:#15803d' : '';

  const page5 = `
  <section class="page results results-right">
    <table class="grid">
      <thead>
        <tr class="banner">
          <th rowspan="3" class="hh">#</th>
          <th colspan="11" class="bg-a">* Affective</th>
          <th rowspan="3" class="hh">#</th>
          <th colspan="11" class="bg-p">* Psychomotor</th>
        </tr>
        <tr class="grp">
          ${['T1', 'T2', 'T3'].map((t) => `<th colspan="3" class="bg-a2">${t}</th>`).join('')}
          <th colspan="2" class="bg-y">YEARLY</th>
          ${['T1', 'T2', 'T3'].map((t) => `<th colspan="3" class="bg-p2">${t}</th>`).join('')}
          <th colspan="2" class="bg-y">YEARLY</th>
        </tr>
        <tr class="sub">
          ${[0, 1, 2].map(() => `<th>1</th><th>2</th><th class="mn-p">Mn</th>`).join('')}
          <th class="mn-y">Mn</th><th>Rnk</th>
          ${[0, 1, 2].map(() => `<th>1</th><th>2</th><th class="mn-g">Mn</th>`).join('')}
          <th class="mn-y">Mn</th><th>Rnk</th>
        </tr>
      </thead>
      <tbody>
        ${apRows}
        <tr class="sum"><td colspan="13" class="fill"></td></tr>
        <tr class="sum"><td colspan="13" class="fill"></td></tr>
        <tr class="sum2"><td colspan="13" class="fill"></td></tr>
      </tbody>
    </table>
    <div class="footer">
      <div class="fl">
        <div class="att-row">${attBlocks}</div>
        <div class="guid">
          <div class="gtitle">Guidance and counseling/Continuous Assessment Comments</div>
          ${guidance}
        </div>
      </div>
      <div class="fm">
        <div class="dot"></div><div class="mini">Principal's Signature and date</div>
        <div class="terms-t">Terms</div>
        <div class="mini">Term 1 <span class="uline"></span></div>
        <div class="mini">Term 2 <span class="uline"></span></div>
        <div class="mini">Term 3 <span class="uline"></span></div>
        <div class="pcom"><i>Principal's End of Year Comments:</i> <span class="gval">${esc(card.meta?.principal_comment || '')}</span></div>
        <div class="promo">Promoted to / to repeat: <b style="${promoColor}">${esc(promoText)}</b></div>
        ${ys.percentage != null ? `<div class="ysum">Yearly: ${ys.percentage}% · Position ${ordinal(ys.position)}/${ys.class_size}</div>` : ''}
      </div>
      <div class="fr">
        <div class="dot"></div><div class="mini">Parent's Signature and date</div>
        <div class="terms-t">Terms</div>
        <div class="mini">Term 1 <span class="uline sm"></span></div>
        <div class="mini">Term 2 <span class="uline sm"></span></div>
      </div>
    </div>
    <div class="seekey">*See key at the back.</div>
  </section>`;

  // ── BLANK (inside back cover) ───────────────────────────────────────────────
  const pageBlank = `<section class="page blank"></section>`;

  // ── PAGE 8: BACK COVER (with logo watermark) ────────────────────────────────
  const watermarkHtml = logo
    ? `<div class="watermark"><img src="${esc(logo)}" alt="" /></div>`
    : `<div class="watermark"><div class="wm-fallback">${esc(shortName)}</div></div>`;
  const page8 = `
  <section class="page cover-back">
    ${watermarkHtml}
    <div class="cover-content">
    <div class="ckey">Key: Mn = Average &nbsp;·&nbsp; Rnk = Position</div>
    <div class="cblock"><div class="ctitle affective">Affective</div><div class="grid2">${affectiveLegend}</div></div>
    <div class="cblock"><div class="ctitle psycho">Psychomotor</div><div class="grid2">${psychoLegend}</div></div>
    <div class="cblock"><div class="ctitle">Cognitive — Mark / Scores</div><div class="grid2">${gradeLegend}</div>
      <div class="note">Above 50% — reasonable but must maintain effort. Below 50% — improvement needed; discuss with the teacher.</div></div>
    <div class="cblock"><div class="ctitle">Affective &amp; Psychomotor Rating</div><div class="grid1">${ratingLegend}</div></div>
    <div class="cover-bottom">
      <div class="parents"><div class="ctitle">Note to Parents / Guardian</div>
        <div class="note">This card reports on the whole pupil, not just the academic or the cognitive. Look at it carefully and discuss what you do not understand with the teacher. Keep in constant touch with the school. Encourage your child to be honest, truthful, hardworking, tidy, considerate of others and disciplined.</div></div>
    </div>
    </div>
  </section>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  @page { size: 297mm 210mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; }
  .page { width: 297mm; height: 210mm; padding: 8mm; page-break-after: always; overflow: hidden; position: relative; display: flex; flex-direction: column; }
  .page:last-child { page-break-after: auto; }
  .blank { background: #fff; }

  /* ── Front cover (sheet 1 — has border) ── */
  .cover-front { text-align: center; justify-content: space-between; border: 2px solid #111827; padding: 10mm; }
  .cover-front .brand { padding: 5mm 0; }
  .cover-front .logo { width: 40mm; height: 40mm; object-fit: contain; margin: 0 auto; display: block; }
  .cover-front .logo-fallback { width: 40mm; height: 40mm; border-radius: 50%; background: #111827; color: #fff; font-size: 28px; font-weight: 800; display: flex; align-items: center; justify-content: center; margin: 0 auto; }
  .cover-front h1 { font-size: 22px; font-weight: 800; text-transform: uppercase; margin: 5px 0 4px; line-height: 1.15; }
  .cover-front .addr { font-size: 13px; font-weight: 600; color: #4b5563; }
  .cover-front .motto { font-size: 13px; font-style: italic; color: #4b5563; }
  .cover-front .contact { font-size: 12px; color: #6b7280; margin-top: 2px; }
  .cover-front .rc-badge { display: inline-block; background: #111827; color: #fff; font-weight: 700; padding: 6px 16px; font-size: 16px; text-transform: uppercase; margin: 5px 0; }
  .cover-front .lvl { font-size: 15px; font-weight: 700; color: #374151; text-transform: uppercase; }
  .cover-front .pupil { border-top: 2px solid #111827; border-bottom: 2px solid #111827; padding: 10px 0; margin: 5px 0; font-size: 15px; }
  .cover-front .prow { display: flex; justify-content: space-between; border-bottom: 1px solid #d1d5db; padding-bottom: 6px; margin-bottom: 6px; }
  .cover-front .prow.last { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
  .cover-front .prow span { font-weight: 700; color: #4b5563; }
  .cover-front .sigrow { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; }
  .cover-front .sigbox { border: 1px dashed #9ca3af; height: 28mm; display: flex; flex-direction: column; justify-content: space-between; padding: 6px; }
  .cover-front .sigbox span { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; }
  .cover-front .seal { width: 18mm; height: 18mm; border: 2px solid #1e40af; border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; transform: rotate(-12deg); opacity: .7; }
  .cover-front .sig { font-style: italic; font-family: Georgia, serif; font-weight: 700; color: #1e40af; font-size: 17px; }

  /* ── Grading system ── */
  .grading { font-size: 15px; line-height: 1.5; display: flex; flex-direction: column; justify-content: space-between; padding: 8mm; }
  .grading-section { margin-bottom: 0; }
  .gtitle-main { text-align: center; font-size: 18px; font-weight: 800; text-transform: uppercase; text-decoration: underline; text-underline-offset: 4px; margin-bottom: 4mm; }
  .gtitle-sub { text-align: center; font-size: 16px; font-weight: 800; text-transform: uppercase; text-decoration: underline; text-underline-offset: 4px; margin-bottom: 3mm; }
  .grading-list { display: flex; flex-direction: column; gap: 2.5mm; }
  .grading-row { display: flex; align-items: baseline; font-size: 16px; }
  .grading-row.fail { color: #b91c1c; font-weight: 700; }
  .grading-row span:first-child { white-space: nowrap; font-weight: 500; }
  .grading-row span:last-child { white-space: nowrap; font-weight: 700; }
  .conduct-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 10mm; }
  .conduct-row { display: flex; align-items: baseline; font-size: 15px; }
  .conduct-row .code { white-space: nowrap; font-weight: 700; min-width: 36px; text-align: center; background: #f3f4f6; border-radius: 3px; padding: 2px 6px; }
  .conduct-row .leader { flex: 1; border-bottom: 1px dotted #9ca3af; margin: 0 6px 3px; min-width: 10px; }
  .conduct-row span:last-child { white-space: nowrap; font-size: 14px; }
  .att-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3mm; }
  .att-card { border: 1px solid #d1d5db; border-radius: 4px; padding: 3mm; text-align: center; }
  .att-code { font-weight: 700; font-size: 15px; }
  .att-meaning { font-size: 13px; color: #4b5563; line-height: 1.3; margin-top: 1mm; }
  .grading-bottom { }
  .verify-box { display: flex; align-items: center; gap: 5mm; border: 2px solid #111827; border-radius: 6px; padding: 4mm; }
  .verify-qr { width: 25mm; height: 25mm; object-fit: contain; flex-shrink: 0; }
  .verify-text { font-size: 14px; text-align: left; flex: 1; }
  .verify-title { font-weight: 800; text-transform: uppercase; font-size: 16px; margin-bottom: 1.5mm; }
  .verify-meta-row { display: flex; gap: 8mm; margin-top: 1.5mm; color: #6b7280; }
  .verify-meta-row .active { color: #15803d; font-weight: 800; }
  .validity { text-align: center; font-style: italic; font-size: 14px; color: #374151; margin-top: 2mm; border-top: 1px solid #d1d5db; padding-top: 1.5mm; }
  .cblock { padding: 3px 0; }
  .ctitle { font-weight: 700; text-transform: uppercase; border-bottom: 1px solid #9ca3af; margin-bottom: 3px; font-size: 11px; }
  .ctitle.affective { color: #6b21a8; border-color: #d8b4fe; }
  .ctitle.psycho { color: #166534; border-color: #86efac; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 10px; }
  .grid1 { display: grid; gap: 2px; }
  .note { font-style: italic; color: #4b5563; margin-top: 3px; font-size: 9px; }
  .parents { border: 1px solid #6b7280; border-radius: 4px; padding: 6px; margin-top: 4px; }

  /* ── Results pages ── */
  .results { font-size: 11px; line-height: 1.3; }
  .results-left { padding: 5mm; }
  .results-right { padding: 5mm; justify-content: flex-start; }
  .hdr { display: grid; grid-template-columns: 1fr 1fr 1fr; font-size: 11px; border-bottom: 2px solid #111827; padding-bottom: 4px; margin-bottom: 4px; }
  .hdr .c { text-align: center; } .hdr .r { text-align: right; }
  .hdr > div > div { margin: 2px 0; }
  table.grid { width: 100%; border-collapse: collapse; font-size: 10px; flex: 1; table-layout: fixed; }
  table.grid th, table.grid td { border: 0.5px solid #374151; padding: 2px; text-align: center; overflow: hidden; }
  table.grid thead th { font-weight: 700; }
  .banner th { text-transform: uppercase; }
  .subj-h { text-align: left; width: 30mm; }
  .hh { width: 5mm; }
  .grp, .sub { font-size: 10px; }
  .subj { text-align: left; font-weight: 600; word-break: break-word; white-space: normal; line-height: 1.15; }
  td.mn, th.mn { background: #dbeafe80; }
  td.mn-p, th.mn-p { background: #f3e8ff80; }
  td.mn-g, th.mn-g { background: #dcfce780; }
  td.mn-y, th.mn-y { background: #fef3c780; font-weight: 700; }
  .hash-a { font-weight: 700; background: #faf5ff; }
  .hash-p { font-weight: 700; background: #f0fdf4; }
  .b { font-weight: 700; }
  .bg-c { background: #eff6ff; } .bg-c2 { background: #dbeafe99; }
  .bg-a { background: #faf5ff; } .bg-a2 { background: #f3e8ff99; }
  .bg-p { background: #f0fdf4; } .bg-p2 { background: #dcfce799; }
  .bg-y { background: #fffbeb; }
  tr.sum td { background: #f3f4f6; font-weight: 700; }
  tr.sum2 td { background: #e5e7eb; font-weight: 700; }
  td.fill { background: #f9fafb99; }

  /* Footer */
  .footer { display: grid; grid-template-columns: 7fr 3fr 2fr; gap: 0 10px; border-top: 2px solid #111827; margin-top: 4px; padding-top: 4px; font-size: 10px; }
  .att-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0 8px; }
  .att > div { margin: 2px 0; }
  .dot { border-bottom: 1px dotted #6b7280; height: 14px; margin-top: 4px; }
  .mini { font-size: 9px; color: #4b5563; }
  .amber { color: #d97706; } .red { color: #dc2626; }
  .guid { margin-top: 4px; border-top: 1px solid #d1d5db; padding-top: 3px; }
  .gtitle { font-style: italic; font-weight: 600; }
  .gline { display: flex; gap: 3px; align-items: baseline; }
  .gval { flex: 1; border-bottom: 1px dotted #6b7280; font-style: italic; padding: 0 4px; }
  .fm, .fr { border-left: 1px solid #d1d5db; padding-left: 8px; }
  .terms-t { font-weight: 700; text-transform: uppercase; font-size: 9px; padding-top: 4px; }
  .uline { display: inline-block; width: 50px; border-bottom: 1px dotted #6b7280; }
  .uline.sm { width: 36px; }
  .pcom { padding-top: 4px; } .pcom i { font-style: italic; }
  .promo { padding-top: 4px; font-weight: 700; text-transform: uppercase; font-size: 9px; }
  .ysum { font-size: 8px; color: #6b7280; }
  .seekey { font-size: 8px; font-style: italic; color: #9ca3af; margin-top: 3px; }

  /* ── Back cover (sheet 1 — has border, has watermark) ── */
  .cover-back { font-size: 14px; line-height: 1.5; border: 2px solid #111827; padding: 10mm; }
  .cover-back .watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0.06; z-index: 0; pointer-events: none; }
  .cover-back .watermark img { width: 140mm; height: 140mm; object-fit: contain; }
  .cover-back .watermark .wm-fallback { width: 70mm; height: 70mm; border-radius: 50%; background: #111827; color: #fff; font-size: 28px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
  .cover-back .cover-content { position: relative; z-index: 1; display: flex; flex-direction: column; height: 100%; }
  .cover-back .ckey { text-align: center; font-weight: 700; font-size: 15px; border-bottom: 2px solid #6b7280; padding-bottom: 5px; margin-bottom: 6px; }
  .cover-back .cblock { padding: 4px 0; }
  .cover-back .ctitle { font-weight: 700; text-transform: uppercase; border-bottom: 1px solid #9ca3af; margin-bottom: 4px; font-size: 14px; }
  .cover-back .ctitle.affective { color: #6b21a8; border-color: #d8b4fe; }
  .cover-back .ctitle.psycho { color: #166534; border-color: #86efac; }
  .cover-back .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 14px; font-size: 13px; }
  .cover-back .grid1 { display: grid; gap: 3px; font-size: 13px; }
  .cover-back .note { font-style: italic; color: #4b5563; margin-top: 4px; font-size: 12px; line-height: 1.45; }
  .cover-back .cover-bottom { margin-top: auto; }
  .cover-back .parents { border: 1px solid #6b7280; border-radius: 4px; padding: 8px; }
</style>
</head>
<body>
  ${page1}
  ${page3}
  ${page4}
  ${page5}
  ${pageBlank}
  ${page8}
</body></html>`;
}

/**
 * Booklet imposition for an 8-page logical PDF.
 *
 * Takes a 6-page PDF (each page A4 landscape = 297×210mm) and produces a
 * 3-page PDF (each page A3 landscape = 420×297mm) with 2 logical pages
 * placed side-by-side per physical sheet, in booklet imposition order:
 *
 *   Physical page 1 (Sheet 1 outside): [Page 6 | Page 1]
 *   Physical page 2 (Sheet 1 inside):  [Page 2 | Page 5]
 *   Physical page 3 (Sheet 2 outside):  [Page 4 | Page 3]
 *
 * After printing double-sided (flip on short edge), folding both sheets in
 * half, and nesting them, the reader sees pages 1→2→3→4→5→6.
 *
 * @param pdfBuffer — the 6-page A4 landscape PDF from Puppeteer
 * @returns — the 3-page A3 landscape imposed PDF
 */
export async function imposeBooklet(pdfBuffer: Buffer): Promise<Buffer> {
  const { PDFDocument } = await import('pdf-lib');

  const srcDoc = await PDFDocument.load(pdfBuffer);
  const srcPages = srcDoc.getPages();

  if (srcPages.length !== 6) {
    throw new Error(`Booklet imposition requires exactly 6 source pages, got ${srcPages.length}`);
  }

  const outDoc = await PDFDocument.create();

  const MM_TO_PT = 2.834645669;
  const A3_W = 420 * MM_TO_PT; // ~1190.55 pt
  const A3_H = 297 * MM_TO_PT; // ~841.89 pt

  const imposition = [
    [5, 0], // Sheet 1 outside: Page 6 | Page 1
    [1, 4], // Sheet 1 inside:  Page 2 | Page 5
    [3, 2], // Sheet 2 outside: Page 4 | Page 3
  ];

  for (const [leftIdx, rightIdx] of imposition) {
    const leftEmbedded = await outDoc.embedPage(srcPages[leftIdx]);
    const rightEmbedded = await outDoc.embedPage(srcPages[rightIdx]);

    const page = outDoc.addPage([A3_W, A3_H]);

    const leftW = leftEmbedded.width;
    const leftH = leftEmbedded.height;
    const rightW = rightEmbedded.width;
    const rightH = rightEmbedded.height;

    const targetW = A3_W / 2;
    const targetH = A3_H;

    const scaleLeft = Math.min(targetW / leftW, targetH / leftH);
    const scaleRight = Math.min(targetW / rightW, targetH / rightH);

    const leftDrawW = leftW * scaleLeft;
    const leftDrawH = leftH * scaleLeft;
    const rightDrawW = rightW * scaleRight;
    const rightDrawH = rightH * scaleRight;

    const leftX = (targetW - leftDrawW) / 2;
    const leftY = (A3_H - leftDrawH) / 2;
    page.drawPage(leftEmbedded, { x: leftX, y: leftY, xScale: scaleLeft, yScale: scaleLeft });

    const rightX = targetW + (targetW - rightDrawW) / 2;
    const rightY = (A3_H - rightDrawH) / 2;
    page.drawPage(rightEmbedded, { x: rightX, y: rightY, xScale: scaleRight, yScale: scaleRight });
  }

  const outBytes = await outDoc.save();
  return Buffer.from(outBytes);
}
