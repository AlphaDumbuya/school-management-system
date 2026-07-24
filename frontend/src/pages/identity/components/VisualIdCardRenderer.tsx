/**
 * Visual ID Card Renderer Component
 * Renders Canva-grade premium ID cards with full vector support for waves, shapes, borders,
 * custom typography, logos, photo frame geometries, barcodes, and QR codes.
 * Fully responsive for both Horizontal (Landscape PVC) and Vertical (Portrait Badge/Lanyard) orientations.
 */

import React, { useRef, useState, useEffect } from 'react';
import { QrCode, GraduationCap, Building2, Shield, Award, BookOpen, User as UserIcon } from 'lucide-react';
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
}

export interface VisualIdCardRendererProps {
  config: TemplateConfig;
  format: CardFormat;
  user?: VisualCardUserData;
  logoUrl?: string;
  side?: 'front' | 'back';
  widthPx?: number; // target container width (if omitted, auto-fits parent container responsively)
  onClickElement?: (elementKey: string) => void;
  onPositionChange?: (elementKey: string, newX: number, newY: number) => void;
  selectedElement?: string | null;
  className?: string;
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

export const VisualIdCardRenderer: React.FC<VisualIdCardRendererProps> = ({
  config,
  format,
  user = DEFAULT_USER,
  logoUrl,
  side = 'front',
  widthPx,
  onClickElement,
  onPositionChange,
  selectedElement,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [actualWidth, setActualWidth] = useState<number>(widthPx || 340);

  // Measure container width for fluid responsiveness across screen sizes
  useEffect(() => {
    if (widthPx) {
      setActualWidth(widthPx);
      return;
    }
    const elem = containerRef.current;
    if (!elem) return;

    const measure = () => {
      if (elem.clientWidth > 40) {
        setActualWidth(elem.clientWidth);
      }
    };
    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(elem);
      return () => observer.disconnect();
    }
  }, [widthPx]);

  const isPortrait = format === 'badge';

  // Physical Dimensions:
  // PVC Landscape: 85.6mm x 53.98mm (Ratio: 1.5858)
  // Badge Portrait: 101.6mm x 152.4mm (Ratio: 0.6667)
  const cardWidthMm = isPortrait ? 101.6 : 85.6;
  const cardHeightMm = isPortrait ? 152.4 : 53.98;

  // Responsive scale factor relative to measured container width
  const scale = actualWidth / cardWidthMm;
  const heightPx = Math.round(cardHeightMm * scale);

  // Extract config styling values with fallbacks
  const primaryColor = config.primaryColor || '#1E3A8A';
  const secondaryColor = config.secondaryColor || '#F59E0B';
  const backgroundColor = config.backgroundColor || '#FFFFFF';
  const textColor = config.textColor || '#0F172A';
  const headerStyle = config.headerStyle || 'curved-wave';
  const photoShape = config.photoShape || 'circle';
  const photoBorderColor = config.photoBorderColor || primaryColor;
  const photoBorderWidth = config.photoBorderWidth ?? 3;
  const cardTitle = config.cardTitle || (user.role === 'Student' ? 'STUDENT ID CARD' : user.role === 'Teacher' ? 'TEACHER ID CARD' : 'IDENTIFICATION CARD');
  const fontFamily = config.fontFamily || 'Helvetica, sans-serif';

  const idLabel = config.idLabel || 'ID NO';
  const dobLabel = config.dobLabel || 'D.O.B';
  const gradeLabel = config.gradeLabel || 'GRADE';
  const expiryLabel = config.expiryLabel || 'EXPIRES';
  const activeLogoUrl = logoUrl || config.logoUrl;
  const schoolNameText = config.customSchoolName || user.schoolName || 'GINYARD ACADEMY';
  const logoEmblem = config.logoEmblem || 'graduation-cap';

  // Helper to format full image URL for relative server paths
  const getFullImageUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    const apiBase = ((import.meta as any).env?.VITE_API_URL as string) || 'http://localhost:5000';
    const cleanBase = apiBase.replace(/\/api\/?$/, '');
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return `${cleanBase}${cleanUrl}`;
  };

  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [activeLogoUrl]);

  const vf = {
    showName: config.visibleFields?.showName !== false,
    showTitle: config.visibleFields?.showTitle !== false,
    showRole: config.visibleFields?.showRole !== false,
    showId: config.visibleFields?.showId !== false,
    showDob: config.visibleFields?.showDob !== false,
    showGrade: config.visibleFields?.showGrade !== false,
    showExpiry: config.visibleFields?.showExpiry !== false,
    showSchoolName: config.visibleFields?.showSchoolName !== false,
    showLogo: config.visibleFields?.showLogo !== false,
  };

  // Dynamic responsive font multiplier taking user font size into account
  const baseFontSize = config.fontSize || 12;
  const fontMultiplier = Math.max(0.4, Math.min(2.5, (scale / 4.2) * (baseFontSize / 12)));

  // Smart auto-scaling font size for long school names (strictly prevents text wrapping while respecting font size settings)
  const getSchoolNameFontSize = (text: string) => {
    const customElementFontSize = (layout.schoolNamePosition as any)?.fontSize || config.fontSize || 12;
    const len = text.length;
    let basePx = customElementFontSize * fontMultiplier;
    if (len > 35) {
      basePx = Math.max(6.5 * fontMultiplier, (customElementFontSize * fontMultiplier) * (30 / len));
    } else if (len > 22) {
      basePx = Math.max(8 * fontMultiplier, (customElementFontSize * fontMultiplier) * (22 / len));
    } else if (len > 15) {
      basePx = Math.max(9.5 * fontMultiplier, (customElementFontSize * fontMultiplier) * (15 / len));
    }
    return `${basePx}px`;
  };

  const layout = config.layoutConfig || {
    photoPosition: isPortrait ? { x: 26, y: 20, width: 50, height: 60 } : { x: 6, y: 12, width: 22, height: 28 },
    namePosition: isPortrait ? { x: 10, y: 88 } : { x: 33, y: 14 },
    titlePosition: isPortrait ? { x: 10, y: 95 } : { x: 33, y: 19.5 },
    rolePosition: isPortrait ? { x: 10, y: 102 } : { x: 33, y: 25 },
    idPosition: isPortrait ? { x: 10, y: 112 } : { x: 33, y: 31 },
    qrCodePosition: isPortrait ? { x: 38, y: 124, size: 25 } : { x: 63, y: 13, size: 16 },
    barcodePosition: isPortrait ? { x: 10, y: 138 } : { x: 33, y: 38 },
  };

  const titlePos = layout.titlePosition || {
    x: layout.namePosition.x,
    y: layout.namePosition.y + (isPortrait ? 6 : 5.5),
    side: layout.namePosition.side || 'front',
  };

  const logoPos = layout.logoPositionConfig || {
    x: 4,
    y: 3.5,
    side: 'front',
  };

  const schoolNamePos = layout.schoolNamePosition || {
    x: isPortrait ? 12 : 15,
    y: 4,
    side: 'front',
  };

  // Photo shape helper
  const getPhotoShapeStyle = () => {
    switch (photoShape) {
      case 'circle':
        return 'rounded-full';
      case 'rounded':
        return 'rounded-2xl';
      case 'arch':
        return 'rounded-t-full rounded-b-xl';
      case 'hexagon':
        return 'rounded-xl shadow-inner';
      case 'square':
      default:
        return 'rounded-none';
    }
  };

  // Smart Alignment Guides State
  const [alignGuides, setAlignGuides] = useState<{ vLineX?: number; hLineY?: number }>({});

  // Mouse Drag positioning state with Smart Alignment Magnetic Snap
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; initElemX: number; initElemY: number } | null>(null);

  const handleMouseDownElement = (e: React.MouseEvent, key: string, currentX: number, currentY: number) => {
    e.stopPropagation();
    onClickElement?.(key);
    if (!onPositionChange) return;
    setDraggingKey(key);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initElemX: currentX,
      initElemY: currentY,
    };
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (!draggingKey || !dragStartRef.current || !onPositionChange) return;

    const rawX = Math.max(0, Math.min(cardWidthMm - 10, dragStartRef.current.initElemX + (e.clientX - dragStartRef.current.startX) / scale));
    const rawY = Math.max(0, Math.min(cardHeightMm - 10, dragStartRef.current.initElemY + (e.clientY - dragStartRef.current.startY) / scale));

    // Collect all snap target coordinates on current side
    const xTargets: number[] = [
      cardWidthMm / 2, // Card Center X
      5, // Left margin
      cardWidthMm - 5, // Right margin
    ];
    const yTargets: number[] = [
      cardHeightMm / 2, // Card Middle Y
      5, // Top margin
      cardHeightMm - 5, // Bottom margin
    ];

    // Add other element positions as snap targets
    if (layout.photoPosition && draggingKey !== 'photo') xTargets.push(layout.photoPosition.x);
    if (layout.namePosition && draggingKey !== 'name') xTargets.push(layout.namePosition.x);
    if (layout.rolePosition && draggingKey !== 'role') xTargets.push(layout.rolePosition.x);
    if (layout.idPosition && draggingKey !== 'id') xTargets.push(layout.idPosition.x);
    if (layout.barcodePosition && draggingKey !== 'barcode') xTargets.push(layout.barcodePosition.x);
    if (layout.qrCodePosition && draggingKey !== 'qrCode') xTargets.push(layout.qrCodePosition.x);

    if (layout.photoPosition && draggingKey !== 'photo') yTargets.push(layout.photoPosition.y);
    if (layout.namePosition && draggingKey !== 'name') yTargets.push(layout.namePosition.y);
    if (layout.rolePosition && draggingKey !== 'role') yTargets.push(layout.rolePosition.y);
    if (layout.idPosition && draggingKey !== 'id') yTargets.push(layout.idPosition.y);

    (layout.customElements || []).forEach(el => {
      if (el.id !== draggingKey && el.side === side) {
        xTargets.push(el.x);
        yTargets.push(el.y);
      }
    });

    const SNAP_THRESHOLD = 1.8; // mm snap distance
    let snappedX = rawX;
    let snappedY = rawY;
    let matchedVLine: number | undefined;
    let matchedHLine: number | undefined;

    // Check X snap
    for (const targetX of xTargets) {
      if (Math.abs(rawX - targetX) <= SNAP_THRESHOLD) {
        snappedX = targetX;
        matchedVLine = targetX;
        break;
      }
    }

    // Check Y snap
    for (const targetY of yTargets) {
      if (Math.abs(rawY - targetY) <= SNAP_THRESHOLD) {
        snappedY = targetY;
        matchedHLine = targetY;
        break;
      }
    }

    setAlignGuides({ vLineX: matchedVLine, hLineY: matchedHLine });
    onPositionChange(draggingKey, parseFloat(snappedX.toFixed(1)), parseFloat(snappedY.toFixed(1)));
  };

  const handleMouseUpCanvas = () => {
    setDraggingKey(null);
    dragStartRef.current = null;
    setAlignGuides({});
  };

  // Selection outline helper
  const getSelectionBorder = (key: string) => {
    if (selectedElement === key) {
      return 'ring-2 ring-amber-500 ring-offset-2 z-30 cursor-grab active:cursor-grabbing';
    }
    return 'hover:ring-1 hover:ring-blue-400 cursor-pointer z-10';
  };

  return (
    <div ref={containerRef} className="w-full flex justify-center items-center">
      <div
        onMouseMove={handleMouseMoveCanvas}
        onMouseUp={handleMouseUpCanvas}
        onMouseLeave={handleMouseUpCanvas}
        className={`relative select-none overflow-hidden shadow-2xl transition-all duration-300 border border-black/10 dark:border-white/10 ${className}`}
        style={{
          width: `${actualWidth}px`,
          height: `${heightPx}px`,
          backgroundColor,
          color: textColor,
          fontFamily,
          borderRadius: isPortrait ? '20px' : '14px',
        }}
      >
        {/* ── SMART ALIGNMENT GUIDES & MARGIN BORDERS ── */}
        {alignGuides.vLineX !== undefined && (
          <div
            className="absolute top-0 bottom-0 border-l-2 border-dashed border-cyan-400 dark:border-cyan-300 z-50 pointer-events-none shadow-sm"
            style={{ left: `${alignGuides.vLineX * scale}px` }}
          >
            <span className="absolute top-1 left-1 bg-cyan-500 text-white text-[7px] font-mono font-bold px-1 rounded shadow-xs">
              X: {alignGuides.vLineX.toFixed(1)}mm
            </span>
          </div>
        )}
        {alignGuides.hLineY !== undefined && (
          <div
            className="absolute left-0 right-0 border-t-2 border-dashed border-cyan-400 dark:border-cyan-300 z-50 pointer-events-none shadow-sm"
            style={{ top: `${alignGuides.hLineY * scale}px` }}
          >
            <span className="absolute left-1 top-1 bg-cyan-500 text-white text-[7px] font-mono font-bold px-1 rounded shadow-xs">
              Y: {alignGuides.hLineY.toFixed(1)}mm
            </span>
          </div>
        )}

        {/* ── RESPONSIVE BACKGROUND VECTOR SHAPES & HEADERS ── */}
        {headerStyle === 'curved-wave' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Elegant Header Wave */}
            <svg className={`absolute top-0 left-0 w-full ${isPortrait ? 'h-[26%]' : 'h-[32%]'}`} viewBox="0 0 500 120" preserveAspectRatio="none">
              <defs>
                <linearGradient id="waveGradPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={primaryColor} />
                  <stop offset="100%" stopColor={secondaryColor || primaryColor} stopOpacity="0.9" />
                </linearGradient>
              </defs>
              <path d="M0,0 L500,0 L500,75 C360,115 140,115 0,75 Z" fill="url(#waveGradPrimary)" opacity={side === 'back' ? 0.4 : 1} />
            </svg>
            {/* Subtle Bottom Accent Arc */}
            <svg className={`absolute bottom-0 right-0 w-full ${isPortrait ? 'h-[14%]' : 'h-[20%]'}`} viewBox="0 0 500 100" preserveAspectRatio="none">
              <path d="M500,100 L0,100 L0,80 Q250,20 500,60 Z" fill={secondaryColor} opacity="0.15" />
              <path d="M500,100 L200,100 Q380,40 500,30 Z" fill={primaryColor} opacity="0.7" />
            </svg>
          </div>
        )}

        {headerStyle === 'dual-strip' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Dual Layered Wave Header */}
            <svg className={`absolute top-0 left-0 w-full ${isPortrait ? 'h-[28%]' : 'h-[35%]'}`} viewBox="0 0 500 140" preserveAspectRatio="none">
              <path d="M0,0 L500,0 L500,85 C320,135 120,100 0,90 Z" fill={secondaryColor} opacity={side === 'back' ? 0.5 : 1} />
              <path d="M0,0 L500,0 L500,65 C280,110 80,80 0,70 Z" fill={primaryColor} opacity={side === 'back' ? 0.5 : 1} />
            </svg>
            <div
              className={`absolute rounded-full opacity-15 ${isPortrait ? '-bottom-16 -left-16 w-48 h-48' : '-bottom-10 -left-10 w-36 h-36'}`}
              style={{ backgroundColor: primaryColor }}
            />
          </div>
        )}

        {headerStyle === 'sidebar-left' && (
          <div className="absolute inset-0 pointer-events-none">
            <div
              className={`absolute top-0 left-0 bottom-0 ${isPortrait ? 'w-[14%]' : 'w-[16%]'} flex flex-col items-center justify-between py-4 shadow-sm`}
              style={{ backgroundColor: primaryColor }}
            >
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white">
                <GraduationCap size={14} />
              </div>
              <div
                className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 whitespace-nowrap transform -rotate-90 origin-center"
                style={{ width: `${heightPx * 0.6}px`, textAlign: 'center' }}
              >
                {schoolNameText}
              </div>
              <div className="w-2 h-2 rounded-full bg-amber-400" />
            </div>
          </div>
        )}

        {headerStyle === 'arch-frame' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              className={`absolute top-0 left-0 right-0 ${isPortrait ? 'h-[20%]' : 'h-[26%]'}`}
              style={{ backgroundColor: primaryColor, opacity: side === 'back' ? 0.4 : 1 }}
            />
            <svg className={`absolute left-0 w-full ${isPortrait ? 'top-[19%] h-[12%]' : 'top-[25%] h-[16%]'}`} viewBox="0 0 500 80" preserveAspectRatio="none">
              <path d="M0,0 L500,0 C350,65 150,65 0,0 Z" fill={primaryColor} opacity={side === 'back' ? 0.4 : 1} />
            </svg>
            <div
              className="absolute bottom-0 left-0 right-0 h-2.5"
              style={{ backgroundColor: secondaryColor }}
            />
          </div>
        )}

        {headerStyle === 'top-banner' && (
          <div className="absolute inset-0 pointer-events-none">
            <div
              className={`absolute top-0 left-0 right-0 ${isPortrait ? 'h-[20%]' : 'h-[26%]'} flex items-center justify-between px-4 shadow-sm`}
              style={{ backgroundColor: primaryColor }}
            >
              <div className="w-full border-b border-white/20 pb-1 flex justify-between items-center text-white">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Building2 size={14} />
                  <span>{schoolNameText}</span>
                </div>
                <span className="text-[9px] uppercase tracking-wider font-semibold opacity-80">{cardTitle}</span>
              </div>
            </div>
          </div>
        )}

        {headerStyle === 'angled-split' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <svg className="absolute top-0 left-0 w-full h-[30%]" viewBox="0 0 500 120" preserveAspectRatio="none">
              <polygon points="0,0 500,0 500,70 0,110" fill={primaryColor} opacity={side === 'back' ? 0.4 : 1} />
              <polygon points="0,110 500,70 500,85 0,120" fill={secondaryColor} opacity={side === 'back' ? 0.4 : 1} />
            </svg>
          </div>
        )}

        {/* ── FRONT SIDE CONTENT ── */}
        {side === 'front' && (
          <div className="relative w-full h-full">
            {/* School Logo Element (Freely Draggable & Repositionable) */}
            {(!logoPos.side || logoPos.side === 'front') && vf.showLogo && (
              <div
                onMouseDown={(e) => handleMouseDownElement(e, 'logo', logoPos.x, logoPos.y)}
                onClick={() => onClickElement?.('logo')}
                className={`absolute transition-all z-30 cursor-grab active:cursor-grabbing ${getSelectionBorder('logo')}`}
                style={{
                  left: `${logoPos.x * scale}px`,
                  top: `${logoPos.y * scale}px`,
                }}
              >
                {activeLogoUrl && !logoFailed ? (
                  <img
                    src={getFullImageUrl(activeLogoUrl)}
                    alt="School Logo"
                    className="h-7 w-auto max-w-[85px] object-contain drop-shadow-md rounded-full transition-transform hover:scale-105"
                    onError={() => {
                      if (!activeLogoUrl?.startsWith('data:')) {
                        setLogoFailed(true);
                      }
                    }}
                  />
                ) : (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm bg-white/20 backdrop-blur-sm border border-white/30 hover:bg-white/30"
                  >
                    <GraduationCap size={14} />
                  </div>
                )}
              </div>
            )}

            {/* School Name Title Element (Freely Draggable & Repositionable) */}
            {(!schoolNamePos.side || schoolNamePos.side === 'front') && vf.showSchoolName && (
              <div
                onMouseDown={(e) => handleMouseDownElement(e, 'schoolName', schoolNamePos.x, schoolNamePos.y)}
                onClick={() => onClickElement?.('schoolName')}
                className={`absolute transition-all z-30 cursor-grab active:cursor-grabbing ${getSelectionBorder('schoolName')}`}
                style={{
                  left: `${schoolNamePos.x * scale}px`,
                  top: `${schoolNamePos.y * scale}px`,
                }}
              >
                <span
                  className="font-extrabold tracking-tight text-white drop-shadow-sm transition-all px-1 rounded whitespace-nowrap overflow-hidden text-ellipsis inline-block"
                  style={{
                    color: (schoolNamePos as any)?.color || '#FFFFFF',
                    fontSize: getSchoolNameFontSize(schoolNameText),
                    fontFamily: (schoolNamePos as any)?.fontFamily || fontFamily,
                  }}
                >
                  {schoolNameText}
                </span>
              </div>
            )}

            {/* Photo Frame */}
            {(!layout.photoPosition.side || layout.photoPosition.side === 'front') && (
              <div
                onMouseDown={(e) => handleMouseDownElement(e, 'photo', layout.photoPosition.x, layout.photoPosition.y)}
                onClick={() => onClickElement?.('photo')}
                className={`absolute transition-all ${getSelectionBorder('photo')}`}
                style={{
                  left: `${layout.photoPosition.x * scale}px`,
                  top: `${layout.photoPosition.y * scale}px`,
                  width: `${layout.photoPosition.width * scale}px`,
                  height: `${layout.photoPosition.height * scale}px`,
                }}
              >
                <div
                  className={`w-full h-full ${getPhotoShapeStyle()} overflow-hidden shadow-lg flex items-center justify-center bg-gray-100 dark:bg-gray-800`}
                  style={{
                    border: `${photoBorderWidth}px solid ${photoBorderColor}`,
                  }}
                >
                  {user.photoUrl ? (
                    <img src={user.photoUrl} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <UserIcon size={Math.round(layout.photoPosition.width * scale * 0.4)} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* User Name */}
            {(!layout.namePosition.side || layout.namePosition.side === 'front') && vf.showName && (
              <div
                onMouseDown={(e) => handleMouseDownElement(e, 'name', layout.namePosition.x, layout.namePosition.y)}
                onClick={() => onClickElement?.('name')}
                className={`absolute transition-all ${getSelectionBorder('name')} ${isPortrait ? 'text-center w-full px-4' : ''}`}
                style={{
                  left: isPortrait ? '0' : `${(headerStyle === 'sidebar-left' ? layout.namePosition.x + 8 : layout.namePosition.x) * scale}px`,
                  top: `${layout.namePosition.y * scale}px`,
                }}
              >
                <h2
                  className="font-black leading-snug uppercase tracking-wide drop-shadow-xs truncate"
                  style={{
                    color: (layout.namePosition as any)?.color || textColor,
                    fontSize: `${((layout.namePosition as any)?.fontSize || 13) * fontMultiplier}px`,
                    fontFamily: (layout.namePosition as any)?.fontFamily || fontFamily,
                  }}
                >
                  {user.name}
                </h2>
              </div>
            )}

            {/* Card Subtitle / Header Title */}
            {(!titlePos.side || titlePos.side === 'front') && vf.showTitle && (
              <div
                onMouseDown={(e) => handleMouseDownElement(e, 'title', titlePos.x, titlePos.y)}
                onClick={() => onClickElement?.('title')}
                className={`absolute transition-all ${getSelectionBorder('title')} ${isPortrait ? 'text-center w-full px-4' : ''}`}
                style={{
                  left: isPortrait ? '0' : `${(headerStyle === 'sidebar-left' ? titlePos.x + 8 : titlePos.x) * scale}px`,
                  top: `${titlePos.y * scale}px`,
                }}
              >
                <div
                  className="font-bold tracking-wider uppercase truncate"
                  style={{
                    color: (titlePos as any)?.color || (primaryColor === '#09090B' || primaryColor === '#0F172A' || primaryColor === '#18181B' ? (secondaryColor || '#EAB308') : primaryColor),
                    fontSize: `${((titlePos as any)?.fontSize || 9) * fontMultiplier}px`,
                    fontFamily: (titlePos as any)?.fontFamily || fontFamily,
                  }}
                >
                  {cardTitle}
                </div>
              </div>
            )}

            {/* User Role Badge / Pill */}
            {(!layout.rolePosition.side || layout.rolePosition.side === 'front') && vf.showRole && (
              <div
                onMouseDown={(e) => handleMouseDownElement(e, 'role', layout.rolePosition.x, layout.rolePosition.y)}
                onClick={() => onClickElement?.('role')}
                className={`absolute transition-all ${getSelectionBorder('role')} ${isPortrait ? 'w-full flex justify-center' : ''}`}
                style={{
                  left: isPortrait ? '0' : `${(headerStyle === 'sidebar-left' ? layout.rolePosition.x + 8 : layout.rolePosition.x) * scale}px`,
                  top: `${layout.rolePosition.y * scale}px`,
                }}
              >
                <span
                  className="inline-block font-extrabold uppercase px-2.5 py-0.5 rounded-full shadow-xs text-center"
                  style={{
                    backgroundColor: (layout.rolePosition as any)?.bgColor || primaryColor,
                    color: (layout.rolePosition as any)?.color || '#FFFFFF',
                    fontSize: `${((layout.rolePosition as any)?.fontSize || 9) * fontMultiplier}px`,
                    fontFamily: (layout.rolePosition as any)?.fontFamily || fontFamily,
                  }}
                >
                  {user.role}
                </span>
              </div>
            )}

            {/* Details Table / Grid (ID, DOB, Address, Expiry) */}
            {(!layout.idPosition.side || layout.idPosition.side === 'front') && (vf.showId || vf.showDob || vf.showGrade || vf.showExpiry) && (
              <div
                onMouseDown={(e) => handleMouseDownElement(e, 'id', layout.idPosition.x, layout.idPosition.y)}
                onClick={() => onClickElement?.('id')}
                className={`absolute transition-all ${getSelectionBorder('id')} ${isPortrait ? 'w-full px-8' : ''}`}
                style={{
                  left: isPortrait ? '0' : `${(headerStyle === 'sidebar-left' ? layout.idPosition.x + 8 : layout.idPosition.x) * scale}px`,
                  top: `${layout.idPosition.y * scale}px`,
                }}
              >
                <div
                  className="space-y-1.5 sm:space-y-2 font-medium"
                  style={{
                    color: (layout.idPosition as any)?.color || textColor,
                    fontSize: `${((layout.idPosition as any)?.fontSize || 9.5) * fontMultiplier}px`,
                    fontFamily: (layout.idPosition as any)?.fontFamily || fontFamily,
                  }}
                >
                  {vf.showId && (
                    <div className="flex items-center gap-3 justify-between">
                      <span className="font-bold opacity-60 uppercase tracking-wide">{idLabel} :</span>
                      <span className="font-mono font-bold tracking-wider">{user.idNumber}</span>
                    </div>
                  )}
                  {vf.showDob && user.dob && (
                    <div className="flex items-center gap-3 justify-between">
                      <span className="font-bold opacity-60 uppercase tracking-wide">{dobLabel} :</span>
                      <span className="font-medium">{user.dob}</span>
                    </div>
                  )}
                  {vf.showGrade && user.departmentOrGrade && (
                    <div className="flex items-center gap-3 justify-between">
                      <span className="font-bold opacity-60 uppercase tracking-wide">{gradeLabel} :</span>
                      <span className="font-medium">{user.departmentOrGrade}</span>
                    </div>
                  )}
                  {vf.showExpiry && user.expiresAt && (
                    <div className="flex items-center gap-3 justify-between">
                      <span className="font-bold opacity-60 uppercase tracking-wide">{expiryLabel} :</span>
                      <span className="font-bold text-amber-700 dark:text-amber-400">{user.expiresAt}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Custom Elements Rendered on Front Canvas */}
            {(layout.customElements || []).filter(el => el.side === 'front' || !el.side).map(el => (
              <div
                key={el.id}
                onMouseDown={(e) => handleMouseDownElement(e, el.id, el.x, el.y)}
                onClick={(e) => { e.stopPropagation(); onClickElement?.(el.id); }}
                className={`absolute transition-all cursor-grab active:cursor-grabbing ${getSelectionBorder(el.id)}`}
                style={{
                  left: `${el.x * scale}px`,
                  top: `${el.y * scale}px`,
                }}
              >
                {el.type === 'badge' ? (
                  <span
                    className="inline-block font-extrabold uppercase px-2.5 py-0.5 rounded-full shadow-xs text-center"
                    style={{
                      backgroundColor: el.bgColor || primaryColor,
                      color: el.color || '#FFFFFF',
                      fontSize: `${(el.fontSize || 9) * fontMultiplier}px`,
                    }}
                  >
                    {el.label}
                  </span>
                ) : (
                  <div style={{ color: el.color || textColor, fontSize: `${(el.fontSize || 10) * fontMultiplier}px` }}>
                    {el.sublabel && <span className="font-bold opacity-60 uppercase mr-1.5">{el.sublabel}:</span>}
                    <span className="font-semibold">{el.label}</span>
                  </div>
                )}
              </div>
            ))}

            {/* Barcode (If placed on Front or Single-Sided & Enabled) */}
            {(!layout.barcodePosition.side || layout.barcodePosition.side === 'front') && config.showBarcode === true && (
              <div
                onMouseDown={(e) => handleMouseDownElement(e, 'barcode', layout.barcodePosition.x, layout.barcodePosition.y)}
                onClick={() => onClickElement?.('barcode')}
                className={`absolute transition-all z-30 cursor-grab active:cursor-grabbing ${getSelectionBorder('barcode')}`}
                style={{
                  left: `${layout.barcodePosition.x * scale}px`,
                  top: `${layout.barcodePosition.y * scale}px`,
                }}
              >
                <div className="bg-white p-1.5 rounded-lg border border-gray-300 shadow-xs flex flex-col items-center">
                  <div className="flex items-center h-5 gap-[1.5px]">
                    {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 3, 1, 4, 2].map((w, idx) => (
                      <div key={idx} className="bg-black h-full" style={{ width: `${w}px` }} />
                    ))}
                  </div>
                  <span className="text-[7px] font-mono tracking-widest text-black mt-0.5">{user.idNumber}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── BACK SIDE CONTENT (FULLY THEME MATCHED & CUSTOMIZABLE) ── */}
        {side === 'back' && (
          <div className="relative w-full h-full flex flex-col justify-between overflow-hidden">
            {/* Top Edge-to-Edge Theme-Matched Magnetic Security Stripe */}
            <div
              className="w-full h-9 z-20 flex items-center justify-between px-4 shadow-sm border-b border-black/30"
              style={{
                background: `linear-gradient(90deg, ${primaryColor} 0%, #0F172A 50%, ${secondaryColor || primaryColor} 100%)`
              }}
            >
              <span className="text-[8px] font-mono text-amber-400 font-extrabold uppercase tracking-widest drop-shadow-xs">MAGNETIC SECURITY STRIPE</span>
              <span className="text-[8px] font-mono text-gray-200 font-bold opacity-90">AUTHORIZED HOLDER ONLY</span>
            </div>

            {/* Back Card Details */}
            <div className="flex-1 px-4 pt-3 pb-2 flex flex-col justify-between relative">
              <div className="flex items-center justify-between gap-4">
                {/* Terms and Security Info */}
                <div className="flex-1 space-y-1.5 text-[9px]" style={{ color: textColor }}>
                  <p className="font-extrabold uppercase tracking-wide drop-shadow-xs" style={{ color: primaryColor === '#09090B' || primaryColor === '#1E293B' ? (secondaryColor || '#EAB308') : primaryColor }}>
                    {schoolNameText}
                  </p>
                  <p className="text-[8px] leading-tight opacity-85">This credential is official property of {schoolNameText}. If found, please return to the school administration office.</p>
                  <p className="text-[7.5px] font-mono font-bold tracking-tight opacity-90" style={{ color: secondaryColor || primaryColor }}>
                    Emergency Helpline: +232 (0) 76-000-111 / +1 (800) 555-0199
                  </p>
                </div>

                {/* Back QR Code (Draggable & Repositionable) */}
                {config.showQrCode !== false && (
                  <div
                    onMouseDown={(e) => handleMouseDownElement(e, 'qrCode', layout.qrCodePosition.x || 63, layout.qrCodePosition.y || 14)}
                    onClick={() => onClickElement?.('qrCode')}
                    className={`transition-all flex-shrink-0 cursor-grab active:cursor-grabbing ${getSelectionBorder('qrCode')}`}
                  >
                    <div className="bg-white/95 backdrop-blur-xs p-1.5 rounded-xl border border-gray-300 shadow-md flex flex-col items-center">
                      <QrCode size={Math.round((layout.qrCodePosition.size || 20) * scale)} className="text-gray-900" />
                      <span className="text-[6px] font-mono font-extrabold mt-0.5 text-blue-900 uppercase">VERIFY QR</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Custom Elements Rendered on Back Canvas */}
              {(layout.customElements || []).filter(el => el.side === 'back').map(el => (
                <div
                  key={el.id}
                  onMouseDown={(e) => handleMouseDownElement(e, el.id, el.x, el.y)}
                  onClick={(e) => { e.stopPropagation(); onClickElement?.(el.id); }}
                  className={`absolute transition-all cursor-grab active:cursor-grabbing ${getSelectionBorder(el.id)}`}
                  style={{
                    left: `${el.x * scale}px`,
                    top: `${el.y * scale}px`,
                  }}
                >
                  {el.type === 'badge' ? (
                    <span
                      className="inline-block font-extrabold uppercase px-2.5 py-0.5 rounded-full shadow-xs text-center"
                      style={{
                        backgroundColor: el.bgColor || primaryColor,
                        color: el.color || '#FFFFFF',
                        fontSize: `${(el.fontSize || 9) * fontMultiplier}px`,
                      }}
                    >
                      {el.label}
                    </span>
                  ) : (
                    <div style={{ color: el.color || textColor, fontSize: `${(el.fontSize || 10) * fontMultiplier}px` }}>
                      {el.sublabel && <span className="font-bold opacity-60 uppercase mr-1.5">{el.sublabel}:</span>}
                      <span className="font-semibold">{el.label}</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Back Barcode (Enabled Only When Explicitly Turned ON) */}
              {config.showBarcode === true && (
                <div
                  onMouseDown={(e) => handleMouseDownElement(e, 'barcode', layout.barcodePosition.x || 10, layout.barcodePosition.y || 40)}
                  onClick={() => onClickElement?.('barcode')}
                  className={`w-full flex flex-col items-center justify-center transition-all mt-2 cursor-grab active:cursor-grabbing ${getSelectionBorder('barcode')}`}
                >
                  <div className="bg-white px-3 py-1 rounded-lg border border-gray-300 shadow-xs flex flex-col items-center w-4/5">
                    <div className="flex items-center h-5 w-full justify-between gap-[1px]">
                      {[2, 1, 3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 3].map((w, idx) => (
                        <div key={idx} className="bg-black h-full" style={{ width: `${w}px` }} />
                      ))}
                    </div>
                    <span className="text-[8px] font-mono font-bold tracking-widest text-black mt-0.5">{user.idNumber}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
