/**
 * IdCardsPage — /identity/cards
 * Grade A: Fully functional, visually rich ID card management hub.
 * Tabs: Cards | Expiring Soon | Bulk Generate | QR Verify
 * All queries are strictly scoped to the current tenant (multi-tenant system).
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard, Users, AlertTriangle, CheckCircle, XCircle, Plus, Download,
  RefreshCw, X, Eye, Ban, RotateCcw, LayoutGrid, List,
  QrCode, Loader2, ShieldCheck, ShieldAlert, Clock, Zap,
  Search, ChevronRight, AlertCircle, GraduationCap, BookOpen, Trash2,
  MoreVertical, FileText, Image as ImageIcon,
} from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { Button } from '@components/ui/button';
import { SearchBar } from '@components/admin/table/SearchBar';
import { showToast } from '@utils/toast';
import { idCardService, IdCard, CardStatus } from '@services/idCardService';
import { classesService } from '@services/classesService';
import { apiClient } from '@lib/apiClient';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { CardGenerationModal } from './components/CardGenerationModal';
import { CardDetailsModal } from './components/CardDetailsModal';
import { VisualIdCardRenderer } from './components/VisualIdCardRenderer';
import { CardPdfExporter, buildCardExportData } from './components/cardExport';
import type { CardPdfExporterHandle } from './components/cardExport';

// ── Types ─────────────────────────────────────────────────────────────────────
type ActiveTab = 'cards' | 'expiring' | 'bulk' | 'qr';
type ViewMode = 'grid' | 'table';
type RoleFilter = '' | 'student' | 'teacher' | 'principal' | 'staff';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function daysUntil(d?: string | null) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}
function isExpiringSoon(d?: string | null) {
  const n = daysUntil(d); return n !== null && n > 0 && n <= 30;
}
function urgencyColor(days: number) {
  if (days <= 7) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  if (days <= 14) return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800';
  return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
}
const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  expired: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  revoked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  lost: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  suspended: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};
const STATUS_DOT: Record<string, string> = {
  active: 'bg-emerald-500', expired: 'bg-gray-400', revoked: 'bg-red-500',
  lost: 'bg-amber-500', suspended: 'bg-purple-500',
};
const ROLE_COLORS: Record<string, string> = {
  student: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  teacher: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  principal: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  super_admin: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  accountant: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  admissions_officer: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
};

// ── Avatar Component ──────────────────────────────────────────────────────────
function Avatar({ name, photoUrl, size = 'md' }: { name: string; photoUrl?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-lg' : 'w-10 h-10 text-sm';
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  const [imgFailed, setImgFailed] = React.useState(false);
  return (
    <div className={`${sz} rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center font-bold text-white shadow-sm`}>
      {photoUrl && !imgFailed
        ? <img src={photoUrl} alt={name} className="w-full h-full object-cover" onError={() => setImgFailed(true)} />
        : <span>{initials}</span>}
    </div>
  );
}

// ── Visual ID Card Tile ───────────────────────────────────────────────────────
function VisualIdCard({ card, onView, onRevoke, onRegenerate, onDelete, onReportLost, onReactivate, onDownload, downloading }: {
  card: IdCard; onView: () => void; onRevoke: () => void; onRegenerate: () => void; onDelete: () => void; onReportLost: () => void; onReactivate: () => void; onDownload: (output: 'pdf' | 'png' | 'jpg') => void; downloading: boolean;
}) {
  const user = card.user;
  const name = user ? `${user.firstName} ${user.lastName}` : 'Unknown Member';
  const expiring = isExpiringSoon(card.expiresAt);
  const days = daysUntil(card.expiresAt);

  const tplConfig = card.template?.config || {
    headerStyle: 'curved-wave',
    primaryColor: '#1E3A8A',
    secondaryColor: '#EA580C',
    backgroundColor: '#FFFFFF',
    textColor: '#0F172A',
    photoShape: 'circle',
    cardTitle: 'IDENTIFICATION CARD',
    layoutConfig: {
      logoPositionConfig: { x: 4, y: 4, side: 'front' },
      schoolNamePosition: { x: 26, y: 5, side: 'front' },
      photoPosition: { x: 5, y: 17, width: 20, height: 25, side: 'front' },
      namePosition: { x: 30, y: 18, side: 'front' },
      rolePosition: { x: 30, y: 26, side: 'front' },
      idPosition: { x: 30, y: 33, side: 'front' },
      qrCodePosition: { x: 71, y: 36, size: 12, side: 'front' },
      barcodePosition: { x: 5, y: 46, side: 'front' },
    }
  };

  // Keep every tile the same height so the action rows line up across the grid
  // (PVC is landscape, badge is portrait — without a fixed aspect the buttons
  // would sit at different heights per card and look scattered).
  const isBadge = (card.format || 'pvc') === 'badge';

  return (
    <div className="group relative flex flex-col h-full">
      {/* Card face — fixed aspect ratio per format so all tiles align */}
      <div
        className="relative w-full shadow-xl overflow-hidden cursor-pointer transition-all duration-300 group-hover:shadow-2xl group-hover:-translate-y-1 flex items-center justify-center bg-gray-900 rounded-2xl p-1"
        style={{ aspectRatio: isBadge ? '2 / 3' : '85.6 / 53.98' }}
        onClick={onView}
      >
        <VisualIdCardRenderer
          config={tplConfig as any}
          format={card.format || 'pvc'}
          user={{
            name,
            idNumber: (user as any)?.memberId || card.cardNumber,
            role: user?.role ? user.role.toUpperCase() : 'STUDENT',
            photoUrl: user?.photoUrl,
            expiresAt: fmt(card.expiresAt),
            dob: (user as any)?.dob ? fmt((user as any).dob) : undefined,
            departmentOrGrade: (user as any)?.departmentOrGrade || undefined,
            qrImageUrl: (card as any).qrImageUrl || undefined,
          }}
          logoUrl={card.template?.logoUrl || card.template?.config?.logoUrl}
          side="front"
          readonly
        />

        {/* Status overlay for non-active */}
        {card.status !== 'active' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px] rounded-2xl">
            <span className={`text-xs font-black uppercase tracking-[0.2em] px-3 py-1 rounded border-2 ${
              card.status === 'revoked' ? 'border-red-400 text-red-300 bg-red-950/80' :
              card.status === 'expired' ? 'border-gray-400 text-gray-300 bg-gray-900/80' :
              card.status === 'lost' ? 'border-amber-400 text-amber-300 bg-amber-950/80' :
              'border-purple-400 text-purple-300 bg-purple-950/80'}`}>{card.status}</span>
          </div>
        )}

        {/* Expiring ribbon */}
        {expiring && days !== null && (
          <div className="absolute top-0 left-0 right-0 bg-amber-500/90 py-0.5 text-center">
            <span className="text-[9px] font-bold text-white uppercase tracking-wide">⚠ Expires in {days}d</span>
          </div>
        )}
      </div>

      {/* Actions — pinned to the bottom (mt-auto) so every tile's action row
          lines up across the grid, even when PVC/badge faces differ in height.

          MOBILE: only a full-width View button — all actions (download,
          regenerate, revoke, …) live inside the View/detail page to keep tiles
          tap-friendly and clutter-free.
          DESKTOP (md+): View + a quick Download button + the ⋮ overflow menu. */}
      <div className="flex items-center gap-1.5 mt-auto pt-2">
        <button onClick={onView} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-50 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors border border-gray-200 dark:border-gray-700">
          <Eye size={13} /> View
        </button>

        {/* Desktop-only quick download + overflow menu */}
        <div className="hidden md:flex items-center gap-1.5">
          <div className="relative group/dl">
            <button
              onClick={() => onDownload('pdf')}
              disabled={downloading}
              className="flex items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 bg-gray-50 dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors border border-gray-200 dark:border-gray-700 disabled:opacity-50"
              title="Download card"
            >
              {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            </button>
            <div className="absolute right-0 top-full mt-1 w-28 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-30 opacity-0 invisible group-hover/dl:opacity-100 group-hover/dl:visible transition-all">
              <button onClick={() => onDownload('pdf')} className="w-full text-left px-2.5 py-1.5 text-[11px] font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 rounded-t-lg">PDF</button>
              <button onClick={() => onDownload('png')} className="w-full text-left px-2.5 py-1.5 text-[11px] font-semibold hover:bg-gray-50 dark:hover:bg-gray-700">PNG</button>
              <button onClick={() => onDownload('jpg')} className="w-full text-left px-2.5 py-1.5 text-[11px] font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 rounded-b-lg">JPG</button>
            </div>
          </div>
          <CardActionMenu
            card={card}
            downloading={downloading}
            onDownload={onDownload}
            onRegenerate={onRegenerate}
            onRevoke={onRevoke}
            onReportLost={onReportLost}
            onReactivate={onReactivate}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  );
}

// ── Tile action overflow menu ─────────────────────────────────────────────────
function CardActionMenu({ card, downloading, onDownload, onRegenerate, onRevoke, onReportLost, onReactivate, onDelete }: {
  card: IdCard; downloading: boolean;
  onDownload: (output: 'pdf' | 'png' | 'jpg') => void;
  onRegenerate: () => void; onRevoke: () => void; onReportLost: () => void; onReactivate: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const item = 'w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-left hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors';

  const act = (fn: () => void) => () => { setOpen(false); fn(); };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={downloading}
        className="p-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-200 dark:border-gray-700 disabled:opacity-50"
        title="Actions"
      >
        {downloading ? <Loader2 size={15} className="animate-spin" /> : <MoreVertical size={15} />}
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-40 overflow-hidden py-1">
          <div className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Download</div>
          <button onClick={act(() => onDownload('pdf'))} className={item}><FileText size={13} className="text-emerald-600" /> Save as PDF</button>
          <button onClick={act(() => onDownload('png'))} className={item}><ImageIcon size={13} className="text-emerald-600" /> Save as PNG</button>
          <button onClick={act(() => onDownload('jpg'))} className={item}><ImageIcon size={13} className="text-emerald-600" /> Save as JPG</button>
          <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
          <button onClick={act(onRegenerate)} className={item}><RotateCcw size={13} className="text-violet-600" /> Regenerate</button>
          {card.status === 'active' && (
            <button onClick={act(onRevoke)} className={item}><Ban size={13} className="text-red-600" /> Revoke</button>
          )}
          {card.status === 'active' && (
            <button onClick={act(onReportLost)} className={item}><AlertTriangle size={13} className="text-amber-600" /> Report Lost</button>
          )}
          {card.status === 'suspended' && (
            <button onClick={act(onReactivate)} className={item}><RotateCcw size={13} className="text-emerald-600" /> Reactivate</button>
          )}
          <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
          <button onClick={act(onDelete)} className={`${item} text-red-600 dark:text-red-400`}><Trash2 size={13} /> Delete</button>
        </div>
      )}
    </div>
  );
}

// ── QR Verify Tab ─────────────────────────────────────────────────────────────
function QrVerifyTab() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const verify = async () => {
    if (!input.trim()) return;
    setLoading(true); setResult(null);
    try {
      const res = await idCardService.verifyQrCode(input.trim());
      setResult((res as any)?.verification ?? res);
    } catch { setResult({ isValid: false, failureReason: 'Verification failed — check connection.' }); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-md"><QrCode size={22} className="text-white" /></div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">QR Code Verifier</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Verify any tenant card by its QR value</p>
          </div>
        </div>
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && verify()}
            placeholder="Paste QR code content here…"
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <Button onClick={verify} disabled={loading || !input.trim()} className="px-5">
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Verify'}
          </Button>
        </div>
      </div>

      {result && (
        <div className={`rounded-2xl border p-6 ${result.isValid ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
          <div className="flex items-center gap-3 mb-4">
            {result.isValid ? <ShieldCheck size={28} className="text-emerald-500" /> : <ShieldAlert size={28} className="text-red-500" />}
            <div>
              <p className={`font-bold text-lg ${result.isValid ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                {result.isValid ? '✓ Valid Card' : 'Invalid / Unrecognised'}
              </p>
              {!result.isValid && result.failureReason && <p className="text-sm text-red-600 dark:text-red-400">{result.failureReason}</p>}
            </div>
          </div>
          {result.isValid && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {result.userName && <div><span className="text-xs text-emerald-600 dark:text-emerald-500 font-bold uppercase">Name</span><p className="font-semibold text-gray-900 dark:text-white mt-0.5">{result.userName}</p></div>}
              {result.role && <div><span className="text-xs text-emerald-600 dark:text-emerald-500 font-bold uppercase">Role</span><p className="font-semibold text-gray-900 dark:text-white capitalize mt-0.5">{result.role}</p></div>}
              {result.expirationDate && <div><span className="text-xs text-emerald-600 dark:text-emerald-500 font-bold uppercase">Expires</span><p className="font-semibold text-gray-900 dark:text-white mt-0.5">{fmt(result.expirationDate)}</p></div>}
            </div>
          )}
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
        <p className="text-xs text-blue-700 dark:text-blue-400 font-medium flex items-start gap-2">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          USB QR scanners auto-fill this field. All verifications are scoped to your tenant's cards only.
        </p>
      </div>
    </div>
  );
}

// ── Expiring Tab ──────────────────────────────────────────────────────────────
function ExpiringTab({ onGenerateNew }: { onGenerateNew: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['id-cards-expiring', 30],
    queryFn: () => idCardService.getExpiringCards(30),
    staleTime: 60_000,
  });
  const cards: any[] = (data as any)?.cards ?? (data as any)?.data?.cards ?? [];

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 size={36} className="animate-spin text-blue-500" /></div>;

  if (cards.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <CheckCircle size={52} className="text-emerald-400 mb-4" />
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">All Clear!</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">No cards expiring in the next 30 days.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          <span className="text-amber-600 dark:text-amber-400 font-bold">{cards.length}</span> cards expiring within 30 days
        </p>
        <Button size="sm" onClick={onGenerateNew} className="gap-1.5"><Plus size={14} /> Generate Replacements</Button>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
          {cards.map((card: any) => {
            const days = daysUntil(card.expiresAt ?? card.expires_at);
            const name = card.user ? `${card.user.firstName || ''} ${card.user.lastName || ''}`.trim() : card.user_name || '—';
            const role = card.user?.role || card.role || '—';
            if (days === null) return null;
            return (
              <div key={card.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <Avatar name={name} photoUrl={card.user?.photoUrl} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{name}</p>
                  <p className="text-[11px] text-gray-400 font-mono">{card.cardNumber || card.card_number}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[role] || 'bg-gray-100 text-gray-600'} capitalize`}>{role}</span>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${urgencyColor(days)}`}>
                  <Clock size={12} /> {days === 0 ? 'Today' : `${days}d`}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{fmt(card.expiresAt ?? card.expires_at)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Bulk Generate Tab ─────────────────────────────────────────────────────────
function BulkGenerateTab() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [target, setTarget] = useState<'all_students' | 'all_teachers' | 'all' | 'by_class'>('all_students');
  const [classId, setClassId] = useState('');
  const [format, setFormat] = useState<'pvc' | 'badge'>('pvc');
  const [expiry, setExpiry] = useState('');
  const [jobResult, setJobResult] = useState<any>(null);

  const role = target === 'all_students' || target === 'by_class' ? 'student'
    : target === 'all_teachers' ? 'teacher' : undefined;

  // Classes for the "By Class" target
  const { data: classesData } = useQuery({
    queryKey: ['bulk-classes-list'],
    queryFn: () => classesService.listClasses({ limit: 200 }),
    staleTime: 60_000,
    enabled: target === 'by_class',
  });
  const classes: any[] = (classesData as any)?.data ?? (classesData as any)?.data?.data ?? [];

  const { data: eligibleData, isLoading: eligibleLoading } = useQuery({
    queryKey: ['eligible-members-bulk', target, classId],
    queryFn: () => apiClient.get('/api/v1/id-cards/eligible-members', {
      params: {
        ...(role ? { role } : {}),
        ...(target === 'by_class' && classId ? { classId } : {}),
      },
    }),
    staleTime: 30_000,
    // Don't fetch until a class is chosen in by_class mode.
    enabled: target !== 'by_class' || !!classId,
  });
  const eligible: any[] = (eligibleData as any)?.data ?? [];

  const [jobId, setJobId] = useState<string | null>(null);

  const bulkMutation = useMutation({
    mutationFn: () => idCardService.createBulkJob({ userIds: eligible.map((u: any) => u.userId || u.id), format, ...(expiry ? { expirationDate: expiry } : {}) } as any),
    onSuccess: (res) => {
      const job = (res as any)?.job ?? (res as any)?.data?.job ?? res;
      const id = job?.jobId ?? job?.id ?? null;
      setJobId(id);
      setJobResult(job);
      setStep(3);
      queryClient.invalidateQueries({ queryKey: ['id-cards'] });
      queryClient.invalidateQueries({ queryKey: ['id-cards-stats'] });
    },
    onError: (err: any) => showToast.error(err?.response?.data?.error?.message || 'Bulk generation failed'),
  });

  // Poll job status until it reaches a terminal state.
  const { data: statusData } = useQuery({
    queryKey: ['bulk-job-status', jobId],
    queryFn: () => idCardService.getBulkJobStatus(jobId!),
    enabled: !!jobId && !!jobResult,
    refetchInterval: (query) => {
      const s = (query.state.data as any)?.status?.status ?? (query.state.data as any)?.data?.status?.status;
      return s === 'completed' || s === 'failed' || s === 'cancelled' ? false : 1500;
    },
  });

  const jobStatus: any = (statusData as any)?.status ?? (statusData as any)?.data?.status ?? null;
  const isTerminal = jobStatus && ['completed', 'failed', 'cancelled'].includes(jobStatus.status);

  const { data: reportData } = useQuery({
    queryKey: ['bulk-job-report', jobId],
    queryFn: () => idCardService.getBulkJobReport(jobId!),
    enabled: !!jobId && jobStatus?.status === 'completed',
    staleTime: 60_000,
  });
  const report: any = (reportData as any)?.report ?? (reportData as any)?.data ?? reportData ?? null;

  const storageUrl = (u?: string) => {
    if (!u) return '';
    const base = ((import.meta as any).env?.VITE_API_URL as string || '').replace(/\/api\/?$/, '');
    return u.startsWith('/storage') ? `${base}${u}` : u;
  };

  const cancelJob = async () => {
    if (!jobId) return;
    try {
      await idCardService.cancelBulkJob(jobId);
      showToast.success('Job cancelled');
    } catch { showToast.error('Failed to cancel job'); }
  };

  const STEPS = ['Target', 'Settings', 'Confirm'];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${step === i + 1 ? 'bg-blue-600 text-white' : step > i + 1 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
              {step > i + 1 ? <CheckCircle size={14} /> : <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] bg-white/20">{i + 1}</span>}
              {s}
            </div>
            {i < STEPS.length - 1 && <ChevronRight size={14} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="font-bold text-gray-900 dark:text-white">Choose Target Group</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { v: 'all_students', l: 'All Students', icon: <GraduationCap size={22} />, d: 'All active students' },
                { v: 'by_class', l: 'By Class', icon: <BookOpen size={22} />, d: 'Students in one class' },
                { v: 'all_teachers', l: 'All Teachers', icon: <Users size={22} />, d: 'All teaching staff' },
                { v: 'all', l: 'All Members', icon: <Users size={22} />, d: 'Students + teachers' },
              ].map(opt => (
                <button key={opt.v} onClick={() => { setTarget(opt.v as any); if (opt.v !== 'by_class') setClassId(''); }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center ${target === opt.v ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-800'}`}>
                  <span className={target === opt.v ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}>{opt.icon}</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{opt.l}</span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">{opt.d}</span>
                </button>
              ))}
            </div>

            {/* Class selector — only for the "By Class" target */}
            {target === 'by_class' && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Select Class</label>
                <div className="relative">
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="w-full appearance-none pl-3 pr-8 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Choose a class —</option>
                    {classes.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.level ? ` (${c.level})` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none text-gray-400" />
                </div>
              </div>
            )}

            {target === 'by_class' && !classId
              ? <p className="text-sm text-gray-400">Select a class to see eligible students.</p>
              : eligibleLoading
                ? <p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Counting eligible members…</p>
                : <p className="text-sm text-gray-600 dark:text-gray-400"><span className="font-bold text-blue-600 dark:text-blue-400">{eligible.length}</span> eligible members found</p>}
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={eligible.length === 0 || (target === 'by_class' && !classId)}>Next <ChevronRight size={14} /></Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h2 className="font-bold text-gray-900 dark:text-white">Card Settings</h2>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Format</label>
              <div className="grid grid-cols-2 gap-3">
                {[{ v: 'pvc', l: 'PVC Card', d: '85.6 × 54mm' }, { v: 'badge', l: 'Badge', d: '4″ × 6″' }].map(f => (
                  <button key={f.v} onClick={() => setFormat(f.v as any)}
                    className={`flex flex-col items-center gap-1 p-4 rounded-xl border-2 transition-all ${format === f.v ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-gray-200 dark:border-gray-700'}`}>
                    <CreditCard size={22} className={format === f.v ? 'text-blue-500' : 'text-gray-400'} />
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{f.l}</span>
                    <span className="text-[10px] text-gray-500">{f.d}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Expiry Date</label>
              <div className="flex gap-2 flex-wrap mb-2">
                {[['6 mo', 6], ['1 yr', 12], ['2 yr', 24]].map(([l, m]) => {
                  const d = new Date(); d.setMonth(d.getMonth() + (m as number));
                  const v = d.toISOString().slice(0, 10);
                  return <button key={l as string} onClick={() => setExpiry(v)} className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${expiry === v ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>{l}</button>;
                })}
              </div>
              <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} min={new Date().toISOString().slice(0, 10)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-[11px] text-gray-400 mt-1">Leave empty for default (1 year)</p>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)}>Review <ChevronRight size={14} /></Button>
            </div>
          </div>
        )}

        {step === 3 && !jobResult && (
          <div className="space-y-5">
            <h2 className="font-bold text-gray-900 dark:text-white">Review & Confirm</h2>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-3 text-sm">
              {[
                ['Target', target === 'by_class'
                  ? `Class: ${classes.find((c: any) => String(c.id) === String(classId))?.name || '—'}`
                  : target.replace('_', ' ')],
                ['Count', `${eligible.length} cards`],
                ['Format', format.toUpperCase()],
                ['Expiry', expiry ? fmt(expiry) : '1 year from today'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between"><span className="text-gray-500">{k}</span><span className="font-semibold text-gray-900 dark:text-white capitalize">{v}</span></div>
              ))}
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-start gap-2">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                Scoped to your tenant only. All generated cards will be logged in the audit trail.
              </p>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={() => bulkMutation.mutate()} disabled={bulkMutation.isPending}>
                {bulkMutation.isPending ? <><Loader2 size={14} className="animate-spin mr-2" /> Generating…</> : <><Zap size={14} className="mr-1.5" /> Generate {eligible.length} Cards</>}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && jobResult && (
          <div className="py-4 space-y-5">
            {!isTerminal ? (
              <>
                <div className="flex items-center gap-3">
                  <Loader2 size={22} className="animate-spin text-blue-500" />
                  <div>
                    <h2 className="font-bold text-gray-900 dark:text-white">Generating cards…</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {jobStatus ? `${jobStatus.processedCards} of ${jobStatus.totalCards} processed` : 'Starting job…'}
                    </p>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${jobStatus?.progress ?? 0}%` }} />
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={cancelJob}>Cancel Job</Button>
                </div>
              </>
            ) : jobStatus?.status === 'completed' ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <CheckCircle size={30} className="text-emerald-500" />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900 dark:text-white text-lg">Batch Complete</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      <span className="text-emerald-600 font-bold">{jobStatus.successfulCards}</span> generated
                      {jobStatus.failedCards > 0 && <> · <span className="text-red-600 font-bold">{jobStatus.failedCards}</span> failed</>}
                    </p>
                  </div>
                </div>

                {jobStatus.pdfUrl && (
                  <a href={storageUrl(jobStatus.pdfUrl)} target="_blank" rel="noopener noreferrer" download>
                    <Button className="gap-1.5"><Download size={15} /> Download All Cards (PDF)</Button>
                  </a>
                )}

                {report?.failed?.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                    <p className="text-sm font-bold text-red-700 dark:text-red-400 mb-2">{report.failed.length} card(s) failed</p>
                    <ul className="space-y-1 max-h-40 overflow-y-auto">
                      {report.failed.map((f: any, i: number) => (
                        <li key={i} className="text-xs text-red-600 dark:text-red-400 flex justify-between gap-2">
                          <span className="font-medium truncate">{f.userName || f.userId}</span>
                          <span className="text-red-500/80 truncate">{f.errorMessage}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button variant="outline" onClick={() => { setStep(1); setJobResult(null); setJobId(null); }}>Start Another Batch</Button>
              </>
            ) : (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
                  <XCircle size={36} className="text-red-500" />
                </div>
                <h2 className="font-bold text-gray-900 dark:text-white text-lg">Job {jobStatus?.status === 'cancelled' ? 'Cancelled' : 'Failed'}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {jobStatus?.status === 'cancelled' ? 'The batch was cancelled.' : 'The batch could not be completed. Please try again.'}
                </p>
                <Button onClick={() => { setStep(1); setJobResult(null); setJobId(null); }}>Start Another Batch</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export const IdCardsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ActiveTab>('cards');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CardStatus | ''>('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 24;

  const [generationModalOpen, setGenerationModalOpen] = useState(false);
  const [detailsModal, setDetailsModal] = useState<{ open: boolean; cardId: string | null }>({ open: false, cardId: null });
  const [revokeTarget, setRevokeTarget] = useState<IdCard | null>(null);
  const [regenerateTarget, setRegenerateTarget] = useState<IdCard | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IdCard | null>(null);
  const [reportLostTarget, setReportLostTarget] = useState<IdCard | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<IdCard | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const exporterRef = React.useRef<CardPdfExporterHandle>(null);

  const [bulkDownloading, setBulkDownloading] = useState(false);

  const fetchFull = async (card: IdCard): Promise<any> => {
    try {
      const res = await idCardService.getCard(card.id);
      return (res as any)?.card ?? (res as any)?.data ?? card;
    } catch {
      return card;
    }
  };

  const handleDownload = async (card: IdCard, output: 'pdf' | 'png' | 'jpg' = 'pdf') => {
    setDownloadingId(card.id);
    try {
      // Fetch the full card (template config + user details) so the export
      // matches the on-screen card exactly.
      const full = await fetchFull(card);
      await exporterRef.current?.export(buildCardExportData(full, output));
      showToast.success(`Card ${output.toUpperCase()} downloaded`);
    } catch {
      showToast.error(`Failed to download card ${output.toUpperCase()}`);
    } finally {
      setDownloadingId(null);
    }
  };

  // Bulk download every visible card, one file each (sequential so the shared
  // off-screen exporter isn't clobbered). Great for printing a whole batch.
  const handleBulkDownload = async (list: IdCard[], output: 'pdf' | 'png' | 'jpg') => {
    if (bulkDownloading || list.length === 0) return;
    setBulkDownloading(true);
    let ok = 0;
    try {
      for (const card of list) {
        const full = await fetchFull(card);
        try {
          await exporterRef.current?.export(buildCardExportData(full, output));
          ok++;
          // Small gap so browsers don't drop rapid successive downloads.
          await new Promise((r) => setTimeout(r, 400));
        } catch { /* skip one, continue the batch */ }
      }
      showToast.success(`Downloaded ${ok} of ${list.length} card${list.length === 1 ? '' : 's'} (${output.toUpperCase()})`);
    } finally {
      setBulkDownloading(false);
    }
  };

  // Fetch cards (tenant-scoped by backend)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['id-cards', { search, statusFilter, page, PAGE_SIZE }],
    queryFn: () => idCardService.listCards({ page, limit: PAGE_SIZE, status: statusFilter || undefined, search: search || undefined }),
    staleTime: 30_000,
    enabled: activeTab === 'cards',
  });

  const cards: IdCard[] = useMemo(() => {
    const raw = (data as any)?.data ?? (data as any)?.cards ?? [];
    if (!Array.isArray(raw)) return [];
    return roleFilter ? raw.filter((c: IdCard) => c.user?.role === roleFilter) : raw;
  }, [data, roleFilter]);

  const pagination = (data as any)?.pagination ?? { total: 0, total_pages: 1 };

  const { data: statsData } = useQuery({
    queryKey: ['id-cards-stats'],
    queryFn: () => idCardService.getDashboardStats(),
    staleTime: 60_000,
  });
  const stats = (statsData as any)?.data ?? (statsData as any) ?? { totalActive: 0, totalExpired: 0, totalRevoked: 0, totalLost: 0, expiringSoon: 0 };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await idCardService.revokeCard(revokeTarget.id, 'Revoked by administrator');
      showToast.success('Card revoked');
      queryClient.invalidateQueries({ queryKey: ['id-cards'] });
      queryClient.invalidateQueries({ queryKey: ['id-cards-stats'] });
    } catch { showToast.error('Failed to revoke card'); }
    setRevokeTarget(null);
  };

  const handleRegenerate = async () => {
    if (!regenerateTarget) return;
    try {
      await idCardService.regenerateCard(regenerateTarget.id);
      showToast.success('Card regenerated');
      queryClient.invalidateQueries({ queryKey: ['id-cards'] });
    } catch { showToast.error('Failed to regenerate card'); }
    setRegenerateTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await idCardService.deleteCard(deleteTarget.id);
      showToast.deleted('ID Card');
      queryClient.invalidateQueries({ queryKey: ['id-cards'] });
      queryClient.invalidateQueries({ queryKey: ['id-cards-stats'] });
      refetch();
    } catch (err: any) {
      showToast.error(err.response?.data?.message || err.message || 'Failed to delete ID card');
    }
    setDeleteTarget(null);
  };

  const handleReportLost = async () => {
    if (!reportLostTarget) return;
    try {
      await idCardService.reportLost(reportLostTarget.id, 'Reported lost by administrator');
      showToast.success('Card reported as lost');
      queryClient.invalidateQueries({ queryKey: ['id-cards'] });
      queryClient.invalidateQueries({ queryKey: ['id-cards-stats'] });
    } catch { showToast.error('Failed to report card as lost'); }
    setReportLostTarget(null);
  };

  const handleReactivate = async () => {
    if (!reactivateTarget) return;
    try {
      await idCardService.reactivateCard(reactivateTarget.id);
      showToast.success('Card reactivated');
      queryClient.invalidateQueries({ queryKey: ['id-cards'] });
      queryClient.invalidateQueries({ queryKey: ['id-cards-stats'] });
    } catch { showToast.error('Failed to reactivate card'); }
    setReactivateTarget(null);
  };

  const TABS = [
    { id: 'cards' as const, label: 'Cards', icon: <CreditCard size={15} /> },
    { id: 'expiring' as const, label: 'Expiring Soon', icon: <Clock size={15} />, badge: Number(stats.expiringSoon) || undefined },
    { id: 'bulk' as const, label: 'Bulk Generate', icon: <Zap size={15} /> },
    { id: 'qr' as const, label: 'QR Verify', icon: <QrCode size={15} /> },
  ];

  const ROLE_PILLS: { value: RoleFilter; label: string }[] = [
    { value: '', label: 'All' }, { value: 'student', label: 'Students' },
    { value: 'teacher', label: 'Teachers' }, { value: 'principal', label: 'Principal' },
  ];

  return (
    <MainLayout>
      <PageShell
        title="ID Card Management"
        subtitle="Generate, manage and track identity cards — scoped to your school"
        breadcrumbs={[{ label: 'Identity' }, { label: 'ID Cards' }]}
        actions={
          <div className="flex items-center gap-2">
            {activeTab === 'cards' && (
              <div className="flex items-center border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-0.5 shadow-sm">
                {(['grid', 'table'] as ViewMode[]).map(m => (
                  <button key={m} onClick={() => setViewMode(m)} className={`p-2 rounded-md transition-all ${viewMode === m ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
                    {m === 'grid' ? <LayoutGrid size={16} /> : <List size={16} />}
                  </button>
                ))}
              </div>
            )}
            <Button size="sm" onClick={() => setGenerationModalOpen(true)} className="gap-1.5 shadow-sm">
              <Plus size={15} /> Generate Card
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <KPICard title="Active" value={Number(stats.totalActive ?? 0)} icon={<CheckCircle size={18} />} color="green" />
            <KPICard title="Expired" value={Number(stats.totalExpired ?? 0)} icon={<XCircle size={18} />} color="gray" />
            <KPICard title="Revoked" value={Number(stats.totalRevoked ?? 0)} icon={<Ban size={18} />} color="red" />
            <KPICard title="Lost" value={Number(stats.totalLost ?? 0)} icon={<AlertTriangle size={18} />} color="amber" />
            <KPICard title="Expiring" value={Number(stats.expiringSoon ?? 0)} icon={<Clock size={18} />} color="blue" />
          </div>

          {/* Expiring alert banner */}
          {Number(stats.expiringSoon) > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400 font-medium flex-1">
                <span className="font-bold">{stats.expiringSoon}</span> card{Number(stats.expiringSoon) > 1 ? 's are' : ' is'} expiring within 30 days.
              </p>
              <button onClick={() => setActiveTab('expiring')} className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline whitespace-nowrap">View All →</button>
            </div>
          )}

          {/* Tab bar */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-gray-800/70 p-1.5 rounded-2xl overflow-x-auto scrollbar-none">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex-shrink-0 whitespace-nowrap ${activeTab === tab.id ? 'bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] text-white shadow-md shadow-blue-500/30' : 'text-gray-600 dark:text-gray-400 hover:text-blue-700 hover:bg-white/70 dark:hover:bg-gray-700/50'}`}>
                {tab.icon} {tab.label}
                {'badge' in tab && tab.badge ? (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{tab.badge}</span>
                ) : null}
              </button>
            ))}
          </div>

          {/* ── TAB: CARDS ── */}
          {activeTab === 'cards' && (
            <div className="space-y-5">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <SearchBar
                  placeholder="Search card number, name or email…"
                  onSearch={(v) => { setSearch(v); setPage(1); }}
                  isLoading={isLoading}
                  resultCount={search ? cards.length : undefined}
                  defaultValue={search}
                  className="w-full sm:flex-1"
                />
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }}
                  className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer min-w-[140px]">
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="lost">Lost</option>
                  <option value="revoked">Revoked</option>
                  <option value="suspended">Suspended</option>
                </select>
                <button onClick={() => refetch()} className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-400 hover:text-blue-600 transition-colors" title="Refresh">
                  <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
                </button>
                {/* Bulk print/download of all visible cards */}
                {cards.length > 0 && (
                  <div className="relative group/bulk">
                    <button
                      disabled={bulkDownloading}
                      className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-emerald-600 disabled:opacity-50 whitespace-nowrap"
                      title="Download / print all listed cards"
                    >
                      {bulkDownloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                      <span className="hidden sm:inline">Download All</span>
                    </button>
                    <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-30 opacity-0 invisible group-hover/bulk:opacity-100 group-hover/bulk:visible transition-all">
                      <button onClick={() => handleBulkDownload(cards, 'pdf')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-t-lg">All as PDF</button>
                      <button onClick={() => handleBulkDownload(cards, 'png')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">All as PNG</button>
                      <button onClick={() => handleBulkDownload(cards, 'jpg')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-b-lg">All as JPG</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Role pills */}
              <div className="flex items-center gap-2 flex-wrap">
                {ROLE_PILLS.map(r => (
                  <button key={r.value} onClick={() => setRoleFilter(r.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${roleFilter === r.value ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-blue-400'}`}>
                    {r.label}
                  </button>
                ))}
                {(search || statusFilter || roleFilter) && (
                  <button onClick={() => { setSearch(''); setStatusFilter(''); setRoleFilter(''); setPage(1); }} className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:text-red-700 dark:text-red-400 font-semibold"><X size={11} /> Clear</button>
                )}
              </div>

              {/* Cards content */}
              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4">
                  {[...Array(12)].map((_, i) => <div key={i} className="rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" style={{ aspectRatio: '1.586 / 1' }} />)}
                </div>
              ) : cards.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                  <CreditCard size={52} className="text-gray-300 dark:text-gray-600 mb-4" />
                  <h3 className="text-lg font-bold text-gray-700 dark:text-white mb-1">No ID cards found</h3>
                  <p className="text-sm text-gray-400 mb-5">Generate the first card for your school.</p>
                  <Button onClick={() => setGenerationModalOpen(true)}><Plus size={15} className="mr-1.5" /> Generate First Card</Button>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5">
                  {cards.map(card => (
                    <VisualIdCard key={card.id} card={card}
                      onView={() => setDetailsModal({ open: true, cardId: card.id })}
                      onRevoke={() => setRevokeTarget(card)}
                      onRegenerate={() => setRegenerateTarget(card)}
                      onDelete={() => setDeleteTarget(card)}
                      onReportLost={() => setReportLostTarget(card)}
                      onReactivate={() => setReactivateTarget(card)}
                      onDownload={(output) => handleDownload(card, output)}
                      downloading={downloadingId === card.id} />
                  ))}
                </div>
              ) : (
                /* Table view */
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] border-b border-blue-700">
                        <tr>
                          {['Holder', 'Card #', 'Role', 'Format', 'Issued', 'Expires', 'Status', 'Actions'].map(h => (
                            <th key={h} className={`px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-white${h === 'Actions' ? ' text-right' : ''}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {cards.map((card, rowIndex) => {
                          const user = card.user;
                          const name = user ? `${user.firstName} ${user.lastName}` : '—';
                          const expiring = isExpiringSoon(card.expiresAt);
                          const days = daysUntil(card.expiresAt);
                          return (
                            <tr key={card.id} className={`transition-colors hover:bg-sky-100 dark:hover:bg-gray-700/30 group ${rowIndex % 2 === 1 ? 'bg-sky-50 dark:bg-gray-900/30' : 'bg-white dark:bg-transparent'}`}>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                  <Avatar name={name} photoUrl={user?.photoUrl} size="sm" />
                                  <div>
                                    <p className="font-semibold text-gray-900 dark:text-white leading-tight">{name}</p>
                                    <p className="text-[11px] text-gray-400">{user?.email || '—'}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3.5"><span className="font-mono text-sm font-bold text-gray-800 dark:text-gray-200">{card.cardNumber}</span></td>
                              <td className="px-5 py-3.5"><span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full capitalize ${ROLE_COLORS[user?.role || ''] || 'bg-gray-100 text-gray-600'}`}>{user?.role || '—'}</span></td>
                              <td className="px-5 py-3.5"><span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">{card.format}</span></td>
                              <td className="px-5 py-3.5 text-xs text-gray-500 dark:text-gray-400 tabular-nums">{fmt(card.issuedAt)}</td>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-1.5">
                                  {expiring && days !== null && <span className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${urgencyColor(days)}`}><Clock size={9} /> {days}d</span>}
                                  <span className={`text-xs tabular-nums ${expiring ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>{fmt(card.expiresAt)}</span>
                                </div>
                              </td>
                              <td className="px-5 py-3.5">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_STYLES[card.status] || ''}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[card.status] || 'bg-gray-400'}`} />
                                  {card.status.charAt(0).toUpperCase() + card.status.slice(1)}
                                </span>
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => setDetailsModal({ open: true, cardId: card.id })} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title="View"><Eye size={14} /></button>
                                  <button onClick={() => handleDownload(card)} disabled={downloadingId === card.id} className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50" title="Download PDF">{downloadingId === card.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}</button>
                                  <button onClick={() => setRegenerateTarget(card)} className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors" title="Regenerate"><RotateCcw size={14} /></button>
                                  {card.status === 'active' && <button onClick={() => setRevokeTarget(card)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Revoke"><Ban size={14} /></button>}
                                  {card.status === 'active' && <button onClick={() => setReportLostTarget(card)} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors" title="Report Lost"><AlertTriangle size={14} /></button>}
                                  {card.status === 'suspended' && <button onClick={() => setReactivateTarget(card)} className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors" title="Reactivate"><RotateCcw size={14} /></button>}
                                  <button onClick={() => setDeleteTarget(card)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete"><Trash2 size={14} /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {pagination.total_pages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">{pagination.total} cards · Page {page} of {pagination.total_pages}</p>
                      <div className="flex items-center gap-2">
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">← Prev</button>
                        <button disabled={page === pagination.total_pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Next →</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'expiring' && <ExpiringTab onGenerateNew={() => { setGenerationModalOpen(true); setActiveTab('cards'); }} />}
          {activeTab === 'bulk' && <BulkGenerateTab />}
          {activeTab === 'qr' && <QrVerifyTab />}
        </div>
      </PageShell>

      <CardPdfExporter ref={exporterRef} />

      <CardGenerationModal isOpen={generationModalOpen} onClose={() => setGenerationModalOpen(false)}
        onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['id-cards'] }); queryClient.invalidateQueries({ queryKey: ['id-cards-stats'] }); }} />
      <CardDetailsModal isOpen={detailsModal.open} onClose={() => setDetailsModal({ open: false, cardId: null })} cardId={detailsModal.cardId} />
      <ConfirmationDialog isOpen={!!revokeTarget} onClose={() => setRevokeTarget(null)} onConfirm={handleRevoke}
        title="Revoke ID Card"
        message={`Revoke card "${revokeTarget?.cardNumber}" for ${revokeTarget?.user?.firstName} ${revokeTarget?.user?.lastName}? The holder will no longer be able to use this card.`}
        confirmLabel="Revoke Card" />
      <ConfirmationDialog isOpen={!!regenerateTarget} onClose={() => setRegenerateTarget(null)} onConfirm={handleRegenerate}
        title="Regenerate ID Card"
        message={`Regenerate card "${regenerateTarget?.cardNumber}"? A new card will be issued.`}
        confirmLabel="Regenerate" isDestructive={false} />
      <ConfirmationDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete ID Card"
        message={`Are you sure you want to delete card "${deleteTarget?.cardNumber}"? This action is permanent and cannot be undone.`}
        confirmLabel="Delete Card" />
      <ConfirmationDialog isOpen={!!reportLostTarget} onClose={() => setReportLostTarget(null)} onConfirm={handleReportLost}
        title="Report Card as Lost"
        message={`Mark card "${reportLostTarget?.cardNumber}" as lost? The holder will need a replacement card.`}
        confirmLabel="Report Lost" isDestructive={false} />
      <ConfirmationDialog isOpen={!!reactivateTarget} onClose={() => setReactivateTarget(null)} onConfirm={handleReactivate}
        title="Reactivate Card"
        message={`Reactivate suspended card "${reactivateTarget?.cardNumber}"? It will become active again.`}
        confirmLabel="Reactivate" isDestructive={false} />
    </MainLayout>
  );
};

export default IdCardsPage;
