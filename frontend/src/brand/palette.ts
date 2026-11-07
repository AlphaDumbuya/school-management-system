/**
 * palette: one brand colour in, a full 50 to 900 scale out.
 *
 * The school gives one hex colour. It becomes the "700" shade (the one the app
 * uses for buttons and links; the default WiSkul blue #1D4ED8 is exactly that
 * shade in the old fixed palette). The other shades keep its hue and
 * saturation and move along lightness the way the old blue scale did, so the
 * look stays the same and only the colour changes.
 *
 * Readability: white text sits on the 600 to 900 shades, so a pale colour is
 * darkened until white text on it passes WCAG AA (4.5:1). The result can
 * therefore differ from the colour that was typed; the Settings colour picker
 * shows this as a contrast hint.
 */
export type Shade = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;
export const SHADES: Shade[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
export type Rgb = [number, number, number];

export const DEFAULT_PRIMARY = '#1D4ED8';

const HEX = /^#[0-9a-fA-F]{6}$/;
export const isHexColor = (v: unknown): v is string => typeof v === 'string' && HEX.test(v.trim());

export function hexToRgb(hex: string): Rgb {
  const h = hex.trim().replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const part = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

/** [h 0-360, s 0-1, l 0-1] */
function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb([h, s, l]: [number, number, number]): Rgb {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const hue = (p: number, q: number, t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hn = h / 360;
  return [hue(p, q, hn + 1 / 3) * 255, hue(p, q, hn) * 255, hue(p, q, hn - 1 / 3) * 255];
}

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const luminance = ([r, g, b]: Rgb) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** WCAG contrast ratio between two colours (1 to 21). */
export function contrastRatio(a: Rgb | string, b: Rgb | string): number {
  const la = luminance(typeof a === 'string' ? hexToRgb(a) : a);
  const lb = luminance(typeof b === 'string' ? hexToRgb(b) : b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Text colour that reads on `background`: white or a near-black slate. */
export function readableTextOn(background: string): '#FFFFFF' | '#0F172A' {
  return contrastRatio(background, '#FFFFFF') >= contrastRatio(background, '#0F172A') ? '#FFFFFF' : '#0F172A';
}

/** True when white text passes WCAG AA on this colour. */
export const whiteTextPasses = (hex: string) => contrastRatio(hex, '#FFFFFF') >= 4.5;

/** How far each lighter shade moves from the base lightness toward near-white (0 = base, 1 = white). */
const LIGHTEN: Partial<Record<Shade, number>> = { 50: 0.98, 100: 0.9, 200: 0.76, 300: 0.58, 400: 0.38, 500: 0.24, 600: 0.1 };
/** Darker shades keep this share of the base lightness. */
const DARKEN: Partial<Record<Shade, number>> = { 800: 0.83, 900: 0.69, 950: 0.42 };
const NEAR_WHITE = 0.98;

/** The colour the "700" shade will really be: the typed one, darkened until white text is readable. */
export function effectivePrimary(hex: string): string {
  const base = isHexColor(hex) ? hex.trim() : DEFAULT_PRIMARY;
  const [h, s, l0] = rgbToHsl(hexToRgb(base));
  let l = l0;
  let out = rgbToHex(hslToRgb([h, s, l]));
  let guard = 0;
  while (!whiteTextPasses(out) && l > 0.05 && guard++ < 80) {
    l -= 0.01;
    out = rgbToHex(hslToRgb([h, s, l]));
  }
  return out;
}

/** The full scale, as hex colours. */
export function generatePalette(hex: string): Record<Shade, string> {
  const base = effectivePrimary(hex);
  const [h, s, l] = rgbToHsl(hexToRgb(base));
  const palette = {} as Record<Shade, string>;
  for (const shade of SHADES) {
    let target = l;
    if (shade === 700) target = l;
    else if (LIGHTEN[shade] !== undefined) target = l + (NEAR_WHITE - l) * (LIGHTEN[shade] as number);
    else if (DARKEN[shade] !== undefined) target = l * (DARKEN[shade] as number);
    // Pale tints look washed out at full saturation; ease it off a little.
    // Mid tints are capped so a very saturated colour does not turn neon when lightened.
    const sat = shade <= 200 ? s * 0.9 : shade < 700 ? Math.min(s, 0.85) : s;
    palette[shade] = shade === 700 ? base : rgbToHex(hslToRgb([h, Math.min(1, sat), target]));
  }
  return palette;
}

/** CSS variable values ("r g b") so Tailwind can add alpha: rgb(var(--brand-600) / 0.5). */
export function paletteCssVars(hex: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const palette = generatePalette(hex);
  for (const shade of SHADES) {
    const [r, g, b] = hexToRgb(palette[shade]);
    vars[`--brand-${shade}`] = `${r} ${g} ${b}`;
  }
  // Deep tones for hero panels and gradients: the same hue, much darker.
  const [bh, bs, bl] = rgbToHsl(hexToRgb(palette[700]));
  const deep = (ratio: number) => hexToRgb(rgbToHex(hslToRgb([bh, Math.min(1, bs * 0.85), bl * ratio])));
  const [dr, dg, db] = deep(0.56);
  const [er, eg, eb] = deep(0.48);
  vars['--brand-deep'] = `${dr} ${dg} ${db}`;
  vars['--brand-deeper'] = `${er} ${eg} ${eb}`;
  const [tr, tg, tb] = hexToRgb(readableTextOn(palette[700]));
  vars['--brand-contrast'] = `${tr} ${tg} ${tb}`;
  return vars;
}
