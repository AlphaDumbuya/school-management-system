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
  tenant_id?: string;
  student_id?: string;
  class_id?: string;
  verify_url?: string;
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

export interface BorderStyleConfig {
  preset?: string;
  color?: string;
  width?: number;
  padding?: number;
  style?: 'solid' | 'double' | 'dashed' | 'dotted' | 'groove' | 'ridge' | 'inset' | 'outset' | 'none';
  radius?: number;
}

// ── Certificate-grade decorative FRAMES (mirror of frontend src/lib/reportCardBorders.ts) ──
// Each is a single full-page SVG rectangular frame that decorates the FRONT
// COVER only, rendered as an absolutely-positioned background image. Every
// builder takes (color, thickness) so schools can recolour and resize.
const VB_W = 1000, VB_H = 1400;

function svgToDataUrl(svg: string): string {
  const compact = svg.replace(/\s{2,}/g, ' ').replace(/>\s+</g, '><').trim();
  const enc = encodeURIComponent(compact).replace(/'/g, '%27').replace(/"/g, '%22');
  return `data:image/svg+xml,${enc}`;
}

function fTint(hex: string, amt: number): string {
  const m = hex.replace('#', '');
  const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amt);
  const hx = (c: number) => c.toString(16).padStart(2, '0');
  return `#${hx(mix(r))}${hx(mix(g))}${hx(mix(b))}`;
}

const FRAME_BUILDERS: Record<string, (color: string, t: number) => string> = {
  frame_band_zigzag: (color, t) => {
    const band = t, inner = band * 0.5, teeth = 26, light = fTint(color, 0.55);
    const ix = band + inner, iy = band + inner, iw = VB_W - 2 * ix, ih = VB_H - 2 * iy;
    const step = (VB_W - 2 * band) / teeth;
    const pts: string[] = [];
    const x0 = band, y0 = band, x1 = VB_W - band, y1 = VB_H - band, amp = inner * 0.9;
    for (let x = x0; x < x1; x += step) { pts.push(`${x},${y0}`); pts.push(`${x + step / 2},${y0 + amp}`); }
    const vstep = (y1 - y0) / Math.round((y1 - y0) / step);
    for (let y = y0; y < y1; y += vstep) { pts.push(`${x1},${y}`); pts.push(`${x1 - amp},${y + vstep / 2}`); }
    for (let x = x1; x > x0; x -= step) { pts.push(`${x},${y1}`); pts.push(`${x - step / 2},${y1 - amp}`); }
    for (let y = y1; y > y0; y -= vstep) { pts.push(`${x0},${y}`); pts.push(`${x0 + amp},${y - vstep / 2}`); }
    return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${VB_W} ${VB_H}' preserveAspectRatio='none'><rect x='0' y='0' width='${VB_W}' height='${VB_H}' fill='${color}'/><polygon points='${pts.join(' ')}' fill='${light}'/><rect x='${ix}' y='${iy}' width='${iw}' height='${ih}' fill='#ffffff'/></svg>`;
  },
  frame_guilloche: (color, t) => {
    const x = 24, y = 24, w = VB_W - 48, h = VB_H - 48, light = fTint(color, 0.35), band = Math.max(30, t), waveUnit = 60;
    const rosette = (cx: number, cy: number) =>
      `<g transform='translate(${cx} ${cy})' fill='none' stroke='${color}' stroke-width='1'>${Array.from({ length: 6 }).map((_, i) => `<ellipse rx='${10 + i * 4}' ry='${16 + i * 5}' transform='rotate(${i * 30})'/>`).join('')}<circle r='4' fill='${color}' stroke='none'/></g>`;
    const wave = `<g stroke='${color}' fill='none' stroke-width='1'><path d='M0 ${band / 2} q${waveUnit / 4} -${band / 3} ${waveUnit / 2} 0 q${waveUnit / 4} ${band / 3} ${waveUnit / 2} 0'/><path d='M0 ${band / 2} q${waveUnit / 4} ${band / 3} ${waveUnit / 2} 0 q${waveUnit / 4} -${band / 3} ${waveUnit / 2} 0'/><ellipse cx='${waveUnit / 2}' cy='${band / 2}' rx='${waveUnit / 3}' ry='${band / 4}'/></g>`;
    return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${VB_W} ${VB_H}' preserveAspectRatio='none'><defs><pattern id='gwave' width='${waveUnit}' height='${band}' patternUnits='userSpaceOnUse'>${wave}</pattern></defs><rect x='${x}' y='${y}' width='${w}' height='${h}' fill='none' stroke='${light}' stroke-width='${band}'/><rect x='${x}' y='${y}' width='${w}' height='${band}' fill='url(#gwave)'/><rect x='${x}' y='${y + h - band}' width='${w}' height='${band}' fill='url(#gwave)'/><rect x='${x + band + 6}' y='${y + band + 6}' width='${w - 2 * band - 12}' height='${h - 2 * band - 12}' fill='none' stroke='${color}' stroke-width='1.5'/>${rosette(x + band / 2, y + band / 2)}${rosette(x + w - band / 2, y + band / 2)}${rosette(x + band / 2, y + h - band / 2)}${rosette(x + w - band / 2, y + h - band / 2)}</svg>`;
  },
  frame_filigree: (color, t) => {
    const x = 30, y = 30, w = VB_W - 60, h = VB_H - 60, gap = Math.max(10, t * 0.6), dash = `${t * 0.8} ${t * 0.9}`;
    const corner = (ox: number, oy: number, sx: number, sy: number) =>
      `<g transform='translate(${ox} ${oy}) scale(${sx} ${sy})' fill='none' stroke='${color}' stroke-width='2.4' stroke-linecap='round'><path d='M0 0 h70'/><path d='M0 0 v70'/><path d='M14 14 q46 2 60 -18 q4 24 -24 32 q28 -2 34 -24'/><circle cx='72' cy='16' r='3.5' fill='${color}' stroke='none'/><circle cx='16' cy='72' r='3.5' fill='${color}' stroke='none'/></g>`;
    return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${VB_W} ${VB_H}' preserveAspectRatio='none'><rect x='${x}' y='${y}' width='${w}' height='${h}' fill='none' stroke='${color}' stroke-width='2'/><rect x='${x + gap}' y='${y + gap}' width='${w - 2 * gap}' height='${h - 2 * gap}' fill='none' stroke='${color}' stroke-width='1.4' stroke-dasharray='${dash}'/>${corner(x, y, 1, 1)}${corner(x + w, y, -1, 1)}${corner(x, y + h, 1, -1)}${corner(x + w, y + h, -1, -1)}</svg>`;
  },
  frame_geometric: (color, t) => {
    const x = 24, y = 24, w = VB_W - 48, h = VB_H - 48, band = Math.max(24, t), unit = Math.max(24, t);
    const motif = `<g stroke='${color}' fill='none' stroke-width='2'><rect x='2' y='2' width='${unit - 4}' height='${band - 4}'/><path d='M${unit / 2} 4 L${unit - 4} ${band / 2} L${unit / 2} ${band - 4} L4 ${band / 2} Z' fill='${color}'/></g>`;
    return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${VB_W} ${VB_H}' preserveAspectRatio='none'><defs><pattern id='geo' width='${unit}' height='${band}' patternUnits='userSpaceOnUse'>${motif}</pattern></defs><rect x='${x}' y='${y}' width='${w}' height='${h}' fill='none' stroke='${color}' stroke-width='2.5'/><rect x='${x}' y='${y}' width='${w}' height='${band}' fill='url(#geo)'/><rect x='${x}' y='${y + h - band}' width='${w}' height='${band}' fill='url(#geo)'/><rect x='${x}' y='${y}' width='${band}' height='${h}' fill='url(#geo)'/><rect x='${x + w - band}' y='${y}' width='${band}' height='${h}' fill='url(#geo)'/><rect x='${x + band}' y='${y + band}' width='${w - 2 * band}' height='${h - 2 * band}' fill='none' stroke='${color}' stroke-width='1.2'/></svg>`;
  },
  frame_medallion: (color, t) => {
    const band = Math.max(60, t * 1.6), gold = '#c8a24a', ix = band, iy = band, iw = VB_W - 2 * band, ih = VB_H - 2 * band, unit = band * 0.9;
    const medallion = `<g transform='translate(${unit / 2} ${band / 2})'><circle r='${band * 0.32}' fill='none' stroke='${gold}' stroke-width='3'/><circle r='${band * 0.2}' fill='none' stroke='${gold}' stroke-width='2'/><path d='M0 -${band * 0.28} V${band * 0.28} M-${band * 0.28} 0 H${band * 0.28}' stroke='${gold}' stroke-width='2'/></g>`;
    return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${VB_W} ${VB_H}' preserveAspectRatio='none'><defs><pattern id='med' width='${unit}' height='${band}' patternUnits='userSpaceOnUse'>${medallion}</pattern></defs><rect x='0' y='0' width='${VB_W}' height='${VB_H}' fill='${color}'/><rect x='0' y='0' width='${VB_W}' height='${band}' fill='url(#med)'/><rect x='0' y='${VB_H - band}' width='${VB_W}' height='${band}' fill='url(#med)'/><rect x='0' y='0' width='${band}' height='${VB_H}' fill='url(#med)'/><rect x='${VB_W - band}' y='0' width='${band}' height='${VB_H}' fill='url(#med)'/><rect x='${ix}' y='${iy}' width='${iw}' height='${ih}' fill='#ffffff'/></svg>`;
  },
  frame_modern_corners: (color, t) => {
    const x = 20, y = 20, w = VB_W - 40, h = VB_H - 40, tri = Math.max(40, t * 1.4), accent = color, dark = color;
    const cornerTri = (cx: number, cy: number, sx: number, sy: number) =>
      `<g transform='translate(${cx} ${cy}) scale(${sx} ${sy})'><path d='M0 0 L${tri} 0 L0 ${tri} Z' fill='${dark}'/><path d='M${tri * 0.35} ${tri * 0.35} L${tri * 1.05} ${tri * 0.35} L${tri * 0.35} ${tri * 1.05} Z' fill='${accent}' opacity='0.85'/></g>`;
    return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${VB_W} ${VB_H}' preserveAspectRatio='none'><rect x='${x}' y='${y}' width='${w}' height='${h}' fill='none' stroke='${dark}' stroke-width='2.5'/><rect x='${x + 8}' y='${y + 8}' width='${w - 16}' height='${h - 16}' fill='none' stroke='${dark}' stroke-width='1'/>${cornerTri(x, y, 1, 1)}${cornerTri(x + w, y, -1, 1)}${cornerTri(x, y + h, 1, -1)}${cornerTri(x + w, y + h, -1, -1)}</svg>`;
  },
  frame_dotted: (color, t) => {
    const x = 28, y = 28, w = VB_W - 56, h = VB_H - 56, r = Math.max(2, t * 0.12), gap = Math.max(10, t * 0.7);
    return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${VB_W} ${VB_H}' preserveAspectRatio='none'><rect x='${x}' y='${y}' width='${w}' height='${h}' fill='none' stroke='${color}' stroke-width='${Math.max(2, t * 0.18)}' stroke-linecap='round' stroke-dasharray='0.1 ${gap}'/><circle cx='${x}' cy='${y}' r='${r * 1.6}' fill='${color}'/><circle cx='${x + w}' cy='${y}' r='${r * 1.6}' fill='${color}'/><circle cx='${x}' cy='${y + h}' r='${r * 1.6}' fill='${color}'/><circle cx='${x + w}' cy='${y + h}' r='${r * 1.6}' fill='${color}'/></svg>`;
  },
  frame_rope: (color, t) => {
    const x = 26, y = 26, w = VB_W - 52, h = VB_H - 52, band = Math.max(16, t), unit = band * 1.4, light = fTint(color, 0.4);
    const twist = `<g fill='none' stroke-width='${band * 0.22}' stroke-linecap='round'><path d='M0 ${band / 2} q${unit / 4} -${band / 2} ${unit / 2} 0 q${unit / 4} ${band / 2} ${unit / 2} 0' stroke='${color}'/><path d='M0 ${band / 2} q${unit / 4} ${band / 2} ${unit / 2} 0 q${unit / 4} -${band / 2} ${unit / 2} 0' stroke='${light}'/></g>`;
    return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${VB_W} ${VB_H}' preserveAspectRatio='none'><defs><pattern id='rope' width='${unit}' height='${band}' patternUnits='userSpaceOnUse'>${twist}</pattern></defs><rect x='${x}' y='${y}' width='${w}' height='${band}' fill='url(#rope)'/><rect x='${x}' y='${y + h - band}' width='${w}' height='${band}' fill='url(#rope)'/><rect x='${x}' y='${y}' width='${band}' height='${h}' fill='url(#rope)'/><rect x='${x + w - band}' y='${y}' width='${band}' height='${h}' fill='url(#rope)'/><rect x='${x + band + 4}' y='${y + band + 4}' width='${w - 2 * band - 8}' height='${h - 2 * band - 8}' fill='none' stroke='${color}' stroke-width='1.5'/></svg>`;
  },
  frame_laurel: (color, t) => {
    const x = 26, y = 26, w = VB_W - 52, h = VB_H - 52, band = Math.max(18, t), unit = band * 1.2;
    const leaf = `<g fill='${color}'><path d='M${unit * 0.1} ${band / 2} q${unit * 0.2} -${band * 0.4} ${unit * 0.4} 0 q-${unit * 0.2} ${band * 0.15} -${unit * 0.4} 0 Z'/><path d='M${unit * 0.5} ${band / 2} q${unit * 0.2} ${band * 0.4} ${unit * 0.4} 0 q-${unit * 0.2} -${band * 0.15} -${unit * 0.4} 0 Z'/></g><line x1='0' y1='${band / 2}' x2='${unit}' y2='${band / 2}' stroke='${color}' stroke-width='1'/>`;
    return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${VB_W} ${VB_H}' preserveAspectRatio='none'><defs><pattern id='laurel' width='${unit}' height='${band}' patternUnits='userSpaceOnUse'>${leaf}</pattern></defs><rect x='${x}' y='${y}' width='${w}' height='${band}' fill='url(#laurel)'/><rect x='${x}' y='${y + h - band}' width='${w}' height='${band}' fill='url(#laurel)'/><rect x='${x}' y='${y}' width='${band}' height='${h}' fill='url(#laurel)'/><rect x='${x + w - band}' y='${y}' width='${band}' height='${h}' fill='url(#laurel)'/><rect x='${x + band + 4}' y='${y + band + 4}' width='${w - 2 * band - 8}' height='${h - 2 * band - 8}' fill='none' stroke='${color}' stroke-width='1.2'/></svg>`;
  },
  frame_beveled: (color, t) => {
    const x = 24, y = 24, w = VB_W - 48, h = VB_H - 48, band = Math.max(14, t), light = fTint(color, 0.5);
    return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${VB_W} ${VB_H}' preserveAspectRatio='none'><rect x='${x}' y='${y}' width='${w}' height='${h}' fill='none' stroke='${color}' stroke-width='${band}'/><rect x='${x}' y='${y}' width='${w}' height='${h}' fill='none' stroke='${light}' stroke-width='${band * 0.35}'/><rect x='${x + band}' y='${y + band}' width='${w - 2 * band}' height='${h - 2 * band}' fill='none' stroke='${color}' stroke-width='2'/></svg>`;
  },
  frame_deco: (color, t) => {
    const x = 24, y = 24, w = VB_W - 48, h = VB_H - 48, band = Math.max(20, t), unit = band;
    const chevron = `<path d='M0 ${band} L${unit / 2} 2 L${unit} ${band} L${unit / 2} ${band * 0.5} Z' fill='${color}'/>`;
    return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${VB_W} ${VB_H}' preserveAspectRatio='none'><defs><pattern id='deco' width='${unit}' height='${band}' patternUnits='userSpaceOnUse'>${chevron}</pattern></defs><rect x='${x}' y='${y}' width='${w}' height='${h}' fill='none' stroke='${color}' stroke-width='3'/><rect x='${x}' y='${y}' width='${w}' height='${band}' fill='url(#deco)'/><rect x='${x}' y='${y + h - band}' width='${w}' height='${band}' fill='url(#deco)'/><rect x='${x + band + 6}' y='${y + band + 6}' width='${w - 2 * band - 12}' height='${h - 2 * band - 12}' fill='none' stroke='${color}' stroke-width='1.2'/></svg>`;
  },
  frame_wave_ribbon: (color, t) => {
    const x = 26, y = 26, w = VB_W - 52, h = VB_H - 52, band = Math.max(16, t), unit = band * 2, light = fTint(color, 0.45);
    const wave = `<path d='M0 ${band / 2} q${unit / 4} -${band / 2.2} ${unit / 2} 0 t${unit / 2} 0' fill='none' stroke='${color}' stroke-width='${band * 0.28}'/><path d='M0 ${band * 0.72} q${unit / 4} -${band / 2.2} ${unit / 2} 0 t${unit / 2} 0' fill='none' stroke='${light}' stroke-width='${band * 0.2}'/>`;
    return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${VB_W} ${VB_H}' preserveAspectRatio='none'><defs><pattern id='wr' width='${unit}' height='${band}' patternUnits='userSpaceOnUse'>${wave}</pattern></defs><rect x='${x}' y='${y}' width='${w}' height='${band}' fill='url(#wr)'/><rect x='${x}' y='${y + h - band}' width='${w}' height='${band}' fill='url(#wr)'/><rect x='${x}' y='${y}' width='${band}' height='${h}' fill='url(#wr)'/><rect x='${x + w - band}' y='${y}' width='${band}' height='${h}' fill='url(#wr)'/><rect x='${x + band + 4}' y='${y + band + 4}' width='${w - 2 * band - 8}' height='${h - 2 * band - 8}' fill='none' stroke='${color}' stroke-width='1.4'/></svg>`;
  },
};

const FRAME_COLORS: Record<string, string> = {
  frame_band_zigzag: '#1d4ed8', frame_guilloche: '#3b82f6', frame_filigree: '#6d28d9',
  frame_geometric: '#111827', frame_medallion: '#1e40af', frame_modern_corners: '#1e293b',
  frame_dotted: '#334155', frame_rope: '#a16207', frame_laurel: '#14532d',
  frame_beveled: '#475569', frame_deco: '#7c2d12', frame_wave_ribbon: '#0369a1',
};
const FRAME_THICKNESS: Record<string, number> = {
  frame_band_zigzag: 60, frame_guilloche: 46, frame_filigree: 20,
  frame_geometric: 30, frame_medallion: 48, frame_modern_corners: 70,
  frame_dotted: 24, frame_rope: 26, frame_laurel: 26,
  frame_beveled: 22, frame_deco: 28, frame_wave_ribbon: 24,
};
const FRAME_PADDING: Record<string, number> = {
  frame_band_zigzag: 54, frame_guilloche: 60, frame_filigree: 46,
  frame_geometric: 48, frame_medallion: 60, frame_modern_corners: 46,
  frame_dotted: 42, frame_rope: 46, frame_laurel: 46,
  frame_beveled: 44, frame_deco: 46, frame_wave_ribbon: 46,
};

function frameDataUrl(preset?: string, color?: string, thickness?: number): string | undefined {
  if (!preset || !FRAME_BUILDERS[preset]) return undefined;
  const c = color || FRAME_COLORS[preset] || '#1f2937';
  const t = Math.max(6, Math.min(160, thickness ?? FRAME_THICKNESS[preset] ?? 40));
  return svgToDataUrl(FRAME_BUILDERS[preset](c, t));
}

function resolveBorderCss(cfg?: BorderStyleConfig): {
  borderCss: string; paddingCss: string; radiusCss: string;
  frameUrl?: string; framePadding?: number;
} {
  // `width` doubles as the frame thickness for frame presets.
  const frameUrl = frameDataUrl(cfg?.preset, cfg?.color, cfg?.width);
  if (frameUrl) {
    const pad = cfg?.padding ?? FRAME_PADDING[cfg!.preset!] ?? 40;
    return { borderCss: 'none', paddingCss: `${pad}px`, radiusCss: '0', frameUrl, framePadding: pad };
  }
  if (!cfg || cfg.style === 'none' || cfg.width === 0 || cfg.preset === 'none') {
    return { borderCss: 'none', paddingCss: '8mm', radiusCss: '0' };
  }
  const w = cfg.width ?? 2;
  const s = cfg.style ?? 'solid';
  const c = cfg.color ?? '#111827';
  return { borderCss: `${w}px ${s} ${c}`, paddingCss: `${cfg.padding ?? 8}px`, radiusCss: `${cfg.radius ?? 0}px` };
}

export interface ReportDisplayOptions {
  show_watermark?: boolean;
  watermark_opacity?: number;
  watermark_size?: number;   // px (matches the on-screen preview scale)
  show_student_photo?: boolean;
  photo_frame?: 'none' | 'classic' | 'gold' | 'navy' | 'rounded' | 'circle';
}

export async function renderReportCardHtml(
  card: ReportCardData,
  school: SchoolInfo,
  gradingMethod?: GradingMethodEntry[],
  borderStyle?: BorderStyleConfig,
  display?: ReportDisplayOptions,
): Promise<string> {
  const schoolName = school?.name || 'SCHOOL NAME';
  // Display options (default to the same values as the on-screen preview).
  const showWatermark = display?.show_watermark !== false;
  const wmOpacity = typeof display?.watermark_opacity === 'number' ? display!.watermark_opacity : 0.06;
  const wmSizeMm = Math.round(((typeof display?.watermark_size === 'number' ? display!.watermark_size : 450) / 450) * 140); // 450px ≈ 140mm
  const showStudentPhoto = display?.show_student_photo !== false;
  const photoFrame = display?.photo_frame || 'gold';
  const schoolAddress = [school?.address, school?.city, school?.state, school?.country].filter(Boolean).join(', ');
  const shortName = school?.short_name || schoolName.split(' ').map((w) => w[0]).join('').slice(0, 4).toUpperCase();
  const logo = school?.logo_url;
  const schoolPhone = school?.phone;
  const schoolEmail = school?.email;
  const schoolWebsite = school?.website;
  const gm = gradingMethod?.length ? gradingMethod : GRADING_METHOD;

  // Watermark markup (shared: back cover + results pages). Declared up-front so
  // every page section below can reference it.
  const watermarkHtml = showWatermark
    ? (logo
      ? `<div class="watermark"><img src="${esc(logo)}" alt="" /></div>`
      : `<div class="watermark"><div class="wm-fallback">${esc(shortName)}</div></div>`)
    : '';

  // Digital verification QR code for the grading page.
  // The verify_url is pre-computed by slReportCardService.getReportCard() and
  // contains a unique verification code stored in the DB — each report card
  // generation produces a new code, so every printed copy has a unique QR.
  const verificationBaseUrl = (process.env.REPORT_CARD_VERIFY_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const verifyUrl = card.verify_url
    ? (card.verify_url.startsWith('http')
      ? card.verify_url
      : verificationBaseUrl + card.verify_url)
    : `${verificationBaseUrl}/verify-report-card/missing?s=${card.student_id}&c=${card.class_id}&y=${encodeURIComponent(card.academic_year)}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 200, margin: 1, color: { dark: '#111827', light: '#ffffff' } }).catch(() => '');
  const ys = card.yearly_summary || {};

  // Resolve border style (from settings) for cover-front and cover-back pages
  const bCfg = resolveBorderCss(borderStyle);
  // Decorative frame (front cover ONLY) — a full-page SVG background image.
  const frameUrl = bCfg.frameUrl;
  const framePad = bCfg.framePadding ?? 40;

  // ── PAGE 1: FRONT COVER ──────────────────────────────────────────────────────
  // The frame image fills the whole cover; content sits above it, inset by pad.
  const frameImgHtml = frameUrl ? `<img class="cover-frame" src="${frameUrl}" alt="" aria-hidden="true" />` : '';
  const artContentOpen = frameUrl ? `<div class="art-content" style="position:relative;z-index:1;text-align:center;justify-content:space-between;display:flex;flex-direction:column;height:100%;padding:${framePad}px;box-sizing:border-box;">` : '';
  const artContentClose = frameUrl ? '</div>' : '';
  const page1 = `
  <section class="page cover-front">
    ${frameImgHtml}
    ${artContentOpen}
    <div class="brand">
      ${logo ? `<img class="logo" src="${esc(logo)}" alt="logo" />` : `<div class="logo-fallback">${esc(shortName)}</div>`}
      <h1>${esc(schoolName)}</h1>
      ${schoolAddress ? `<div class="addr">${esc(schoolAddress)}</div>` : ''}
      ${school?.motto ? `<div class="motto">Motto: ${esc(school.motto)}</div>` : ''}
      ${(schoolPhone || schoolEmail || schoolWebsite) ? `<div class="contact">${[schoolPhone, schoolEmail, schoolWebsite].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ')}</div>` : ''}
    </div>
    <div class="rc-badge">Report Card</div>
    ${card.student.class_level ? `<div class="lvl">${esc(card.student.class_level)}</div>` : ''}
    ${showStudentPhoto ? `<div class="photo-wrap pf-${photoFrame}">
      <div class="photo-frame">
        ${(card.student as any).photo_url ? `<img class="photo" src="${esc((card.student as any).photo_url)}" alt="" />` : `<div class="photo ph">No Photo</div>`}
      </div>
      ${photoFrame === 'circle' ? '' : '<div class="photo-cap">Student</div>'}
    </div>` : ''}
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
    ${artContentClose}
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
    ${watermarkHtml}
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
    ${watermarkHtml}
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

  /* ── Front cover (sheet 1 — decorative frame OR line border) ── */
  .cover-front { text-align: center; justify-content: space-between; border: ${frameUrl ? 'none' : bCfg.borderCss}; padding: ${frameUrl ? '0' : '8mm'}; border-radius: ${frameUrl ? '0' : bCfg.radiusCss}; position: relative; }
  .cover-front .cover-frame { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; }
  .cover-front .brand { padding: 3mm 0; }
  .cover-front .logo { width: 32mm; height: 32mm; object-fit: contain; margin: 0 auto; display: block; }
  .cover-front .logo-fallback { width: 32mm; height: 32mm; border-radius: 50%; background: #111827; color: #fff; font-size: 22px; font-weight: 800; display: flex; align-items: center; justify-content: center; margin: 0 auto; }
  .cover-front h1 { font-size: 18px; font-weight: 800; text-transform: uppercase; margin: 4px 0 2px; line-height: 1.15; }
  .cover-front .addr { font-size: 12px; font-weight: 600; color: #4b5563; }
  .cover-front .motto { font-size: 12px; font-style: italic; color: #4b5563; }
  .cover-front .contact { font-size: 11px; color: #6b7280; margin-top: 2px; }
  .cover-front .rc-badge { display: inline-block; background: #111827; color: #fff; font-weight: 700; padding: 4px 14px; font-size: 14px; text-transform: uppercase; margin: 4px 0; }
  .cover-front .lvl { font-size: 13px; font-weight: 700; color: #374151; text-transform: uppercase; }
  /* Framed passport portrait — style varies by .pf-* modifier */
  .cover-front .photo-wrap { position: relative; display: flex; justify-content: center; margin: 6px 0 12px; }
  .cover-front .photo { width: 26mm; height: 34mm; object-fit: cover; display: block; background: #fff; }
  .cover-front .photo.ph { display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f9fafb; color: #9ca3af; font-size: 9px; font-weight: 700; text-transform: uppercase; }
  .cover-front .photo-cap { position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); background: #111827; color: #fff; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 2px 8px; }
  .cover-front .photo-frame { box-shadow: 0 4px 14px rgba(0,0,0,0.18); background: #fff; }
  /* gold: navy gradient + gold inner rule */
  .cover-front .pf-gold .photo-frame { padding: 3px; background: linear-gradient(135deg,#1e3a8a,#3b82f6); }
  .cover-front .pf-gold .photo-frame > * { border: 2px solid #c8a24a; }
  /* classic: thick black */
  .cover-front .pf-classic .photo-frame { padding: 3px; }
  .cover-front .pf-classic .photo-frame > * { border: 3px solid #111827; }
  /* navy: thick navy */
  .cover-front .pf-navy .photo-frame { padding: 3px; }
  .cover-front .pf-navy .photo-frame > * { border: 3px solid #1e3a8a; }
  /* rounded: soft corners + grey ring */
  .cover-front .pf-rounded .photo-frame { padding: 4px; border-radius: 10px; }
  .cover-front .pf-rounded .photo-frame > * { border: 2px solid #cbd5e1; border-radius: 7px; overflow: hidden; }
  .cover-front .pf-rounded .photo { border-radius: 6px; }
  /* circle: round photo + gold ring */
  .cover-front .pf-circle .photo-frame { padding: 3px; border-radius: 50%; }
  .cover-front .pf-circle .photo-frame > * { border: 3px solid #c8a24a; border-radius: 50%; overflow: hidden; }
  .cover-front .pf-circle .photo { width: 32mm; height: 32mm; border-radius: 50%; }
  /* none: plain photo, subtle shadow only */
  .cover-front .pf-none .photo-frame { padding: 0; }
  .cover-front .pupil { border-top: 2px solid #111827; border-bottom: 2px solid #111827; padding: 6px 0; margin: 4px 0; font-size: 13px; }
  .cover-front .prow { display: flex; justify-content: space-between; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; margin-bottom: 4px; }
  .cover-front .prow.last { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
  .cover-front .prow span { font-weight: 700; color: #4b5563; }
  .cover-front .sigrow { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; }
  .cover-front .sigbox { border: 1px dashed #9ca3af; height: 22mm; display: flex; flex-direction: column; justify-content: space-between; padding: 4px; }
  .cover-front .sigbox span { font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; }
  .cover-front .seal { width: 14mm; height: 14mm; border: 2px solid #1e40af; border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center; font-size: 7px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; transform: rotate(-12deg); opacity: .7; }
  .cover-front .sig { font-style: italic; font-family: Georgia, serif; font-weight: 700; color: #1e40af; font-size: 14px; }

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

  /* ── Back cover (sheet 1 — clean, NO decorative frame; has watermark) ── */
  .cover-back { font-size: 14px; line-height: 1.5; border: none; padding: 10mm; border-radius: 0; position: relative; }
  /* Shared watermark (back cover + results pages) — opacity/size from settings */
  .watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: ${wmOpacity}; z-index: 0; pointer-events: none; }
  .watermark img { width: ${wmSizeMm}mm; height: ${wmSizeMm}mm; object-fit: contain; }
  .watermark .wm-fallback { width: ${Math.round(wmSizeMm * 0.5)}mm; height: ${Math.round(wmSizeMm * 0.5)}mm; border-radius: 50%; background: #111827; color: #fff; font-size: 28px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
  /* Results pages: content sits above the watermark */
  .results { position: relative; }
  .results > *:not(.watermark) { position: relative; z-index: 1; }
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

  /* ── Decorative front-cover frame content wrapper ── */
  .art-content { position: relative; z-index: 1; }
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
 * renderTermResultSheetHtml — a single portrait A4 "terminal result sheet" for
 * ONE term (Term 1 / Term 2). WAEC/WASSCE-styled, authentic and official:
 * school header, student meta, a clean subjects table (Test1 · Test2 · Mean ·
 * Grade · Remark · Position), a summary block (total, average, class position,
 * attendance, conduct), class-teacher & principal comment lines, grading key,
 * signatures, and the verification QR. Full year uses the folded booklet
 * instead (Term 3 / promotional).
 */
export async function renderTermResultSheetHtml(
  card: ReportCardData,
  school: SchoolInfo,
  gradingMethod: GradingMethodEntry[] | undefined,
  term: string,
  _borderStyle?: BorderStyleConfig,
  _display?: ReportDisplayOptions,
): Promise<string> {
  const gm = gradingMethod?.length ? gradingMethod : GRADING_METHOD;
  const schoolName = school?.name || 'SCHOOL NAME';
  const schoolAddress = [school?.address, school?.city, school?.state, school?.country].filter(Boolean).join(', ');
  const shortName = school?.short_name || schoolName.split(' ').map((w) => w[0]).join('').slice(0, 4).toUpperCase();
  const logo = school?.logo_url;
  const termLabel = TERM_SHORT[term] || term.replace('_', ' ').toUpperCase();
  const s = card.student || {};
  const sm = card.term_summaries?.[term] || {};

  // Grade + remark for a mean score, from the tenant grading method.
  const gradeFor = (mean: number | null | undefined): { grade: string; remark: string; fail: boolean } => {
    if (mean == null) return { grade: '—', remark: '', fail: false };
    const g = gm.find((x) => mean >= x.min && mean <= x.max) || gm[gm.length - 1];
    // Derive a short letter from the remark's ordering (A1..F9-ish) — use position.
    const idx = gm.indexOf(g);
    const letter = String.fromCharCode(65 + Math.min(idx, 5)); // A..F
    return { grade: letter, remark: g.remark, fail: g.isFail || mean < 50 };
  };

  // Rows: each subject's Test1/Test2/Mean/Grade/Remark/Position for THIS term.
  const rows = (card.subjects || []).map((subj: any, i: number) => {
    const t = subj.terms?.[term] || {};
    const mean = t.mean ?? null;
    const g = gradeFor(mean);
    const fail = g.fail;
    return `<tr>
      <td class="idx">${i + 1}</td>
      <td class="subj">${esc(subj.subject_name)}</td>
      <td>${t.test1 ?? '—'}</td>
      <td>${t.test2 ?? '—'}</td>
      <td class="mean ${fail ? 'fail' : ''}">${mean ?? '—'}</td>
      <td class="${fail ? 'fail' : ''}">${g.grade}</td>
      <td class="rem">${esc(g.remark)}</td>
      <td>${t.rank ? ordinal(t.rank) : '—'}</td>
    </tr>`;
  }).join('');

  // Verification QR — build a data URL server-side (same as the booklet).
  const verificationBaseUrl = (process.env.REPORT_CARD_VERIFY_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const verifyUrl = card.verify_url
    ? (card.verify_url.startsWith('http') ? card.verify_url : verificationBaseUrl + card.verify_url)
    : '';
  const qrDataUrl = verifyUrl
    ? await QRCode.toDataURL(verifyUrl, { width: 200, margin: 1, color: { dark: '#111827', light: '#ffffff' } }).catch(() => '')
    : '';

  const gradeKey = gm.map((g) =>
    `<span class="gk ${g.isFail ? 'fail' : ''}">${esc(g.remark)}: ${g.min}–${g.max}</span>`).join('');

  const attendance = `On Time <b>${sm.on_time ?? 0}</b> &nbsp;·&nbsp; Late <b>${sm.late ?? 0}</b> &nbsp;·&nbsp; Absent <b>${sm.absent ?? 0}</b>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: 'Times New Roman', Georgia, serif; color: #111827; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { width: 210mm; min-height: 297mm; padding: 12mm 12mm 10mm; position: relative; }
  .frame { border: 3px double #1e3a8a; padding: 8mm 8mm 7mm; min-height: 273mm; position: relative; display: flex; flex-direction: column; }
  .spacer { flex: 1 1 auto; min-height: 6mm; }
  /* Header */
  .head { display: flex; align-items: center; gap: 10px; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; }
  .head .logo { width: 22mm; height: 22mm; object-fit: contain; }
  .head .logo-fb { width: 22mm; height: 22mm; border-radius: 50%; background: #1e3a8a; color: #fff; font-weight: 800; font-size: 20px; display: flex; align-items: center; justify-content: center; }
  .head .ht { flex: 1; text-align: center; }
  .head h1 { margin: 0; font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: #1e3a8a; }
  .head .addr { font-size: 11px; color: #374151; margin-top: 2px; }
  .head .motto { font-size: 11px; font-style: italic; color: #6b7280; }
  .title { text-align: center; margin: 16px 0 6px; }
  .title .band { display: inline-block; background: #1e3a8a; color: #fff; font-weight: 700; text-transform: uppercase; font-size: 13px; letter-spacing: 1px; padding: 6px 18px; }
  .title .yr { font-size: 12px; color: #374151; margin-top: 5px; }
  /* Student meta */
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; font-size: 12px; margin: 14px 0; padding: 10px 0; border-top: 1px solid #d1d5db; border-bottom: 1px solid #d1d5db; }
  .meta div { padding: 1px 0; }
  .meta b { display: inline-block; min-width: 92px; color: #374151; }
  /* Subjects table */
  table.res { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
  table.res th, table.res td { border: 1px solid #374151; padding: 7px 5px; text-align: center; }
  table.res th { background: #1e3a8a; color: #fff; font-size: 11px; text-transform: uppercase; }
  table.res td.subj { text-align: left; font-weight: 600; }
  table.res td.idx { width: 22px; color: #6b7280; }
  table.res td.mean { font-weight: 700; }
  table.res td.rem { text-align: left; font-size: 11px; color: #374151; }
  table.res td.fail, table.res td.mean.fail { color: #b91c1c; font-weight: 700; }
  table.res tbody tr:nth-child(even) td { background: #f8fafc; }
  /* Summary */
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px 0; }
  .summary .box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px; text-align: center; }
  .summary .box .v { font-size: 18px; font-weight: 800; color: #1e3a8a; }
  .summary .box .l { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: .5px; }
  .att { font-size: 12px; text-align: center; margin: 4px 0 8px; color: #374151; }
  /* Comments */
  .comments { font-size: 12px; margin-top: 6px; }
  .comments .row { display: flex; gap: 6px; align-items: baseline; margin-bottom: 6px; }
  .comments .row span.lab { font-weight: 700; white-space: nowrap; color: #374151; }
  .comments .row span.val { flex: 1; border-bottom: 1px dotted #6b7280; font-style: italic; padding: 0 4px; min-height: 15px; }
  /* Grade key */
  .key { margin-top: 8px; font-size: 10px; }
  .key .kt { font-weight: 700; text-transform: uppercase; color: #374151; margin-bottom: 3px; }
  .key .gk { display: inline-block; border: 1px solid #d1d5db; border-radius: 10px; padding: 1px 8px; margin: 0 4px 4px 0; }
  .key .gk.fail { color: #b91c1c; border-color: #fca5a5; }
  /* Footer: signatures + QR */
  .foot { display: flex; align-items: flex-end; justify-content: space-between; margin-top: 12px; }
  .sig { text-align: center; font-size: 11px; }
  .sig .line { border-top: 1px solid #374151; width: 42mm; margin: 0 auto 3px; padding-top: 3px; }
  .qr { text-align: center; font-size: 9px; color: #6b7280; }
  .qr img { width: 22mm; height: 22mm; display: block; margin: 0 auto 2px; }
  .note { text-align: center; font-size: 10px; font-style: italic; color: #6b7280; margin-top: 8px; border-top: 1px solid #e5e7eb; padding-top: 5px; }
</style></head>
<body>
  <div class="sheet"><div class="frame">
    <div class="head">
      ${logo ? `<img class="logo" src="${esc(logo)}" alt=""/>` : `<div class="logo-fb">${esc(shortName)}</div>`}
      <div class="ht">
        <h1>${esc(schoolName)}</h1>
        ${schoolAddress ? `<div class="addr">${esc(schoolAddress)}</div>` : ''}
        ${school?.motto ? `<div class="motto">Motto: ${esc(school.motto)}</div>` : ''}
      </div>
      ${logo ? `<div style="width:22mm"></div>` : ''}
    </div>

    <div class="title">
      <span class="band">${esc(termLabel)} Terminal Result</span>
      <div class="yr">Academic Year ${esc(card.academic_year)}</div>
    </div>

    <div class="meta">
      <div><b>Name:</b> ${esc(s.name)}</div>
      <div><b>Admission No:</b> ${esc(s.admission_no)}</div>
      <div><b>Class / Form:</b> ${esc(s.class_name || '—')}</div>
      <div><b>No. in Class:</b> ${esc(s.number_in_form ?? sm.class_size ?? '—')}</div>
      <div><b>Class Teacher:</b> ${esc(s.form_teacher_name || '—')}</div>
      <div><b>Term Position:</b> ${sm.position ? `${ordinal(sm.position)}${sm.class_size ? ` of ${sm.class_size}` : ''}` : '—'}</div>
    </div>

    <table class="res">
      <thead>
        <tr>
          <th>#</th><th style="text-align:left">Subject</th><th>Test 1</th><th>Test 2</th><th>Mean</th><th>Grade</th><th style="text-align:left">Remark</th><th>Pos.</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="8" style="padding:12px;color:#9ca3af">No subject scores recorded for this term.</td></tr>'}</tbody>
    </table>

    <div class="summary">
      <div class="box"><div class="v">${sm.combined_score ?? '—'}</div><div class="l">Total Score</div></div>
      <div class="box"><div class="v">${sm.percentage != null ? `${sm.percentage}%` : '—'}</div><div class="l">Average</div></div>
      <div class="box"><div class="v">${sm.position ? ordinal(sm.position) : '—'}</div><div class="l">Position</div></div>
      <div class="box"><div class="v">${esc(sm.conduct || '—')}</div><div class="l">Conduct</div></div>
    </div>
    <div class="att">Attendance — ${attendance}</div>

    <div class="comments">
      <div class="row"><span class="lab">Class Teacher's Remark:</span><span class="val">${esc(sm.teacher_comment || '')}</span></div>
      <div class="row"><span class="lab">Principal's Remark:</span><span class="val">${esc(card.meta?.principal_comment || '')}</span></div>
    </div>

    <div class="key">
      <div class="kt">Grading Key</div>
      ${gradeKey}
    </div>

    <div class="spacer"></div>

    <div class="foot">
      <div class="sig"><div class="line"></div>Class Teacher's Signature</div>
      <div class="qr">
        ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR"/>` : ''}
        Scan to verify
      </div>
      <div class="sig"><div class="line">${esc(school?.principal_name || '')}</div>Principal's Signature</div>
    </div>

    <div class="note">This is an official single-term result. The complete report booklet is issued at the end of the academic year.</div>
  </div></div>
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
