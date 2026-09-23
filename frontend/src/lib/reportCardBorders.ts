/**
 * reportCardBorders — professional, certificate-grade page frames for the
 * report-card FRONT COVER only.
 *
 * Each frame is a SINGLE full-page SVG rectangular frame (proper corners +
 * continuous decorative edges). Because it's one vector image sized to the
 * page, it renders crisp and identical in:
 *   • the on-screen React preview
 *   • the client-side html-to-image → jsPDF export
 *   • the server-side Chromium (Puppeteer) PDF
 *
 * Every frame builder takes an accent `color` AND a `thickness` (band width in
 * viewBox units) so schools can recolour and make any frame thin or bold.
 */

export type BorderKind = 'none' | 'line' | 'frame';

export interface ReportCardBorderStyle {
  preset?: string;
  color?: string;
  /** Line width (line borders) OR frame band thickness (frame borders). */
  width?: number;
  style?: 'solid' | 'double' | 'dashed' | 'dotted' | 'groove' | 'ridge' | 'inset' | 'outset' | 'none';
  padding?: number;
  radius?: number;
}

// ── Simple line borders ──────────────────────────────────────────────────────

export interface LinePreset {
  id: string; name: string; description: string;
  kind: 'line' | 'none';
  color: string; width: number;
  style: NonNullable<ReportCardBorderStyle['style']>;
  padding: number; radius: number;
}

export const LINE_PRESETS: LinePreset[] = [
  { id: 'none',          name: 'No Border',    description: 'Clean, borderless front cover.',        kind: 'none', color: 'transparent', width: 0, style: 'none',   padding: 8,  radius: 0 },
  { id: 'classic',       name: 'Classic Rule', description: 'A single fine ink rule — timeless.',     kind: 'line', color: '#1f2937',     width: 2, style: 'solid',  padding: 10, radius: 0 },
  { id: 'double_navy',   name: 'Double Navy',  description: 'Twin navy rules — formal and crisp.',     kind: 'line', color: '#1e3a8a',     width: 4, style: 'double', padding: 12, radius: 0 },
  { id: 'double_gold',   name: 'Double Gold',  description: 'Twin gold rules — premium and warm.',     kind: 'line', color: '#a16207',     width: 4, style: 'double', padding: 12, radius: 0 },
  { id: 'rounded_slate', name: 'Rounded Slate',description: 'Soft rounded slate frame — modern.',      kind: 'line', color: '#334155',     width: 2, style: 'solid',  padding: 12, radius: 16 },
];

// ── Certificate-grade decorative frames (full-page SVG) ──────────────────────

const VB_W = 1000;
const VB_H = 1400;

export function svgToDataUrl(svg: string): string {
  const compact = svg.replace(/\s{2,}/g, ' ').replace(/>\s+</g, '><').trim();
  const enc = encodeURIComponent(compact).replace(/'/g, '%27').replace(/"/g, '%22');
  return `data:image/svg+xml,${enc}`;
}

/** lighten/darken helper — returns a hex tint of `hex` toward white by `amt` (0..1). */
function tint(hex: string, amt: number): string {
  const m = hex.replace('#', '');
  const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amt);
  const hx = (c: number) => c.toString(16).padStart(2, '0');
  return `#${hx(mix(r))}${hx(mix(g))}${hx(mix(b))}`;
}

// ── 1. Thick colour band with a scalloped/zigzag inner edge (ref image 1) ────
function frameBandZigzag(color: string, t: number): string {
  const band = t;                    // outer solid band width
  const inner = band * 0.5;          // inner light band
  const teeth = 26;                  // number of zigzag teeth per side (approx)
  const light = tint(color, 0.55);
  // Outer solid rect + inner white area; a zigzag ring drawn between them.
  const ix = band + inner, iy = band + inner;
  const iw = VB_W - 2 * ix, ih = VB_H - 2 * iy;
  const step = (VB_W - 2 * band) / teeth;
  // Build a zigzag path around the inner rectangle edge.
  const zig = (): string => {
    const pts: string[] = [];
    const x0 = band, y0 = band, x1 = VB_W - band, y1 = VB_H - band, amp = inner * 0.9;
    // top
    for (let x = x0; x < x1; x += step) { pts.push(`${x},${y0}`); pts.push(`${x + step / 2},${y0 + amp}`); }
    // right
    const vstep = (y1 - y0) / Math.round((y1 - y0) / step);
    for (let y = y0; y < y1; y += vstep) { pts.push(`${x1},${y}`); pts.push(`${x1 - amp},${y + vstep / 2}`); }
    // bottom
    for (let x = x1; x > x0; x -= step) { pts.push(`${x},${y1}`); pts.push(`${x - step / 2},${y1 - amp}`); }
    // left
    for (let y = y1; y > y0; y -= vstep) { pts.push(`${x0},${y}`); pts.push(`${x0 + amp},${y - vstep / 2}`); }
    return pts.join(' ');
  };
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${VB_W} ${VB_H}' preserveAspectRatio='none'>
    <rect x='0' y='0' width='${VB_W}' height='${VB_H}' fill='${color}'/>
    <polygon points='${zig()}' fill='${light}'/>
    <rect x='${ix}' y='${iy}' width='${iw}' height='${ih}' fill='#ffffff'/>
  </svg>`;
}

// ── 2. Guilloché certificate frame with rosette corners (ref images 4, 6, 10) ─
function frameGuilloche(color: string, t: number): string {
  const x = 24, y = 24, w = VB_W - 48, h = VB_H - 48;
  const light = tint(color, 0.35);
  const band = Math.max(30, t);
  // corner rosette (concentric ellipses) — a security-print flourish
  const rosette = (cx: number, cy: number) =>
    `<g transform='translate(${cx} ${cy})' fill='none' stroke='${color}' stroke-width='1'>
      ${Array.from({ length: 6 }).map((_, i) => `<ellipse rx='${10 + i * 4}' ry='${16 + i * 5}' transform='rotate(${i * 30})'/>`).join('')}
      <circle r='4' fill='${color}' stroke='none'/>
    </g>`;
  // repeating wave band along an edge via pattern
  const waveUnit = 60;
  const wave = `<g stroke='${color}' fill='none' stroke-width='1'>
    <path d='M0 ${band / 2} q${waveUnit / 4} -${band / 3} ${waveUnit / 2} 0 q${waveUnit / 4} ${band / 3} ${waveUnit / 2} 0'/>
    <path d='M0 ${band / 2} q${waveUnit / 4} ${band / 3} ${waveUnit / 2} 0 q${waveUnit / 4} -${band / 3} ${waveUnit / 2} 0'/>
    <ellipse cx='${waveUnit / 2}' cy='${band / 2}' rx='${waveUnit / 3}' ry='${band / 4}'/>
  </g>`;
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${VB_W} ${VB_H}' preserveAspectRatio='none'>
    <defs>
      <pattern id='gwave' width='${waveUnit}' height='${band}' patternUnits='userSpaceOnUse'>${wave}</pattern>
    </defs>
    <rect x='${x}' y='${y}' width='${w}' height='${h}' fill='none' stroke='${light}' stroke-width='${band}'/>
    <rect x='${x}' y='${y}' width='${w}' height='${band}' fill='url(#gwave)'/>
    <rect x='${x}' y='${y + h - band}' width='${w}' height='${band}' fill='url(#gwave)'/>
    <rect x='${x + band + 6}' y='${y + band + 6}' width='${w - 2 * band - 12}' height='${h - 2 * band - 12}' fill='none' stroke='${color}' stroke-width='1.5'/>
    ${rosette(x + band / 2, y + band / 2)}${rosette(x + w - band / 2, y + band / 2)}${rosette(x + band / 2, y + h - band / 2)}${rosette(x + w - band / 2, y + h - band / 2)}
  </svg>`;
}

// ── 3. Ornate double-line with filigree corners (ref images 3, 11) ───────────
function frameFiligree(color: string, t: number): string {
  const x = 30, y = 30, w = VB_W - 60, h = VB_H - 60;
  const gap = Math.max(10, t * 0.6);
  const dash = `${t * 0.8} ${t * 0.9}`;
  const corner = (ox: number, oy: number, sx: number, sy: number) =>
    `<g transform='translate(${ox} ${oy}) scale(${sx} ${sy})' fill='none' stroke='${color}' stroke-width='2.4' stroke-linecap='round'>
      <path d='M0 0 h70'/><path d='M0 0 v70'/>
      <path d='M14 14 q46 2 60 -18 q4 24 -24 32 q28 -2 34 -24'/>
      <circle cx='72' cy='16' r='3.5' fill='${color}' stroke='none'/>
      <circle cx='16' cy='72' r='3.5' fill='${color}' stroke='none'/>
    </g>`;
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${VB_W} ${VB_H}' preserveAspectRatio='none'>
    <rect x='${x}' y='${y}' width='${w}' height='${h}' fill='none' stroke='${color}' stroke-width='2'/>
    <rect x='${x + gap}' y='${y + gap}' width='${w - 2 * gap}' height='${h - 2 * gap}' fill='none' stroke='${color}' stroke-width='1.4' stroke-dasharray='${dash}'/>
    ${corner(x, y, 1, 1)}${corner(x + w, y, -1, 1)}${corner(x, y + h, 1, -1)}${corner(x + w, y + h, -1, -1)}
  </svg>`;
}

// ── 4. Greek-key / geometric meander band (ref images 9, 8) ──────────────────
function frameGeometric(color: string, t: number): string {
  const x = 24, y = 24, w = VB_W - 48, h = VB_H - 48;
  const band = Math.max(24, t);
  const unit = band;   // square motif cells
  const motif = `<g stroke='${color}' fill='none' stroke-width='2'>
    <rect x='2' y='2' width='${unit - 4}' height='${band - 4}'/>
    <path d='M${unit / 2} 4 L${unit - 4} ${band / 2} L${unit / 2} ${band - 4} L4 ${band / 2} Z' fill='${color}'/>
  </g>`;
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${VB_W} ${VB_H}' preserveAspectRatio='none'>
    <defs><pattern id='geo' width='${unit}' height='${band}' patternUnits='userSpaceOnUse'>${motif}</pattern></defs>
    <rect x='${x}' y='${y}' width='${w}' height='${h}' fill='none' stroke='${color}' stroke-width='2.5'/>
    <rect x='${x}' y='${y}' width='${w}' height='${band}' fill='url(#geo)'/>
    <rect x='${x}' y='${y + h - band}' width='${w}' height='${band}' fill='url(#geo)'/>
    <rect x='${x}' y='${y}' width='${band}' height='${h}' fill='url(#geo)'/>
    <rect x='${x + w - band}' y='${y}' width='${band}' height='${h}' fill='url(#geo)'/>
    <rect x='${x + band}' y='${y + band}' width='${w - 2 * band}' height='${h - 2 * band}' fill='none' stroke='${color}' stroke-width='1.2'/>
  </svg>`;
}

// ── 5. Regal coin/medallion band on a solid colour field (ref images 8, 5) ───
function frameMedallion(color: string, t: number): string {
  const band = Math.max(60, t * 1.6);
  const gold = tint(color, 0.05) === color ? '#c8a24a' : '#c8a24a';
  const ix = band, iy = band, iw = VB_W - 2 * band, ih = VB_H - 2 * band;
  const unit = band * 0.9;
  const medallion = `<g transform='translate(${unit / 2} ${band / 2})'>
    <circle r='${band * 0.32}' fill='none' stroke='${gold}' stroke-width='3'/>
    <circle r='${band * 0.20}' fill='none' stroke='${gold}' stroke-width='2'/>
    <path d='M0 -${band * 0.28} V${band * 0.28} M-${band * 0.28} 0 H${band * 0.28}' stroke='${gold}' stroke-width='2'/>
  </g>`;
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${VB_W} ${VB_H}' preserveAspectRatio='none'>
    <defs><pattern id='med' width='${unit}' height='${band}' patternUnits='userSpaceOnUse'>${medallion}</pattern></defs>
    <rect x='0' y='0' width='${VB_W}' height='${VB_H}' fill='${color}'/>
    <rect x='0' y='0' width='${VB_W}' height='${band}' fill='url(#med)'/>
    <rect x='0' y='${VB_H - band}' width='${VB_W}' height='${band}' fill='url(#med)'/>
    <rect x='0' y='0' width='${band}' height='${VB_H}' fill='url(#med)'/>
    <rect x='${VB_W - band}' y='0' width='${band}' height='${VB_H}' fill='url(#med)'/>
    <rect x='${ix}' y='${iy}' width='${iw}' height='${ih}' fill='#ffffff'/>
  </svg>`;
}

// ── 6. Modern corner triangles + thin rule (ref image 7 — letterhead) ────────
function frameModernCorners(color: string, t: number): string {
  const x = 20, y = 20, w = VB_W - 40, h = VB_H - 40;
  const tri = Math.max(40, t * 1.4);
  const accent = tint(color, 0.0);
  const dark = color;
  const cornerTri = (cx: number, cy: number, sx: number, sy: number) =>
    `<g transform='translate(${cx} ${cy}) scale(${sx} ${sy})'>
      <path d='M0 0 L${tri} 0 L0 ${tri} Z' fill='${dark}'/>
      <path d='M${tri * 0.35} ${tri * 0.35} L${tri * 1.05} ${tri * 0.35} L${tri * 0.35} ${tri * 1.05} Z' fill='${accent}' opacity='0.85'/>
    </g>`;
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${VB_W} ${VB_H}' preserveAspectRatio='none'>
    <rect x='${x}' y='${y}' width='${w}' height='${h}' fill='none' stroke='${dark}' stroke-width='2.5'/>
    <rect x='${x + 8}' y='${y + 8}' width='${w - 16}' height='${h - 16}' fill='none' stroke='${dark}' stroke-width='1'/>
    ${cornerTri(x, y, 1, 1)}${cornerTri(x + w, y, -1, 1)}${cornerTri(x, y + h, 1, -1)}${cornerTri(x + w, y + h, -1, -1)}
  </svg>`;
}

// ── 7. Dotted rule frame — refined dotted line with corner dots ──────────────
function frameDotted(color: string, t: number): string {
  const x = 28, y = 28, w = VB_W - 56, h = VB_H - 56;
  const r = Math.max(2, t * 0.12);
  const gap = Math.max(10, t * 0.7);
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${VB_W} ${VB_H}' preserveAspectRatio='none'>
    <rect x='${x}' y='${y}' width='${w}' height='${h}' fill='none' stroke='${color}' stroke-width='${Math.max(2, t * 0.18)}' stroke-linecap='round' stroke-dasharray='0.1 ${gap}'/>
    <circle cx='${x}' cy='${y}' r='${r * 1.6}' fill='${color}'/><circle cx='${x + w}' cy='${y}' r='${r * 1.6}' fill='${color}'/>
    <circle cx='${x}' cy='${y + h}' r='${r * 1.6}' fill='${color}'/><circle cx='${x + w}' cy='${y + h}' r='${r * 1.6}' fill='${color}'/>
  </svg>`;
}

// ── 8. Rope / twist band — braided cable frame ───────────────────────────────
function frameRope(color: string, t: number): string {
  const x = 26, y = 26, w = VB_W - 52, h = VB_H - 52, band = Math.max(16, t), unit = band * 1.4;
  const light = tint(color, 0.4);
  const twist = `<g fill='none' stroke-width='${band * 0.22}' stroke-linecap='round'>
    <path d='M0 ${band / 2} q${unit / 4} -${band / 2} ${unit / 2} 0 q${unit / 4} ${band / 2} ${unit / 2} 0' stroke='${color}'/>
    <path d='M0 ${band / 2} q${unit / 4} ${band / 2} ${unit / 2} 0 q${unit / 4} -${band / 2} ${unit / 2} 0' stroke='${light}'/>
  </g>`;
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${VB_W} ${VB_H}' preserveAspectRatio='none'>
    <defs><pattern id='rope' width='${unit}' height='${band}' patternUnits='userSpaceOnUse'>${twist}</pattern></defs>
    <rect x='${x}' y='${y}' width='${w}' height='${band}' fill='url(#rope)'/>
    <rect x='${x}' y='${y + h - band}' width='${w}' height='${band}' fill='url(#rope)'/>
    <rect x='${x}' y='${y}' width='${band}' height='${h}' fill='url(#rope)'/>
    <rect x='${x + w - band}' y='${y}' width='${band}' height='${h}' fill='url(#rope)'/>
    <rect x='${x + band + 4}' y='${y + band + 4}' width='${w - 2 * band - 8}' height='${h - 2 * band - 8}' fill='none' stroke='${color}' stroke-width='1.5'/>
  </svg>`;
}

// ── 9. Laurel / leaf vine band — a botanical certificate frame ───────────────
function frameLaurel(color: string, t: number): string {
  const x = 26, y = 26, w = VB_W - 52, h = VB_H - 52, band = Math.max(18, t), unit = band * 1.2;
  const leaf = `<g fill='${color}'>
    <path d='M${unit * 0.1} ${band / 2} q${unit * 0.2} -${band * 0.4} ${unit * 0.4} 0 q-${unit * 0.2} ${band * 0.15} -${unit * 0.4} 0 Z'/>
    <path d='M${unit * 0.5} ${band / 2} q${unit * 0.2} ${band * 0.4} ${unit * 0.4} 0 q-${unit * 0.2} -${band * 0.15} -${unit * 0.4} 0 Z'/>
  </g><line x1='0' y1='${band / 2}' x2='${unit}' y2='${band / 2}' stroke='${color}' stroke-width='1'/>`;
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${VB_W} ${VB_H}' preserveAspectRatio='none'>
    <defs><pattern id='laurel' width='${unit}' height='${band}' patternUnits='userSpaceOnUse'>${leaf}</pattern></defs>
    <rect x='${x}' y='${y}' width='${w}' height='${band}' fill='url(#laurel)'/>
    <rect x='${x}' y='${y + h - band}' width='${w}' height='${band}' fill='url(#laurel)'/>
    <rect x='${x}' y='${y}' width='${band}' height='${h}' fill='url(#laurel)'/>
    <rect x='${x + w - band}' y='${y}' width='${band}' height='${h}' fill='url(#laurel)'/>
    <rect x='${x + band + 4}' y='${y + band + 4}' width='${w - 2 * band - 8}' height='${h - 2 * band - 8}' fill='none' stroke='${color}' stroke-width='1.2'/>
  </svg>`;
}

// ── 10. Beveled inset frame — engraved groove look ───────────────────────────
function frameBeveled(color: string, t: number): string {
  const x = 24, y = 24, w = VB_W - 48, h = VB_H - 48, band = Math.max(14, t);
  const light = tint(color, 0.5);
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${VB_W} ${VB_H}' preserveAspectRatio='none'>
    <rect x='${x}' y='${y}' width='${w}' height='${h}' fill='none' stroke='${color}' stroke-width='${band}'/>
    <rect x='${x}' y='${y}' width='${w}' height='${h}' fill='none' stroke='${light}' stroke-width='${band * 0.35}'/>
    <rect x='${x + band}' y='${y + band}' width='${w - 2 * band}' height='${h - 2 * band}' fill='none' stroke='${color}' stroke-width='2'/>
  </svg>`;
}

// ── 11. Art-deco chevron band — angular repeating chevrons ───────────────────
function frameDeco(color: string, t: number): string {
  const x = 24, y = 24, w = VB_W - 48, h = VB_H - 48, band = Math.max(20, t), unit = band;
  const chevron = `<path d='M0 ${band} L${unit / 2} 2 L${unit} ${band} L${unit / 2} ${band * 0.5} Z' fill='${color}'/>`;
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${VB_W} ${VB_H}' preserveAspectRatio='none'>
    <defs><pattern id='deco' width='${unit}' height='${band}' patternUnits='userSpaceOnUse'>${chevron}</pattern></defs>
    <rect x='${x}' y='${y}' width='${w}' height='${h}' fill='none' stroke='${color}' stroke-width='3'/>
    <rect x='${x}' y='${y}' width='${w}' height='${band}' fill='url(#deco)'/>
    <rect x='${x}' y='${y + h - band}' width='${w}' height='${band}' fill='url(#deco)'/>
    <rect x='${x + band + 6}' y='${y + band + 6}' width='${w - 2 * band - 12}' height='${h - 2 * band - 12}' fill='none' stroke='${color}' stroke-width='1.2'/>
  </svg>`;
}

// ── 12. Wave ribbon — smooth sine ribbon band ────────────────────────────────
function frameWaveRibbon(color: string, t: number): string {
  const x = 26, y = 26, w = VB_W - 52, h = VB_H - 52, band = Math.max(16, t), unit = band * 2;
  const light = tint(color, 0.45);
  const wave = `<path d='M0 ${band / 2} q${unit / 4} -${band / 2.2} ${unit / 2} 0 t${unit / 2} 0' fill='none' stroke='${color}' stroke-width='${band * 0.28}'/>
    <path d='M0 ${band * 0.72} q${unit / 4} -${band / 2.2} ${unit / 2} 0 t${unit / 2} 0' fill='none' stroke='${light}' stroke-width='${band * 0.2}'/>`;
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${VB_W} ${VB_H}' preserveAspectRatio='none'>
    <defs><pattern id='wr' width='${unit}' height='${band}' patternUnits='userSpaceOnUse'>${wave}</pattern></defs>
    <rect x='${x}' y='${y}' width='${w}' height='${band}' fill='url(#wr)'/>
    <rect x='${x}' y='${y + h - band}' width='${w}' height='${band}' fill='url(#wr)'/>
    <rect x='${x}' y='${y}' width='${band}' height='${h}' fill='url(#wr)'/>
    <rect x='${x + w - band}' y='${y}' width='${band}' height='${h}' fill='url(#wr)'/>
    <rect x='${x + band + 4}' y='${y + band + 4}' width='${w - 2 * band - 8}' height='${h - 2 * band - 8}' fill='none' stroke='${color}' stroke-width='1.4'/>
  </svg>`;
}

export interface FramePreset {
  id: string; name: string; description: string; kind: 'frame';
  color: string;
  /** Default band thickness (viewBox units). */
  thickness: number;
  padding: number;
  build: (color: string, thickness: number) => string;
}

export const FRAME_PRESETS: FramePreset[] = [
  { id: 'frame_band_zigzag',     name: 'Colour Band',      description: 'Bold colour band with a scalloped inner edge — striking and clean.', kind: 'frame', color: '#1d4ed8', thickness: 60, padding: 54, build: frameBandZigzag },
  { id: 'frame_guilloche',       name: 'Guilloché',        description: 'Security-print certificate frame with rosette corners.',              kind: 'frame', color: '#3b82f6', thickness: 46, padding: 60, build: frameGuilloche },
  { id: 'frame_filigree',        name: 'Filigree',         description: 'Ornate double line with filigree corner scrolls.',                    kind: 'frame', color: '#6d28d9', thickness: 20, padding: 46, build: frameFiligree },
  { id: 'frame_geometric',       name: 'Geometric',        description: 'Greek-key / diamond meander band — formal and architectural.',        kind: 'frame', color: '#111827', thickness: 30, padding: 48, build: frameGeometric },
  { id: 'frame_medallion',       name: 'Regal Medallion',  description: 'Coin-medallion band on a solid colour field — regal and premium.',    kind: 'frame', color: '#1e40af', thickness: 48, padding: 60, build: frameMedallion },
  { id: 'frame_modern_corners',  name: 'Modern Corners',   description: 'Thin rule with bold geometric corner accents — contemporary.',        kind: 'frame', color: '#1e293b', thickness: 70, padding: 46, build: frameModernCorners },
  { id: 'frame_dotted',          name: 'Dotted Rule',      description: 'A refined dotted line with accent corner dots — light and elegant.',  kind: 'frame', color: '#334155', thickness: 24, padding: 42, build: frameDotted },
  { id: 'frame_rope',            name: 'Braided Rope',     description: 'A two-tone braided rope band — classic and tactile.',                 kind: 'frame', color: '#a16207', thickness: 26, padding: 46, build: frameRope },
  { id: 'frame_laurel',          name: 'Laurel Vine',      description: 'A botanical laurel-leaf vine band — graduation feel.',                kind: 'frame', color: '#14532d', thickness: 26, padding: 46, build: frameLaurel },
  { id: 'frame_beveled',         name: 'Engraved Bevel',   description: 'A beveled, engraved-groove frame — subtle depth and weight.',         kind: 'frame', color: '#475569', thickness: 22, padding: 44, build: frameBeveled },
  { id: 'frame_deco',            name: 'Art Deco',         description: 'Angular chevron band — bold, geometric, art-deco styling.',           kind: 'frame', color: '#7c2d12', thickness: 28, padding: 46, build: frameDeco },
  { id: 'frame_wave_ribbon',     name: 'Wave Ribbon',      description: 'A smooth two-tone sine-wave ribbon band — flowing and modern.',       kind: 'frame', color: '#0369a1', thickness: 24, padding: 46, build: frameWaveRibbon },
];

// ── Resolution helpers ───────────────────────────────────────────────────────

export const DEFAULT_BORDER: Required<ReportCardBorderStyle> = {
  preset: 'classic', color: '#1f2937', width: 2, style: 'solid', padding: 10, radius: 0,
};

export function getFramePreset(preset?: string): FramePreset | undefined {
  return FRAME_PRESETS.find((f) => f.id === preset);
}
export function getLinePreset(preset?: string): LinePreset | undefined {
  return LINE_PRESETS.find((l) => l.id === preset);
}
export function borderKind(preset?: string): BorderKind {
  if (getFramePreset(preset)) return 'frame';
  const line = getLinePreset(preset);
  if (line?.kind === 'none') return 'none';
  return 'line';
}

/** Thickness bounds for the UI slider (viewBox units) — from very thin to very bold. */
export const FRAME_THICKNESS_RANGE = { min: 6, max: 160 };

export function resolveBorder(cfg?: ReportCardBorderStyle): {
  kind: BorderKind;
  color: string; padding: number;
  width: number; style: NonNullable<ReportCardBorderStyle['style']>; radius: number;
  frameSvg?: string; thickness?: number;
} {
  const preset = cfg?.preset;
  const frame = getFramePreset(preset);
  if (frame) {
    const color = cfg?.color || frame.color;
    const thickness = clamp(cfg?.width ?? frame.thickness, FRAME_THICKNESS_RANGE.min, FRAME_THICKNESS_RANGE.max);
    return {
      kind: 'frame', color,
      padding: cfg?.padding ?? frame.padding,
      width: thickness, style: 'none', radius: 0,
      frameSvg: frame.build(color, thickness), thickness,
    };
  }
  const line = getLinePreset(preset) ?? LINE_PRESETS.find((l) => l.id === 'classic')!;
  if (line.kind === 'none') {
    return { kind: 'none', color: 'transparent', padding: cfg?.padding ?? line.padding, width: 0, style: 'none', radius: 0 };
  }
  return {
    kind: 'line',
    color: cfg?.color || line.color,
    padding: cfg?.padding ?? line.padding,
    width: cfg?.width ?? line.width,
    style: cfg?.style || line.style,
    radius: cfg?.radius ?? line.radius,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
