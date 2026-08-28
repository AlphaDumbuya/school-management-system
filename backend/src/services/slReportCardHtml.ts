/**
 * Sierra Leone Report Card — server-side HTML renderer for PDF export.
 * Produces a self-contained HTML document (inline CSS, no Tailwind) that
 * Puppeteer converts to a clean 2-page A4 landscape PDF with NO browser
 * header/footer. Mirrors the frontend BookletContent layout.
 */

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

/** A cognitive cell, red if <50 */
function num(v: number | null | undefined, bold = false): string {
  if (v == null) return '<span style="color:#9ca3af">–</span>';
  const fail = v < 50;
  const style = `${fail ? 'color:#dc2626;font-weight:700;' : ''}${bold ? 'font-weight:700;' : ''}`;
  return `<span style="${style}">${v}</span>`;
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
}

export function renderReportCardHtml(card: ReportCardData, school: SchoolInfo): string {
  const schoolName = school?.name || 'SCHOOL NAME';
  const schoolAddress = [school?.address, school?.city, school?.state, school?.country].filter(Boolean).join(', ');
  const shortName = school?.short_name || schoolName.split(' ').map((w) => w[0]).join('').slice(0, 4).toUpperCase();
  const logo = school?.logo_url;

  // ── SHEET 1: covers ────────────────────────────────────────────────────────
  const affectiveLegend = AFFECTIVE_TRAITS.map((t, i) => `<div><b>${i + 1}</b> - ${esc(t)}</div>`).join('');
  const psychoLegend = PSYCHOMOTOR_SKILLS.map((t, i) => `<div><b>${i + 1}</b> - ${esc(t)}</div>`).join('');
  const gradeLegend = GRADING_METHOD.map((g) =>
    `<div style="${g.isFail ? 'color:#b91c1c;font-weight:700;' : ''}">${g.remark}: ${g.min}–${g.max}</div>`).join('');
  const ratingLegend = RATING_LEGEND.map((r) => `<div><b>${r.value}</b> - ${esc(r.label)}</div>`).join('');

  const sheet1 = `
  <section class="sheet cover">
    <div class="cover-left">
      <div class="ckey">Key: Mn = Average &nbsp;·&nbsp; Rnk = Position</div>
      <div class="cblock"><div class="ctitle affective">Affective</div><div class="grid2">${affectiveLegend}</div></div>
      <div class="cblock"><div class="ctitle psycho">Psychomotor</div><div class="grid2">${psychoLegend}</div></div>
      <div class="cblock"><div class="ctitle">Cognitive — Mark / Scores</div><div class="grid2">${gradeLegend}</div>
        <div class="note">Above 50% — reasonable but must maintain effort. Below 50% — improvement needed; discuss with the teacher.</div></div>
      <div class="cblock"><div class="ctitle">Affective &amp; Psychomotor Rating</div><div class="grid1">${ratingLegend}</div></div>
      <div class="parents"><div class="ctitle">Note to Parents / Guardian</div>
        <div class="note">This card reports on the whole pupil, not just the academic or the cognitive. Look at it carefully and discuss what you do not understand with the teacher. Keep in constant touch with the school. Encourage your child to be honest, truthful, hardworking, tidy, considerate of others and disciplined.</div></div>
    </div>
    <div class="cover-right">
      <div class="brand">
        ${logo ? `<img class="logo" src="${esc(logo)}" alt="logo" />` : `<div class="logo-fallback">${esc(shortName)}</div>`}
        <h1>${esc(schoolName)}</h1>
        ${schoolAddress ? `<div class="addr">${esc(schoolAddress)}</div>` : ''}
        <div class="rc-badge">Report Card</div>
        ${card.student.class_level ? `<div class="lvl">${esc(card.student.class_level)}</div>` : ''}
      </div>
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
    </div>
  </section>`;

  // ── SHEET 2: results grid ────────────────────────────────────────────────────
  const rowCount = Math.max(card.subjects.length, AFFECTIVE_TRAITS.length, PSYCHOMOTOR_SKILLS.length);
  const aff = card.domain_ratings.affective || {};
  const psy = card.domain_ratings.psychomotor || {};
  const ys = card.yearly_summary || {};

  const bodyRows = Array.from({ length: rowCount }).map((_, i) => {
    const s = card.subjects[i];
    const affTrait = AFFECTIVE_TRAITS[i];
    const psyTrait = PSYCHOMOTOR_SKILLS[i];
    const affR = aff[i + 1] || { terms: {} };
    const psyR = psy[i + 1] || { terms: {} };

    const cog = SL_TERMS.map((t) => {
      const ts = s?.terms?.[t];
      return `<td>${num(ts?.test1)}</td><td>${num(ts?.test2)}</td><td class="mn">${num(ts?.mean, true)}</td><td>${ts?.rank ?? ''}</td>`;
    }).join('');

    const affCells = SL_TERMS.map((t) => {
      const c = affR.terms?.[t];
      return `<td>${affTrait ? (c?.r1 ?? '') : ''}</td><td>${affTrait ? (c?.r2 ?? '') : ''}</td><td class="mn-p">${affTrait ? (c?.mean ?? '') : ''}</td>`;
    }).join('');

    const psyCells = SL_TERMS.map((t) => {
      const c = psyR.terms?.[t];
      return `<td>${psyTrait ? (c?.r1 ?? '') : ''}</td><td>${psyTrait ? (c?.r2 ?? '') : ''}</td><td class="mn-g">${psyTrait ? (c?.mean ?? '') : ''}</td>`;
    }).join('');

    return `<tr>
      <td class="subj">${esc(s?.subject_name ?? '')}</td>
      ${cog}
      <td class="mn-y">${num(s?.yearly_mean, true)}</td><td class="b">${s?.yearly_rank ?? ''}</td>
      <td class="hash-a">${affTrait ? i + 1 : ''}</td>
      ${affCells}
      <td class="mn-y">${affTrait ? (affR.yearly_mean ?? '') : ''}</td><td>${affTrait ? (affR.yearly_rank ?? '') : ''}</td>
      <td class="hash-p">${psyTrait ? i + 1 : ''}</td>
      ${psyCells}
      <td class="mn-y">${psyTrait ? (psyR.yearly_mean ?? '') : ''}</td><td>${psyTrait ? (psyR.yearly_rank ?? '') : ''}</td>
    </tr>`;
  }).join('');

  const summaryRow = (label: string, valueFor: (t: string) => string, yearly: string, cls: string) => `
    <tr class="${cls}">
      <td class="subj">${label}</td>
      ${SL_TERMS.map((t) => `<td></td><td></td><td class="mn">${valueFor(t)}</td><td></td>`).join('')}
      <td class="mn-y">${yearly}</td><td></td>
      <td class="fill" colspan="28"></td>
    </tr>`;

  const combRow = summaryRow('Comb. Scores',
    (t) => esc(card.term_summaries[t]?.combined_score ?? ''),
    esc(ys.combined_score ?? ''), 'sum');
  const pctRow = summaryRow('Percentages',
    (t) => card.term_summaries[t]?.percentage != null ? `${card.term_summaries[t].percentage}%` : '',
    ys.percentage != null ? `${ys.percentage}%` : '', 'sum');
  const posRow = summaryRow('Position',
    (t) => { const sm = card.term_summaries[t]; return sm?.position ? `${sm.position}${sm.class_size ? `/${sm.class_size}` : ''}` : ''; },
    ys.position ? `${ys.position}${ys.class_size ? `/${ys.class_size}` : ''}` : '', 'sum2');

  const attBlocks = SL_TERMS.map((t) => {
    const sm = card.term_summaries[t] || {};
    return `<div class="att">
      <div>On Time: <b>${sm.on_time ?? 0}</b></div>
      <div>Late: <b class="amber">${sm.late ?? 0}</b></div>
      <div>Absent: <b class="red">${sm.absent ?? 0}</b></div>
      <div class="dot"></div>
      <div class="mini">Teacher's Sign and Date</div>
      <div>CONDUCT: <b>${esc(sm.conduct || '............')}</b></div>
    </div>`;
  }).join('');

  const guidance = SL_TERMS.map((t, i) =>
    `<div class="gline"><span>Term ${i + 1}:</span><span class="gval">${esc(card.term_summaries[t]?.teacher_comment || '')}</span></div>`).join('');

  const promoText = card.meta?.promotion_status || ys.promotion_recommendation || '............';
  const promoColor = ys.outcome === 'fail' ? 'color:#dc2626'
    : ys.outcome === 'promoted_effort' ? 'color:#d97706'
    : ys.outcome === 'promoted' ? 'color:#15803d' : '';

  const sheet2 = `
  <section class="sheet inner">
    <div class="hdr">
      <div><div><b>Name:</b> ${esc(card.student.name)}</div><div><b>No. in Form:</b> ${esc(card.student.admission_no)}</div></div>
      <div class="c"><div><b>Average Age:</b> ${esc(card.student.class_average_age ?? '—')}</div><div><b>Pupil's Age:</b> ${esc(card.student.pupil_age ?? '—')}</div></div>
      <div class="r"><div><b>Teacher in charge of class:</b> ${esc(card.student.form_teacher_name || '—')}</div><div><b>Form:</b> ${esc(card.student.class_name || '—')} &nbsp; <b>Year:</b> ${esc(card.academic_year)}</div></div>
    </div>

    <table class="grid">
      <thead>
        <tr class="banner">
          <th rowspan="3" class="subj-h">Subject</th>
          <th colspan="14" class="bg-c">* Cognitive</th>
          <th rowspan="3" class="hh">#</th>
          <th colspan="13" class="bg-a">* Affective</th>
          <th rowspan="3" class="hh">#</th>
          <th colspan="13" class="bg-p">* Psychomotor</th>
        </tr>
        <tr class="grp">
          ${SL_TERMS.map((t) => `<th colspan="4" class="bg-c2">${TERM_SHORT[t]}</th>`).join('')}
          <th colspan="2" class="bg-y">YEARLY</th>
          ${['TEST 1', 'TEST 2', 'TEST 3'].map((t) => `<th colspan="3" class="bg-a2">${t} (Rating)</th>`).join('')}
          <th colspan="2" class="bg-y">YEARLY</th>
          ${['TEST 1', 'TEST 2', 'TEST 3'].map((t) => `<th colspan="3" class="bg-p2">${t} (Rating)</th>`).join('')}
          <th colspan="2" class="bg-y">YEARLY</th>
        </tr>
        <tr class="sub">
          ${SL_TERMS.map(() => `<th>1</th><th>2</th><th class="mn">Mn</th><th>Rnk</th>`).join('')}
          <th class="mn-y">Mn</th><th>Rnk</th>
          ${[0, 1, 2].map(() => `<th>1</th><th>2</th><th class="mn-p">Mn</th>`).join('')}
          <th class="mn-y">Mn</th><th>Rnk</th>
          ${[0, 1, 2].map(() => `<th>1</th><th>2</th><th class="mn-g">Mn</th>`).join('')}
          <th class="mn-y">Mn</th><th>Rnk</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
        ${combRow}${pctRow}${posRow}
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
        ${ys.percentage != null ? `<div class="ysum">Yearly: ${ys.percentage}% · Position ${ys.position}/${ys.class_size}</div>` : ''}
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

  // ── Full document with inline CSS ────────────────────────────────────────────
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; }
  .sheet { width: 297mm; min-height: 209mm; padding: 6mm; page-break-after: always; overflow: hidden; }
  .sheet:last-child { page-break-after: auto; }

  /* Cover */
  .cover { display: flex; }
  .cover-left, .cover-right { width: 50%; padding: 6mm; display: flex; flex-direction: column; justify-content: space-between; }
  .cover-left { border-right: 2px dashed #6b7280; font-size: 12px; line-height: 1.35; }
  .cover-right { text-align: center; }
  .ckey { text-align: center; font-weight: 700; font-size: 13px; border-bottom: 2px solid #6b7280; padding-bottom: 5px; }
  .cblock { padding: 3px 0; }
  .ctitle { font-weight: 700; text-transform: uppercase; border-bottom: 1px solid #9ca3af; margin-bottom: 3px; }
  .ctitle.affective { color: #6b21a8; border-color: #d8b4fe; }
  .ctitle.psycho { color: #166534; border-color: #86efac; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
  .grid1 { display: grid; gap: 2px; }
  .note { font-style: italic; color: #4b5563; margin-top: 3px; }
  .parents { border: 2px solid #6b7280; border-radius: 4px; padding: 6px; margin-top: 4px; }
  .brand h1 { font-size: 22px; font-weight: 800; text-transform: uppercase; margin: 8px 0 4px; }
  .logo { width: 120px; height: 120px; object-fit: contain; margin: 0 auto; display: block; }
  .logo-fallback { width: 120px; height: 120px; border-radius: 50%; background: #111827; color: #fff; font-size: 30px; font-weight: 800; display: flex; align-items: center; justify-content: center; margin: 0 auto; }
  .addr { font-size: 13px; font-weight: 600; color: #4b5563; }
  .rc-badge { display: inline-block; background: #111827; color: #fff; font-weight: 700; padding: 6px 16px; border-radius: 4px; font-size: 14px; text-transform: uppercase; margin-top: 6px; }
  .lvl { font-size: 13px; font-weight: 700; color: #374151; text-transform: uppercase; margin-top: 4px; }
  .pupil { border-top: 2px solid #111827; border-bottom: 2px solid #111827; padding: 14px 0; margin: 8px 0; font-size: 14px; }
  .prow { display: flex; justify-content: space-between; border-bottom: 1px solid #d1d5db; padding-bottom: 6px; margin-bottom: 10px; }
  .prow.last { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
  .prow span { font-weight: 700; color: #4b5563; }
  .sigrow { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; font-size: 12px; }
  .sigbox { border: 2px dashed #9ca3af; border-radius: 4px; height: 100px; display: flex; flex-direction: column; justify-content: space-between; padding: 8px; }
  .sigbox span { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; }
  .seal { width: 60px; height: 60px; border: 2px solid #1e40af; border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; transform: rotate(-12deg); opacity: .7; }
  .sig { font-style: italic; font-family: Georgia, serif; font-weight: 700; color: #1e40af; font-size: 15px; }

  /* Inner grid */
  .inner { display: flex; flex-direction: column; }
  .hdr { display: grid; grid-template-columns: 1fr 1fr 1fr; font-size: 12px; border-bottom: 2px solid #111827; padding-bottom: 8px; margin-bottom: 8px; }
  .hdr .c { text-align: center; } .hdr .r { text-align: right; }
  .hdr > div > div { margin: 2px 0; }
  table.grid { width: 100%; border-collapse: collapse; font-size: 11px; flex: 1; }
  table.grid th, table.grid td { border: 1px solid #374151; padding: 2px; text-align: center; }
  table.grid thead th { font-weight: 700; }
  .banner th { text-transform: uppercase; }
  .subj-h { text-align: left; width: 92px; }
  .hh { width: 14px; }
  .grp, .sub { font-size: 10px; }
  .subj { text-align: left; font-weight: 600; white-space: nowrap; }
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
  .footer { display: grid; grid-template-columns: 7fr 3fr 2fr; gap: 0 16px; border-top: 2px solid #111827; margin-top: 8px; padding-top: 8px; font-size: 11px; }
  .att-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0 16px; }
  .att > div { margin: 1px 0; }
  .dot { border-bottom: 1px dotted #6b7280; height: 14px; margin-top: 4px; }
  .mini { font-size: 10px; color: #4b5563; }
  .amber { color: #d97706; } .red { color: #dc2626; }
  .guid { margin-top: 8px; border-top: 1px solid #d1d5db; padding-top: 4px; }
  .gtitle { font-style: italic; font-weight: 600; }
  .gline { display: flex; gap: 4px; align-items: baseline; }
  .gval { flex: 1; border-bottom: 1px dotted #6b7280; font-style: italic; padding: 0 4px; }
  .fm, .fr { border-left: 1px solid #d1d5db; padding-left: 12px; }
  .terms-t { font-weight: 700; text-transform: uppercase; font-size: 10px; padding-top: 4px; }
  .uline { display: inline-block; width: 64px; border-bottom: 1px dotted #6b7280; }
  .uline.sm { width: 48px; }
  .pcom { padding-top: 4px; } .pcom i { font-style: italic; }
  .promo { padding-top: 4px; font-weight: 700; text-transform: uppercase; font-size: 10px; }
  .ysum { font-size: 9px; color: #6b7280; }
  .seekey { font-size: 9px; font-style: italic; color: #9ca3af; margin-top: 4px; }
</style>
</head>
<body>
  ${sheet1}
  ${sheet2}
</body></html>`;
}
