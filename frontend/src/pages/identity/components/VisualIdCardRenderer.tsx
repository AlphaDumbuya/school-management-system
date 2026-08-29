/**
 * VisualIdCardRenderer — Zone-Based Professional Edition
 * - Zone-based CSS Flexbox layout (no absolute x/y for default rendering)
 * - ISO/IEC 7810 physical dimensions
 * - Front & Back sides for PVC Landscape and Badge Portrait
 * - DraggableEl pattern preserved for edit mode
 * - Font scaling with text-overflow protection
 * - Background patterns, photo shapes, header styles
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { QrCode, GraduationCap, Building2, User as UserIcon } from 'lucide-react';
import { CardFormat, TemplateConfig } from '@services/idCardService';

export interface VisualCardUserData {
  name: string;
  idNumber: string;
  role: string;
  dob?: string;
  departmentOrGrade?: string;
  address?: string;
  phone?: string;
  email?: string;
  issuedAt?: string;
  expiresAt?: string;
  photoUrl?: string;
  schoolName?: string;
  /** Base64 data-URL of the real scannable QR (from the backend). When missing,
   *  QrCodeBlock shows a decorative placeholder. */
  qrImageUrl?: string;
}

export interface VisualIdCardRendererProps {
  config: TemplateConfig;
  format: CardFormat;
  user?: VisualCardUserData;
  logoUrl?: string;
  side?: 'front' | 'back';
  widthPx?: number;
  onClickElement?: (elementKey: string) => void;
  onPositionChange?: (elementKey: string, newX: number, newY: number) => void;
  onSizeChange?: (elementKey: string, newW: number, newH: number) => void;
  showGrid?: boolean;
  selectedElement?: string | null;
  className?: string;
  readonly?: boolean;
}

const DEFAULT_USER: VisualCardUserData = {
  name: 'Morgan Maxwell',
  idNumber: 'ID-2026-9874',
  role: 'Director',
  dob: '15/09/1998',
  departmentOrGrade: 'Grade 12 / Science',
  address: '123 Anywhere St., Any City',
  phone: '+1 234-567-890',
  email: 'm.maxwell@school.edu',
  issuedAt: '01/09/2025',
  expiresAt: '31/08/2027',
  schoolName: 'Ginyard International Co.',
};

const CARD_DIMS = {
  pvc:   { w: 85.60, h: 53.98, r: 3.18 },
  badge: { w: 101.6, h: 152.4, r: 4.00 },
};

function resolveImageUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('http')) return url;
  const base = ((import.meta as any).env?.VITE_API_URL as string || 'http://localhost:5000').replace(/\/api\/?$/, '');
  return `${base}${url.startsWith('/') ? url : `/${url}`}`;
}

const HEXAGON_CLIP = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';

function photoShapeClass(shape: string): string {
  switch (shape) {
    case 'circle':
    case 'rounded': return 'rounded-full';
    case 'arch':    return 'rounded-t-full rounded-b-xl';
    case 'square':  return 'rounded-none';
    case 'hexagon': return '';
    default:        return 'rounded-full';
  }
}

function schoolNameFontSize(text: string, basePx: number): string {
  const len = text.length;
  if (len > 35) return `${Math.max(6, basePx * 0.55)}px`;
  if (len > 22) return `${Math.max(7.5, basePx * 0.72)}px`;
  if (len > 15) return `${Math.max(9, basePx * 0.87)}px`;
  return `${basePx}px`;
}

function buildBgPattern(pattern: string, color: string): string | undefined {
  const c = encodeURIComponent(color);
  switch (pattern) {
    case 'dots':       return `url("data:image/svg+xml,%3Csvg width='12' height='12' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='6' cy='6' r='1.2' fill='${c}' fill-opacity='0.18'/%3E%3C/svg%3E")`;
    case 'crosshatch': return `url("data:image/svg+xml,%3Csvg width='10' height='10' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0L10 10M10 0L0 10' stroke='${c}' stroke-width='0.6' stroke-opacity='0.15'/%3E%3C/svg%3E")`;
    case 'diagonal':   return `url("data:image/svg+xml,%3Csvg width='10' height='10' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10L10 0' stroke='${c}' stroke-width='0.7' stroke-opacity='0.14'/%3E%3C/svg%3E")`;
    case 'grid':       return `url("data:image/svg+xml,%3Csvg width='12' height='12' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 0H0M0 0V12' stroke='${c}' stroke-width='0.5' stroke-opacity='0.15'/%3E%3C/svg%3E")`;
    default:           return undefined;
  }
}

// ── Header components ─────────────────────────────────────────────────────────
// All dimensions are percentage-based so every header scales correctly at any
// rendered card width and for both PVC (landscape) and Badge (portrait) formats.

interface HeaderProps { primary: string; secondary: string; isBack?: boolean; isPortrait: boolean; }

// Helper: % string based on orientation
const hp = (portrait: string, landscape: string, isPortrait: boolean) => isPortrait ? portrait : landscape;

// 1. Curved Wave + bottom arc
function HeaderCurvedWave({ primary, secondary, isBack, isPortrait }: HeaderProps) {
  const op = isBack ? 0.4 : 1;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <svg className="absolute top-0 left-0 w-full" style={{ height: hp('20%','30%', isPortrait) }} viewBox="0 0 500 130" preserveAspectRatio="none">
        <defs><linearGradient id="wg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={primary}/><stop offset="100%" stopColor={secondary||primary} stopOpacity="0.88"/></linearGradient></defs>
        <path d="M0,0 L500,0 L500,85 C360,125 140,125 0,85 Z" fill="url(#wg1)" opacity={op}/>
      </svg>
      <svg className="absolute bottom-0 left-0 w-full" style={{ height: hp('8%','12%', isPortrait) }} viewBox="0 0 500 100" preserveAspectRatio="none">
        <path d="M500,100 L0,100 L0,80 Q250,18 500,58 Z" fill={secondary} opacity="0.12"/>
        <path d="M500,100 L200,100 Q380,38 500,28 Z" fill={primary} opacity="0.70"/>
      </svg>
    </div>
  );
}

// 2. Dual-tone layered wave
function HeaderDualStrip({ primary, secondary, isBack, isPortrait }: HeaderProps) {
  const op = isBack ? 0.5 : 1;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <svg className="absolute top-0 left-0 w-full" style={{ height: hp('22%','32%', isPortrait) }} viewBox="0 0 500 140" preserveAspectRatio="none">
        <path d="M0,0 L500,0 L500,90 C320,140 120,104 0,94 Z" fill={secondary} opacity={op}/>
        <path d="M0,0 L500,0 L500,70 C280,114 80,84 0,74 Z" fill={primary} opacity={op}/>
      </svg>
      <svg className="absolute bottom-0 left-0 w-full" style={{ height: hp('6%','8%', isPortrait) }} viewBox="0 0 500 40" preserveAspectRatio="none">
        <path d="M0,40 L0,20 C120,0 380,40 500,10 L500,40 Z" fill={secondary} opacity={op * 0.5}/>
      </svg>
    </div>
  );
}

// 3. Left vertical sidebar accent
function HeaderSidebarLeft({ primary, secondary, isPortrait, scale, heightPx, schoolName }: HeaderProps & { scale: number; heightPx: number; schoolName: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute top-0 left-0 bottom-0 flex flex-col items-center justify-between shadow-sm"
        style={{ width: hp('13%','15%', isPortrait), backgroundColor: primary, paddingTop: `${scale * 2}px`, paddingBottom: `${scale * 2}px` }}>
        <GraduationCap size={Math.max(10, scale * 3.5)} className="text-white/80 shrink-0"/>
        <div className="text-white/90 font-black uppercase transform -rotate-90 origin-center"
          style={{ width: `${heightPx * 0.58}px`, textAlign: 'center', fontSize: `${Math.max(6, scale * 2.2)}px`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '0.15em' }}>
          {schoolName}
        </div>
        <div className="rounded-full shrink-0" style={{ width: `${Math.max(6, scale * 2)}px`, height: `${Math.max(6, scale * 2)}px`, backgroundColor: secondary || '#F59E0B' }}/>
      </div>
    </div>
  );
}

// 4. Solid top banner with school name + card type
function HeaderTopBanner({ primary, schoolName, cardTitle, isPortrait, scale }: HeaderProps & { schoolName: string; cardTitle: string; scale: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute top-0 left-0 right-0 flex items-center overflow-hidden"
        style={{ height: hp('15%','22%', isPortrait), backgroundColor: primary, paddingInline: `${scale * 2.5}px` }}>
        <div className="w-full flex justify-between items-center text-white gap-2 overflow-hidden">
          <div className="flex items-center gap-1.5 font-bold truncate min-w-0" style={{ fontSize: `${Math.max(6.5, scale * 2.5)}px` }}>
            <Building2 size={Math.max(8, scale * 2.6)} className="shrink-0"/><span className="truncate">{schoolName}</span>
          </div>
          <span className="font-semibold uppercase tracking-wider opacity-80 whitespace-nowrap shrink-0" style={{ fontSize: `${Math.max(5.5, scale * 1.9)}px` }}>{cardTitle}</span>
        </div>
      </div>
    </div>
  );
}

// 5. Arch / drooping-curve frame
function HeaderArchFrame({ primary, secondary, isBack, isPortrait }: HeaderProps) {
  const op = isBack ? 0.4 : 1;
  const topH = hp('15%','21%', isPortrait);
  const archTop = hp('14%','20%', isPortrait);
  const archH  = hp('8%','12%', isPortrait);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute top-0 left-0 right-0" style={{ height: topH, backgroundColor: primary, opacity: op }}/>
      <svg className="absolute left-0 w-full" style={{ top: archTop, height: archH }} viewBox="0 0 500 80" preserveAspectRatio="none">
        <path d="M0,0 L500,0 C350,68 150,68 0,0 Z" fill={primary} opacity={op}/>
      </svg>
      <div className="absolute bottom-0 left-0 right-0" style={{ height: '3px', backgroundColor: secondary }}/>
    </div>
  );
}

// 6. Angled / parallelogram split
function HeaderAngledSplit({ primary, secondary, isBack, isPortrait }: HeaderProps) {
  const op = isBack ? 0.4 : 1;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <svg className="absolute top-0 left-0 w-full" style={{ height: hp('28%','30%', isPortrait) }} viewBox="0 0 500 120" preserveAspectRatio="none">
        <polygon points="0,0 500,0 500,74 0,114" fill={primary} opacity={op}/>
        <polygon points="0,114 500,74 500,90 0,126" fill={secondary} opacity={op}/>
      </svg>
    </div>
  );
}

// 7. Minimal clean — hairline top + bottom bars
function HeaderMinimalClean({ primary, secondary, isPortrait }: HeaderProps) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute top-0 left-0 right-0" style={{ height: hp('3%','4%', isPortrait), backgroundColor: primary }}/>
      <div className="absolute left-0 right-0" style={{ top: hp('3%','4%', isPortrait), height: '0.7%', backgroundColor: secondary, opacity: 0.55 }}/>
      <div className="absolute bottom-0 left-0 right-0" style={{ height: hp('3%','4%', isPortrait), backgroundColor: primary }}/>
      <div className="absolute bottom-0 left-0 right-0" style={{ height: '0.7%', backgroundColor: secondary, opacity: 0.55 }}/>
    </div>
  );
}

// 8. Diagonal gradient fill — top-left to bottom-right polygon
function HeaderGradientDiagonal({ primary, secondary, isBack, isPortrait }: HeaderProps) {
  const op = isBack ? 0.35 : 1;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <svg className="absolute top-0 left-0 w-full" style={{ height: hp('30%','35%', isPortrait) }} viewBox="0 0 500 150" preserveAspectRatio="none">
        <defs><linearGradient id="diagGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={primary}/><stop offset="100%" stopColor={secondary||primary} stopOpacity="0.7"/></linearGradient></defs>
        <polygon points="0,0 500,0 500,80 0,150" fill="url(#diagGrad)" opacity={op}/>
      </svg>
      <div className="absolute bottom-0 left-0 right-0" style={{ height: hp('3%','4%', isPortrait), background: `linear-gradient(90deg,${secondary||primary},${primary})`, opacity: 0.8 }}/>
    </div>
  );
}

// 9. Corner ribbon — colored triangles, properly clipped to card proportions
function HeaderCornerRibbon({ primary, secondary, isBack, isPortrait }: HeaderProps) {
  const op = isBack ? 0.35 : 1;
  // Landscape: 500×200 viewBox (matches ~2.5:1 aspect). Portrait: 500×750
  const vbH = isPortrait ? 750 : 200;
  const tH = isPortrait ? 140 : 56;   // top triangle height
  const bY = isPortrait ? 610 : 144;  // bottom triangle start Y
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <svg className="absolute top-0 left-0 w-full h-full" viewBox={`0 0 500 ${vbH}`} preserveAspectRatio="none">
        {/* top-left triangle */}
        <polygon points={`0,0 260,0 0,${tH}`} fill={primary} opacity={op}/>
        {/* bottom-right triangle */}
        <polygon points={`500,${vbH} 240,${vbH} 500,${bY}`} fill={secondary||primary} opacity={op*0.7}/>
      </svg>
      <div className="absolute top-0 left-0 right-0" style={{ height: hp('1.5%','2%', isPortrait), backgroundColor: primary }}/>
      <div className="absolute bottom-0 left-0 right-0" style={{ height: hp('1.5%','2%', isPortrait), backgroundColor: secondary||primary }}/>
    </div>
  );
}

// 10. Split color — primary left panel, stays behind photo zone only
function HeaderSplitColor({ primary, secondary, isBack, isPortrait }: HeaderProps) {
  const op = isBack ? 0.4 : 1;
  // The panel covers exactly the left ~30% (photo zone) with a clean diagonal cut at ~35%
  // Uses inline style percentages so it scales at every card width
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Solid left band */}
      <div className="absolute top-0 left-0 bottom-0" style={{ width: '30%', backgroundColor: primary, opacity: op }} />
      {/* Diagonal feather at the right edge of the band */}
      <svg className="absolute top-0 bottom-0" style={{ left: '28%', width: '10%', height: '100%' }}
        viewBox="0 0 40 100" preserveAspectRatio="none">
        <polygon points="0,0 40,0 0,100" fill={primary} opacity={op} />
      </svg>
      {/* Top + bottom accent lines */}
      <div className="absolute top-0 left-0 right-0"
        style={{ height: hp('1.5%','2%', isPortrait), background: `linear-gradient(90deg,${secondary||primary},transparent)`, opacity: 0.8 }} />
      <div className="absolute bottom-0 left-0 right-0"
        style={{ height: hp('1.5%','2%', isPortrait), background: `linear-gradient(90deg,${secondary||primary},transparent)`, opacity: 0.8 }} />
    </div>
  );
}

// 11. Rounded band — pill-bottom header
function HeaderRoundedBand({ primary, secondary, isBack, isPortrait }: HeaderProps) {
  const op = isBack ? 0.4 : 1;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute top-0 left-0 right-0" style={{
        height: hp('18%','24%', isPortrait),
        background: `linear-gradient(135deg,${primary} 0%,${secondary||primary} 100%)`,
        opacity: op,
        borderBottomLeftRadius: '50%',
        borderBottomRightRadius: '50%',
      }}/>
      <div className="absolute bottom-0 left-0 right-0" style={{ height: '2.5%', backgroundColor: secondary||primary, opacity: op*0.8 }}/>
    </div>
  );
}

// 12. Wave bottom only — flat top bar + wavy bottom decoration
function HeaderWaveBottom({ primary, secondary, isBack, isPortrait }: HeaderProps) {
  const op = isBack ? 0.4 : 1;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute top-0 left-0 right-0" style={{ height: hp('2%','3%', isPortrait), backgroundColor: primary }}/>
      <svg className="absolute bottom-0 left-0 w-full" style={{ height: hp('18%','22%', isPortrait) }} viewBox="0 0 500 110" preserveAspectRatio="none">
        <defs><linearGradient id="wbGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor={primary}/><stop offset="100%" stopColor={secondary||primary}/></linearGradient></defs>
        <path d="M0,110 L0,62 C80,22 160,92 250,52 C340,12 420,72 500,42 L500,110 Z" fill="url(#wbGrad)" opacity={op}/>
      </svg>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function BarcodeStripes({ idNumber, widthMm, scale }: { idNumber: string; widthMm: number; scale: number }) {
  const widths = [2,1,3,1,4,2,1,3,2,4,1,2,3,1,2,4,1,3,2,1,4,2,3,1,2,3];
  return (
    <div className="bg-white px-1.5 py-1 rounded-md border border-gray-300 shadow-xs flex flex-col items-center"
      style={{ width: `${Math.min(widthMm * 0.7, 55) * scale}px` }}>
      <div className="flex items-center gap-[1.5px]" style={{ height: `${Math.max(10, scale * 5)}px` }}>
        {widths.map((w, i) => <div key={i} className="bg-black h-full" style={{ width: `${w * Math.max(0.8, scale * 0.35)}px` }} />)}
      </div>
      <span className="font-mono font-bold text-black mt-0.5 truncate" style={{ fontSize: `${Math.max(5, scale * 1.8)}px` }}>{idNumber}</span>
    </div>
  );
}

function QrCodeBlock({ sizeMm, scale, label, imageUrl }: { sizeMm: number; scale: number; label?: string; imageUrl?: string }) {
  const sizePx = Math.round(Math.max(18, sizeMm * scale));
  return (
    <div className="bg-white p-1 rounded-lg border border-gray-300 shadow-sm flex flex-col items-center" style={{ width: `${sizePx + 8}px` }}>
      {imageUrl
        ? <img src={imageUrl} alt="QR code" width={sizePx} height={sizePx} style={{ width: `${sizePx}px`, height: `${sizePx}px`, imageRendering: 'pixelated' }} />
        : <QrCode size={sizePx} className="text-gray-900" />}
      {label && <span className="font-mono font-extrabold uppercase text-blue-900 mt-0.5" style={{ fontSize: `${Math.max(5, scale * 1.6)}px` }}>{label}</span>}
    </div>
  );
}

interface DraggableProps {
  elemKey: string; x: number; y: number; scale: number;
  selectedElement?: string | null; onClickElement?: (key: string) => void;
  onPointerDown?: (e: React.PointerEvent, key: string, x: number, y: number) => void;
  readonly?: boolean; children: React.ReactNode; style?: React.CSSProperties; className?: string; ariaLabel?: string;
  // Resize support: when provided (and element is selected) a drag handle is
  // shown at the bottom-right. w/h are the current size in mm.
  onSizeChange?: (key: string, newW: number, newH: number) => void;
  w?: number; h?: number; minW?: number; minH?: number; lockAspect?: boolean;
}
function DraggableEl({ elemKey, x, y, scale, selectedElement, onClickElement, onPointerDown, readonly, children, style, className = '', ariaLabel, onSizeChange, w, h, minW = 6, minH = 6, lockAspect }: DraggableProps) {
  const isSelected = selectedElement === elemKey;
  const interactive = !readonly && (onClickElement || onPointerDown);
  const canResize = !readonly && !!onSizeChange && w != null && h != null;

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = w!;
    const startH = h!;
    const aspect = startH !== 0 ? startW / startH : 1;
    const move = (ev: PointerEvent) => {
      const dxMm = (ev.clientX - startX) / scale;
      const dyMm = (ev.clientY - startY) / scale;
      let newW = Math.max(minW, Math.round((startW + dxMm) * 10) / 10);
      let newH = lockAspect ? Math.max(minH, Math.round((newW / aspect) * 10) / 10) : Math.max(minH, Math.round((startH + dyMm) * 10) / 10);
      onSizeChange!(elemKey, newW, newH);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div role={interactive ? 'button' : undefined} aria-label={ariaLabel || elemKey}
      tabIndex={interactive ? 0 : undefined}
      onPointerDown={interactive && onPointerDown ? (e) => onPointerDown(e, elemKey, x, y) : undefined}
      onClick={interactive && onClickElement ? () => onClickElement(elemKey) : undefined}
      onKeyDown={interactive && onClickElement ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClickElement(elemKey); } : undefined}
      className={['absolute transition-none touch-none', interactive ? 'cursor-grab active:cursor-grabbing' : '',
        isSelected ? 'ring-2 ring-inset ring-amber-400 z-30' : (interactive ? 'hover:ring-1 hover:ring-blue-400/70 z-10' : ''),
        className].join(' ')}
      style={{ left: `${x * scale}px`, top: `${y * scale}px`, touchAction: 'none', ...style }}>
      {children}
      {canResize && isSelected && (
        <div
          role="button"
          aria-label={`Resize ${elemKey}`}
          onPointerDown={startResize}
          onClick={(e) => e.stopPropagation()}
          title="Drag to resize"
          className="absolute -bottom-2 -right-2 w-5 h-5 rounded-full bg-amber-500 border-2 border-white shadow-md cursor-se-resize z-40 touch-none"
          style={{ touchAction: 'none' }}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value, valueColor, scale, fontMult, fontFamily, textColor, fontSizePt }: {
  label: string; value: string; valueColor?: string; scale: number; fontMult: number; fontFamily: string; textColor: string; fontSizePt?: number;
}) {
  // When a per-element font size (pt) is set it OVERRIDES the general size:
  // scale it geometrically only (by `scale`, ~px-per-mm) so it's independent of
  // the card-wide fontMult. Otherwise fall back to the general fontMult sizing.
  const fsPx = (fontSizePt && fontSizePt > 0)
    ? Math.max(5.5, fontSizePt * scale * 0.3528)
    : Math.max(5.5, 9 * fontMult);
  const fs = `${fsPx}px`;
  // Fixed label column width = 7 characters wide at current font size (longest label is "EXPIRES" = 7 chars)
  const labelMinW = `${Math.max(28, 7 * fsPx * 0.62)}px`;
  return (
    <div className="flex items-baseline overflow-hidden" style={{ fontFamily, gap: `${Math.max(3, scale * 1.5)}px` }}>
      <span className="font-bold opacity-65 uppercase tracking-wide whitespace-nowrap shrink-0"
        style={{ color: textColor, fontSize: fs, minWidth: labelMinW }}>{label}</span>
      <span className="font-semibold shrink-0" style={{ color: textColor, fontSize: fs, opacity: 0.65 }}>:</span>
      <span className="font-semibold truncate" style={{ color: valueColor || textColor, fontSize: fs }}>{value}</span>
    </div>
  );
}

function PhotoBlock({ photoUrl, userName, widthPx, heightPx, shapeClass, clipStyle, borderColor, borderWidth }: {
  photoUrl?: string; userName: string; widthPx: number; heightPx: number;
  shapeClass: string; clipStyle: React.CSSProperties; borderColor: string; borderWidth: number;
}) {
  return (
    <div className={`overflow-hidden flex items-center justify-center bg-gray-100 dark:bg-gray-700 shrink-0 ${shapeClass}`}
      style={{ width: `${widthPx}px`, height: `${heightPx}px`, border: `${borderWidth}px solid ${borderColor}`, ...clipStyle }}>
      {photoUrl ? <img src={photoUrl} alt={userName} className="w-full h-full object-cover" /> : <UserIcon size={Math.round(widthPx * 0.38)} className="text-gray-400" />}
    </div>
  );
}

// ── Shared front props type ───────────────────────────────────────────────────

interface FrontSharedProps {
  user: VisualCardUserData; config: TemplateConfig;
  scale: number; cardW: number; cardH: number; fontMult: number;
  primary: string; secondary: string; textColor: string; fontFamily: string;
  photoShapeCls: string; photoClipStyle: React.CSSProperties;
  activeLogoUrl?: string; logoFailed: boolean; onLogoError: () => void;
  vf: Record<string, boolean>;
  selectedElement?: string | null; onClickElement?: (k: string) => void;
  onPointerDown?: (e: React.PointerEvent, k: string, x: number, y: number) => void;
  onSizeChange?: (k: string, w: number, h: number) => void;
  readonly?: boolean; layout: any; sidebarOffset: number;
}

// ── PVC Landscape Front ───────────────────────────────────────────────────────
// Header band → photo+info zone → barcode|QR bottom bar

function FrontContentPVC({ user, config, scale, cardW, cardH, fontMult, primary, secondary, textColor, fontFamily, photoShapeCls, photoClipStyle, activeLogoUrl, logoFailed, onLogoError, vf, selectedElement, onClickElement, onPointerDown, onSizeChange, readonly, layout, sidebarOffset }: FrontSharedProps) {
  const pb = config.photoBorderColor || primary;
  const pbW = config.photoBorderWidth ?? 2;
  const schoolName = config.customSchoolName || user.schoolName || 'SCHOOL NAME';

  const headerStyle       = (config.headerStyle || 'curved-wave') as string;
  const suppressHeader    = headerStyle === 'top-banner';
  const needsHeaderBacking = headerStyle === 'wave-bottom' || headerStyle === 'minimal-clean';

  // Read per-element style overrides from layoutConfig (written by the Style tab)
  const elStyle = (key: string) => (layout as any)[key === 'logo' ? 'logoPositionConfig' : `${key}Position`] || {};
  const elColor = (key: string, def: string) => elStyle(key).color    || def;
  const elBg    = (key: string, def: string) => elStyle(key).bgColor  || def;
  // Per-element font size (pt) OVERRIDES the general size: scale it geometrically
  // (by `scale`) so it's independent of the card-wide fontMult; otherwise use the
  // default size scaled by fontMult.
  const elFs    = (key: string, def: number) => {
    const s = elStyle(key).fontSize;
    return (typeof s === 'number' && s > 0) ? Math.max(5, s * scale * 0.3528) : Math.max(5, def * fontMult);
  };
  const elFf    = (key: string) => elStyle(key).fontFamily || fontFamily;
  const elOp    = (key: string) => elStyle(key).opacity != null ? elStyle(key).opacity / 100 : 1;

  const headerH    = Math.round(cardH * 0.28 * scale);
  const photoPx    = Math.round(22 * scale);
  const photoZoneW = photoPx + Math.round(5 * scale);
  const contentW   = Math.round(cardW * scale) - photoZoneW - Math.round(sidebarOffset * scale) - Math.round(4 * scale);
  const nameFontPx = elFs('name', 13);
  const padPx      = Math.round(2 * scale);

  // Refs for actual-position-based drag (zone layout uses flex, not x/y)
  const cardRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);
  const idRef   = useRef<HTMLDivElement>(null);

  const getPosMm = (ref: React.RefObject<HTMLDivElement>): { x: number; y: number } => {
    if (!ref.current || !cardRef.current) return { x: 0, y: 0 };
    const cr = cardRef.current.getBoundingClientRect();
    const er = ref.current.getBoundingClientRect();
    return { x: parseFloat(((er.left - cr.left) / scale).toFixed(1)), y: parseFloat(((er.top - cr.top) / scale).toFixed(1)) };
  };

  const mkBtn = (key: string, label: string) => ({
    role: (!readonly && onClickElement ? 'button' : undefined) as any,
    'aria-label': label,
    tabIndex: (!readonly && onClickElement ? 0 : undefined) as any,
    onClick: (!readonly && onClickElement ? () => onClickElement(key) : undefined) as any,
    className: [!readonly && onClickElement ? 'cursor-pointer' : '', selectedElement === key ? 'ring-1 ring-inset ring-amber-400 rounded' : ''].join(' '),
  });

  const mkDrag = (key: string, label: string, ref?: React.RefObject<HTMLDivElement>, fallX = 32, fallY = 14) => ({
    ref,
    role: (!readonly && onClickElement ? 'button' : undefined) as any,
    'aria-label': label,
    tabIndex: (!readonly && onClickElement ? 0 : undefined) as any,
    onClick: (!readonly && onClickElement ? () => onClickElement(key) : undefined) as any,
    onPointerDown: (!readonly && onPointerDown ? (e: React.PointerEvent) => {
      const pos = ref ? getPosMm(ref) : { x: fallX, y: fallY };
      onPointerDown(e, key, pos.x, pos.y);
    } : undefined),
    className: [!readonly && onClickElement ? 'cursor-grab active:cursor-grabbing' : '', selectedElement === key ? 'ring-1 ring-inset ring-amber-400' : ''].join(' '),
  });

  // ── Edit mode: render core elements ABSOLUTELY from their layoutConfig x/y
  // (mm) so dragging, snap-align and resizing are truly WYSIWYG and match the
  // printed PDF (which also uses absolute mm). In readonly/preview we keep the
  // original flex zone layout untouched.
  // Absolute layout is used for BOTH editing and readonly/generated cards so the
  // saved template renders exactly as designed (matches the mm-based PDF).
  const editing = true;
  const interactiveEdit = !readonly && !!onPointerDown;
  const posOf = (key: string): { x: number; y: number } | null => {
    const s = elStyle(key);
    if (typeof s.x === 'number' && typeof s.y === 'number') return { x: s.x, y: s.y };
    return null;
  };
  // Absolute wrapper props for a core element.
  const abs = (key: string, fallX: number, fallY: number, size?: { w: number; h: number; lockAspect?: boolean }) => {
    const p = posOf(key) ?? { x: fallX, y: fallY };
    return {
      style: { position: 'absolute' as const, left: `${p.x * scale}px`, top: `${p.y * scale}px`, zIndex: selectedElement === key ? 40 : 25, touchAction: interactiveEdit ? 'none' as const : undefined },
      onPointerDown: interactiveEdit && onPointerDown ? (e: React.PointerEvent) => onPointerDown(e, key, p.x, p.y) : undefined,
      onClick: interactiveEdit && onClickElement ? () => onClickElement(key) : undefined,
      className: interactiveEdit
        ? ['cursor-grab active:cursor-grabbing touch-none', selectedElement === key ? 'ring-2 ring-inset ring-amber-400' : 'hover:ring-1 hover:ring-blue-400/70'].join(' ')
        : '',
      _size: size,
    };
  };
  // A bottom-right resize handle for the currently-selected editable element
  // (touch-friendly: larger hit target + touch-action none).
  const ResizeHandle = ({ elemKey, w, h, minW = 6, minH = 6, lockAspect }: { elemKey: string; w: number; h: number; minW?: number; minH?: number; lockAspect?: boolean }) => {
    if (!onSizeChange || selectedElement !== elemKey) return null;
    const start = (e: React.PointerEvent) => {
      e.preventDefault(); e.stopPropagation();
      const sx = e.clientX, sy = e.clientY, sw = w, sh = h;
      const aspect = sh !== 0 ? sw / sh : 1;
      const mv = (ev: PointerEvent) => {
        const nw = Math.max(minW, Math.round((sw + (ev.clientX - sx) / scale) * 10) / 10);
        const nh = lockAspect ? Math.max(minH, Math.round((nw / aspect) * 10) / 10) : Math.max(minH, Math.round((sh + (ev.clientY - sy) / scale) * 10) / 10);
        onSizeChange!(elemKey, nw, nh);
      };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    };
    return <div role="button" aria-label={`Resize ${elemKey}`} onPointerDown={start} onClick={(e) => e.stopPropagation()} title="Drag to resize"
      style={{ touchAction: 'none' }}
      className="absolute -bottom-2 -right-2 w-5 h-5 rounded-full bg-amber-500 border-2 border-white shadow-md cursor-se-resize z-50 touch-none" />;
  };

  // ── EDIT MODE: absolute, WYSIWYG layout driven by layoutConfig mm coords ──
  if (editing) {
    const photoW = Math.round((layout.photoPosition?.width ?? 20) * scale);
    const photoH = Math.round((layout.photoPosition?.height ?? 25) * scale);
    const qrSize = layout.qrCodePosition?.size ?? 12;
    return (
      <div ref={cardRef} className="absolute inset-0" style={{ paddingLeft: `${sidebarOffset * scale}px` }}>
        {/* Logo */}
        {!suppressHeader && vf.logo && (
          <div {...abs('logo', 4, 4)}>
            {activeLogoUrl && !logoFailed
              ? <img src={resolveImageUrl(activeLogoUrl)} alt="Logo" style={{ height: `${Math.max(14, scale * 6.5)}px`, maxWidth: `${scale * 18}px`, objectFit: 'contain' }} onError={onLogoError} />
              : <div className="rounded-full flex items-center justify-center text-white" style={{ width: `${Math.max(16, scale * 6)}px`, height: `${Math.max(16, scale * 6)}px`, backgroundColor: `${primary}dd` }}><GraduationCap size={Math.max(10, scale * 3.5)} /></div>}
          </div>
        )}
        {/* School name */}
        {!suppressHeader && vf.schoolName && (
          <div {...abs('schoolName', 26, 5)}>
            <span className="font-extrabold tracking-tight drop-shadow-sm block whitespace-nowrap" style={{ color: elColor('schoolName', headerStyle === 'top-banner' ? textColor : '#FFFFFF'), fontSize: (typeof elStyle('schoolName').fontSize === 'number' && elStyle('schoolName').fontSize > 0) ? `${elFs('schoolName', 11)}px` : schoolNameFontSize(schoolName, 11 * fontMult), fontFamily: elFf('schoolName') }}>{schoolName}</span>
          </div>
        )}
        {/* Photo */}
        {(
          <div {...abs('photo', 5, 17)}>
            <PhotoBlock photoUrl={user.photoUrl} userName={user.name} widthPx={photoW} heightPx={photoH} shapeClass={photoShapeCls} clipStyle={photoClipStyle} borderColor={pb} borderWidth={pbW} />
            <ResizeHandle elemKey="photo" w={layout.photoPosition?.width ?? 20} h={layout.photoPosition?.height ?? 25} lockAspect />
          </div>
        )}
        {/* Role */}
        {vf.role && (
          <div {...abs('role', 30, 26)}>
            <span className="inline-block font-extrabold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: elBg('role', primary), color: elColor('role', '#FFFFFF'), fontSize: `${elFs('role', 8)}px`, fontFamily: elFf('role'), opacity: elOp('role') }}>{user.role} IDENTITY CARD</span>
          </div>
        )}
        {/* Name */}
        {vf.name && (
          <div {...abs('name', 30, 18)}>
            <h2 className="font-black leading-snug uppercase tracking-wide whitespace-nowrap" style={{ color: elColor('name', textColor), fontSize: `${nameFontPx}px`, fontFamily: elFf('name'), opacity: elOp('name') }}>{user.name}</h2>
          </div>
        )}
        {/* ID block */}
        <div {...abs('id', 30, 33)}>
          {vf.id && <InfoRow label={config.idLabel || 'ID NO'} value={user.idNumber} scale={scale} fontMult={fontMult} fontFamily={elFf('id')} textColor={elColor('id', textColor)} fontSizePt={elStyle('id').fontSize} />}
          {vf.dob && user.dob && <InfoRow label={config.dobLabel || 'D.O.B'} value={user.dob} scale={scale} fontMult={fontMult} fontFamily={elFf('id')} textColor={elColor('id', textColor)} fontSizePt={elStyle('id').fontSize} />}
          {vf.grade && user.departmentOrGrade && <InfoRow label={config.gradeLabel || 'GRADE'} value={user.departmentOrGrade} scale={scale} fontMult={fontMult} fontFamily={elFf('id')} textColor={elColor('id', textColor)} fontSizePt={elStyle('id').fontSize} />}
          {vf.expiry && user.expiresAt && <InfoRow label={config.expiryLabel || 'EXPIRES'} value={user.expiresAt} valueColor={secondary || '#F59E0B'} scale={scale} fontMult={fontMult} fontFamily={elFf('id')} textColor={elColor('id', textColor)} fontSizePt={elStyle('id').fontSize} />}
        </div>
        {/* Barcode */}
        {config.showBarcode === true && (
          <div {...abs('barcode', 5, 46)}>
            <BarcodeStripes idNumber={user.idNumber} widthMm={cardW * 0.45} scale={scale} />
          </div>
        )}
        {/* QR (front only when single-sided) — small, bottom-right */}
        {config.showQrCode !== false && (config as any).printSides !== 'double' && (
          <div {...abs('qrCode', 71, 36)}>
            <QrCodeBlock sizeMm={qrSize} scale={scale} label="SCAN" imageUrl={user.qrImageUrl} />
            <ResizeHandle elemKey="qrCode" w={qrSize} h={qrSize} minW={8} lockAspect />
          </div>
        )}
        {/* Custom front elements */}
        {(layout.customElements || []).filter((el: any) => !el.side || el.side === 'front').map((el: any) => (
          <DraggableEl key={el.id} elemKey={el.id} x={el.x} y={el.y} scale={scale} selectedElement={selectedElement} onClickElement={onClickElement} onPointerDown={onPointerDown} onSizeChange={onSizeChange} w={el.width ?? 24} h={el.height ?? 10} lockAspect={el.type === 'shape' || el.type === 'photo'} readonly={readonly} ariaLabel={el.label}>
            {el.type === 'badge'
              ? <span className="inline-block font-extrabold uppercase px-2 py-0.5 rounded-full shadow-xs" style={{ backgroundColor: el.bgColor || primary, color: el.color || '#FFFFFF', fontSize: `${(el.fontSize || 9) * fontMult}px`, opacity: el.opacity != null ? el.opacity / 100 : 1 }}>{el.label}</span>
              : <div style={{ color: el.color || textColor, fontSize: `${(el.fontSize || 10) * fontMult}px`, opacity: el.opacity != null ? el.opacity / 100 : 1 }}>{el.sublabel && <span className="font-bold opacity-60 uppercase mr-1">{el.sublabel}:</span>}<span className="font-semibold">{el.label}</span></div>}
          </DraggableEl>
        ))}
      </div>
    );
  }

  return (
    <div ref={cardRef} className="absolute inset-0 flex flex-col" style={{ paddingLeft: `${sidebarOffset * scale}px` }}>
      {/* HEADER — logo left, school name centered on full width */}
      <div className="relative shrink-0 flex items-center justify-center px-2 z-10 overflow-hidden" style={{ height: `${headerH}px` }}>
        {/* Logo — absolute left so school name can truly center */}
        {!suppressHeader && vf.logo && (
          <div {...mkBtn('logo', 'School logo')}
            onPointerDown={!readonly && onPointerDown ? (e: React.PointerEvent) => onPointerDown(e, 'logo', 4, 3.5) : undefined}
            className={['absolute left-2 shrink-0 z-10', !readonly && onClickElement ? 'cursor-grab active:cursor-grabbing' : '', selectedElement === 'logo' ? 'ring-2 ring-inset ring-amber-400' : ''].join(' ')}>
            {activeLogoUrl && !logoFailed
              ? <img src={resolveImageUrl(activeLogoUrl)} alt="Logo"
                  style={{ height: `${Math.max(14, scale * 6.5)}px`, maxWidth: `${scale * 18}px`, objectFit: 'contain', mixBlendMode: 'multiply', background: 'transparent' }}
                  onError={onLogoError} />
              : <div className="rounded-full flex items-center justify-center text-white border border-white/30"
                  style={{ width: `${Math.max(16, scale * 6)}px`, height: `${Math.max(16, scale * 6)}px`, backgroundColor: needsHeaderBacking ? `${primary}dd` : 'rgba(255,255,255,0.2)' }}>
                  <GraduationCap size={Math.max(10, scale * 3.5)} />
                </div>
            }
          </div>
        )}
        {/* School name — centered in full header width */}
        {!suppressHeader && vf.schoolName && (
          <div {...mkBtn('schoolName', 'School name')}
            onPointerDown={!readonly && onPointerDown ? (e: React.PointerEvent) => onPointerDown(e, 'schoolName', 16, 4) : undefined}
            className={['w-full text-center', !readonly && onClickElement ? 'cursor-grab active:cursor-grabbing' : '', selectedElement === 'schoolName' ? 'ring-1 ring-inset ring-amber-400 rounded' : ''].join(' ')}
            style={needsHeaderBacking ? { backgroundColor: `${primary}cc`, borderRadius: `${scale * 1.5}px`, padding: `${Math.max(1, scale * 0.8)}px ${Math.max(2, scale * 1.5)}px` } : {}}>
            <span className="font-extrabold tracking-tight text-white drop-shadow-sm block overflow-hidden text-ellipsis whitespace-nowrap text-center"
              style={{ fontSize: schoolNameFontSize(schoolName, 11 * fontMult), fontFamily }}>{schoolName}</span>
          </div>
        )}
      </div>

      {/* MIDDLE: Photo | Info */}
      <div className="flex flex-1 min-h-0 overflow-visible relative z-20">
        <div className="shrink-0 flex items-center justify-center relative z-20" style={{ width: `${photoZoneW}px`, paddingLeft: `${padPx}px` }}>
          <div role={!readonly && onClickElement ? 'button' : undefined} aria-label="Photo frame"
            tabIndex={!readonly && onClickElement ? 0 : undefined}
            onClick={!readonly && onClickElement ? () => onClickElement('photo') : undefined}
            onPointerDown={!readonly && onPointerDown ? (e) => onPointerDown(e, 'photo', layout.photoPosition?.x ?? 6, layout.photoPosition?.y ?? 12) : undefined}
            className={['relative z-20', !readonly && onClickElement ? 'cursor-grab active:cursor-grabbing' : '', selectedElement === 'photo' ? 'ring-2 ring-inset ring-amber-400' : ''].join(' ')}>
            <PhotoBlock photoUrl={user.photoUrl} userName={user.name} widthPx={photoPx} heightPx={photoPx} shapeClass={photoShapeCls} clipStyle={photoClipStyle} borderColor={pb} borderWidth={pbW} />
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-center gap-0 pr-2 overflow-hidden min-w-0">
          {/* ROLE BADGE first — shows "STUDENT IDENTITY CARD" style */}
          {vf.role && (
            <div {...mkDrag('role', 'Role badge', roleRef)}  ref={roleRef}>
              <span className="inline-block font-extrabold uppercase px-2 py-0.5 rounded-full"
                style={{ backgroundColor: elBg('role', primary), color: elColor('role', '#FFFFFF'), fontSize: `${elFs('role', 8)}px`, fontFamily: elFf('role'), opacity: elOp('role') }}>
                {user.role} IDENTITY CARD
              </span>
            </div>
          )}
          {/* NAME below role */}
          {vf.name && (
            <div {...mkDrag('name', 'Holder name', nameRef)} ref={nameRef} className={['overflow-hidden', !readonly && onClickElement ? 'cursor-grab active:cursor-grabbing' : '', selectedElement === 'name' ? 'ring-1 ring-inset ring-amber-400' : ''].join(' ')}>
              <h2 className="font-black leading-snug uppercase tracking-wide overflow-hidden text-ellipsis whitespace-nowrap"
                style={{ color: elColor('name', textColor), fontSize: `${nameFontPx}px`, fontFamily: elFf('name'), opacity: elOp('name'), maxWidth: `${contentW}px` }}>{user.name}</h2>
            </div>
          )}
          <div className="border-t opacity-15" style={{ borderColor: textColor, margin: `${Math.max(1, scale * 0.8)}px 0` }} />
          <div {...mkDrag('id', 'ID details', idRef)} ref={idRef} className={['overflow-hidden', !readonly && onClickElement ? 'cursor-grab active:cursor-grabbing' : '', selectedElement === 'id' ? 'ring-1 ring-inset ring-amber-400' : ''].join(' ')} style={{ maxWidth: `${contentW}px` }}>
            {vf.id && <InfoRow label={config.idLabel || 'ID NO'} value={user.idNumber} scale={scale} fontMult={fontMult} fontFamily={elFf('id')} textColor={elColor('id', textColor)} fontSizePt={elStyle('id').fontSize} />}
            {vf.dob && user.dob && <InfoRow label={config.dobLabel || 'D.O.B'} value={user.dob} scale={scale} fontMult={fontMult} fontFamily={elFf('id')} textColor={elColor('id', textColor)} fontSizePt={elStyle('id').fontSize} />}
            {vf.grade && user.departmentOrGrade && <InfoRow label={config.gradeLabel || 'GRADE'} value={user.departmentOrGrade} scale={scale} fontMult={fontMult} fontFamily={elFf('id')} textColor={elColor('id', textColor)} fontSizePt={elStyle('id').fontSize} />}
            {vf.expiry && user.expiresAt && <InfoRow label={config.expiryLabel || 'EXPIRES'} value={user.expiresAt} valueColor={secondary || '#F59E0B'} scale={scale} fontMult={fontMult} fontFamily={elFf('id')} textColor={elColor('id', textColor)} fontSizePt={elStyle('id').fontSize} />}
          </div>
        </div>
      </div>

      {/* BOTTOM: Barcode | QR — 7px min bottom gap guaranteed */}
      <div className="shrink-0 flex items-center justify-between px-2 gap-2"
        style={{ paddingBottom: `${Math.max(7, scale * 3.5)}px`, paddingTop: `${Math.max(3, scale * 1.5)}px` }}>
        <div {...mkBtn('barcode', 'Barcode')} className={[!readonly && onClickElement ? 'cursor-pointer' : '', selectedElement === 'barcode' ? 'ring-1 ring-inset ring-amber-400' : ''].join(' ')}>
          {config.showBarcode === true && <BarcodeStripes idNumber={user.idNumber} widthMm={cardW * 0.5} scale={scale} />}
        </div>
        {/* QR only on front when single-sided — double-sided puts it on the back */}
        {config.showQrCode !== false && (config as any).printSides !== 'double' && (
          <div {...mkBtn('qrCode', 'QR code')} className={[!readonly && onClickElement ? 'cursor-pointer' : '', selectedElement === 'qrCode' ? 'ring-1 ring-inset ring-amber-400' : ''].join(' ')}>
            <QrCodeBlock sizeMm={9} scale={scale} label="SCAN" imageUrl={user.qrImageUrl} />
          </div>
        )}
      </div>

      {(layout.customElements || []).filter((el: any) => !el.side || el.side === 'front').map((el: any) => (
        <DraggableEl key={el.id} elemKey={el.id} x={el.x} y={el.y} scale={scale} selectedElement={selectedElement} onClickElement={onClickElement} onPointerDown={onPointerDown} onSizeChange={onSizeChange} w={el.width ?? 24} h={el.height ?? 10} lockAspect={el.type === 'shape' || el.type === 'photo'} readonly={readonly} ariaLabel={el.label}>
          {el.type === 'badge'
            ? <span className="inline-block font-extrabold uppercase px-2 py-0.5 rounded-full shadow-xs" style={{ backgroundColor: el.bgColor || primary, color: el.color || '#FFFFFF', fontSize: `${(el.fontSize || 9) * fontMult}px`, opacity: el.opacity != null ? el.opacity / 100 : 1 }}>{el.label}</span>
            : <div style={{ color: el.color || textColor, fontSize: `${(el.fontSize || 10) * fontMult}px`, opacity: el.opacity != null ? el.opacity / 100 : 1 }}>{el.sublabel && <span className="font-bold opacity-60 uppercase mr-1">{el.sublabel}:</span>}<span className="font-semibold">{el.label}</span></div>}
        </DraggableEl>
      ))}
    </div>
  );
}

// ── Badge Portrait Front ──────────────────────────────────────────────────────
// Professional portrait ID card — matches reference school ID card designs:
//   ① Header ~22%  — logo left, school name large centered
//   ② Photo  ~28%  — large centered circle with thick border
//   ③ Name         — bold uppercase centered
//   ④ Role pill    — "STUDENT IDENTITY CARD" centered
//   ⑤ Info grid   — left-aligned label : value rows
//   ⑥ Bottom      — QR centered, 7px+ from edge

function FrontContentBadge({ user, config, scale, cardW, cardH, fontMult, primary, secondary, textColor, fontFamily, photoShapeCls, photoClipStyle, activeLogoUrl, logoFailed, onLogoError, vf, selectedElement, onClickElement, onPointerDown, onSizeChange, readonly, layout, sidebarOffset }: FrontSharedProps) {
  const pb  = config.photoBorderColor || primary;
  const pbW = config.photoBorderWidth ?? 3;
  const schoolName = config.customSchoolName || user.schoolName || 'SCHOOL NAME';
  const hStyle = (config.headerStyle || 'curved-wave') as string;
  const suppressHeader     = hStyle === 'top-banner';
  const needsHeaderBacking = hStyle === 'wave-bottom' || hStyle === 'minimal-clean';

  const elStyle = (key: string) => (layout as any)[key === 'logo' ? 'logoPositionConfig' : `${key}Position`] || {};
  const elColor = (key: string, def: string) => elStyle(key).color   || def;
  const elBg    = (key: string, def: string) => elStyle(key).bgColor || def;
  // Per-element font size (pt) OVERRIDES the general size (see PVC front notes).
  const elFs    = (key: string, def: number) => {
    const s = elStyle(key).fontSize;
    return (typeof s === 'number' && s > 0) ? Math.max(5, s * scale * 0.3528) : Math.max(5, def * fontMult);
  };
  const elFf    = (key: string) => elStyle(key).fontFamily || fontFamily;
  const elOp    = (key: string) => elStyle(key).opacity != null ? elStyle(key).opacity / 100 : 1;

  const hPad       = Math.round(cardW * 0.05 * scale);
  const hdrH       = Math.round(cardH * 0.22 * scale);
  const photoSz    = Math.round(Math.min(cardW * 0.52, cardH * 0.26) * scale);
  const nameFontPx = Math.max(9, elFs('name', 15));
  const roleFontPx = Math.max(6, elFs('role', 9));

  const cardRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);
  const idRef   = useRef<HTMLDivElement>(null);

  const getPosMm = (ref: React.RefObject<HTMLDivElement>) => {
    if (!ref.current || !cardRef.current) return { x: 0, y: 0 };
    const cr = cardRef.current.getBoundingClientRect();
    const er = ref.current.getBoundingClientRect();
    return { x: parseFloat(((er.left - cr.left) / scale).toFixed(1)), y: parseFloat(((er.top - cr.top) / scale).toFixed(1)) };
  };

  const mkBtn = (key: string, label: string) => ({
    role: (!readonly && onClickElement ? 'button' : undefined) as any,
    'aria-label': label,
    tabIndex: (!readonly && onClickElement ? 0 : undefined) as any,
    onClick: (!readonly && onClickElement ? () => onClickElement(key) : undefined) as any,
  });

  const mkDrag = (key: string, label: string, ref?: React.RefObject<HTMLDivElement>, fallX = 10, fallY = 88) => ({
    ref,
    role: (!readonly && onClickElement ? 'button' : undefined) as any,
    'aria-label': label,
    tabIndex: (!readonly && onClickElement ? 0 : undefined) as any,
    onClick: (!readonly && onClickElement ? () => onClickElement(key) : undefined) as any,
    onPointerDown: (!readonly && onPointerDown ? (e: React.PointerEvent) => {
      const pos = ref ? getPosMm(ref) : { x: fallX, y: fallY };
      onPointerDown(e, key, pos.x, pos.y);
    } : undefined),
    className: [!readonly && onClickElement ? 'cursor-grab active:cursor-grabbing' : '', selectedElement === key ? 'ring-1 ring-inset ring-amber-400' : ''].join(' '),
  });

  // ── Absolute WYSIWYG helpers (portrait) — used for edit AND readonly ───────
  const editing = true;
  const interactiveEdit = !readonly && !!onPointerDown;
  const posOf = (key: string): { x: number; y: number } | null => {
    const s = elStyle(key);
    if (typeof s.x === 'number' && typeof s.y === 'number') return { x: s.x, y: s.y };
    return null;
  };
  const abs = (key: string, fallX: number, fallY: number) => {
    const p = posOf(key) ?? { x: fallX, y: fallY };
    return {
      style: { position: 'absolute' as const, left: `${p.x * scale}px`, top: `${p.y * scale}px`, zIndex: selectedElement === key ? 40 : 25, touchAction: interactiveEdit ? 'none' as const : undefined },
      onPointerDown: interactiveEdit && onPointerDown ? (e: React.PointerEvent) => onPointerDown(e, key, p.x, p.y) : undefined,
      onClick: interactiveEdit && onClickElement ? () => onClickElement(key) : undefined,
      className: interactiveEdit
        ? ['cursor-grab active:cursor-grabbing touch-none', selectedElement === key ? 'ring-2 ring-inset ring-amber-400' : 'hover:ring-1 hover:ring-blue-400/70'].join(' ')
        : '',
    };
  };
  const ResizeHandle = ({ elemKey, w, h, minW = 6, minH = 6, lockAspect }: { elemKey: string; w: number; h: number; minW?: number; minH?: number; lockAspect?: boolean }) => {
    if (!onSizeChange || selectedElement !== elemKey) return null;
    const start = (e: React.PointerEvent) => {
      e.preventDefault(); e.stopPropagation();
      const sx = e.clientX, sy = e.clientY, sw = w, sh = h;
      const aspect = sh !== 0 ? sw / sh : 1;
      const mv = (ev: PointerEvent) => {
        const nw = Math.max(minW, Math.round((sw + (ev.clientX - sx) / scale) * 10) / 10);
        const nh = lockAspect ? Math.max(minH, Math.round((nw / aspect) * 10) / 10) : Math.max(minH, Math.round((sh + (ev.clientY - sy) / scale) * 10) / 10);
        onSizeChange!(elemKey, nw, nh);
      };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    };
    return <div role="button" aria-label={`Resize ${elemKey}`} onPointerDown={start} onClick={(e) => e.stopPropagation()} title="Drag to resize"
      style={{ touchAction: 'none' }}
      className="absolute -bottom-2 -right-2 w-5 h-5 rounded-full bg-amber-500 border-2 border-white shadow-md cursor-se-resize z-50 touch-none" />;
  };

  if (editing) {
    const photoW = Math.round((layout.photoPosition?.width ?? 34) * scale);
    const photoH = Math.round((layout.photoPosition?.height ?? 40) * scale);
    const qrSize = layout.qrCodePosition?.size ?? 18;
    return (
      <div ref={cardRef} className="absolute inset-0 overflow-hidden" style={{ paddingLeft: `${sidebarOffset * scale}px` }}>
        {!suppressHeader && vf.logo && (
          <div {...abs('logo', 6, 6)}>
            {activeLogoUrl && !logoFailed
              ? <img src={resolveImageUrl(activeLogoUrl)} alt="Logo" style={{ height: `${Math.max(20, scale * 10)}px`, maxWidth: `${scale * 22}px`, objectFit: 'contain' }} onError={onLogoError} />
              : <div className="rounded-full flex items-center justify-center text-white" style={{ width: `${Math.max(22, scale * 10)}px`, height: `${Math.max(22, scale * 10)}px`, backgroundColor: `${primary}dd` }}><GraduationCap size={Math.max(13, scale * 5.5)} /></div>}
          </div>
        )}
        {!suppressHeader && vf.schoolName && (
          <div {...abs('schoolName', 22, 8)}>
            <span className="font-black tracking-wide drop-shadow-sm block whitespace-nowrap uppercase" style={{ color: elColor('schoolName', suppressHeader ? textColor : '#FFFFFF'), fontSize: (typeof elStyle('schoolName').fontSize === 'number' && elStyle('schoolName').fontSize > 0) ? `${elFs('schoolName', 13)}px` : schoolNameFontSize(schoolName, 13 * fontMult), fontFamily: elFf('schoolName') }}>{schoolName}</span>
          </div>
        )}
        <div {...abs('photo', 34, 26)}>
          <PhotoBlock photoUrl={user.photoUrl} userName={user.name} widthPx={photoW} heightPx={photoH} shapeClass={photoShapeCls} clipStyle={photoClipStyle} borderColor={pb} borderWidth={Math.max(pbW, 3)} />
          <ResizeHandle elemKey="photo" w={layout.photoPosition?.width ?? 34} h={layout.photoPosition?.height ?? 40} lockAspect />
        </div>
        {vf.name && (
          <div {...abs('name', 0, 72)} style={{ ...abs('name', 0, 72).style, left: 0, width: `${cardW * scale}px`, textAlign: 'center' }}>
            <h2 className="font-black uppercase tracking-wide whitespace-nowrap inline-block" style={{ color: elColor('name', textColor), fontSize: `${nameFontPx}px`, fontFamily: elFf('name'), opacity: elOp('name') }}>{user.name}</h2>
          </div>
        )}
        {vf.role && (
          <div {...abs('role', 0, 84)} style={{ ...abs('role', 0, 84).style, left: 0, width: `${cardW * scale}px`, textAlign: 'center' }}>
            <span className="inline-block font-extrabold uppercase rounded-full" style={{ backgroundColor: elBg('role', primary), color: elColor('role', '#FFFFFF'), fontSize: `${roleFontPx}px`, fontFamily: elFf('role'), opacity: elOp('role'), padding: `${Math.max(2, scale * 1.2)}px ${Math.max(7, scale * 4.5)}px` }}>{user.role} IDENTITY CARD</span>
          </div>
        )}
        {/* Info block — centred column to match the name/role alignment */}
        <div {...abs('id', 0, 98)} style={{ ...abs('id', 0, 98).style, left: 0, width: `${cardW * scale}px`, display: 'flex', justifyContent: 'center' }}>
          <div className="inline-block text-left">
            {vf.id && <InfoRow label={config.idLabel || 'ID NO'} value={user.idNumber} scale={scale} fontMult={fontMult} fontFamily={elFf('id')} textColor={elColor('id', textColor)} fontSizePt={elStyle('id').fontSize} />}
            {vf.dob && user.dob && <InfoRow label={config.dobLabel || 'D.O.B'} value={user.dob} scale={scale} fontMult={fontMult} fontFamily={elFf('id')} textColor={elColor('id', textColor)} fontSizePt={elStyle('id').fontSize} />}
            {vf.grade && user.departmentOrGrade && <InfoRow label={config.gradeLabel || 'GRADE'} value={user.departmentOrGrade} scale={scale} fontMult={fontMult} fontFamily={elFf('id')} textColor={elColor('id', textColor)} fontSizePt={elStyle('id').fontSize} />}
            {vf.expiry && user.expiresAt && <InfoRow label={config.expiryLabel || 'EXPIRES'} value={user.expiresAt} valueColor={secondary || '#F59E0B'} scale={scale} fontMult={fontMult} fontFamily={elFf('id')} textColor={elColor('id', textColor)} fontSizePt={elStyle('id').fontSize} />}
          </div>
        </div>
        {config.showBarcode === true && (
          <div {...abs('barcode', 12, 132)}>
            <BarcodeStripes idNumber={user.idNumber} widthMm={cardW * 0.45} scale={scale} />
          </div>
        )}
        {config.showQrCode !== false && (config as any).printSides !== 'double' && (
          <div {...abs('qrCode', 42, 124)}>
            <QrCodeBlock sizeMm={qrSize} scale={scale} label="SCAN" imageUrl={user.qrImageUrl} />
            <ResizeHandle elemKey="qrCode" w={qrSize} h={qrSize} minW={10} lockAspect />
          </div>
        )}
        {(layout.customElements || []).filter((el: any) => !el.side || el.side === 'front').map((el: any) => (
          <DraggableEl key={el.id} elemKey={el.id} x={el.x} y={el.y} scale={scale} selectedElement={selectedElement} onClickElement={onClickElement} onPointerDown={onPointerDown} onSizeChange={onSizeChange} w={el.width ?? 24} h={el.height ?? 10} lockAspect={el.type === 'shape' || el.type === 'photo'} readonly={readonly} ariaLabel={el.label}>
            {el.type === 'badge'
              ? <span className="inline-block font-extrabold uppercase px-2 py-0.5 rounded-full shadow-xs" style={{ backgroundColor: el.bgColor||primary, color: el.color||'#FFFFFF', fontSize:`${(el.fontSize||9)*fontMult}px`, opacity:el.opacity!=null?el.opacity/100:1 }}>{el.label}</span>
              : <div style={{ color:el.color||textColor, fontSize:`${(el.fontSize||10)*fontMult}px`, opacity:el.opacity!=null?el.opacity/100:1 }}>{el.sublabel&&<span className="font-bold opacity-60 uppercase mr-1">{el.sublabel}:</span>}<span className="font-semibold">{el.label}</span></div>}
          </DraggableEl>
        ))}
      </div>
    );
  }

  return (
    <div ref={cardRef} className="absolute inset-0 flex flex-col overflow-hidden" style={{ paddingLeft: `${sidebarOffset * scale}px` }}>

      {/* ① HEADER — logo left (absolute), school name large centered */}
      <div className="relative shrink-0 flex items-center justify-center z-10 overflow-hidden"
        style={{ height: `${hdrH}px`, paddingInline: `${hPad}px` }}>
        {!suppressHeader && (
          <>
            {vf.logo && (
              <div {...mkBtn('logo', 'School logo')}
                onPointerDown={!readonly && onPointerDown ? (e: React.PointerEvent) => onPointerDown(e, 'logo', 4, 3.5) : undefined}
                className={['absolute z-10 shrink-0', !readonly && onClickElement ? 'cursor-grab active:cursor-grabbing' : '', selectedElement === 'logo' ? 'ring-2 ring-inset ring-amber-400' : ''].join(' ')}
                style={{ left: `${hPad}px` }}>
                {activeLogoUrl && !logoFailed
                  ? <img src={resolveImageUrl(activeLogoUrl)} alt="Logo"
                      style={{ height: `${Math.max(20, scale * 10)}px`, maxWidth: `${scale * 22}px`, objectFit: 'contain', mixBlendMode: 'multiply', background: 'transparent' }}
                      onError={onLogoError} />
                  : <div className="rounded-full flex items-center justify-center text-white border border-white/30"
                      style={{ width: `${Math.max(22, scale * 10)}px`, height: `${Math.max(22, scale * 10)}px`, backgroundColor: needsHeaderBacking ? `${primary}dd` : 'rgba(255,255,255,0.2)' }}>
                      <GraduationCap size={Math.max(13, scale * 5.5)} />
                    </div>
                }
              </div>
            )}
            {vf.schoolName && (
              <div {...mkBtn('schoolName', 'School name')}
                onPointerDown={!readonly && onPointerDown ? (e: React.PointerEvent) => onPointerDown(e, 'schoolName', 14, 4) : undefined}
                className={['w-full text-center', !readonly && onClickElement ? 'cursor-grab active:cursor-grabbing' : '', selectedElement === 'schoolName' ? 'ring-1 ring-inset ring-amber-400 rounded' : ''].join(' ')}
                style={needsHeaderBacking ? { backgroundColor: `${primary}cc`, borderRadius: `${scale * 1.5}px`, padding: `${Math.max(2, scale)}px ${scale * 8}px` } : {}}>
                <span className="font-black tracking-wide text-white drop-shadow-sm block overflow-hidden text-ellipsis whitespace-nowrap text-center uppercase"
                  style={{ fontSize: schoolNameFontSize(schoolName, 13 * fontMult), fontFamily }}>{schoolName}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ② PHOTO — large centered, thick border */}
      <div className="shrink-0 flex items-center justify-center relative z-20"
        style={{ paddingTop: `${Math.round(scale * 3)}px`, paddingBottom: `${Math.round(scale * 2)}px` }}>
        <div {...mkBtn('photo', 'Photo frame')}
          onPointerDown={!readonly && onPointerDown ? (e: React.PointerEvent) => onPointerDown(e, 'photo', layout.photoPosition?.x ?? 25, layout.photoPosition?.y ?? 22) : undefined}
          className={['relative z-20', !readonly && onClickElement ? 'cursor-grab active:cursor-grabbing' : '', selectedElement === 'photo' ? 'ring-2 ring-inset ring-amber-400' : ''].join(' ')}>
          <PhotoBlock photoUrl={user.photoUrl} userName={user.name} widthPx={photoSz} heightPx={photoSz} shapeClass={photoShapeCls} clipStyle={photoClipStyle} borderColor={pb} borderWidth={Math.max(pbW, 3)} />
        </div>
      </div>

      {/* ③ NAME — large bold uppercase centered */}
      {vf.name && (
        <div {...mkDrag('name', 'Holder name', nameRef)} ref={nameRef}
          className={['shrink-0 w-full text-center overflow-hidden', !readonly && onClickElement ? 'cursor-grab active:cursor-grabbing' : '', selectedElement === 'name' ? 'ring-1 ring-inset ring-amber-400' : ''].join(' ')}
          style={{ paddingInline: `${hPad}px`, marginBottom: `${Math.round(scale * 1)}px` }}>
          <h2 className="font-black uppercase tracking-wide overflow-hidden text-ellipsis whitespace-nowrap text-center"
            style={{ color: elColor('name', textColor), fontSize: `${nameFontPx}px`, fontFamily: elFf('name'), opacity: elOp('name') }}>
            {user.name}
          </h2>
        </div>
      )}

      {/* ④ ROLE PILL — centered */}
      {vf.role && (
        <div {...mkDrag('role', 'Role badge', roleRef)} ref={roleRef}
          className={['shrink-0 flex justify-center', !readonly && onClickElement ? 'cursor-grab active:cursor-grabbing' : '', selectedElement === 'role' ? 'ring-1 ring-inset ring-amber-400' : ''].join(' ')}
          style={{ marginBottom: `${Math.round(scale * 2)}px` }}>
          <span className="inline-block font-extrabold uppercase rounded-full text-center"
            style={{ backgroundColor: elBg('role', primary), color: elColor('role', '#FFFFFF'), fontSize: `${roleFontPx}px`, fontFamily: elFf('role'), opacity: elOp('role'), padding: `${Math.max(2, scale * 1.2)}px ${Math.max(7, scale * 4.5)}px` }}>
            {user.role} IDENTITY CARD
          </span>
        </div>
      )}

      {/* ⑤ INFO GRID — aligned label : value rows */}
      <div {...mkDrag('id', 'ID details', idRef)} ref={idRef}
        className={['shrink-0 flex-1 overflow-hidden', !readonly && onClickElement ? 'cursor-grab active:cursor-grabbing' : '', selectedElement === 'id' ? 'ring-1 ring-inset ring-amber-400' : ''].join(' ')}
        style={{ paddingInline: `${hPad + Math.round(scale * 2)}px` }}>
        <div className="border-t opacity-20 mb-1" style={{ borderColor: textColor }} />
        {[
          vf.id  ? { label: config.idLabel  || 'ID NO',   value: user.idNumber,           accent: false } : null,
          vf.dob && user.dob ? { label: config.dobLabel  || 'D.O.B', value: user.dob, accent: false } : null,
          vf.grade && user.departmentOrGrade ? { label: config.gradeLabel || 'GRADE', value: user.departmentOrGrade, accent: false } : null,
          vf.expiry && user.expiresAt ? { label: config.expiryLabel || 'EXPIRES', value: user.expiresAt, accent: true } : null,
        ].filter(Boolean).map((row, i) => row && (
          <div key={i} style={{ marginBottom: `${Math.max(1.5, scale * 1.2)}px` }}>
            <InfoRow
              label={row.label}
              value={row.value}
              valueColor={row.accent ? (secondary || '#F59E0B') : undefined}
              scale={scale}
              fontMult={fontMult}
              fontFamily={elFf('id')}
              textColor={elColor('id', textColor)}
            />
          </div>
        ))}
      </div>

      {/* ⑥ BOTTOM — QR centered, 7px+ from edge */}
      <div className="shrink-0 flex items-center justify-center gap-3"
        style={{ paddingBottom: `${Math.max(7, scale * 3.5)}px`, paddingTop: `${Math.max(2, scale * 1.5)}px` }}>
        {config.showQrCode !== false && (config as any).printSides !== 'double' && (
          <div {...mkBtn('qrCode', 'QR code')} className={[!readonly && onClickElement ? 'cursor-pointer' : '', selectedElement === 'qrCode' ? 'ring-1 ring-inset ring-amber-400 rounded' : ''].join(' ')}>
            <QrCodeBlock sizeMm={14} scale={scale} label="SCAN" imageUrl={user.qrImageUrl} />
          </div>
        )}
        {config.showBarcode === true && (
          <div {...mkBtn('barcode', 'Barcode')} className={[!readonly && onClickElement ? 'cursor-pointer' : '', selectedElement === 'barcode' ? 'ring-1 ring-inset ring-amber-400 rounded' : ''].join(' ')}>
            <BarcodeStripes idNumber={user.idNumber} widthMm={cardW * 0.5} scale={scale} />
          </div>
        )}
      </div>

      {/* Custom overlay elements */}
      {(layout.customElements || []).filter((el: any) => !el.side || el.side === 'front').map((el: any) => (
        <DraggableEl key={el.id} elemKey={el.id} x={el.x} y={el.y} scale={scale} selectedElement={selectedElement} onClickElement={onClickElement} onPointerDown={onPointerDown} onSizeChange={onSizeChange} w={el.width ?? 24} h={el.height ?? 10} lockAspect={el.type === 'shape' || el.type === 'photo'} readonly={readonly} ariaLabel={el.label}>
          {el.type === 'badge'
            ? <span className="inline-block font-extrabold uppercase px-2 py-0.5 rounded-full shadow-xs" style={{ backgroundColor: el.bgColor||primary, color: el.color||'#FFFFFF', fontSize:`${(el.fontSize||9)*fontMult}px`, opacity:el.opacity!=null?el.opacity/100:1 }}>{el.label}</span>
            : <div style={{ color:el.color||textColor, fontSize:`${(el.fontSize||10)*fontMult}px`, opacity:el.opacity!=null?el.opacity/100:1 }}>{el.sublabel&&<span className="font-bold opacity-60 uppercase mr-1">{el.sublabel}:</span>}<span className="font-semibold">{el.label}</span></div>}
        </DraggableEl>
      ))}
    </div>
  );
}

// ── Back Content — Zone-based, responsive for both PVC and Badge ─────────────
//
// PVC Landscape back zones:
//   ① Magnetic stripe      — full width top band
//   ② School info + QR     — info left, QR right, flex row
//   ③ Signature line       — centered dashed line
//   ④ Barcode              — centered (if enabled)
//
// Badge Portrait back zones:
//   ① Magnetic stripe      — full width top band
//   ② School info text     — left aligned block
//   ③ QR code              — centered
//   ④ Signature line       — centered
//   ⑤ Barcode              — centered (if enabled)

function BackContent({ user, config, scale, cardW, cardH, fontMult, primary, secondary, textColor, fontFamily, isPortrait, selectedElement, onClickElement, onPointerDown, onSizeChange, readonly, layout, schoolName }: {
  user: VisualCardUserData; config: TemplateConfig; scale: number; cardW: number; cardH: number; fontMult: number;
  primary: string; secondary: string; textColor: string; fontFamily: string; isPortrait: boolean;
  selectedElement?: string | null; onClickElement?: (k: string) => void;
  onPointerDown?: (e: React.PointerEvent, k: string, x: number, y: number) => void;
  onSizeChange?: (k: string, w: number, h: number) => void;
  readonly?: boolean; layout: any; schoolName: string;
}) {
  // Refs for drag position measurement
  const cardRef    = useRef<HTMLDivElement>(null);
  const infoRef    = useRef<HTMLDivElement>(null);
  const qrRef      = useRef<HTMLDivElement>(null);
  const sigRef     = useRef<HTMLDivElement>(null);
  const bcRef      = useRef<HTMLDivElement>(null);

  const getPosMm = (ref: React.RefObject<HTMLDivElement>): { x: number; y: number } => {
    if (!ref.current || !cardRef.current) return { x: 0, y: 0 };
    const cr = cardRef.current.getBoundingClientRect();
    const er = ref.current.getBoundingClientRect();
    return { x: parseFloat(((er.left - cr.left) / scale).toFixed(1)), y: parseFloat(((er.top - cr.top) / scale).toFixed(1)) };
  };

  const mkDrag = (key: string, ref: React.RefObject<HTMLDivElement>) => ({
    ref,
    role: (!readonly && onClickElement ? 'button' : undefined) as any,
    tabIndex: (!readonly && onClickElement ? 0 : undefined) as any,
    onClick: (!readonly && onClickElement ? () => onClickElement(key) : undefined) as any,
    onPointerDown: (!readonly && onPointerDown ? (e: React.PointerEvent) => {
      onPointerDown(e, key, getPosMm(ref).x, getPosMm(ref).y);
    } : undefined),
    className: [
      !readonly && onClickElement ? 'cursor-grab active:cursor-grabbing' : '',
      selectedElement === key ? 'ring-1 ring-inset ring-amber-400 rounded' : '',
    ].join(' '),
  });

  const stripeH  = Math.round((isPortrait ? cardH * 0.07  : cardH * 0.14) * scale);
  const padPx    = Math.round(5 * scale);
  const infoFs   = Math.max(5.5, scale * 2.3);
  const qrMm     = isPortrait ? 20 : 13;

  // ── Absolute WYSIWYG helpers (back face) — used for edit AND readonly ──────
  const editing = true;
  const interactiveEdit = !readonly && !!onPointerDown;
  const backPos = (key: string): { x: number; y: number } | null => {
    const s = (layout as any)[`${key}Position`];
    if (s && typeof s.x === 'number' && typeof s.y === 'number') return { x: s.x, y: s.y };
    return null;
  };
  const absBack = (key: string, fallX: number, fallY: number) => {
    const p = backPos(key) ?? { x: fallX, y: fallY };
    return {
      style: { position: 'absolute' as const, left: `${p.x * scale}px`, top: `${p.y * scale}px`, zIndex: selectedElement === key ? 40 : 25, touchAction: interactiveEdit ? 'none' as const : undefined },
      onPointerDown: interactiveEdit && onPointerDown ? (e: React.PointerEvent) => onPointerDown(e, key, p.x, p.y) : undefined,
      onClick: interactiveEdit && onClickElement ? () => onClickElement(key) : undefined,
      className: interactiveEdit
        ? ['cursor-grab active:cursor-grabbing touch-none', selectedElement === key ? 'ring-2 ring-inset ring-amber-400' : 'hover:ring-1 hover:ring-blue-400/70'].join(' ')
        : '',
    };
  };
  const backQrSize = (layout as any).backQrPosition?.size ?? qrMm;

  // ── EDIT MODE (both orientations): absolute back layout ────────────────────
  if (editing) {
    return (
      <div ref={cardRef} className="absolute inset-0 overflow-hidden">
        {/* Magnetic stripe (full width, fixed at its y) */}
        <div {...absBack('backStripe', 0, isPortrait ? 8 : 4)} style={{ ...absBack('backStripe', 0, isPortrait ? 8 : 4).style, left: 0, width: `${cardW * scale}px` }}>
          <div className="flex items-center justify-between overflow-hidden" style={{ height: `${stripeH}px`, background: `linear-gradient(90deg,${primary} 0%,#0F172A 55%,${secondary || primary} 100%)`, paddingInline: `${padPx}px` }}>
            <span className="font-mono font-extrabold uppercase tracking-widest text-amber-400 truncate" style={{ fontSize: `${Math.max(4.5, scale * 1.8)}px` }}>MAGNETIC SECURITY STRIPE</span>
            <span className="font-mono font-bold text-gray-200 opacity-90 whitespace-nowrap ml-2" style={{ fontSize: `${Math.max(4, scale * 1.6)}px` }}>AUTHORIZED HOLDER ONLY</span>
          </div>
        </div>
        {/* Info block */}
        <div {...absBack('backInfo', padPx / scale, isPortrait ? 22 : 20)} style={{ ...absBack('backInfo', padPx / scale, isPortrait ? 22 : 20).style, maxWidth: `${cardW * 0.6 * scale}px` }}>
          <p className="font-extrabold uppercase tracking-wide" style={{ color: primary, fontSize: `${Math.max(6, scale * 2.4)}px`, fontFamily }}>{schoolName}</p>
          <p className="leading-snug opacity-75 mt-0.5" style={{ color: textColor, fontSize: `${Math.max(4.5, scale * 2)}px`, fontFamily }}>This credential is the official property of {schoolName}.<br />If found, please return to the school administration.</p>
          <p className="font-mono font-bold mt-1 tracking-tight" style={{ color: secondary || primary, fontSize: `${Math.max(4.5, scale * 1.9)}px` }}>Emergency: +232 (0) 76-000-111</p>
        </div>
        {/* QR */}
        {config.showQrCode !== false && (
          <div {...absBack('backQr', isPortrait ? 38 : 66, isPortrait ? 60 : 18)}>
            <QrCodeBlock sizeMm={backQrSize} scale={scale} label="VERIFY QR" imageUrl={user.qrImageUrl} />
          </div>
        )}
        {/* Signature */}
        <div {...absBack('backSignature', padPx / scale, isPortrait ? 130 : 44)} style={{ ...absBack('backSignature', padPx / scale, isPortrait ? 130 : 44).style, width: `${cardW * 0.48 * scale}px` }}>
          <div className="border-b-2 border-dashed" style={{ borderColor: primary, opacity: 0.55 }} />
          <p className="font-semibold uppercase mt-0.5" style={{ fontSize: `${Math.max(4.5, scale * 1.8)}px`, color: textColor, opacity: 0.65 }}>Authorized Signature</p>
        </div>
        {/* Barcode */}
        {config.showBarcode === true && (
          <div {...absBack('backBarcode', isPortrait ? 20 : 34, isPortrait ? 140 : 46)}>
            <BarcodeStripes idNumber={user.idNumber} widthMm={cardW * 0.4} scale={scale} />
          </div>
        )}
        {/* Custom back elements */}
        {(layout.customElements || []).filter((el: any) => el.side === 'back').map((el: any) => (
          <DraggableEl key={el.id} elemKey={el.id} x={el.x} y={el.y} scale={scale} selectedElement={selectedElement} onClickElement={onClickElement} onPointerDown={onPointerDown} onSizeChange={onSizeChange} w={el.width ?? 24} h={el.height ?? 10} lockAspect={el.type === 'shape' || el.type === 'photo'} readonly={readonly} ariaLabel={el.label}>
            {el.type === 'badge'
              ? <span className="inline-block font-extrabold uppercase px-2 py-0.5 rounded-full shadow-xs" style={{ backgroundColor: el.bgColor || primary, color: el.color || '#FFFFFF', fontSize: `${(el.fontSize || 9) * fontMult}px`, opacity: el.opacity != null ? el.opacity / 100 : 1 }}>{el.label}</span>
              : <div style={{ color: el.color || textColor, fontSize: `${(el.fontSize || 10) * fontMult}px`, opacity: el.opacity != null ? el.opacity / 100 : 1 }}>{el.sublabel && <span className="font-bold opacity-60 uppercase mr-1">{el.sublabel}:</span>}<span className="font-semibold">{el.label}</span></div>}
          </DraggableEl>
        ))}
      </div>
    );
  }

  // ── PVC LANDSCAPE BACK ─────────────────────────────────────────────────────
  if (!isPortrait) {
    return (
      <div ref={cardRef} className="absolute inset-0 flex flex-col overflow-hidden">

        {/* ① MAGNETIC STRIPE — full width */}
        <div ref={infoRef} {...mkDrag('backStripe', infoRef)}
          className="shrink-0 flex items-center justify-between overflow-hidden"
          style={{ height: `${stripeH}px`, background: `linear-gradient(90deg,${primary} 0%,#0F172A 55%,${secondary||primary} 100%)`, paddingInline: `${padPx}px` }}>
          <span className="font-mono font-extrabold uppercase tracking-widest text-amber-400 truncate"
            style={{ fontSize: `${Math.max(4.5, scale * 1.8)}px` }}>MAGNETIC SECURITY STRIPE</span>
          <span className="font-mono font-bold text-gray-200 opacity-90 whitespace-nowrap ml-2"
            style={{ fontSize: `${Math.max(4, scale * 1.6)}px` }}>AUTHORIZED HOLDER ONLY</span>
        </div>

        {/* ② INFO + QR — flex row, fills most of card */}
        <div className="flex flex-1 min-h-0 overflow-hidden" style={{ paddingInline: `${padPx}px`, paddingTop: `${Math.round(scale * 2)}px` }}>
          {/* Info block left */}
          <div ref={qrRef} {...mkDrag('backInfo', qrRef)} className="flex-1 min-w-0 flex flex-col justify-center overflow-hidden">
            <p className="font-extrabold uppercase tracking-wide text-center"
              style={{ color: primary, fontSize: `${Math.max(6, scale * 2.4)}px`, fontFamily }}>
              {schoolName}
            </p>
            <p className="leading-snug opacity-75 mt-0.5"
              style={{ color: textColor, fontSize: `${Math.max(4.5, scale * 2)}px`, fontFamily }}>
              This credential is the official property of {schoolName}.<br />
              If found, please return to the school administration.
            </p>
            <p className="font-mono font-bold mt-1 tracking-tight"
              style={{ color: secondary || primary, fontSize: `${Math.max(4.5, scale * 1.9)}px` }}>
              Emergency: +232 (0) 76-000-111
            </p>
          </div>

          {/* QR right */}
          {config.showQrCode !== false && (
            <div ref={sigRef} {...mkDrag('backQr', sigRef)} className="shrink-0 flex items-center justify-center"
              style={{ paddingLeft: `${Math.round(scale * 3)}px` }}>
              <QrCodeBlock sizeMm={qrMm} scale={scale} label="VERIFY QR" imageUrl={user.qrImageUrl} />
            </div>
          )}
        </div>

        {/* ③ SIGNATURE — dashed line centered-ish, with label */}
        <div className="shrink-0 flex items-end overflow-hidden"
          style={{ paddingInline: `${padPx}px`, paddingBottom: `${Math.round(scale * 1.5)}px`, height: `${Math.round(cardH * 0.2 * scale)}px` }}>
          <div ref={bcRef} {...mkDrag('backSignature', bcRef)} style={{ width: `${Math.round(cardW * 0.48 * scale)}px` }}>
            <div className="border-b-2 border-dashed" style={{ borderColor: primary, opacity: 0.55 }} />
            <p className="font-semibold uppercase mt-0.5"
              style={{ fontSize: `${Math.max(4.5, scale * 1.8)}px`, color: textColor, opacity: 0.65 }}>
              Authorized Signature
            </p>
          </div>

          {/* BARCODE right of signature */}
          {config.showBarcode === true && (
            <div className="ml-auto flex items-end">
              <BarcodeStripes idNumber={user.idNumber} widthMm={cardW * 0.38} scale={scale} />
            </div>
          )}
        </div>

        {/* Custom back elements */}
        {(layout.customElements || []).filter((el: any) => el.side === 'back').map((el: any) => (
          <DraggableEl key={el.id} elemKey={el.id} x={el.x} y={el.y} scale={scale}
            selectedElement={selectedElement} onClickElement={onClickElement}
            onPointerDown={onPointerDown} onSizeChange={onSizeChange} w={el.width ?? 24} h={el.height ?? 10} lockAspect={el.type === 'shape' || el.type === 'photo'} readonly={readonly} ariaLabel={el.label}>
            {el.type === 'badge'
              ? <span className="inline-block font-extrabold uppercase px-2 py-0.5 rounded-full shadow-xs"
                  style={{ backgroundColor: el.bgColor||primary, color: el.color||'#FFFFFF', fontSize:`${(el.fontSize||9)*fontMult}px`, opacity:el.opacity!=null?el.opacity/100:1 }}>{el.label}</span>
              : <div style={{ color:el.color||textColor, fontSize:`${(el.fontSize||10)*fontMult}px`, opacity:el.opacity!=null?el.opacity/100:1 }}>
                  {el.sublabel&&<span className="font-bold opacity-60 uppercase mr-1">{el.sublabel}:</span>}
                  <span className="font-semibold">{el.label}</span>
                </div>}
          </DraggableEl>
        ))}
      </div>
    );
  }

  // ── BADGE PORTRAIT BACK ────────────────────────────────────────────────────
  return (
    <div ref={cardRef} className="absolute inset-0 flex flex-col overflow-hidden">

      {/* ① MAGNETIC STRIPE */}
      <div ref={infoRef} {...mkDrag('backStripe', infoRef)}
        className="shrink-0 flex items-center justify-between overflow-hidden"
        style={{ height: `${stripeH}px`, background: `linear-gradient(90deg,${primary} 0%,#0F172A 55%,${secondary||primary} 100%)`, paddingInline: `${padPx}px` }}>
        <span className="font-mono font-extrabold uppercase tracking-widest text-amber-400 truncate"
          style={{ fontSize: `${Math.max(4.5, scale * 1.8)}px` }}>MAGNETIC SECURITY STRIPE</span>
        <span className="font-mono font-bold text-gray-200 opacity-90 whitespace-nowrap ml-2"
          style={{ fontSize: `${Math.max(4, scale * 1.6)}px` }}>AUTHORIZED HOLDER ONLY</span>
      </div>

      {/* ② SCHOOL INFO TEXT */}
      <div ref={qrRef} {...mkDrag('backInfo', qrRef)}
        className="shrink-0 overflow-hidden text-center"
        style={{ padding: `${Math.round(scale * 2.5)}px ${padPx}px ${Math.round(scale * 1.5)}px` }}>
        <p className="font-extrabold uppercase tracking-wide"
          style={{ color: primary, fontSize: `${Math.max(6, scale * 2.4)}px`, fontFamily }}>
          {schoolName}
        </p>
        <p className="leading-snug opacity-75 mt-0.5"
          style={{ color: textColor, fontSize: `${Math.max(5, scale * 2)}px`, fontFamily }}>
          This credential is the official property of {schoolName}. If found, please return to the school administration office.
        </p>
        <p className="font-mono font-bold mt-1 tracking-tight"
          style={{ color: secondary||primary, fontSize: `${Math.max(4.5, scale * 1.9)}px` }}>
          Emergency: +232 (0) 76-000-111
        </p>
      </div>

      {/* ③ QR CODE — centered */}
      {config.showQrCode !== false && (
        <div ref={sigRef} {...mkDrag('backQr', sigRef)}
          className="shrink-0 flex items-center justify-center"
          style={{ paddingBlock: `${Math.round(scale * 2)}px`, paddingBottom: `${Math.max(7, scale * 3.5)}px` }}>
          <QrCodeBlock sizeMm={qrMm} scale={scale} label="VERIFY QR" imageUrl={user.qrImageUrl} />
        </div>
      )}

      {/* ④ SIGNATURE */}
      <div ref={bcRef} {...mkDrag('backSignature', bcRef)}
        className="shrink-0 flex flex-col items-center overflow-hidden"
        style={{ paddingInline: `${padPx}px`, paddingBottom: `${Math.round(scale * 1.5)}px` }}>
        <div style={{ width: `${Math.round(cardW * 0.6 * scale)}px` }}>
          <div className="border-b-2 border-dashed" style={{ borderColor: primary, opacity: 0.55 }} />
          <p className="font-semibold uppercase mt-0.5 text-center"
            style={{ fontSize: `${Math.max(4.5, scale * 1.8)}px`, color: textColor, opacity: 0.65 }}>
            Authorized Signature
          </p>
        </div>
      </div>

      {/* ⑤ BARCODE */}
      {config.showBarcode === true && (
        <div className="shrink-0 flex items-center justify-center"
          style={{ paddingBottom: `${Math.max(7, scale * 3.5)}px` }}>
          <BarcodeStripes idNumber={user.idNumber} widthMm={cardW * 0.7} scale={scale} />
        </div>
      )}

      {/* Custom back elements */}
      {(layout.customElements || []).filter((el: any) => el.side === 'back').map((el: any) => (
        <DraggableEl key={el.id} elemKey={el.id} x={el.x} y={el.y} scale={scale}
          selectedElement={selectedElement} onClickElement={onClickElement}
          onPointerDown={onPointerDown} onSizeChange={onSizeChange} w={el.width ?? 24} h={el.height ?? 10} lockAspect={el.type === 'shape' || el.type === 'photo'} readonly={readonly} ariaLabel={el.label}>
          {el.type === 'badge'
            ? <span className="inline-block font-extrabold uppercase px-2 py-0.5 rounded-full shadow-xs"
                style={{ backgroundColor: el.bgColor||primary, color: el.color||'#FFFFFF', fontSize:`${(el.fontSize||9)*fontMult}px`, opacity:el.opacity!=null?el.opacity/100:1 }}>{el.label}</span>
            : <div style={{ color:el.color||textColor, fontSize:`${(el.fontSize||10)*fontMult}px`, opacity:el.opacity!=null?el.opacity/100:1 }}>
                {el.sublabel&&<span className="font-bold opacity-60 uppercase mr-1">{el.sublabel}:</span>}
                <span className="font-semibold">{el.label}</span>
              </div>}
        </DraggableEl>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export const VisualIdCardRenderer: React.FC<VisualIdCardRendererProps> = ({
  config, format, user = DEFAULT_USER, logoUrl, side = 'front', widthPx,
  onClickElement, onPositionChange, onSizeChange, showGrid = false, selectedElement, className = '', readonly = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [actualWidth, setActualWidth] = useState<number>(widthPx || 340);
  const [logoFailed, setLogoFailed] = useState(false);
  const [alignGuides, setAlignGuides] = useState<{ vx?: number; hy?: number }>({});
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (widthPx) { setActualWidth(widthPx); return; }
    const el = containerRef.current;
    if (!el) return;
    const measure = () => { if (el.clientWidth > 40) setActualWidth(el.clientWidth); };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, [widthPx]);

  useEffect(() => { setLogoFailed(false); }, [logoUrl, config.logoUrl]);

  const dims = CARD_DIMS[format] ?? CARD_DIMS.pvc;
  const cardW = dims.w, cardH = dims.h;
  const isPortrait = format === 'badge';
  const scale = actualWidth / cardW;
  const heightPx = Math.round(cardH * scale);
  const borderRadiusPx = dims.r * scale;

  const primary    = config.primaryColor    || '#1E3A8A';
  const secondary  = config.secondaryColor  || '#F59E0B';
  const bgColor    = config.backgroundColor || '#FFFFFF';
  const textColor  = config.textColor       || '#0F172A';
  const fontFamily = config.fontFamily      || 'Helvetica, sans-serif';
  const headerStyle = config.headerStyle    || 'curved-wave';
  const photoShape  = config.photoShape     || 'circle';
  const bgPattern   = (config as any).backgroundPattern as string | undefined;
  const bgPatternColor = (config as any).backgroundPatternColor as string | undefined;
  const bgPatternImage = bgPattern && bgPattern !== 'none' ? buildBgPattern(bgPattern, bgPatternColor || textColor) : undefined;

  const fontMult = Math.max(0.38, Math.min(2.4, (scale / 4.0) * ((config.fontSize || 12) / 12)));

  const vf = {
    name:       config.visibleFields?.showName       !== false,
    title:      config.visibleFields?.showTitle      !== false,
    role:       config.visibleFields?.showRole       !== false,
    id:         config.visibleFields?.showId         !== false,
    dob:        config.visibleFields?.showDob        !== false,
    grade:      config.visibleFields?.showGrade      !== false,
    expiry:     config.visibleFields?.showExpiry     !== false,
    schoolName: config.visibleFields?.showSchoolName !== false,
    logo:       config.visibleFields?.showLogo       !== false,
  };

  const layout = config.layoutConfig || {
    photoPosition:   isPortrait ? { x: 26, y: 22, width: 50, height: 60 } : { x: 6, y: 12, width: 22, height: 28 },
    namePosition:    isPortrait ? { x: 10, y: 88 } : { x: 32, y: 14 },
    rolePosition:    isPortrait ? { x: 10, y: 103 } : { x: 32, y: 26 },
    idPosition:      isPortrait ? { x: 10, y: 113 } : { x: 32, y: 32 },
    qrCodePosition:  isPortrait ? { x: 38, y: 126, size: 24 } : { x: 64, y: 14, size: 15 },
    barcodePosition: isPortrait ? { x: 10, y: 140 } : { x: 32, y: 41 },
    customElements: [],
  };

  const schoolName = config.customSchoolName || user.schoolName || 'SCHOOL NAME';
  const activeLogoUrl = logoUrl || config.logoUrl;
  const isSidebarLeft = headerStyle === 'sidebar-left';
  const sidebarOffset = isSidebarLeft ? (isPortrait ? cardW * 0.13 : cardW * 0.15) : 0;
  const photoShapeCls = photoShapeClass(photoShape);
  const photoClipStyle = photoShape === 'hexagon' ? { clipPath: HEXAGON_CLIP } : {};

  // Drag state
  const draggingKey = useRef<string | null>(null);
  const dragStart   = useRef<{ sx: number; sy: number; ex: number; ey: number } | null>(null);
  const SNAP_MM = 1.8;

  const handlePointerDown = useCallback((e: React.PointerEvent, key: string, curX: number, curY: number) => {
    if (readonly || !onPositionChange) return;
    e.stopPropagation();
    onClickElement?.(key);
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    draggingKey.current = key;
    dragStart.current = { sx: e.clientX, sy: e.clientY, ex: curX, ey: curY };
    setIsDragging(true);
  }, [readonly, onPositionChange, onClickElement]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingKey.current || !dragStart.current || !onPositionChange) return;
    const rawX = Math.max(0, Math.min(cardW - 5, dragStart.current.ex + (e.clientX - dragStart.current.sx) / scale));
    const rawY = Math.max(0, Math.min(cardH - 5, dragStart.current.ey + (e.clientY - dragStart.current.sy) / scale));
    const xs = [0, cardW / 2, cardW, 5, cardW - 5];
    const ys = [0, cardH / 2, cardH, 5, cardH - 5];
    let sx = rawX, sy = rawY, vx: number | undefined, hy: number | undefined;
    for (const t of xs) { if (Math.abs(rawX - t) <= SNAP_MM) { sx = t; vx = t; break; } }
    for (const t of ys) { if (Math.abs(rawY - t) <= SNAP_MM) { sy = t; hy = t; break; } }
    setAlignGuides({ vx, hy });
    onPositionChange(draggingKey.current, parseFloat(sx.toFixed(1)), parseFloat(sy.toFixed(1)));
  }, [onPositionChange, cardW, cardH, scale]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (draggingKey.current) { try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {} }
    draggingKey.current = null; dragStart.current = null; setAlignGuides({}); setIsDragging(false);
  }, []);

  const headerProps: HeaderProps = { primary, secondary, isBack: side === 'back', isPortrait };
  const renderHeader = () => {
    switch (headerStyle) {
      case 'curved-wave':        return <HeaderCurvedWave {...headerProps} />;
      case 'dual-strip':         return <HeaderDualStrip {...headerProps} />;
      case 'sidebar-left':       return <HeaderSidebarLeft {...headerProps} scale={scale} heightPx={heightPx} schoolName={schoolName} />;
      case 'top-banner':         return <HeaderTopBanner {...headerProps} schoolName={schoolName} cardTitle={config.cardTitle || 'IDENTIFICATION CARD'} scale={scale} />;
      case 'arch-frame':         return <HeaderArchFrame {...headerProps} />;
      case 'angled-split':       return <HeaderAngledSplit {...headerProps} />;
      case 'minimal-clean':      return <HeaderMinimalClean {...headerProps} />;
      case 'gradient-diagonal':  return <HeaderGradientDiagonal {...headerProps} />;
      case 'corner-ribbon':      return <HeaderCornerRibbon {...headerProps} />;
      case 'split-color':        return <HeaderSplitColor {...headerProps} />;
      case 'rounded-band':       return <HeaderRoundedBand {...headerProps} />;
      case 'wave-bottom':        return <HeaderWaveBottom {...headerProps} />;
      default:                   return <HeaderCurvedWave {...headerProps} />;
    }
  };

  const sharedFront = {
    user, config, scale, cardW, cardH, fontMult, primary, secondary, textColor, fontFamily,
    photoShapeCls, photoClipStyle, activeLogoUrl, logoFailed,
    onLogoError: () => { if (!activeLogoUrl?.startsWith('data:')) setLogoFailed(true); },
    vf, selectedElement, onClickElement,
    onPointerDown: onPositionChange ? handlePointerDown : undefined,
    onSizeChange,
    readonly, layout, sidebarOffset,
  };

  return (
    <div ref={containerRef} className="w-full flex justify-center items-center">
      <div onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}
        className={`relative select-none overflow-hidden shadow-2xl border border-black/10 dark:border-white/10 ${className}`}
        style={{ width: `${actualWidth}px`, height: `${heightPx}px`, backgroundColor: bgColor, color: textColor, fontFamily, borderRadius: `${borderRadiusPx}px`, touchAction: 'none', backgroundImage: bgPatternImage }}>

        {/* Alignment grid — shown only WHILE actively dragging an element (or
            when the editor's grid toggle is on), never fixed by default. */}
        {!readonly && onPositionChange && (isDragging || showGrid) && (
          <div className="absolute inset-0 z-40 pointer-events-none"
            style={{
              backgroundImage:
                `linear-gradient(to right, rgba(59,130,246,0.10) 1px, transparent 1px),` +
                `linear-gradient(to bottom, rgba(59,130,246,0.10) 1px, transparent 1px)`,
              backgroundSize: `${5 * scale}px ${5 * scale}px`,
            }}>
            {/* vertical centre */}
            <div className="absolute top-0 bottom-0 border-l border-dashed border-blue-400/50" style={{ left: `${(cardW / 2) * scale}px` }} />
            {/* horizontal centre */}
            <div className="absolute left-0 right-0 border-t border-dashed border-blue-400/50" style={{ top: `${(cardH / 2) * scale}px` }} />
          </div>
        )}

        {/* Alignment guides */}
        {alignGuides.vx !== undefined && (
          <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-cyan-400 z-50 pointer-events-none" style={{ left: `${alignGuides.vx * scale}px` }}>
            <span className="absolute top-0.5 left-0.5 bg-cyan-500 text-white font-mono font-bold rounded px-0.5" style={{ fontSize: '7px' }}>X:{alignGuides.vx.toFixed(1)}</span>
          </div>
        )}
        {alignGuides.hy !== undefined && (
          <div className="absolute left-0 right-0 border-t-2 border-dashed border-cyan-400 z-50 pointer-events-none" style={{ top: `${alignGuides.hy * scale}px` }}>
            <span className="absolute top-0.5 left-0.5 bg-cyan-500 text-white font-mono font-bold rounded px-0.5" style={{ fontSize: '7px' }}>Y:{alignGuides.hy.toFixed(1)}</span>
          </div>
        )}

        {/* Decorative header graphics — z-0 so photo (z-20) always sits above */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          {renderHeader()}
        </div>

        {/* Zone-based card content — z-10 base, photo bumped to z-20 */}
        <div className="absolute inset-0 z-10">
          {side === 'front'
            ? (isPortrait ? <FrontContentBadge {...sharedFront} /> : <FrontContentPVC {...sharedFront} />)
            : <BackContent user={user} config={config} scale={scale} cardW={cardW} cardH={cardH} fontMult={fontMult}
                primary={primary} secondary={secondary} textColor={textColor} fontFamily={fontFamily}
                isPortrait={isPortrait} selectedElement={selectedElement} onClickElement={onClickElement}
                onPointerDown={onPositionChange ? handlePointerDown : undefined}
                onSizeChange={onSizeChange}
                readonly={readonly} layout={layout} schoolName={schoolName} />
          }
        </div>
      </div>
    </div>
  );
};

export default VisualIdCardRenderer;
