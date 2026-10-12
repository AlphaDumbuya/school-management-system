/**
 * GlobalSearchBar: the header search. One box for the whole app.
 *
 *  - Pages, settings and everyday actions are matched instantly in the browser
 *    (synonyms and small typos understood: "arrears", "atendance").
 *  - People and records (students, staff, parents, classes, subjects,
 *    admissions, invoices, receipts, assignments, announcements, events) come
 *    from one server search that only returns what this role may see.
 *  - Best match first, the first row is always ready: press Enter to open it.
 *  - Ctrl/Cmd + K or "/" focuses the box from anywhere. Arrow keys, Home/End,
 *    Esc work as in any command palette; recent items are remembered.
 */
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, Users, Briefcase, BookOpen, BookMarked, Megaphone, Clock, CornerDownLeft, Loader2,
  ClipboardList, FileText, Receipt, CalendarDays, ClipboardCheck, Building2, UserCog, HeartHandshake,
  Zap, LayoutGrid, Sparkles, WifiOff,
} from 'lucide-react';
import clsx from 'clsx';
import useAuth from '@hooks/useAuth';
import searchService, { type SearchItem, type SearchResponse, type SearchType } from '@services/searchService';
import { buildPageIndex, searchPages, suggestedPages, type PageEntry } from '@lib/searchIndex';

// ── Rows ─────────────────────────────────────────────────────────────────────

type RowKind = 'page' | 'action' | 'record';

interface Row {
  key: string;
  kind: RowKind;
  /** Record type, or 'page' / 'action'. */
  type: SearchType | 'page' | 'action';
  title: string;
  subtitle?: string;
  badge?: string;
  photo?: string | null;
  to: string;
  state?: unknown;
  score: number;
}

interface Group {
  id: string;
  label: string;
  rows: Row[];
}

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; tint: string; tag: string }> = {
  student:       { label: 'Student',       icon: <Users size={15} />,          tint: 'bg-blue-500',    tag: 'bg-blue-50 text-blue-700' },
  staff:         { label: 'Staff',         icon: <Briefcase size={15} />,      tint: 'bg-emerald-500', tag: 'bg-emerald-50 text-emerald-700' },
  support_staff: { label: 'Support staff', icon: <UserCog size={15} />,        tint: 'bg-teal-500',    tag: 'bg-teal-50 text-teal-700' },
  guardian:      { label: 'Parent',        icon: <HeartHandshake size={15} />, tint: 'bg-pink-500',    tag: 'bg-pink-50 text-pink-700' },
  class:         { label: 'Class',         icon: <BookOpen size={15} />,       tint: 'bg-violet-500',  tag: 'bg-violet-50 text-violet-700' },
  subject:       { label: 'Subject',       icon: <BookMarked size={15} />,     tint: 'bg-amber-500',   tag: 'bg-amber-50 text-amber-700' },
  admission:     { label: 'Admission',     icon: <ClipboardList size={15} />,  tint: 'bg-cyan-600',    tag: 'bg-cyan-50 text-cyan-700' },
  invoice:       { label: 'Invoice',       icon: <FileText size={15} />,       tint: 'bg-indigo-500',  tag: 'bg-indigo-50 text-indigo-700' },
  receipt:       { label: 'Receipt',       icon: <Receipt size={15} />,        tint: 'bg-green-600',   tag: 'bg-green-50 text-green-700' },
  announcement:  { label: 'Announcement',  icon: <Megaphone size={15} />,      tint: 'bg-rose-500',    tag: 'bg-rose-50 text-rose-700' },
  event:         { label: 'Event',         icon: <CalendarDays size={15} />,   tint: 'bg-orange-500',  tag: 'bg-orange-50 text-orange-700' },
  assignment:    { label: 'Assignment',    icon: <ClipboardCheck size={15} />, tint: 'bg-lime-600',    tag: 'bg-lime-50 text-lime-700' },
  tenant:        { label: 'School',        icon: <Building2 size={15} />,      tint: 'bg-slate-600',   tag: 'bg-slate-100 text-slate-700' },
  page:          { label: 'Page',          icon: <LayoutGrid size={15} />,     tint: 'bg-gray-500',    tag: 'bg-gray-100 text-gray-600' },
  action:        { label: 'Action',        icon: <Zap size={15} />,            tint: 'bg-[#315B8C]',   tag: 'bg-blue-50 text-[#315B8C]' },
};

// ── Recent items ─────────────────────────────────────────────────────────────

const RECENT_BASE = 'wiskul.search.recent.v2';
const MAX_RECENT = 6;
const recentKey = (userId?: string, tenantId?: string) => `${RECENT_BASE}.${userId ?? 'anon'}.${tenantId ?? 'none'}`;

function getRecent(userId?: string, tenantId?: string): Row[] {
  try {
    const list = JSON.parse(localStorage.getItem(recentKey(userId, tenantId)) ?? '[]');
    return Array.isArray(list) ? list.filter((r) => r && r.key && r.to && r.title) : [];
  } catch { return []; }
}
function saveRecent(row: Row, userId?: string, tenantId?: string) {
  try {
    const prev = getRecent(userId, tenantId).filter((r) => r.key !== row.key);
    localStorage.setItem(recentKey(userId, tenantId), JSON.stringify([row, ...prev].slice(0, MAX_RECENT)));
  } catch { /* ignore */ }
}
function clearRecent(userId?: string, tenantId?: string) {
  try { localStorage.removeItem(recentKey(userId, tenantId)); } catch { /* ignore */ }
}

// ── Small pieces ─────────────────────────────────────────────────────────────

const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
};

/** Bold the parts of `text` that match what was typed. */
const Highlight: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  const words = Array.from(new Set(query.trim().split(/\s+/).filter((w) => w.length > 0))).slice(0, 5);
  if (!words.length || !text) return <>{text}</>;
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig');
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? <mark key={i} className="bg-transparent text-[#1d4ed8] font-bold">{p}</mark> : <React.Fragment key={i}>{p}</React.Fragment>,
      )}
    </>
  );
};

const Leading: React.FC<{ row: Row }> = ({ row }) => {
  const meta = TYPE_META[row.type] ?? TYPE_META.page;
  if (row.photo) return <img src={row.photo} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" loading="lazy" />;
  const person = row.type === 'student' || row.type === 'staff' || row.type === 'support_staff' || row.type === 'guardian';
  return (
    <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0', meta.tint, person && 'text-[11px] font-bold')} aria-hidden="true">
      {person ? initialsOf(row.title) : meta.icon}
    </div>
  );
};

// ── Component ────────────────────────────────────────────────────────────────

interface GlobalSearchBarProps {
  /** Called after a result is opened (closes the mobile search row). */
  onClose?: () => void;
  /** The mobile variant: full width, opens focused. */
  mobile?: boolean;
}

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({ onClose, mobile }) => {
  const navigate = useNavigate();
  const { user, canAccess } = useAuth();
  const role = String(user?.role ?? 'student');
  const userId = user?.id as string | undefined;
  const tenantId = user?.tenantId as string | undefined;
  const listId = useId();

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [server, setServer] = useState<SearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [offline, setOffline] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [recent, setRecent] = useState<Row[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const cacheRef = useRef<Map<string, SearchResponse>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  const q = query.trim();
  const duties = JSON.stringify((user as any)?.staffDuties ?? []);
  const planKey = JSON.stringify(user?.planAccess?.features ?? null);

  // Pages, settings and actions this person can open (same rules as the sidebar).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pageIndex = useMemo(() => buildPageIndex(user, canAccess as any), [role, duties, planKey, userId]);

  // ── Global shortcut: Ctrl/Cmd+K, or "/" outside a field ───────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isK = (e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey);
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (isK || (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey)) {
        // Only the visible bar answers (the mobile row is mounted only while open).
        if (!inputRef.current || inputRef.current.offsetParent === null) return;
        e.preventDefault();
        inputRef.current.focus();
        inputRef.current.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Mobile row opens ready to type.
  useEffect(() => { if (mobile) inputRef.current?.focus(); }, [mobile]);

  // Close when clicking elsewhere.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => { if (focused) setRecent(getRecent(userId, tenantId)); }, [focused, userId, tenantId]);

  // ── Records from the server (debounced, cancellable, cached) ──────────────
  useEffect(() => {
    abortRef.current?.abort();
    if (q.length < 2) { setServer(null); setSearching(false); setOffline(false); return; }
    const cacheKey = `${userId}|${q.toLowerCase()}`;
    const hit = cacheRef.current.get(cacheKey);
    if (hit) { setServer(hit); setSearching(false); setOffline(false); return; }
    setSearching(true);
    const ctl = new AbortController();
    abortRef.current = ctl;
    const timer = setTimeout(async () => {
      try {
        const res = await searchService.search(q, ctl.signal);
        if (ctl.signal.aborted) return;
        cacheRef.current.set(cacheKey, res);
        if (cacheRef.current.size > 40) cacheRef.current.delete(cacheRef.current.keys().next().value as string);
        setServer(res);
        setOffline(false);
      } catch (err: any) {
        if (ctl.signal.aborted || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
        setServer(null);
        setOffline(true);
      } finally {
        if (!ctl.signal.aborted) setSearching(false);
      }
    }, 220);
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [q, userId]);

  // ── Where a record opens ──────────────────────────────────────────────────
  const staffSeesProfiles = canAccess(['principal', 'super_admin', 'teacher', 'admissions_officer'] as any[]);
  const isFamily = role === 'parent' || role === 'guardian';
  const enc = encodeURIComponent;

  const recordRoute = useCallback((it: SearchItem): { to: string; state?: unknown } => {
    const x = it.extra || {};
    switch (it.type) {
      case 'student':
      case 'guardian': {
        const studentId = it.type === 'guardian' ? x.student_id : it.id;
        if (isFamily) return { to: `/finance/my-fees?child=${enc(String(studentId))}` };
        if (staffSeesProfiles) return { to: '/students/profiles', state: { studentId } };
        return { to: `/finance/payments?q=${enc(String(x.admission_no || x.name || it.title))}` };
      }
      case 'staff': return { to: `/staff/teachers?q=${enc(String(x.teacher_id || x.name || it.title))}` };
      case 'support_staff': return { to: `/staff/members?q=${enc(String(x.name || it.title))}` };
      case 'class': return { to: `/academic/classes?q=${enc(String(x.name || it.title))}` };
      case 'subject': return { to: `/academic/subjects?q=${enc(String(x.name || it.title))}` };
      case 'admission': return { to: `/students/admissions?q=${enc(String(x.application_number || it.title))}` };
      case 'invoice': return { to: `/finance/invoices?q=${enc(String(x.invoice_number || it.title))}` };
      case 'receipt':
        return isFamily || role === 'student'
          ? { to: role === 'student' ? '/finance/my-fees' : `/finance/my-fees?child=${enc(String(x.student_id))}` }
          : { to: `/finance/payments?q=${enc(String(x.receipt_number || it.title))}` };
      case 'assignment': return { to: `/academic/assignments?q=${enc(String(x.title || it.title))}` };
      case 'announcement': return { to: '/communication/announcements' };
      case 'event': return { to: `/events/school/${enc(it.id)}` };
      case 'tenant': return { to: `/platform/tenants/${enc(it.id)}` };
      default: return { to: '/dashboard' };
    }
  }, [isFamily, role, staffSeesProfiles, enc]);

  const recordRow = useCallback((it: SearchItem): Row => {
    const { to, state } = recordRoute(it);
    return {
      key: `${it.type}:${it.id}`, kind: 'record', type: it.type, title: it.title, subtitle: it.subtitle,
      badge: it.badge, photo: it.photo, to, state, score: it.score,
    };
  }, [recordRoute]);

  const pageRow = (e: PageEntry, score: number): Row => ({
    key: e.id, kind: e.kind, type: e.kind, title: e.title, subtitle: e.subtitle,
    badge: e.readOnly ? 'read-only' : undefined, to: e.path, score,
  });

  // ── The list shown ────────────────────────────────────────────────────────
  const groups = useMemo((): Group[] => {
    if (!q) {
      const out: Group[] = [];
      if (recent.length) out.push({ id: 'recent', label: 'Recent', rows: recent });
      const recentKeys = new Set(recent.map((r) => r.key));
      const sug = suggestedPages(pageIndex, role).filter((e) => !recentKeys.has(e.id)).map((e) => pageRow(e, 0));
      if (sug.length) out.push({ id: 'suggested', label: 'Suggested', rows: sug });
      return out;
    }

    const hits = searchPages(pageIndex, q, 8);
    const actionRows = hits.filter((h) => h.entry.kind === 'action').slice(0, 2).map((h) => pageRow(h.entry, h.score));
    const pageRows = hits.filter((h) => h.entry.kind === 'page').slice(0, 4).map((h) => pageRow(h.entry, h.score));
    const bestPage = hits[0]?.score ?? 0;

    const sections = server?.sections ?? [];
    const top = server?.top ?? null;
    const topKey = top ? `${top.type}:${top.id}` : '';
    const recordGroups: Group[] = sections
      .map((s) => ({
        id: s.type,
        label: s.label,
        rows: s.items.filter((i) => `${i.type}:${i.id}` !== topKey).map(recordRow),
      }))
      .filter((g) => g.rows.length);

    const out: Group[] = [];
    // A clear page hit ("attendance", "invoices") goes first unless a record matches even better.
    const pagesFirst = bestPage >= 88 && (!top || top.score < bestPage);
    const pagesBlock: Group[] = [];
    if (actionRows.length) pagesBlock.push({ id: 'actions', label: 'Quick actions', rows: actionRows });
    if (pageRows.length) pagesBlock.push({ id: 'pages', label: 'Pages', rows: pageRows });

    if (top) out.push({ id: 'top', label: 'Best match', rows: [recordRow(top)] });
    if (pagesFirst) out.push(...pagesBlock, ...recordGroups);
    else out.push(...recordGroups, ...pagesBlock);
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, server, recent, pageIndex, role, recordRow]);

  const flat = useMemo(() => groups.flatMap((g) => g.rows), [groups]);

  // First row is always ready for Enter; reset when the list changes.
  useEffect(() => { setCursor(0); }, [groups]);
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${cursor}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const open = (row: Row) => {
    saveRecent(row, userId, tenantId);
    setQuery('');
    setServer(null);
    setFocused(false);
    inputRef.current?.blur();
    onClose?.();
    navigate(row.to, row.state ? { state: row.state } : undefined);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (query) { setQuery(''); return; }
      setFocused(false);
      inputRef.current?.blur();
      onClose?.();
      return;
    }
    if (!flat.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => (c + 1) % flat.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => (c - 1 + flat.length) % flat.length); }
    else if (e.key === 'Home' && !query) { e.preventDefault(); setCursor(0); }
    else if (e.key === 'End' && !query) { e.preventDefault(); setCursor(flat.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); const row = flat[cursor] ?? flat[0]; if (row) open(row); }
  };

  const showPanel = focused && (q.length > 0 || groups.length > 0);
  const placeholder = role === 'super_admin'
    ? 'Search schools and pages…'
    : isFamily || role === 'student'
      ? 'Search pages, receipts, announcements…'
      : 'Search students, staff, fees, pages…';
  const noResults = !!q && !searching && flat.length === 0;
  const activeId = flat[cursor] ? `${listId}-opt-${cursor}` : undefined;

  // ── Render ────────────────────────────────────────────────────────────────
  let idx = -1;
  return (
    <div ref={containerRef} className={clsx('relative', mobile ? 'w-full' : 'flex-1 max-w-xl mx-auto')}>
      <div
        className={clsx(
          'flex items-center gap-2 rounded-xl px-3.5 py-2 transition-all duration-200',
          focused ? 'bg-white border border-[#315B8C] shadow-md ring-2 ring-[#315B8C]/15' : 'bg-gray-50 border border-gray-200 hover:border-gray-300',
        )}
      >
        {searching
          ? <Loader2 size={15} className="text-[#315B8C] flex-shrink-0 animate-spin" aria-hidden="true" />
          : <Search size={15} className={clsx('flex-shrink-0 transition-colors', focused ? 'text-[#315B8C]' : 'text-gray-400')} aria-hidden="true" />}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Search the app"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-activedescendant={showPanel ? activeId : undefined}
          aria-autocomplete="list"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none min-w-0"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={100}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0 transition-colors"
          >
            <X size={14} />
          </button>
        )}
        {!focused && !query && !mobile && (
          <kbd className="hidden lg:flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-gray-400 bg-gray-100 border border-gray-200 rounded font-mono flex-shrink-0" aria-hidden="true">
            Ctrl K
          </kbd>
        )}
      </div>

      {showPanel && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden max-h-[70vh] flex flex-col">
          <div ref={listRef} id={listId} role="listbox" aria-label="Search results" className="overflow-y-auto flex-1">
            {groups.map((g) => (
              <div key={g.id} role="group" aria-label={g.label}>
                <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-50/70 border-b border-gray-50 sticky top-0 z-[1]">
                  {g.id === 'top' && <Sparkles size={11} className="text-amber-500" aria-hidden="true" />}
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{g.label}</span>
                  {g.id === 'recent' && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { clearRecent(userId, tenantId); setRecent([]); }}
                      className="ml-auto text-[11px] text-gray-400 hover:text-gray-600"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {g.rows.map((row) => {
                  idx += 1;
                  const i = idx;
                  const active = i === cursor;
                  const meta = TYPE_META[row.type] ?? TYPE_META.page;
                  return (
                    <button
                      key={`${g.id}:${row.key}`}
                      id={`${listId}-opt-${i}`}
                      data-idx={i}
                      role="option"
                      aria-selected={active}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseMove={() => { if (cursor !== i) setCursor(i); }}
                      onClick={() => open(row)}
                      className={clsx('w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors', active ? 'bg-blue-50' : 'hover:bg-gray-50')}
                    >
                      {g.id === 'recent' ? <Clock size={15} className="text-gray-400 flex-shrink-0 w-8" aria-hidden="true" /> : <Leading row={row} />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate"><Highlight text={row.title} query={q} /></p>
                        {row.subtitle && <p className="text-[11px] text-gray-500 truncate"><Highlight text={row.subtitle} query={q} /></p>}
                      </div>
                      {row.badge && (
                        <span className={clsx(
                          'text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 capitalize',
                          /owes|overdue|unpaid|refunded|draft|withdrawn|inactive/i.test(row.badge) ? 'bg-amber-50 text-amber-700'
                            : /similar/i.test(row.badge) ? 'bg-gray-100 text-gray-500'
                            : /paid|active|approved|enrolled|important/i.test(row.badge) ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-100 text-gray-600',
                        )}>
                          {row.badge}
                        </span>
                      )}
                      <span className={clsx('hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0', meta.tag)}>{meta.label}</span>
                      <CornerDownLeft size={12} className={clsx('flex-shrink-0', active ? 'text-[#315B8C]' : 'text-transparent')} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            ))}

            {q.length >= 2 && searching && (
              <div className="flex items-center gap-2 px-4 py-3 text-xs text-gray-500" role="status">
                <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Looking through people and records…
              </div>
            )}

            {offline && q.length >= 2 && !searching && (
              <div className="flex items-center gap-2 px-4 py-3 text-xs text-amber-700 bg-amber-50/60" role="status">
                <WifiOff size={13} aria-hidden="true" /> Records can't be searched right now. Showing pages only.
              </div>
            )}

            {noResults && !offline && (
              <div className="py-8 px-4 text-center">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center text-gray-300 mb-3"><Search size={22} aria-hidden="true" /></div>
                <p className="text-sm font-semibold text-gray-700">Nothing found for "{q}"</p>
                <p className="text-xs text-gray-500 mt-1">
                  {role === 'super_admin'
                    ? 'Try a school name or a page like "subscriptions".'
                    : isFamily || role === 'student'
                      ? 'Try a page ("fees", "results") or a receipt number.'
                      : 'Try a name, admission number, receipt number (RCP-…), phone number, or a page like "arrears".'}
                </p>
              </div>
            )}

            {!q && groups.length === 0 && (
              <div className="py-8 px-4 text-center text-sm text-gray-500">Start typing to search across your school.</div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-gray-100 bg-gray-50/60 flex-shrink-0">
            <div className="flex items-center gap-3 text-[10px] text-gray-500 min-w-0">
              <span className="flex items-center gap-1"><kbd className="bg-gray-200 px-1 rounded font-mono">↑↓</kbd> move</span>
              <span className="flex items-center gap-1"><kbd className="bg-gray-200 px-1 rounded font-mono">↵</kbd> open</span>
              <span className="flex items-center gap-1"><kbd className="bg-gray-200 px-1 rounded font-mono">Esc</kbd> close</span>
            </div>
            {!q && <span className="hidden sm:block text-[10px] text-gray-400 truncate">Try a name, admission no., RCP-… or "arrears"</span>}
            {q && !searching && flat.length > 0 && <span className="text-[10px] text-gray-400">{flat.length} result{flat.length === 1 ? '' : 's'}</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalSearchBar;
