/**
 * BookletContent — the Sierra Leone report booklet markup.
 *
 * 6 logical pages (reading order): 1 front cover · 2 grading · 3–4 results ·
 * 5 blank · 6 back cover.
 *
 * Renders exactly 3 `.booklet-sheet` nodes (saddle-stitch imposition):
 *   Sheet 1: LEFT back cover | RIGHT front cover   (divided by fold centre line)
 *   Sheet 2: LEFT grading    | RIGHT blank          (divided by fold centre line)
 *   Sheet 3: results as ONE continuous full-width spread — no centre line.
 *            It is the innermost sheet of the booklet, so nothing is cut at the
 *            fold and the results flow seamlessly: subject → cognitive →
 *            affective → psychomotor → footer.
 *
 * Printed double-sided and folded, the reader sees: front cover → grading →
 * results → back cover.
 *
 * Rendered identically in the on-screen preview and the hidden print portal so
 * the printed output matches what the user sees.
 */

import React, { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import QRCode from 'qrcode';
import {
  ReportCard, SLTerm,
  AFFECTIVE_TRAITS, PSYCHOMOTOR_SKILLS, RATING_LEGEND, SL_GRADING_METHOD, getGradingMethod,
} from '@services/reportCardService';
import {
  type ReportCardBorderStyle,
  resolveBorder,
  svgToDataUrl,
} from '@lib/reportCardBorders';

export type { ReportCardBorderStyle } from '@lib/reportCardBorders';

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

export type PhotoFrameStyle = 'none' | 'classic' | 'gold' | 'navy' | 'rounded' | 'circle';

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
  /** Frame style for the front-cover student photo. */
  photoFrame?: PhotoFrameStyle;
  /** Uploaded official stamp/seal image for the front cover. When set, it
   *  replaces the placeholder SEAL circle. */
  stampUrl?: string;
  /** Uploaded principal's signature image for the front cover. When set, it
   *  replaces the placeholder script name. */
  signatureUrl?: string;
  /** Scale factor (0.5–2) for the uploaded stamp image on the front cover. */
  stampScale?: number;
  /** Scale factor (0.5–2) for the uploaded signature image on the front cover. */
  signatureScale?: number;
}

/** Photo frame style definitions — shared by preview + PDF. */
export const PHOTO_FRAME_OPTIONS: { value: PhotoFrameStyle; label: string }[] = [
  { value: 'classic', label: 'Classic (black)' },
  { value: 'gold',    label: 'Gold + Navy' },
  { value: 'navy',    label: 'Navy solid' },
  { value: 'rounded', label: 'Rounded corners' },
  { value: 'circle',  label: 'Circular' },
  { value: 'none',    label: 'No frame (plain)' },
];







/**
 * FrontCoverFrame — wraps ONLY the front-cover content with the chosen border.
 *  - 'none'  → plain padding, no border
 *  - 'line'  → CSS border (color/width/style/radius)
 *  - 'frame' → a full-cover decorative SVG frame (absolutely positioned),
 *              with the content inset by the frame's padding.
 * The frame fills the front-cover half exactly and never bleeds onto the back
 * cover, because it lives inside the right-hand grid cell.
 */
const FrontCoverFrame: React.FC<{
  border: ReturnType<typeof resolveBorder>;
  children: React.ReactNode;
}> = ({ border, children }) => {
  if (border.kind === 'frame' && border.frameSvg) {
    const pad = border.padding;
    return (
      <div className="relative w-full h-full">
        {/* Decorative frame — stretched to fill the cover, behind the content. */}
        <img
          src={svgToDataUrl(border.frameSvg)}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 w-full h-full"
          style={{ zIndex: 0 }}
        />
        <div className="relative w-full h-full" style={{ zIndex: 1, padding: pad }}>
          {children}
        </div>
      </div>
    );
  }

  if (border.kind === 'line') {
    return (
      <div
        className="w-full h-full"
        style={{
          border: `${border.width}px ${border.style} ${border.color}`,
          borderRadius: border.radius,
          padding: border.padding,
          boxSizing: 'border-box',
        }}
      >
        {children}
      </div>
    );
  }

  // none
  return <div className="w-full h-full" style={{ padding: border.padding, boxSizing: 'border-box' }}>{children}</div>;
};

/**
 * StudentPhoto — front-cover passport portrait with a selectable frame style.
 * 'none' shows just the photo with a hairline; other styles add decorative
 * framing. Falls back to a placeholder when no photo is on file.
 */
const StudentPhoto: React.FC<{ photoUrl?: string | null; name: string; frame: PhotoFrameStyle }> = ({ photoUrl, name, frame }) => {
  const circle = frame === 'circle';
  const dims = circle ? 'w-28 h-28 rounded-full' : 'w-24 h-32';
  const radius = frame === 'rounded' ? 'rounded-xl' : circle ? 'rounded-full' : '';

  const inner = photoUrl ? (
    <img
      src={photoUrl}
      alt={`${name} photo`}
      className={`${dims} ${radius} object-cover block bg-white`}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
    />
  ) : (
    <div className={`${dims} ${radius} flex flex-col items-center justify-center bg-gray-50 text-gray-400`}>
      <ImageIcon size={28} />
      <span className="text-[10px] uppercase font-semibold mt-1 tracking-wide">No Photo</span>
    </div>
  );

  const caption = (
    <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 whitespace-nowrap shadow ${circle ? 'hidden' : ''}`}>
      Student
    </div>
  );

  switch (frame) {
    case 'none':
      return <div className="relative" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>{inner}</div>;
    case 'classic':
      return (
        <div className="relative p-1 bg-white shadow-lg" style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.18)' }}>
          <div className="border-4 border-gray-900">{inner}</div>{caption}
        </div>
      );
    case 'navy':
      return (
        <div className="relative p-1 bg-white shadow-lg" style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.18)' }}>
          <div className="border-4 border-[#1e3a8a]">{inner}</div>{caption}
        </div>
      );
    case 'rounded':
      return (
        <div className="relative p-1.5 bg-white rounded-2xl shadow-lg" style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.18)' }}>
          <div className="rounded-xl overflow-hidden ring-2 ring-gray-300">{inner}</div>{caption}
        </div>
      );
    case 'circle':
      return (
        <div className="relative p-1 bg-white rounded-full shadow-lg" style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.18)' }}>
          <div className="rounded-full overflow-hidden ring-4 ring-[#c8a24a]">{inner}</div>
        </div>
      );
    case 'gold':
    default:
      return (
        <div className="relative p-1 bg-white shadow-lg" style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.18)' }}>
          <div className="p-[3px]" style={{ background: 'linear-gradient(135deg,#1e3a8a,#3b82f6)' }}>
            <div className="p-[2px] bg-[#c8a24a]">{inner}</div>
          </div>{caption}
        </div>
      );
  }
};

export const BookletContent: React.FC<BookletContentProps> = ({
  card, school, schoolName, schoolAddress, schoolLogo, shortName, showCover, showInner,
  showGrading = true, borderStyle, showWatermark = true, watermarkOpacity = 0.06, watermarkSize = 450, showStudentPhoto = true,
  photoFrame = 'gold', stampUrl, signatureUrl, stampScale = 1, signatureScale = 1,
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

  // Resolve the front-cover border once. The border decorates the FRONT COVER
  // only (right half of sheet 1) — not the whole sheet, not the back cover.
  const border = resolveBorder(borderStyle);

  const PAGE_W = 1404;
  const PAGE_H = 993;
  const commonPageClass = "booklet-sheet bg-white text-gray-900 mx-auto rounded-lg shadow-lg w-full";
  const commonPageStyle: React.CSSProperties = { width: PAGE_W, minHeight: PAGE_H, height: PAGE_H };
  // No-border style for inner sheets
  const noBorderStyle: React.CSSProperties = { border: 'none', padding: 0, borderRadius: 0 };

  // Sheet 1 (cover) — the SHEET itself is borderless. The decorative frame is
  // applied to the FRONT COVER half only (the right side), via FrontCoverFrame.
  const renderCoverSheet = (key: string, left: React.ReactNode, right: React.ReactNode, extraClass = '') => {
    const inner = (
      <div className={`grid grid-cols-2 divide-x-2 divide-dashed divide-gray-500 w-full h-full`}>
        <div className="relative overflow-hidden">{left}</div>
        <div className="relative overflow-hidden">
          <FrontCoverFrame border={border}>{right}</FrontCoverFrame>
        </div>
      </div>
    );
    return (
      <div key={key} className={`${commonPageClass} ${extraClass} relative`} style={{ ...noBorderStyle, ...commonPageStyle, display: 'flex' }}>
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
    <div className="flex flex-col justify-between text-center h-full overflow-hidden">
      <div className="space-y-2">
        <div className="flex items-center justify-center">
          {schoolLogo ? (<img src={schoolLogo} alt="School logo" className="w-28 h-28 object-contain" />) : (<div className="w-28 h-28 rounded-full bg-gray-900 text-white flex items-center justify-center text-3xl font-extrabold shadow">{shortName}</div>)}
        </div>
        <h1 className="text-2xl font-extrabold uppercase tracking-wide leading-tight text-gray-900">{schoolName}</h1>
        {schoolAddress && <p className="text-[14px] font-semibold text-gray-600">{schoolAddress}</p>}
        {school?.motto && <p className="text-[14px] italic font-semibold text-gray-600">Motto: {school.motto}</p>}
        {(school?.phone || school?.email || school?.website) && (
          <p className="text-[13px] text-gray-500">
            {[school?.phone, school?.email, school?.website].filter(Boolean).join(' · ')}
          </p>
        )}
        <div className="inline-block bg-gray-900 text-white font-bold px-5 py-1.5 text-[15px] uppercase tracking-wider">Report Card</div>
        {card.student.class_level && <p className="text-[14px] font-bold text-gray-700 uppercase">{card.student.class_level}</p>}
      </div>
      {showStudentPhoto && (
        <div className="flex justify-center">
          <StudentPhoto photoUrl={card.student.photo_url} name={card.student.name} frame={photoFrame} />
        </div>
      )}
      <div className="w-full space-y-2 text-[15px] border-t-2 border-b-2 border-gray-900 py-3 my-1">
        <div className="flex justify-between border-b border-gray-300 pb-1.5"><span className="font-bold text-gray-600">Name of pupil:</span><span className="font-bold">{card.student.name}</span></div>
        <div className="flex justify-between border-b border-gray-300 pb-1.5"><span className="font-bold text-gray-600">Admission No:</span><span className="font-bold">{card.student.admission_no}</span></div>
        <div className="flex justify-between border-b border-gray-300 pb-1.5"><span className="font-bold text-gray-600">Class / Form:</span><span className="font-bold">{card.student.class_name || '—'}</span></div>
        <div className="flex justify-between"><span className="font-bold text-gray-600">Academic Year:</span><span className="font-bold">{card.academic_year}</span></div>
      </div>
      <div className="grid grid-cols-2 gap-4 w-full text-[14px]">
        {/* Official Stamp — when an image is uploaded it fills the box and the
            placeholder seal is hidden; otherwise show the dashed placeholder. */}
        <div className={`h-28 flex flex-col p-2 ${stampUrl ? 'border-2 border-gray-200' : 'border-2 border-dashed border-gray-400'}`}>
          <span className="text-[13px] font-bold text-gray-500 uppercase flex-shrink-0">Official Stamp</span>
          {stampUrl ? (
            <div className="flex-1 min-h-0 flex items-center justify-center mt-1 overflow-hidden">
              <img src={stampUrl} alt="Official school stamp" className="w-full h-full object-contain" style={{ transform: `scale(${stampScale})` }} />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-16 h-16 border-2 border-blue-900 rounded-full flex items-center justify-center text-[10px] font-bold text-blue-900 transform -rotate-12 opacity-70 text-center leading-tight">{shortName}<br/>SEAL</div>
            </div>
          )}
        </div>
        {/* Principal's Signature — when an image is uploaded it fills the box and
            BOTH the placeholder name and the "Date:" line are hidden; otherwise
            show the placeholder name and a Date line. */}
        <div className={`h-28 flex flex-col p-2 ${signatureUrl ? 'border-2 border-gray-200' : 'border-2 border-dashed border-gray-400'}`}>
          <span className="text-[13px] font-bold text-gray-500 uppercase flex-shrink-0">Principal's Signature</span>
          {signatureUrl ? (
            <div className="flex-1 min-h-0 flex items-center justify-center mt-1 overflow-hidden">
              <img src={signatureUrl} alt="Principal's signature" className="w-full h-full object-contain" style={{ transform: `scale(${signatureScale})` }} />
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between">
              <div className="flex-1 flex items-center justify-center">
                {school?.principal_name && <span className="italic font-bold font-serif text-lg text-blue-900/40 text-center">{school.principal_name}</span>}
              </div>
              <div className="border-b border-gray-500 pb-0.5 flex-shrink-0"><span className="text-[13px] text-gray-500 uppercase">Date:</span></div>
            </div>
          )}
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
              <span className="whitespace-nowrap text-[15px]">{c.meaning}</span>
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
              <p className="text-[14px] text-gray-600 leading-tight mt-1">{a.meaning}</p>
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
          <div className="text-[15px] text-left flex-1">
            <p className="font-extrabold uppercase text-[17px]">Digital Verification System</p>
            <p className="text-gray-700 leading-snug mt-1">Scan with a smartphone to verify this report card online and view the digital copy.</p>
            <div className="flex gap-6 mt-1.5">
              <p className="text-gray-500">Year: <span className="font-bold text-gray-700">{card.academic_year}</span></p>
              <p className="text-gray-500">Status: <span className="text-green-700 font-extrabold">Active</span></p>
            </div>
          </div>
        </div>
        <p className="text-center italic text-[15px] text-gray-700 border-t border-gray-300 pt-2">
          This progress report is not valid unless it is signed by Principal and carries the official school stamp.
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-4">
      {showCover && renderCoverSheet('s1outer', backCover, frontCover)}
      {showCover && showGrading && renderSheet('s2outer', gradingPage, blankPage)}
      {showInner && renderFullSheet('s2inner', (
        <ResultsFullSpread
          card={card}
          schoolLogo={schoolLogo}
          shortName={shortName}
          // Watermark is intentionally OFF on the results sheet — it should only
          // appear on the back cover. Keep the other props for layout parity.
          showWatermark={false}
          watermarkOpacity={watermarkOpacity}
          watermarkSize={watermarkSize}
        />
      ))}
    </div>
  );
};

// ── Results FULL spread (pages 4 & 5 combined, no centre divider) ─────────────
// One continuous table: Subject → Cognitive → Affective → Psychomotor, then
// the footer block (attendance, guidance, signatures, promotion).
const ResultsFullSpread: React.FC<{
  card: ReportCard;
  schoolLogo?: string;
  shortName?: string;
  showWatermark?: boolean;
  watermarkOpacity?: number;
  watermarkSize?: number;
}> = ({ card, schoolLogo, shortName = 'SCH', showWatermark = true, watermarkOpacity = 0.06, watermarkSize = 450 }) => {
  const rowCount = Math.max(card.subjects.length, AFFECTIVE_TRAITS.length, PSYCHOMOTOR_SKILLS.length);
  const aff = card.domain_ratings.affective || {};
  const psy = card.domain_ratings.psychomotor || {};
  return (
    <div className="p-4 flex flex-col h-full text-gray-900 overflow-hidden relative">
      {/* Faint logo watermark behind the results grid (security overlay) */}
      {showWatermark && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ opacity: watermarkOpacity, zIndex: 0 }}>
          {schoolLogo ? (
            <img src={schoolLogo} alt="" className="object-contain" style={{ width: watermarkSize, height: watermarkSize }} />
          ) : (
            <div className="rounded-full bg-gray-900 text-white flex items-center justify-center font-extrabold" style={{ width: watermarkSize * 0.6, height: watermarkSize * 0.6, fontSize: watermarkSize * 0.15 }}>{shortName}</div>
          )}
        </div>
      )}
      {/* Content sits above the watermark */}
      <div className="relative flex flex-col h-full" style={{ zIndex: 1 }}>
      {/* Header row */}
      <div className="grid grid-cols-3 gap-2 text-[15px] border-b-2 border-gray-900 pb-2 mb-2 flex-shrink-0">
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
        <table className="w-full h-full border-collapse text-[14px]" style={{ tableLayout: 'fixed' }}>
          {/* Explicit widths: ratings (1–5) need little room, so the score
              columns get the space and the larger print size still fits. */}
          <colgroup>
            <col style={{ width: 140 }} />
            {Array.from({ length: 14 }).map((_, i) => <col key={`cc${i}`} />)}
            {[0, 1].map((d) => (
              <React.Fragment key={`dg${d}`}>
                <col style={{ width: 20 }} />
                {Array.from({ length: 10 }).map((_, i) => <col key={`dc${d}${i}`} style={{ width: 26 }} />)}
                <col style={{ width: 36 }} />
              </React.Fragment>
            ))}
          </colgroup>
          <thead>
            {/* Row 1: section banners */}
            <tr className="text-center font-bold uppercase">
              <th rowSpan={3} className="border border-gray-900 p-0.5 align-bottom text-left">Subject</th>
              <th colSpan={14} className="border border-gray-900 p-0.5 bg-blue-50">* Cognitive</th>
              <th rowSpan={3} className="border border-gray-900 p-0.5 align-bottom">#</th>
              <th colSpan={11} className="border border-gray-900 p-0.5 bg-purple-50">* Affective</th>
              <th rowSpan={3} className="border border-gray-900 p-0.5 align-bottom">#</th>
              <th colSpan={11} className="border border-gray-900 p-0.5 bg-green-50">* Psychomotor</th>
            </tr>
            {/* Row 2: term group headers */}
            <tr className="text-center font-bold text-[12px]">
              {TERM_KEYS.map((t) => <th key={`c${t}`} colSpan={4} className="border border-gray-900 p-0.5 bg-blue-50/60">{TERM_SHORT[t]}</th>)}
              <th colSpan={2} className="border border-gray-900 p-0.5 bg-amber-50">YEARLY</th>
              {['T1', 'T2', 'T3'].map((t) => <th key={`a${t}`} colSpan={3} className="border border-gray-900 p-0.5 bg-purple-50/60">{t}</th>)}
              <th colSpan={2} className="border border-gray-900 p-0.5 bg-amber-50">YEARLY</th>
              {['T1', 'T2', 'T3'].map((t) => <th key={`p${t}`} colSpan={3} className="border border-gray-900 p-0.5 bg-green-50/60">{t}</th>)}
              <th colSpan={2} className="border border-gray-900 p-0.5 bg-amber-50">YEARLY</th>
            </tr>
            {/* Row 3: column sub-headers */}
            <tr className="text-center font-semibold text-[12px]">
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
                  {/* Totals span the Mn + Rnk cells so "12th/45" fits at print size */}
                  {TERM_KEYS.map((t) => (
                    <React.Fragment key={t}>
                      <td className="border border-gray-700 p-px" />
                      <td className="border border-gray-700 p-px" />
                      <td colSpan={2} className="border border-gray-700 p-px bg-blue-100/40 whitespace-nowrap">{termVal(t)}</td>
                    </React.Fragment>
                  ))}
                  <td colSpan={2} className="border border-gray-700 p-px bg-amber-100/40 whitespace-nowrap">{yearlyVal}</td>
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
      <div className="border-t-2 border-gray-900 mt-2 pt-2 grid grid-cols-12 gap-x-4 text-[14px] flex-shrink-0">
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
                  <div className="text-[13px] text-gray-600">Teacher's Sign and Date</div>
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
          <div className="text-[13px] text-gray-600">Principal's Signature and date</div>
          <div className="font-bold uppercase text-[13px] pt-1">Terms</div>
          <div className="text-[13px] space-y-0.5">
            <div>Term 1 <span className="border-b border-dotted border-gray-500 inline-block w-20" /></div>
            <div>Term 2 <span className="border-b border-dotted border-gray-500 inline-block w-20" /></div>
            <div>Term 3 <span className="border-b border-dotted border-gray-500 inline-block w-20" /></div>
          </div>
          <div className="pt-1">
            <span className="italic">Principal's End of Year Comments:</span>
            <span className="border-b border-dotted border-gray-500 italic px-1">{card.meta?.principal_comment || ''}</span>
          </div>
          <div className="pt-1 font-bold uppercase text-[14px]">
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
            <div className="text-[13px] text-gray-500 normal-case">Yearly: {card.yearly_summary.percentage}% · Position {ordinal(card.yearly_summary.position)}/{card.yearly_summary.class_size}</div>
          )}
        </div>
        <div className="col-span-2 space-y-1 border-l border-gray-300 pl-3">
          <div className="border-b border-dotted border-gray-500 h-5" />
          <div className="text-[13px] text-gray-600">Parent's Signature and date</div>
          <div className="font-bold uppercase text-[13px] pt-1">Terms</div>
          <div className="text-[13px] space-y-0.5">
            <div>Term 1 <span className="border-b border-dotted border-gray-500 inline-block w-16" /></div>
            <div>Term 2 <span className="border-b border-dotted border-gray-500 inline-block w-16" /></div>
          </div>
        </div>
      </div>
      <p className="text-[11px] italic text-gray-400 mt-1 flex-shrink-0">*See key at the back.</p>
      </div>{/* /watermark content wrapper */}
    </div>
  );
};

export default BookletContent;
