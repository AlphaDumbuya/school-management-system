/**
 * GlobalSearchBar — powerful, role-aware, debounced omni-search for the header.
 *
 * Searches in parallel across: Students, Teachers, Classes, Subjects, Announcements.
 * Results grouped by category with avatars/icons, keyboard navigation (↑↓ Enter Esc),
 * recent searches (localStorage), and smart navigate-on-select.
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, Users, Briefcase, BookOpen, Megaphone,
  GraduationCap, Clock, ArrowRight, Loader2, BookMarked,
} from 'lucide-react';
import clsx from 'clsx';
import useAuth from '@hooks/useAuth';
import { studentsService } from '@services/studentsService';
import { teachersService } from '@services/teachersService';
import { classesService } from '@services/classesService';
import { subjectsService } from '@services/subjectsService';
import { announcementService } from '@services/announcementService';

// ── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  category: 'students' | 'teachers' | 'classes' | 'subjects' | 'announcements';
  title: string;
  subtitle?: string;
  avatarUrl?: string;
  initials?: string;
  route: string;
}

interface GroupedResults {
  label: string;
  icon: React.ReactNode;
  color: string;
  items: SearchResult[];
}

const RECENT_BASE = 'wiskul.search.recent';
const MAX_RECENT = 6;

function recentKey(userId?: string, tenantId?: string) {
  return `${RECENT_BASE}.${userId ?? 'anon'}.${tenantId ?? 'none'}`;
}

function getRecent(userId?: string, tenantId?: string): SearchResult[] {
  try {
    return JSON.parse(localStorage.getItem(recentKey(userId, tenantId)) ?? '[]');
  } catch {
    return [];
  }
}

function saveRecent(item: SearchResult, userId?: string, tenantId?: string) {
  try {
    const key = recentKey(userId, tenantId);
    const prev = getRecent(userId, tenantId).filter((r) => r.id !== item.id || r.category !== item.category);
    localStorage.setItem(key, JSON.stringify([item, ...prev].slice(0, MAX_RECENT)));
  } catch { /* ignore */ }
}

function clearRecent(userId?: string, tenantId?: string) {
  try { localStorage.removeItem(recentKey(userId, tenantId)); } catch { /* ignore */ }
}

function initials(first?: string, last?: string) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?';
}

// ── Avatar ───────────────────────────────────────────────────────────────────

const Avatar: React.FC<{ url?: string; text?: string; color: string }> = ({ url, text, color }) => (
  url
    ? <img src={url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
    : (
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${color}`}>
        {text}
      </div>
    )
);

// ── Category meta ────────────────────────────────────────────────────────────

const CATEGORY_META = {
  students:      { label: 'Students',      icon: <Users size={13} />,       color: 'bg-blue-500',    avatarBg: 'bg-blue-500' },
  teachers:      { label: 'Teachers',      icon: <Briefcase size={13} />,   color: 'bg-emerald-500', avatarBg: 'bg-emerald-500' },
  classes:       { label: 'Classes',       icon: <BookOpen size={13} />,    color: 'bg-violet-500',  avatarBg: 'bg-violet-500' },
  subjects:      { label: 'Subjects',      icon: <BookMarked size={13} />,  color: 'bg-amber-500',   avatarBg: 'bg-amber-500' },
  announcements: { label: 'Announcements', icon: <Megaphone size={13} />,   color: 'bg-rose-500',    avatarBg: 'bg-rose-500' },
} as const;

// ── Main component ────────────────────────────────────────────────────────────

interface GlobalSearchBarProps {
  /** Called when the mobile overlay close button is tapped */
  onClose?: () => void;
  /** Whether this is the mobile inline variant (no backdrop) */
  mobile?: boolean;
}

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({ onClose, mobile }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role     = user?.role     ?? 'student';
  const userId   = user?.id       as string | undefined;
  const tenantId = user?.tenantId as string | undefined;

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [cursor, setCursor] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recent = useMemo(() => getRecent(userId, tenantId), [focused]); // eslint-disable-line react-hooks/exhaustive-deps
  const showDropdown = focused && (query.length > 0 || recent.length > 0);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    try {
      const canSeeStudents   = ['principal', 'teacher', 'accountant', 'admissions_officer'].includes(role);
      const canSeeTeachers   = ['principal'].includes(role);
      const canSeeClasses    = ['principal', 'teacher', 'admissions_officer'].includes(role);
      const canSeeSubjects   = ['principal', 'teacher', 'admissions_officer'].includes(role);
      const canSeeAnnounce   = true; // all roles

      const promises: Promise<SearchResult[]>[] = [];

      if (canSeeStudents) {
        promises.push(
          studentsService.listStudents({ search: q, limit: 5 })
            .then((r) => {
              const list = (r as any)?.data?.data ?? (r as any)?.data ?? [];
              return (Array.isArray(list) ? list : []).map((s: any): SearchResult => ({
                id: s.id,
                category: 'students',
                title: `${s.first_name} ${s.last_name}`,
                subtitle: [s.student_id, s.class_name].filter(Boolean).join(' · '),
                avatarUrl: s.photo_url,
                initials: initials(s.first_name, s.last_name),
                route: `/students/directory?q=${encodeURIComponent(`${s.first_name} ${s.last_name}`)}`,
              }));
            })
            .catch(() => [])
        );
      }

      if (canSeeTeachers) {
        promises.push(
          teachersService.listTeachers({ search: q, limit: 5 })
            .then((r) => {
              const list = (r as any)?.data?.data ?? (r as any)?.data ?? [];
              return (Array.isArray(list) ? list : []).map((t: any): SearchResult => ({
                id: t.id,
                category: 'teachers',
                title: `${t.first_name} ${t.last_name}`,
                subtitle: [t.teacher_id, t.department || t.specialization].filter(Boolean).join(' · '),
                avatarUrl: t.photo_url,
                initials: initials(t.first_name, t.last_name),
                route: `/staff/teachers?q=${encodeURIComponent(`${t.first_name} ${t.last_name}`)}`,
              }));
            })
            .catch(() => [])
        );
      }

      if (canSeeClasses) {
        promises.push(
          classesService.listClasses({ search: q, limit: 5 })
            .then((r) => {
              const list = (r as any)?.data?.data ?? (r as any)?.data ?? [];
              return (Array.isArray(list) ? list : []).map((c: any): SearchResult => ({
                id: String(c.id),
                category: 'classes',
                title: c.name,
                subtitle: [`Level ${c.level}`, c.enrolled_students != null ? `${c.enrolled_students} students` : undefined].filter(Boolean).join(' · '),
                initials: c.name[0]?.toUpperCase() ?? 'C',
                route: `/academic/classes`,
              }));
            })
            .catch(() => [])
        );
      }

      if (canSeeSubjects) {
        promises.push(
          subjectsService.listSubjects({ search: q, limit: 5 })
            .then((r) => {
              const list = (r as any)?.data?.data ?? (r as any)?.data ?? [];
              return (Array.isArray(list) ? list : []).map((s: any): SearchResult => ({
                id: String(s.id),
                category: 'subjects',
                title: s.name,
                subtitle: [s.code, s.category].filter(Boolean).join(' · '),
                initials: s.code?.[0] ?? s.name?.[0] ?? 'S',
                route: `/academic/subjects`,
              }));
            })
            .catch(() => [])
        );
      }

      if (canSeeAnnounce) {
        promises.push(
          announcementService.list({ limit: 5 })
            .then((r) => {
              const list = (r as any)?.data ?? [];
              return (Array.isArray(list) ? list : [])
                .filter((a: any) => a.title?.toLowerCase().includes(q.toLowerCase()) || a.body?.toLowerCase().includes(q.toLowerCase()))
                .slice(0, 4)
                .map((a: any): SearchResult => ({
                  id: a.id,
                  category: 'announcements',
                  title: a.title,
                  subtitle: a.author_display ?? a.author_name,
                  initials: '📢',
                  route: `/communication/announcements`,
                }));
            })
            .catch(() => [])
        );
      }

      const groups = await Promise.all(promises);
      setResults(groups.flat());
    } finally {
      setLoading(false);
    }
  }, [role]);

  // Debounce input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(() => runSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, runSearch]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset cursor when results change
  useEffect(() => { setCursor(-1); }, [results]);

  // ── Grouped display list ──────────────────────────────────────────────────

  const displayItems: SearchResult[] = query.trim() ? results : recent;
  const grouped = useMemo((): GroupedResults[] => {
    if (!displayItems.length) return [];
    const cats = ['students', 'teachers', 'classes', 'subjects', 'announcements'] as const;
    return cats
      .map((cat) => {
        const items = displayItems.filter((r) => r.category === cat);
        if (!items.length) return null;
        const meta = CATEGORY_META[cat];
        return { label: meta.label, icon: meta.icon, color: meta.color, items };
      })
      .filter(Boolean) as GroupedResults[];
  }, [displayItems]);

  // Flat ordered list for keyboard navigation
  const flatItems = grouped.flatMap((g) => g.items);

  // ── Interaction ───────────────────────────────────────────────────────────

  const selectItem = (item: SearchResult) => {
    saveRecent(item, userId, tenantId);
    setQuery('');
    setFocused(false);
    setCursor(-1);
    onClose?.();
    navigate(item.route);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (cursor >= 0 && flatItems[cursor]) {
        selectItem(flatItems[cursor]);
      } else if (query.trim()) {
        // Fallback: navigate to student directory with query
        saveRecent({ id: query, category: 'students', title: query, route: `/students/directory?q=${encodeURIComponent(query)}` }, userId, tenantId);
        navigate(`/students/directory?q=${encodeURIComponent(query)}`);
        setQuery('');
        setFocused(false);
        onClose?.();
      }
    } else if (e.key === 'Escape') {
      setFocused(false);
      inputRef.current?.blur();
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className={clsx('relative', mobile ? 'w-full' : 'flex-1 max-w-xl mx-auto')}>
      {/* Input */}
      <div className={clsx(
        'flex items-center gap-2 rounded-xl px-3.5 py-2 transition-all duration-200',
        focused
          ? 'bg-white border border-[#315B8C] shadow-md ring-2 ring-[#315B8C]/15'
          : 'bg-gray-50 border border-gray-200 hover:border-gray-300',
      )}>
        {loading
          ? <Loader2 size={15} className="text-[#315B8C] flex-shrink-0 animate-spin" />
          : <Search size={15} className={clsx('flex-shrink-0 transition-colors', focused ? 'text-[#315B8C]' : 'text-gray-400')} />
        }
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search students, staff, classes…"
          className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none min-w-0"
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0 transition-colors"
          >
            <X size={14} />
          </button>
        )}
        {/* Keyboard shortcut hint */}
        {!focused && !mobile && (
          <kbd className="hidden lg:flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-gray-400 bg-gray-100 border border-gray-200 rounded font-mono flex-shrink-0">
            ⌘K
          </kbd>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden max-h-[70vh] flex flex-col">

          {/* Header row */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 flex-shrink-0">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              {query.trim() ? (loading ? 'Searching…' : `${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`) : 'Recent searches'}
            </span>
            {!query.trim() && recent.length > 0 && (
              <button
                type="button"
                onClick={() => { clearRecent(userId, tenantId); setFocused(false); setTimeout(() => setFocused(true), 0); }}
                className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Results */}
          <div className="overflow-y-auto flex-1">
            {grouped.length === 0 && !loading && query.trim() && (
              <div className="py-10 px-4 text-center">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center text-gray-300 mb-3">
                  <Search size={22} />
                </div>
                <p className="text-sm font-semibold text-gray-700">No results for "{query}"</p>
                <p className="text-xs text-gray-400 mt-1">Try a different name, ID, or class</p>
              </div>
            )}

            {grouped.length === 0 && !loading && !query.trim() && recent.length === 0 && (
              <div className="py-10 px-4 text-center">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center text-gray-300 mb-3">
                  <Search size={22} />
                </div>
                <p className="text-sm text-gray-500">Start typing to search across your school</p>
              </div>
            )}

            {grouped.map((group) => (
              <div key={group.label}>
                {/* Group header */}
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50/60 border-b border-gray-50">
                  <span className={clsx('w-4 h-4 rounded flex items-center justify-center text-white flex-shrink-0', group.color)}>
                    {group.icon}
                  </span>
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{group.label}</span>
                  <span className="ml-auto text-[10px] text-gray-400">{group.items.length}</span>
                </div>

                {/* Items */}
                {group.items.map((item) => {
                  const idx = flatItems.indexOf(item);
                  const meta = CATEGORY_META[item.category];
                  const isHighlighted = cursor === idx;
                  return (
                    <button
                      key={`${item.category}-${item.id}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()} // prevent blur before click
                      onClick={() => selectItem(item)}
                      className={clsx(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        isHighlighted ? 'bg-blue-50' : 'hover:bg-gray-50',
                      )}
                    >
                      {/* Avatar / icon */}
                      {!query.trim()
                        ? <Clock size={15} className="text-gray-400 flex-shrink-0 w-8 text-center" />
                        : <Avatar url={item.avatarUrl} text={item.initials} color={meta.avatarBg} />
                      }

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{item.title}</p>
                        {item.subtitle && (
                          <p className="text-[11px] text-gray-400 truncate">{item.subtitle}</p>
                        )}
                      </div>

                      {/* Category tag */}
                      <span className={clsx(
                        'hidden xs:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0',
                        `bg-opacity-10 text-opacity-80`,
                        item.category === 'students'      && 'bg-blue-100 text-blue-700',
                        item.category === 'teachers'      && 'bg-emerald-100 text-emerald-700',
                        item.category === 'classes'       && 'bg-violet-100 text-violet-700',
                        item.category === 'subjects'      && 'bg-amber-100 text-amber-700',
                        item.category === 'announcements' && 'bg-rose-100 text-rose-700',
                      )}>
                        {meta.label}
                      </span>

                      <ArrowRight size={13} className={clsx('flex-shrink-0 transition-colors', isHighlighted ? 'text-[#315B8C]' : 'text-gray-300')} />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50/50 flex-shrink-0">
            <div className="flex items-center gap-3 text-[10px] text-gray-400">
              <span className="flex items-center gap-1"><kbd className="bg-gray-200 px-1 rounded font-mono">↑↓</kbd> navigate</span>
              <span className="flex items-center gap-1"><kbd className="bg-gray-200 px-1 rounded font-mono">↵</kbd> select</span>
              <span className="flex items-center gap-1"><kbd className="bg-gray-200 px-1 rounded font-mono">Esc</kbd> close</span>
            </div>
            {query.trim() && results.length > 0 && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  navigate(`/students/directory?q=${encodeURIComponent(query)}`);
                  setQuery(''); setFocused(false); onClose?.();
                }}                className="text-[11px] font-bold text-[#315B8C] hover:underline flex items-center gap-1"
              >
                View all results <ArrowRight size={11} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalSearchBar;
