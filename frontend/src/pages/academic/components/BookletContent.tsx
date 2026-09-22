/**
 * BookletContent — the 8-page Sierra Leone report booklet markup.
 *
 * Physical output = 2 A4 sheets, printed double-sided and folded:
 *   Sheet 1 outside: LEFT page 8 | RIGHT page 1
 *   Sheet 1 inside:  LEFT page 2 | RIGHT page 7
 *   Sheet 2 outside: LEFT page 6 | RIGHT page 3
 *   Sheet 2 inside:  LEFT page 4 | RIGHT page 5
 *
 * On screen we render 4 A4-landscape sheets. Sheets 1–3 are divided into left
 * and right halves by a dashed centre line. Sheet 4 (the results spread, pages
 * 4 & 5) is rendered as ONE continuous full-width spread with no centre line —
 * since it is the innermost sheet of the booklet, nothing gets cut at the fold,
 * so the results table flows seamlessly from subject → cognitive → affective →
 * psychomotor → footer.
 *
 * Rendered both in the on-screen preview and in the hidden print portal so the
 * printed output is byte-for-byte identical to what the user sees.
 */

import React, { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import QRCode from 'qrcode';
import {
  ReportCard, SLTerm,
  AFFECTIVE_TRAITS, PSYCHOMOTOR_SKILLS, RATING_LEGEND, SL_GRADING_METHOD, getGradingMethod,
} from '@services/reportCardService';

const TERM_KEYS: SLTerm[] = ['first_term', 'second_term', 'third_term'];
const TERM_SHORT: Record<SLTerm, string> = { first_term: 'TERM 1', second_term: 'TERM 2', third_term: 'TERM 3' };

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
  showGrading?: boolean;
  borderStyle?: ReportCardBorderStyle;
  showWatermark?: boolean;
  watermarkOpacity?: number;
  watermarkSize?: number;
  showStudentPhoto?: boolean;
}

export interface ReportCardBorderStyle {
  color?: string;
  width?: number;
  padding?: number;
  style?: 'solid' | 'double' | 'dashed' | 'dotted' | 'groove' | 'ridge' | 'inset' | 'outset' | 'none';
  radius?: number;
  preset?: string;
}

const DEFAULT_BORDER: Required<ReportCardBorderStyle> = {
  color: '#1f2937', width: 2, padding: 8, style: 'solid', radius: 0, preset: 'classic',
};

const BORDER_PRESETS: Record<NonNullable<ReportCardBorderStyle['preset']>, Required<ReportCardBorderStyle>> = {
  classic:     { color: '#1f2937', width: 2, padding: 8, style: 'solid', radius: 0, preset: 'classic' },
  modern:      { color: '#2563eb', width: 3, padding: 10, style: 'solid', radius: 8, preset: 'modern' },
  minimal:     { color: '#9ca3af', width: 1, padding: 6, style: 'solid', radius: 4, preset: 'minimal' },
  decorative:  { color: '#7c2d12', width: 4, padding: 8, style: 'double', radius: 0, preset: 'decorative' },
  royal:       { color: '#4c1d95', width: 4, padding: 10, style: 'double', radius: 0, preset: 'royal' },
  forest:      { color: '#14532d', width: 3, padding: 8, style: 'solid', radius: 0, preset: 'forest' },
  navy:        { color: '#1e3a8a', width: 3, padding: 8, style: 'solid', radius: 6, preset: 'navy' },
  maroon:      { color: '#7f1d1d', width: 3, padding: 8, style: 'solid', radius: 0, preset: 'maroon' },
  teal:        { color: '#0f766e', width: 2, padding: 8, style: 'solid', radius: 8, preset: 'teal' },
  sunrise:     { color: '#c2410c', width: 3, padding: 8, style: 'solid', radius: 6, preset: 'sunrise' },
  elegant:     { color: '#374151', width: 2, padding: 10, style: 'groove', radius: 0, preset: 'elegant' },
  playful:     { color: '#7c3aed', width: 3, padding: 8, style: 'dashed', radius: 12, preset: 'playful' },
  dashed_blue: { color: '#1d4ed8', width: 2, padding: 8, style: 'dashed', radius: 0, preset: 'dashed_blue' },
  dotted_green:{ color: '#15803d', width: 2, padding: 8, style: 'dotted', radius: 0, preset: 'dotted_green' },
  double_gold:  { color: '#a16207', width: 4, padding: 8, style: 'double', radius: 0, preset: 'double_gold' },
  none:        { color: 'transparent', width: 0, padding: 4, style: 'none', radius: 0, preset: 'none' },
};

function svgPatternUrl(svg: string): string {
  const enc = svg.replace(/"/g, "'").replace(/#/g, '%23').replace(/\n/g, '').replace(/\s{2,}/g, ' ');
  return `url("data:image/svg+xml;utf8,${enc}")`;
}

const ORNAMENTAL_PATTERNS = {
  chain: svgPatternUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='40' height='20' viewBox='0 0 40 20'><g fill='none' stroke='#1f2937' stroke-width='2'><ellipse cx='10' cy='10' rx='8' ry='6'/><ellipse cx='30' cy='10' rx='8' ry='6'/></g></svg>`),
  floral: svgPatternUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='60' height='20' viewBox='0 0 60 20'><g fill='none' stroke='#7c2d12' stroke-width='1.5'><path d='M10 4 Q15 10 10 16 Q5 10 10 4 Z'/><circle cx='30' cy='10' r='3'/><path d='M50 4 Q55 10 50 16 Q45 10 50 4 Z'/><line x1='13' y1='10' x2='27' y2='10'/><line x1='33' y1='10' x2='47' y2='10'/></g></svg>`),
  dots_ornate: svgPatternUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='30' height='14' viewBox='0 0 30 14'><g fill='#a16207'><circle cx='5' cy='7' r='3'/><circle cx='15' cy='7' r='1.5'/><circle cx='25' cy='7' r='3'/></g></svg>`),
  gold_ornate: svgPatternUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='80' height='20' viewBox='0 0 80 20'><g fill='none' stroke='#a16207' stroke-width='1.5'><path d='M5 10 L15 4 L25 10 L35 4 L45 10 L55 4 L65 10 L75 4'/><circle cx='15' cy='4' r='1.5' fill='#a16207'/><circle cx='35' cy='4' r='1.5' fill='#a16207'/><circle cx='55' cy='4' r='1.5' fill='#a16207'/><circle cx='75' cy='4' r='1.5' fill='#a16207'/></g></svg>`),
  zigzag: svgPatternUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='20' height='14' viewBox='0 0 20 14'><polyline fill='none' stroke='#1e3a8a' stroke-width='2' points='0,7 5,2 10,7 15,12 20,7'/></svg>`),
};

interface OrnamentalBorder { pattern: string; verticalPattern: string; thickness: number; bandColor: string; }

const ORNAMENTAL_BORDERS: Record<string, OrnamentalBorder> = {
  'chain_black': { pattern: ORNAMENTAL_PATTERNS.chain, verticalPattern: ORNAMENTAL_PATTERNS.chain, thickness: 20, bandColor: 'rgba(31,41,55,0.06)' },
  'floral_brown': { pattern: ORNAMENTAL_PATTERNS.floral, verticalPattern: ORNAMENTAL_PATTERNS.floral, thickness: 20, bandColor: 'rgba(124,45,18,0.06)' },
  'gold_ornate': { pattern: ORNAMENTAL_PATTERNS.gold_ornate, verticalPattern: ORNAMENTAL_PATTERNS.gold_ornate, thickness: 22, bandColor: 'rgba(161,98,7,0.06)' },
  'dots_gold': { pattern: ORNAMENTAL_PATTERNS.dots_ornate, verticalPattern: ORNAMENTAL_PATTERNS.dots_ornate, thickness: 16, bandColor: 'rgba(161,98,7,0.05)' },
  'zigzag_navy': { pattern: ORNAMENTAL_PATTERNS.zigzag, verticalPattern: ORNAMENTAL_PATTERNS.zigzag, thickness: 14, bandColor: 'rgba(30,58,138,0.05)' },
};

// ── Microsoft Word-style "Art" page borders (like MS Word > Page Borders > Art) ──
interface ArtBorder { pattern: string; thickness: number; color: string; }
const ART_BORDERS: Record<string, ArtBorder> = {
  stars:         { color: '#a16207', thickness: 18, pattern: svgPatternUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='24' height='18' viewBox='0 0 24 18'><path d='M12 2 L14 8 L20 8 L15 12 L17 18 L12 14 L7 18 L9 12 L4 8 L10 8 Z' fill='#a16207' opacity='0.8'/></svg>`) },
  hearts:        { color: '#be123c', thickness: 18, pattern: svgPatternUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='24' height='18' viewBox='0 0 24 18'><path d='M12 16 C12 16 4 11 4 7 C4 4 6 2 8 2 C10 2 12 4 12 6 C12 4 14 2 16 2 C18 2 20 4 20 7 C20 11 12 16 12 16 Z' fill='#be123c' opacity='0.7'/></svg>`) },
  dots:          { color: '#4b5563', thickness: 10, pattern: svgPatternUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='16' height='10' viewBox='0 0 16 10'><circle cx='8' cy='5' r='3' fill='#4b5563'/></svg>`) },
  dash_long:     { color: '#1e3a8a', thickness: 12, pattern: svgPatternUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='12' viewBox='0 0 32 12'><rect x='2' y='4' width='20' height='4' fill='#1e3a8a' rx='1'/></svg>`) },
  triple_line:   { color: '#374151', thickness: 14, pattern: svgPatternUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='14' viewBox='0 0 32 14'><rect x='2' y='2' width='28' height='2' fill='#374151'/><rect x='2' y='6' width='28' height='2' fill='#374151'/><rect x='2' y='10' width='28' height='2' fill='#374151'/></svg>`) },
  wavy:          { color: '#0f766e', thickness: 14, pattern: svgPatternUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='14' viewBox='0 0 32 14'><path d='M0 7 Q8 0 16 7 Q24 14 32 7' fill='none' stroke='#0f766e' stroke-width='2'/></svg>`) },
  diamonds:      { color: '#7c2d12', thickness: 16, pattern: svgPatternUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='20' height='16' viewBox='0 0 20 16'><path d='M10 2 L16 8 L10 14 L4 8 Z' fill='#7c2d12' opacity='0.8'/></svg>`) },
  leaves:        { color: '#14532d', thickness: 18, pattern: svgPatternUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='24' height='18' viewBox='0 0 24 18'><path d='M12 2 C6 6 6 12 12 16 C18 12 18 6 12 2 Z' fill='#14532d' opacity='0.7'/><line x1='12' y1='2' x2='12' y2='16' stroke='#14532d' stroke-width='0.5'/></svg>`) },
  apples:        { color: '#b91c1c', thickness: 18, pattern: svgPatternUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='22' height='18' viewBox='0 0 22 18'><circle cx='11' cy='10' r='6' fill='#b91c1c' opacity='0.7'/><rect x='10' y='2' width='2' height='4' fill='#14532d'/><path d='M13 4 Q16 2 16 4' fill='none' stroke='#14532d' stroke-width='1'/></svg>`) },
  classical_wave:{ color: '#1e3a8a', thickness: 20, pattern: svgPatternUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='40' height='20' viewBox='0 0 40 20'><path d='M0 10 Q5 2 10 10 Q15 18 20 10 Q25 2 30 10 Q35 18 40 10' fill='none' stroke='#1e3a8a' stroke-width='2'/><path d='M0 12 Q5 4 10 12 Q15 20 20 12 Q25 4 30 12 Q35 20 40 12' fill='none' stroke='#1e3a8a' stroke-width='1' opacity='0.5'/></svg>`) },
};

function isArtBorderPreset(preset?: string): boolean {
  return !!preset && preset.startsWith('art_') && ART_BORDERS[preset.slice(4)] !== undefined;
}

export function resolveBorderStyle(cfg?: ReportCardBorderStyle): Required<ReportCardBorderStyle> {
  if (!cfg) return DEFAULT_BORDER;
  const presetBase = cfg.preset && BORDER_PRESETS[cfg.preset] ? BORDER_PRESETS[cfg.preset] : DEFAULT_BORDER;
  return { ...presetBase, ...cfg };
}

export function isOrnamentalBorder(preset?: string): boolean {
  if (!preset) return false;
  const key = preset.startsWith('ornamental_') ? preset.slice('ornamental_'.length) : preset;
  return ORNAMENTAL_BORDERS[key] !== undefined;
}

const OrnamentalSheet: React.FC<{
  border: Required<ReportCardBorderStyle>;
  ornamental: OrnamentalBorder;
  className?: string;
  style?: React.CSSProperties;
  contentClassName?: string;
  contentStyle?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ border, ornamental, className, style, contentClassName, contentStyle, children }) => {
  const t = ornamental.thickness;
  const wrapperStyle: React.CSSProperties = { position: 'relative', padding: 0, borderRadius: `${border.radius}px`, overflow: 'hidden', background: '#ffffff', ...style };
  const verticalBg: React.CSSProperties = { backgroundImage: ornamental.verticalPattern, backgroundRepeat: 'repeat', backgroundSize: '20px 40px', transform: 'rotate(90deg)', transformOrigin: 'center' };
  const horizontalBg: React.CSSProperties = { backgroundImage: ornamental.pattern, backgroundRepeat: 'repeat-x', backgroundSize: '40px 20px' };
  return (
    <div className={className} style={wrapperStyle}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: t, backgroundColor: ornamental.bandColor, ...horizontalBg }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: t, backgroundColor: ornamental.bandColor, ...horizontalBg }} />
      <div style={{ position: 'absolute', top: t, bottom: t, left: 0, width: t, backgroundColor: ornamental.bandColor, ...verticalBg }} />
      <div style={{ position: 'absolute', top: t, bottom: t, right: 0, width: t, backgroundColor: ornamental.bandColor, ...verticalBg }} />
      <div className={contentClassName} style={{ padding: `${t + border.padding}px`, position: 'relative', zIndex: 1, ...contentStyle }}>{children}</div>
    </div>
  );
};

const ArtSheet: React.FC<{
  border: Required<ReportCardBorderStyle>;
  art: ArtBorder;
  className?: string;
  style?: React.CSSProperties;
  contentClassName?: string;
  contentStyle?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ border, art, className, style, contentClassName, contentStyle, children }) => {
  const t = art.thickness;
  const wrapperStyle: React.CSSProperties = { position: 'relative', padding: 0, borderRadius: 0, overflow: 'hidden', background: '#ffffff', ...style };
  const bandBg: React.CSSProperties = { backgroundImage: art.pattern, backgroundRepeat: 'repeat', backgroundSize: '24px 18px' };
  const vBandBg: React.CSSProperties = { backgroundImage: art.pattern, backgroundRepeat: 'repeat', backgroundSize: '24px 18px' };
  return (
    <div className={className} style={wrapperStyle}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: t, ...bandBg }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: t, ...bandBg }} />
      <div style={{ position: 'absolute', top: t, bottom: t, left: 0, width: t, ...vBandBg }} />
      <div style={{ position: 'absolute', top: t, bottom: t, right: 0, width: t, ...vBandBg }} />
      <div className={contentClassName} style={{ padding: `${t + border.padding}px`, position: 'relative', zIndex: 1, ...contentStyle }}>{children}</div>
    </div>
  );
};

export const BookletContent: React.FC<BookletContentProps> = ({
  card, school, schoolName, schoolAddress, schoolLogo, shortName, showCover, showInner,
  showGrading = true, borderStyle, showWatermark = true, watermarkOpacity = 0.06, watermarkSize = 450, showStudentPhoto = true,
}) => {
  useEffect(() => { getGradingMethod(); }, []);

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  useEffect(() => {
    (async () => {
      try {
        // The backend includes a pre-computed verify_url in the report card data,
        // so we just encode it into a QR — no separate API call needed.
        const studentId = card.student.id;
        const classId = card.class_id || '';
        const academicYear = card.academic_year;
        let verifyUrl = card.verify_url || '';

        if (!verifyUrl) {
          // Fallback for preview/old data: build a relative URL
          verifyUrl = `${window.location.origin}/verify-report-card/missing?s=${studentId}&c=${classId}&y=${encodeURIComponent(academicYear)}`;
        }

        const dataUrl = await QRCode.toDataURL(verifyUrl, { width: 200, margin: 1, color: { dark: '#1f2937', light: '#ffffff' }, errorCorrectionLevel: 'M' });
        setQrDataUrl(dataUrl);
      } catch { /* QR generation failed */ }
    })();
  }, [card.student.id, card.class_id, card.academic_year, card.verify_url]);

  const border = resolveBorderStyle(borderStyle);
  const sheetStyle: React.CSSProperties = { border: `${border.width}px ${border.style} ${border.color}`, padding: `${border.padding}px`, borderRadius: `${border.radius}px` };
  if (border.preset === 'none' || border.width === 0 || border.style === 'none') { sheetStyle.border = 'none'; }
  const ornamentalKey = border.preset?.startsWith('ornamental_') ? border.preset.slice('ornamental_'.length) : border.preset;
  const ornamental = ornamentalKey ? ORNAMENTAL_BORDERS[ornamentalKey] : undefined;
  const artKey = border.preset?.startsWith('art_') ? border.preset.slice(4) : null;
  const artBorder = artKey ? ART_BORDERS[artKey] : undefined;

  const PAGE_W = 1404;
  const PAGE_H = 993;
  const commonPageClass = "booklet-sheet bg-white text-gray-900 mx-auto rounded-lg shadow-lg w-full";
  const commonPageStyle: React.CSSProperties = { width: PAGE_W, minHeight: PAGE_H, height: PAGE_H };
  // No-border style for inner sheets
  const noBorderStyle: React.CSSProperties = { border: 'none', padding: 0, borderRadius: 0 };

  // Sheet 1 (cover) — WITH border
  const renderCoverSheet = (key: string, left: React.ReactNode, right: React.ReactNode, extraClass = '') => {
    const inner = (
      <div className={`grid grid-cols-2 divide-x-2 divide-dashed divide-gray-500 w-full h-full`}>
        <div className="relative overflow-hidden">{left}</div>
        <div className="relative overflow-hidden">{right}</div>
      </div>
    );
    if (artBorder) {
      return (
        <ArtSheet key={key} border={border} art={artBorder} className={`${commonPageClass} ${extraClass} relative`} style={commonPageStyle} contentClassName="w-full h-full flex" contentStyle={{ padding: 0 }}>
          {inner}
        </ArtSheet>
      );
    }
    if (ornamental) {
      return (
        <OrnamentalSheet key={key} border={border} ornamental={ornamental} className={`${commonPageClass} ${extraClass} relative`} style={commonPageStyle} contentClassName="w-full h-full flex" contentStyle={{ padding: 0 }}>
          {inner}
        </OrnamentalSheet>
      );
    }
    return (
      <div key={key} className={`${commonPageClass} ${extraClass} relative`} style={{ ...sheetStyle, ...commonPageStyle, display: 'flex' }}>
        {inner}
      </div>
    );
  };

  // Inner sheets (blank, grading, results) — NO border
  const renderSheet = (key: string, left: React.ReactNode, right: React.ReactNode, extraClass = '') => {
    const inner = (
      <div className={`grid grid-cols-2 divide-x-2 divide-dashed divide-gray-500 w-full h-full`}>
        <div className="relative overflow-hidden">{left}</div>
        <div className="relative overflow-hidden">{right}</div>
      </div>
    );
    return (
      <div key={key} className={`${commonPageClass} ${extraClass} relative`} style={{ ...noBorderStyle, ...commonPageStyle, display: 'flex' }}>
        {inner}
      </div>
    );
  };

  // Results spread = ONE continuous full-width sheet, no centre divider, NO border.
  const renderFullSheet = (key: string, content: React.ReactNode, extraClass = '') => {
    return (
      <div key={key} className={`${commonPageClass} ${extraClass} relative`} style={{ ...noBorderStyle, ...commonPageStyle, display: 'flex' }}>
        <div className="w-full h-full relative overflow-hidden">{content}</div>
      </div>
    );
  };

  const backCover = (
    <div className="p-8 flex flex-col text-[14px] leading-relaxed h-full relative">
      {/* Logo watermark */}
      {showWatermark && schoolLogo && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ opacity: watermarkOpacity, zIndex: 0 }}>
          <img src={schoolLogo} alt="" className="object-contain" style={{ width: watermarkSize, height: watermarkSize }} />
        </div>
      )}
      {showWatermark && !schoolLogo && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ opacity: watermarkOpacity, zIndex: 0 }}>
          <div className="rounded-full bg-gray-900 text-white flex items-center justify-center font-extrabold" style={{ width: watermarkSize * 0.6, height: watermarkSize * 0.6, fontSize: watermarkSize * 0.15 }}>{shortName}</div>
        </div>
      )}
      <div className="relative flex flex-col h-full" style={{ zIndex: 1 }}>
      <div className="text-center font-bold text-[16px] border-b-2 border-gray-500 pb-2 mb-2">
        Key: Mn = Average &nbsp;·&nbsp; Rnk = Position
      </div>
      <div className="py-1">
        <p className="font-bold uppercase text-purple-800 border-b border-purple-300 mb-1.5 text-[15px]">Affective</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[14px]">
          {AFFECTIVE_TRAITS.map((t, i) => <div key={t}><b>{i + 1}</b> - {t}</div>)}
        </div>
      </div>
      <div className="py-1">
        <p className="font-bold uppercase text-green-800 border-b border-green-300 mb-1.5 text-[15px]">Psychomotor</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[14px]">
          {PSYCHOMOTOR_SKILLS.map((t, i) => <div key={t}><b>{i + 1}</b> - {t}</div>)}
        </div>
      </div>
      <div className="py-1">
        <p className="font-bold uppercase text-gray-800 border-b border-gray-400 mb-1.5 text-[15px]">Cognitive — Mark / Scores</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[14px]">
          {SL_GRADING_METHOD.map((g) => (<div key={g.letter} className={g.isFail ? 'text-red-700 font-bold' : ''}>{g.remark}: {g.min}–{g.max}</div>))}
        </div>
        <p className="italic text-gray-600 mt-1.5 text-[13px]">Above 50% — reasonable but must maintain effort. Below 50% — improvement needed; discuss with the teacher.</p>
      </div>
      <div className="py-1">
        <p className="font-bold uppercase text-gray-800 border-b border-gray-400 mb-1.5 text-[15px]">Affective &amp; Psychomotor Rating</p>
        <div className="grid grid-cols-1 gap-y-1 text-[14px]">
          {RATING_LEGEND.map((r) => <div key={r.value}><b>{r.value}</b> - {r.label}</div>)}
        </div>
      </div>
      <div className="mt-auto border-2 border-gray-500 rounded p-3">
        <p className="font-bold uppercase mb-1.5 text-[15px]">Note to Parents / Guardian</p>
        <p className="italic text-gray-700 text-[13px] leading-relaxed">This card reports on the whole pupil, not just the academic or the cognitive. Look at it carefully and discuss what you do not understand with the teacher. Keep in constant touch with the school. Encourage your child to be honest, truthful, hardworking, tidy, considerate of others and disciplined.</p>
      </div>
      </div>
    </div>
  );

  const frontCover = (
    <div className="p-6 flex flex-col justify-between text-center h-full overflow-hidden">
      <div className="space-y-2">
        <div className="flex items-center justify-center">
          {schoolLogo ? (<img src={schoolLogo} alt="School logo" className="w-28 h-28 object-contain" />) : (<div className="w-28 h-28 rounded-full bg-gray-900 text-white flex items-center justify-center text-3xl font-extrabold shadow">{shortName}</div>)}
        </div>
        <h1 className="text-2xl font-extrabold uppercase tracking-wide leading-tight text-gray-900">{schoolName}</h1>
        {schoolAddress && <p className="text-[14px] font-semibold text-gray-600">{schoolAddress}</p>}
        {school?.motto && <p className="text-[14px] italic font-semibold text-gray-600">Motto: {school.motto}</p>}
        {(school?.phone || school?.email || school?.website) && (
          <p className="text-[12px] text-gray-500">
            {[school?.phone, school?.email, school?.website].filter(Boolean).join(' · ')}
          </p>
        )}
        <div className="inline-block bg-gray-900 text-white font-bold px-5 py-1.5 text-[15px] uppercase tracking-wider">Report Card</div>
        {card.student.class_level && <p className="text-[14px] font-bold text-gray-700 uppercase">{card.student.class_level}</p>}
      </div>
      {showStudentPhoto && (
        <div className="flex justify-center">
          {card.student.photo_url ? (<img src={card.student.photo_url} alt={`${card.student.name} photo`} className="w-24 h-32 object-cover border-4 border-gray-900 shadow-lg" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />) : (<div className="w-24 h-32 border-4 border-gray-900 shadow-lg flex flex-col items-center justify-center bg-gray-50 text-gray-400"><ImageIcon size={32} /><span className="text-[11px] uppercase font-semibold mt-1">No Photo</span></div>)}
        </div>
      )}
      <div className="w-full space-y-2 text-[15px] border-t-2 border-b-2 border-gray-900 py-3 my-1">
        <div className="flex justify-between border-b border-gray-300 pb-1.5"><span className="font-bold text-gray-600">Name of pupil:</span><span className="font-bold">{card.student.name}</span></div>
        <div className="flex justify-between border-b border-gray-300 pb-1.5"><span className="font-bold text-gray-600">Admission No:</span><span className="font-bold">{card.student.admission_no}</span></div>
        <div className="flex justify-between border-b border-gray-300 pb-1.5"><span className="font-bold text-gray-600">Class / Form:</span><span className="font-bold">{card.student.class_name || '—'}</span></div>
        <div className="flex justify-between"><span className="font-bold text-gray-600">Academic Year:</span><span className="font-bold">{card.academic_year}</span></div>
      </div>
      <div className="grid grid-cols-2 gap-4 w-full text-[14px]">
        <div className="border-2 border-dashed border-gray-400 h-28 flex flex-col justify-between p-2">
          <span className="text-[12px] font-bold text-gray-500 uppercase">Official Stamp</span>
          <div className="w-16 h-16 border-2 border-blue-900 rounded-full flex items-center justify-center text-[10px] font-bold text-blue-900 mx-auto transform -rotate-12 opacity-70">{shortName}<br/>SEAL</div>
        </div>
        <div className="border-2 border-dashed border-gray-400 h-28 flex flex-col justify-between p-2">
          <span className="text-[12px] font-bold text-gray-500 uppercase">Principal's Signature</span>
          {school?.principal_name && <span className="italic font-bold font-serif text-lg text-blue-900/40 text-center">{school.principal_name}</span>}
          <div className="border-b border-gray-500 pb-0.5"><span className="text-[11px] text-gray-500 uppercase">Date:</span></div>
        </div>
      </div>
    </div>
  );

  const blankPage = <div className="w-full h-full" />;

  const conductCodes = [
    { code: 'V.G', meaning: 'Very Good' },
    { code: 'G', meaning: 'Good' },
    { code: 'S', meaning: 'Satisfactory' },
    { code: 'PT', meaning: 'Play truant must see principal' },
    { code: 'N', meaning: 'Neglected Work' },
    { code: 'Abs', meaning: 'Absent' },
  ];

  const attendanceCodes = [
    { code: 'On Time', meaning: 'Punctual to all sessions' },
    { code: 'Late', meaning: 'Arrived after registration' },
    { code: 'Absent', meaning: 'Not present for the session' },
  ];

  const gradingPage = (
    <div className="p-8 flex flex-col justify-between h-full text-[15px] leading-relaxed">
      {/* ── Method of Grading ── */}
      <div>
        <h3 className="text-center font-extrabold text-[18px] uppercase underline decoration-2 underline-offset-4 pb-1 mb-4">Method of Grading</h3>
        <div className="space-y-2.5">
          {SL_GRADING_METHOD.map((g) => (
            <div key={g.letter} className={`flex items-baseline text-[16px] ${g.isFail ? 'text-red-700 font-bold' : ''}`}>
              <span className="whitespace-nowrap font-medium">{g.remark}</span>
              <span className="flex-1 border-b-2 border-dotted border-gray-500 mx-3 mb-1" />
              <span className="whitespace-nowrap font-bold">{g.isFail ? `Below ${g.max}` : `${g.min} to ${g.max}`}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Conduct ── */}
      <div>
        <h3 className="text-center font-extrabold text-[16px] uppercase underline decoration-2 underline-offset-4 pb-1 mb-3">Conduct</h3>
        <div className="grid grid-cols-2 gap-x-10 gap-y-2">
          {conductCodes.map((c) => (
            <div key={c.code} className="flex items-baseline text-[15px]">
              <span className="whitespace-nowrap font-bold w-12 text-center bg-gray-100 rounded px-1 py-0.5">{c.code}</span>
              <span className="flex-1 border-b border-dotted border-gray-400 mx-2 mb-1" />
              <span className="whitespace-nowrap text-[14px]">{c.meaning}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Attendance ── */}
      <div>
        <h3 className="text-center font-extrabold text-[16px] uppercase underline decoration-2 underline-offset-4 pb-1 mb-3">Attendance</h3>
        <div className="grid grid-cols-3 gap-3">
          {attendanceCodes.map((a) => (
            <div key={a.code} className="border border-gray-300 rounded p-3 text-center">
              <p className="font-bold text-[15px]">{a.code}</p>
              <p className="text-[13px] text-gray-600 leading-tight mt-1">{a.meaning}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Digital Verification + Validity — pinned to bottom ── */}
      <div className="space-y-2">
        <div className="border-2 border-gray-800 rounded-lg p-4 flex items-center gap-4">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Verification QR" className="w-24 h-24 object-contain flex-shrink-0" />
          ) : (
            <div className="w-24 h-24 border border-gray-300 flex items-center justify-center text-[10px] text-gray-400 flex-shrink-0">QR</div>
          )}
          <div className="text-[14px] text-left flex-1">
            <p className="font-extrabold uppercase text-[16px]">Digital Verification System</p>
            <p className="text-gray-700 leading-snug mt-1">Scan with a smartphone to verify this report card online and view the digital copy.</p>
            <div className="flex gap-6 mt-1.5">
              <p className="text-gray-500">Year: <span className="font-bold text-gray-700">{card.academic_year}</span></p>
              <p className="text-gray-500">Status: <span className="text-green-700 font-extrabold">Active</span></p>
            </div>
          </div>
        </div>
        <p className="text-center italic text-[14px] text-gray-700 border-t border-gray-300 pt-2">
          This progress report is not valid unless it is signed by Principal and carries the official school stamp.
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-4">
      {showCover && renderCoverSheet('s1outer', backCover, frontCover)}
      {showCover && showGrading && renderSheet('s2outer', gradingPage, blankPage)}
      {showInner && renderFullSheet('s2inner', <ResultsFullSpread card={card} />)}
    </div>
  );
};

// ── Results FULL spread (pages 4 & 5 combined, no centre divider) ─────────────
// One continuous table: Subject → Cognitive → Affective → Psychomotor, then
// the footer block (attendance, guidance, signatures, promotion).
const ResultsFullSpread: React.FC<{ card: ReportCard }> = ({ card }) => {
  const rowCount = Math.max(card.subjects.length, AFFECTIVE_TRAITS.length, PSYCHOMOTOR_SKILLS.length);
  const aff = card.domain_ratings.affective || {};
  const psy = card.domain_ratings.psychomotor || {};
  return (
    <div className="p-4 flex flex-col h-full text-gray-900 overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-3 gap-2 text-[12px] border-b-2 border-gray-900 pb-2 mb-2 flex-shrink-0">
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

      {/* One continuous table: Subject | Cognitive | Affective | Psychomotor */}
      <div className="flex-1 overflow-hidden">
        <table className="w-full h-full border-collapse text-[11px]" style={{ tableLayout: 'fixed' }}>
          <thead>
            {/* Row 1: section banners */}
            <tr className="text-center font-bold uppercase">
              <th rowSpan={3} className="border border-gray-900 p-0.5 align-bottom text-left" style={{ width: '90px' }}>Subject</th>
              <th colSpan={14} className="border border-gray-900 p-0.5 bg-blue-50">* Cognitive</th>
              <th rowSpan={3} className="border border-gray-900 p-0.5 align-bottom" style={{ width: '14px' }}>#</th>
              <th colSpan={11} className="border border-gray-900 p-0.5 bg-purple-50">* Affective</th>
              <th rowSpan={3} className="border border-gray-900 p-0.5 align-bottom" style={{ width: '14px' }}>#</th>
              <th colSpan={11} className="border border-gray-900 p-0.5 bg-green-50">* Psychomotor</th>
            </tr>
            {/* Row 2: term group headers */}
            <tr className="text-center font-bold text-[10px]">
              {TERM_KEYS.map((t) => <th key={`c${t}`} colSpan={4} className="border border-gray-900 p-0.5 bg-blue-50/60">{TERM_SHORT[t]}</th>)}
              <th colSpan={2} className="border border-gray-900 p-0.5 bg-amber-50">YEARLY</th>
              {['T1', 'T2', 'T3'].map((t) => <th key={`a${t}`} colSpan={3} className="border border-gray-900 p-0.5 bg-purple-50/60">{t}</th>)}
              <th colSpan={2} className="border border-gray-900 p-0.5 bg-amber-50">YEARLY</th>
              {['T1', 'T2', 'T3'].map((t) => <th key={`p${t}`} colSpan={3} className="border border-gray-900 p-0.5 bg-green-50/60">{t}</th>)}
              <th colSpan={2} className="border border-gray-900 p-0.5 bg-amber-50">YEARLY</th>
            </tr>
            {/* Row 3: column sub-headers */}
            <tr className="text-center font-semibold text-[10px]">
              {TERM_KEYS.map((t) => (
                <React.Fragment key={`ch${t}`}>
                  <th className="border border-gray-700 p-0.5">1</th>
                  <th className="border border-gray-700 p-0.5">2</th>
                  <th className="border border-gray-700 p-0.5 bg-blue-100/40">Mn</th>
                  <th className="border border-gray-700 p-0.5">Rnk</th>
                </React.Fragment>
              ))}
              <th className="border border-gray-700 p-0.5 bg-amber-100/40">Mn</th>
              <th className="border border-gray-700 p-0.5">Rnk</th>
              {[0, 1, 2].map((i) => (<React.Fragment key={`ah${i}`}><th className="border border-gray-700 p-0.5">1</th><th className="border border-gray-700 p-0.5">2</th><th className="border border-gray-700 p-0.5 bg-purple-100/40">Mn</th></React.Fragment>))}
              <th className="border border-gray-700 p-0.5 bg-amber-100/40">Mn</th>
              <th className="border border-gray-700 p-0.5">Rnk</th>
              {[0, 1, 2].map((i) => (<React.Fragment key={`ph${i}`}><th className="border border-gray-700 p-0.5">1</th><th className="border border-gray-700 p-0.5">2</th><th className="border border-gray-700 p-0.5 bg-green-100/40">Mn</th></React.Fragment>))}
              <th className="border border-gray-700 p-0.5 bg-amber-100/40">Mn</th>
              <th className="border border-gray-700 p-0.5">Rnk</th>
            </tr>
          </thead>
          <tbody>
            {/* Subject rows: cognitive data + affective/psychomotor ratings aligned by row index */}
            {Array.from({ length: rowCount }).map((_, i) => {
              const subj = card.subjects[i];
              const affTrait = AFFECTIVE_TRAITS[i];
              const psyTrait = PSYCHOMOTOR_SKILLS[i];
              const affR = aff[i + 1] || { terms: {}, yearly_mean: null };
              const psyR = psy[i + 1] || { terms: {}, yearly_mean: null };
              return (
                <tr key={i} className="text-center">
                  {/* Subject name (or blank if more trait rows than subjects) */}
                  <td className="border border-gray-700 p-px text-left font-semibold leading-tight" style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>{subj?.subject_name ?? ''}</td>
                  {/* Cognitive */}
                  {TERM_KEYS.map((t) => {
                    const ts = subj?.terms[t];
                    return (
                      <React.Fragment key={`c${t}`}>
                        <td className="border border-gray-700 p-px">{subj ? <Num v={ts?.test1} /> : ''}</td>
                        <td className="border border-gray-700 p-px">{subj ? <Num v={ts?.test2} /> : ''}</td>
                        <td className="border border-gray-700 p-px bg-blue-50/30">{subj ? <Num v={ts?.mean} bold /> : ''}</td>
                        <td className="border border-gray-700 p-px">{subj ? ordinal(ts?.rank) : ''}</td>
                      </React.Fragment>
                    );
                  })}
                  <td className="border border-gray-700 p-px bg-amber-50/30">{subj ? <Num v={subj.yearly_mean} bold /> : ''}</td>
                  <td className="border border-gray-700 p-px font-bold">{subj ? ordinal(subj.yearly_rank) : ''}</td>
                  {/* Affective */}
                  <td className="border border-gray-700 p-px font-bold bg-purple-50/40">{affTrait ? i + 1 : ''}</td>
                  {TERM_KEYS.map((term, k) => {
                    const cell = affR.terms?.[term];
                    return (<React.Fragment key={`ac${k}`}><td className="border border-gray-700 p-px">{affTrait ? (cell?.r1 ?? '') : ''}</td><td className="border border-gray-700 p-px">{affTrait ? (cell?.r2 ?? '') : ''}</td><td className="border border-gray-700 p-px bg-purple-50/20 font-semibold">{affTrait ? (cell?.mean ?? '') : ''}</td></React.Fragment>);
                  })}
                  <td className="border border-gray-700 p-px bg-amber-50/30 font-bold">{affTrait ? (affR.yearly_mean ?? '') : ''}</td>
                  <td className="border border-gray-700 p-px">{affTrait ? ordinal((affR as any).yearly_rank as any) : ''}</td>
                  {/* Psychomotor */}
                  <td className="border border-gray-700 p-px font-bold bg-green-50/40">{psyTrait ? i + 1 : ''}</td>
                  {TERM_KEYS.map((term, k) => {
                    const cell = psyR.terms?.[term];
                    return (<React.Fragment key={`pc${k}`}><td className="border border-gray-700 p-px">{psyTrait ? (cell?.r1 ?? '') : ''}</td><td className="border border-gray-700 p-px">{psyTrait ? (cell?.r2 ?? '') : ''}</td><td className="border border-gray-700 p-px bg-green-50/20 font-semibold">{psyTrait ? (cell?.mean ?? '') : ''}</td></React.Fragment>);
                  })}
                  <td className="border border-gray-700 p-px bg-amber-50/30 font-bold">{psyTrait ? (psyR.yearly_mean ?? '') : ''}</td>
                  <td className="border border-gray-700 p-px">{psyTrait ? ordinal((psyR as any).yearly_rank as any) : ''}</td>
                </tr>
              );
            })}
            {/* Summary rows: combined scores, percentages, position */}
            {(() => {
              const blankCells = (count: number, amberAt: number[] = []) =>
                Array.from({ length: count }).map((_, j) => (
                  <td key={j} className={`border border-gray-700 p-px ${amberAt.includes(j) ? 'bg-amber-100/40' : ''}`} />
                ));
              const renderSummaryRow = (label: string, termVal: (t: SLTerm) => React.ReactNode, yearlyVal: React.ReactNode, bgClass: string) => (
                <tr className={`text-center font-bold ${bgClass}`}>
                  <td className="border border-gray-900 p-px text-left">{label}</td>
                  {TERM_KEYS.map((t) => (
                    <React.Fragment key={t}>
                      <td className="border border-gray-700 p-px" />
                      <td className="border border-gray-700 p-px" />
                      <td className="border border-gray-700 p-px bg-blue-100/40">{termVal(t)}</td>
                      <td className="border border-gray-700 p-px" />
                    </React.Fragment>
                  ))}
                  <td className="border border-gray-700 p-px bg-amber-100/40">{yearlyVal}</td>
                  {/* Cog blank Rnk */}
                  <td className="border border-gray-700 p-px" />
                  {/* Affective blank: 1 hash + 9 term + 2 yearly = 12 */}
                  {blankCells(12, [10])}
                  {/* Psychomotor blank: 1 hash + 9 term + 2 yearly = 12 */}
                  {blankCells(12, [10])}
                </tr>
              );
              return (
                <>
                  {renderSummaryRow('Comb. Scores',
                    (t) => card.term_summaries[t]?.combined_score ?? '',
                    card.yearly_summary?.combined_score ?? '',
                    'bg-gray-100')}
                  {renderSummaryRow('Percentages',
                    (t) => card.term_summaries[t]?.percentage != null ? `${card.term_summaries[t]?.percentage}%` : '',
                    card.yearly_summary?.percentage != null ? `${card.yearly_summary?.percentage}%` : '',
                    'bg-gray-100')}
                  {renderSummaryRow('Position',
                    (t) => { const sm = card.term_summaries[t]; return sm?.position ? `${ordinal(sm.position)}${sm.class_size ? `/${sm.class_size}` : ''}` : ''; },
                    card.yearly_summary?.position ? `${ordinal(card.yearly_summary.position)}${card.yearly_summary.class_size ? `/${card.yearly_summary.class_size}` : ''}` : '',
                    'bg-gray-200')}
                </>
              );
            })()}
          </tbody>
        </table>
      </div>

      {/* Footer block */}
      <div className="border-t-2 border-gray-900 mt-2 pt-2 grid grid-cols-12 gap-x-4 text-[12px] flex-shrink-0">
        <div className="col-span-7">
          <div className="grid grid-cols-3 gap-x-3">
            {TERM_KEYS.map((t) => {
              const sm = card.term_summaries[t];
              return (
                <div key={t} className="space-y-0.5">
                  <div>On Time: <b>{sm?.on_time ?? 0}</b></div>
                  <div>Late: <b className="text-amber-600">{sm?.late ?? 0}</b></div>
                  <div>Absent: <b className="text-red-600">{sm?.absent ?? 0}</b></div>
                  <div className="pt-1 border-b border-dotted border-gray-500 h-5" />
                  <div className="text-[11px] text-gray-600">Teacher's Sign and Date</div>
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
                <span className="flex-1 border-b border-dotted border-gray-500 italic px-1">{card.term_summaries[t]?.teacher_comment || ''}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="col-span-3 space-y-1 border-l border-gray-300 pl-3">
          <div className="border-b border-dotted border-gray-500 h-5" />
          <div className="text-[11px] text-gray-600">Principal's Signature and date</div>
          <div className="font-bold uppercase text-[11px] pt-1">Terms</div>
          <div className="text-[11px] space-y-0.5">
            <div>Term 1 <span className="border-b border-dotted border-gray-500 inline-block w-20" /></div>
            <div>Term 2 <span className="border-b border-dotted border-gray-500 inline-block w-20" /></div>
            <div>Term 3 <span className="border-b border-dotted border-gray-500 inline-block w-20" /></div>
          </div>
          <div className="pt-1">
            <span className="italic">Principal's End of Year Comments:</span>
            <span className="border-b border-dotted border-gray-500 italic px-1">{card.meta?.principal_comment || ''}</span>
          </div>
          <div className="pt-1 font-bold uppercase text-[12px]">
            Promoted to / to repeat:
            {(() => {
              const auto = card.yearly_summary?.promotion_recommendation;
              const outcome = card.yearly_summary?.outcome;
              const text = card.meta?.promotion_status || auto || '............';
              const cls = outcome === 'fail' ? 'text-red-600' : outcome === 'promoted_effort' ? 'text-amber-600' : outcome === 'promoted' ? 'text-green-700' : '';
              return <span className={`font-extrabold normal-case ml-1 ${cls}`}>{text}</span>;
            })()}
          </div>
          {card.yearly_summary?.percentage != null && (
            <div className="text-[11px] text-gray-500 normal-case">Yearly: {card.yearly_summary.percentage}% · Position {ordinal(card.yearly_summary.position)}/{card.yearly_summary.class_size}</div>
          )}
        </div>
        <div className="col-span-2 space-y-1 border-l border-gray-300 pl-3">
          <div className="border-b border-dotted border-gray-500 h-5" />
          <div className="text-[11px] text-gray-600">Parent's Signature and date</div>
          <div className="font-bold uppercase text-[11px] pt-1">Terms</div>
          <div className="text-[11px] space-y-0.5">
            <div>Term 1 <span className="border-b border-dotted border-gray-500 inline-block w-16" /></div>
            <div>Term 2 <span className="border-b border-dotted border-gray-500 inline-block w-16" /></div>
          </div>
        </div>
      </div>
      <p className="text-[9px] italic text-gray-400 mt-1 flex-shrink-0">*See key at the back.</p>
    </div>
  );
};

export default BookletContent;
