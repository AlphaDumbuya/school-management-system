/**
 * Shared layout for the single-term result sheet (Term 1 / Term 2).
 *
 * One stylesheet, scoped to `.trs`, used by the server PDF renderer. The web
 * preview (frontend lib/termSheetLayout.ts + TermResultSheet.tsx) carries an
 * identical copy so the on-screen sheet, the browser print and the downloaded
 * PDF look the same. Keep the two copies in sync when changing the design.
 *
 * The sheet is a fixed A4 page (210 × 297 mm). Table rows shrink as the number
 * of subjects grows so the whole result always fits on one page.
 */
export const TERM_SHEET_CSS = `
.trs{width:210mm;height:297mm;padding:11mm 13mm 8mm;position:relative;overflow:hidden;background:#fff;color:#111827;font-family:'Helvetica Neue',Helvetica,Arial,'Liberation Sans',sans-serif;font-size:12.5px;line-height:1.35;display:flex;flex-direction:column;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.trs *{box-sizing:border-box}
.trs .topbar{position:absolute;left:0;right:0;top:0;height:3mm;background:#0f2a5c}
.trs .topbar i{position:absolute;left:0;right:0;bottom:-1.2mm;height:1.2mm;background:#b8892b}
.trs .wm{position:absolute;left:50%;top:55%;transform:translate(-50%,-50%);width:115mm;height:115mm;opacity:.05;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0}
.trs .wm img{width:100%;height:100%;object-fit:contain}
.trs .wm span{font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:110px;color:#0f2a5c}
.trs .c{position:relative;z-index:1;display:flex;flex-direction:column;flex:1;min-height:0}
.trs .c>*{flex-shrink:0}
.trs .head{display:grid;grid-template-columns:25mm 1fr 25mm;align-items:center;gap:4mm;height:30mm}
.trs .logo{width:22mm;height:22mm;object-fit:contain;display:block}
.trs .logo-fb{width:22mm;height:22mm;border-radius:50%;background:#0f2a5c;color:#fff;font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:18px;letter-spacing:1px;display:flex;align-items:center;justify-content:center}
.trs .ht{text-align:center;min-width:0}
.trs h1{margin:0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#0f2a5c;line-height:1.15}
.trs .sub{font-size:11px;color:#374151;margin-top:1mm}
.trs .motto{font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:12px;color:#8a6a1f;margin-top:.8mm}
.trs .photo{width:25mm;height:30mm;border:1px solid #c7ced9;padding:.8mm;background:#fff;justify-self:end}
.trs .photo img{width:100%;height:100%;object-fit:cover;display:block}
.trs .photo .ph{width:100%;height:100%;background:#f3f5f8;color:#9aa3b2;font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;display:flex;align-items:center;justify-content:center;text-align:center}
.trs .rule{margin-top:3mm;border-top:2px solid #0f2a5c;border-bottom:1px solid #b8892b;height:4px}
.trs .titlebar{display:flex;justify-content:space-between;align-items:flex-end;margin:3mm 0 2.5mm}
.trs .doc{font-size:17px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#0f2a5c;line-height:1.2}
.trs .term{font-size:12.5px;color:#374151;margin-top:.6mm}
.trs .ref{text-align:right;font-size:11px;color:#4b5563;line-height:1.5}
.trs .ref b{color:#111827}
.trs .info{display:grid;grid-template-columns:2fr 1.3fr 1fr 1fr;border:1px solid #c7ced9;border-radius:2mm;overflow:hidden}
.trs .info>div{padding:1.4mm 3mm;border-right:1px solid #e3e7ee;border-bottom:1px solid #e3e7ee;min-width:0}
.trs .info>div:nth-child(4n){border-right:none}
.trs .info>div:nth-last-child(-n+4){border-bottom:none}
.trs .lab{display:block;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;line-height:1.3}
.trs .val{display:block;font-size:13.5px;font-weight:700;color:#111827;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.trs .sec{display:flex;align-items:center;gap:3mm;margin:3.5mm 0 1.6mm;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#0f2a5c;line-height:1.2}
.trs .sec:after{content:'';flex:1;border-top:1px solid #c7ced9}
.trs table.res{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
.trs .res th{background:#0f2a5c;color:#fff;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:1.9mm 2mm;text-align:center;white-space:nowrap;line-height:1.2}
.trs .res th.l,.trs .res td.l{text-align:left}
.trs .res td{height:var(--rowh,8mm);padding:0 2mm;border-bottom:1px solid #e3e7ee;text-align:center;font-size:var(--rowfs,13.5px);line-height:1.15}
.trs .res tbody tr:nth-child(even) td{background:#f6f8fb}
.trs .res tbody tr:last-child td{border-bottom:2px solid #0f2a5c}
.trs .res td.n{color:#6b7280;width:9mm}
.trs .res td.s{font-weight:700}
.trs .res td.m{font-weight:800}
.trs .res td.rm{color:#374151}
.trs .res td.fail{color:#b91c1c}
.trs .gb{display:inline-block;min-width:8mm;padding:0 1.5mm;border-radius:1mm;font-weight:800;font-size:.9em;line-height:1.5;background:#e8eef9;color:#0f2a5c}
.trs .gb.fail{background:#fde8e8;color:#b91c1c}
.trs .empty{padding:6mm;text-align:center;color:#9aa3b2}
.trs .panels{display:grid;grid-template-columns:1.25fr 1fr;gap:4mm;margin-top:3mm}
.trs .panel{border:1px solid #c7ced9;border-radius:2mm;overflow:hidden}
.trs .ptitle{padding:1.2mm 3mm;background:#f3f5f8;border-bottom:1px solid #e3e7ee;font-size:9.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#0f2a5c;line-height:1.3}
.trs .stats{display:grid;grid-auto-flow:column;grid-auto-columns:1fr}
.trs .stat{padding:1.6mm 1.5mm;text-align:center;border-right:1px solid #e3e7ee}
.trs .stat:last-child{border-right:none}
.trs .stat .v{font-size:18px;font-weight:800;color:#0f2a5c;line-height:1.15;white-space:nowrap}
.trs .stat .v small{font-size:11px;font-weight:700;color:#6b7280}
.trs .stat .v.red{color:#b91c1c}
.trs .stat .k{font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin-top:.6mm;line-height:1.2}
.trs .remarks{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin-top:3mm}
.trs .rmk{border:1px solid #c7ced9;border-radius:2mm;overflow:hidden;display:flex;flex-direction:column;min-height:var(--rmkh,30mm)}
.trs .rmk p{margin:0;padding:2mm 3mm 0;flex:1;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:13px;color:#1f2937;line-height:1.4}
.trs .rmk .by{display:flex;justify-content:space-between;align-items:flex-end;gap:3mm;padding:0 3mm 1.8mm;font-size:10.5px;color:#4b5563;white-space:nowrap}
.trs .rmk .by b{color:#111827}
.trs .rmk .sg{text-align:center}
.trs .rmk .sign{width:34mm;height:7mm;border-bottom:1px solid #6b7280;display:flex;align-items:flex-end;justify-content:center}
.trs .rmk .sign img{max-height:9mm;max-width:100%;object-fit:contain;margin-bottom:-1mm}
.trs .rmk .cap{display:block;font-size:9px;color:#6b7280;margin-top:.4mm;line-height:1.2}
.trs .key{margin-top:3mm;display:flex;flex-wrap:wrap;align-items:center;gap:1.4mm 2mm;font-size:10.5px;color:#374151;line-height:1.3}
.trs .key .kt{font-size:9.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#0f2a5c;margin-right:1mm}
.trs .key .g{border:1px solid #d6dbe4;border-radius:1mm;padding:.3mm 1.8mm;white-space:nowrap}
.trs .key .g b{color:#0f2a5c}
.trs .key .g.fail b{color:#b91c1c}
.trs .spacer{flex:1 1 auto;min-height:2mm}
.trs .foot{display:grid;grid-template-columns:1fr auto;gap:6mm;align-items:end;border-top:1px solid #c7ced9;padding-top:2.5mm}
.trs .verify{display:flex;gap:3mm;align-items:center}
.trs .verify img{width:19mm;height:19mm;display:block}
.trs .verify .t{font-size:10.5px;color:#4b5563;line-height:1.4}
.trs .verify .t b{display:block;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#0f2a5c}
.trs .stamp{width:32mm;height:19mm;border:1px dashed #9aa3b2;border-radius:2mm;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#9aa3b2;overflow:hidden}
.trs .stamp.has{border-color:transparent}
.trs .stamp img{max-width:100%;max-height:100%;object-fit:contain}
.trs .fine{margin-top:2mm;text-align:center;font-size:9.5px;color:#6b7280;line-height:1.35}
`;

/** Row height, row font size and remark box height so N subjects fit one A4 page. */
export function termSheetRowSizing(subjectCount: number): { rowH: string; rowFs: string; remarkH: string } {
  const n = Math.max(subjectCount, 1);
  // Remark boxes give up space first when the subject list is long.
  const remarkMm = n <= 9 ? 36 : n <= 12 ? 30 : 25;
  // About 122 mm of the page is shared by the table rows and the remark boxes.
  const h = Math.max(4.6, Math.min(10, (122 - remarkMm) / n));
  const fs = h >= 7 ? 13.5 : h >= 5.6 ? 12.5 : 11.5;
  return { rowH: `${h.toFixed(2)}mm`, rowFs: `${fs}px`, remarkH: `${remarkMm}mm` };
}

/**
 * Safety net run in the page: if the content still overflows the A4 box
 * (very long subject names, 20+ subjects), shrink rows and text step by step.
 */
export const TERM_SHEET_FIT_JS = `(function(){var s=document.querySelector('.trs');if(!s)return;var c=s.querySelector('.c');var cs=getComputedStyle(s);var h=parseFloat(cs.getPropertyValue('--rowh'))||8;var f=parseFloat(cs.getPropertyValue('--rowfs'))||13;var r=parseFloat(cs.getPropertyValue('--rmkh'))||30;for(var i=0;i<60&&c.scrollHeight>c.clientHeight+1;i++){if(r>22){r-=1}else{h=Math.max(3.8,h-0.2);f=Math.max(9.5,f-0.2)}s.style.setProperty('--rowh',h+'mm');s.style.setProperty('--rowfs',f+'px');s.style.setProperty('--rmkh',r+'mm');if(h<=3.8&&f<=9.5)break}})();`;

/** Human term name and short code. */
export const TERM_NAME: Record<string, string> = { first_term: 'First Term', second_term: 'Second Term', third_term: 'Third Term' };
export const TERM_CODE: Record<string, string> = { first_term: 'T1', second_term: 'T2', third_term: 'T3' };

/** A stable reference printed on the sheet, e.g. WDA/2026-27/T1/DEMO-0001. */
export function termSheetRef(shortName: string, academicYear: string, term: string, admissionNo: string): string {
  const yr = String(academicYear || '').replace(/^(\d{4})\/(\d{2})?(\d{2})$/, (_m, a, _b, c) => `${a}-${c}`);
  return [shortName, yr, TERM_CODE[term] || term, admissionNo].filter(Boolean).join('/');
}
