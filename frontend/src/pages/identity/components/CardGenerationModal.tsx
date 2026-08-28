/**
 * CardGenerationModal — Generate ID cards for staff and students
 * Production-ready: user search with role filter, single/bulk mode,
 * format selector, template picker, expiration date.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { idCardService, CardFormat } from '@services/idCardService';
import { classesService } from '@services/classesService';
import { apiClient } from '@lib/apiClient';
import { SearchBar } from '@components/admin/table/SearchBar';
import {
  CreditCard, BadgeCheck, User, Users,
  ChevronDown, AlertCircle, Loader2, CheckCircle, XCircle, Download,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CardGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId?: string;
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  first_name?: string;
  last_name?: string;
  email: string;
  role: string;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const labelCls = 'block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide';
const selectCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed appearance-none';

const ROLES = [
  { value: '', label: 'All Members' },
  { value: 'student', label: 'Students' },
  { value: 'teacher', label: 'Teachers' },
  { value: 'principal', label: 'Principals' },
  { value: 'accountant', label: 'Accountants' },
  { value: 'admissions_officer', label: 'Admissions' },
];

function roleDisplayName(role: string): string {
  switch (role) {
    case 'student': return 'Student';
    case 'teacher': return 'Teacher';
    case 'principal': return 'Principal';
    case 'super_admin': return 'Admin';
    case 'accountant': return 'Accountant';
    case 'admissions_officer': return 'Admissions';
    case 'parent': return 'Parent';
    default: return role;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export const CardGenerationModal: React.FC<CardGenerationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  userId: preselectedUserId,
}) => {
  // Form state
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [userId, setUserId] = useState(preselectedUserId || '');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [classId, setClassId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [format, setFormat] = useState<CardFormat>('pvc');
  const [expirationDate, setExpirationDate] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [bulkJobId, setBulkJobId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // A class filter only applies to students.
  const classApplies = roleFilter === '' || roleFilter === 'student';

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(preselectedUserId ? 'single' : 'single');
      setUserId(preselectedUserId || '');
      setSelectedUsers([]);
      setUserSearch('');
      setRoleFilter('');
      setClassId('');
      setTemplateId('');
      setFormat('pvc');
      setExpirationDate('');
      setBulkJobId(null);
    }
  }, [isOpen, preselectedUserId]);

  // Clear the class filter if the role switches to a non-student role.
  useEffect(() => {
    if (!classApplies && classId) setClassId('');
  }, [classApplies, classId]);

  // ── Fetch classes for the class filter ───────────────────────────────────────
  const { data: classesData } = useQuery({
    queryKey: ['card-modal-classes'],
    queryFn: () => classesService.listClasses({ limit: 200 }),
    enabled: isOpen && !preselectedUserId,
    staleTime: 60_000,
  });
  const classOptions: any[] = (classesData as any)?.data ?? (classesData as any)?.data?.data ?? [];

  // ── Fetch Students & Staff ───────────────────────────────────────────────────
  const { data: usersData, isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ['school-members-for-cards', userSearch, roleFilter, classId],
    queryFn: async () => {
      // Fetch students and teachers from their respective directory tables
      const params: any = { limit: 100 };
      if (userSearch) params.search = userSearch;
      if (roleFilter) params.role = roleFilter;
      if (classId && classApplies) params.classId = classId;
      return apiClient.get('/api/v1/id-cards/eligible-members', { params });
    },
    enabled: isOpen && !preselectedUserId,
    staleTime: 15_000,
    retry: 1,
  });

  // ── Poll bulk job progress (once a bulk job is created) ──────────────────────
  const { data: bulkStatusData } = useQuery({
    queryKey: ['card-modal-bulk-status', bulkJobId],
    queryFn: () => idCardService.getBulkJobStatus(bulkJobId!),
    enabled: !!bulkJobId,
    refetchInterval: (query) => {
      const s = (query.state.data as any)?.status?.status ?? (query.state.data as any)?.data?.status?.status;
      return s === 'completed' || s === 'failed' || s === 'cancelled' ? false : 1500;
    },
  });
  const bulkStatus: any = (bulkStatusData as any)?.status ?? (bulkStatusData as any)?.data?.status ?? null;
  const bulkTerminal = bulkStatus && ['completed', 'failed', 'cancelled'].includes(bulkStatus.status);

  const { data: bulkReportData } = useQuery({
    queryKey: ['card-modal-bulk-report', bulkJobId],
    queryFn: () => idCardService.getBulkJobReport(bulkJobId!),
    enabled: !!bulkJobId && bulkStatus?.status === 'completed',
    staleTime: 60_000,
  });
  const bulkReport: any = (bulkReportData as any)?.report ?? (bulkReportData as any)?.data ?? bulkReportData ?? null;

  const storageUrl = (u?: string) => {
    if (!u) return '';
    const base = ((import.meta as any).env?.VITE_API_URL as string || '').replace(/\/api\/?$/, '');
    return u.startsWith('/storage') ? `${base}${u}` : u;
  };

  // Refresh the cards list as the job progresses / completes.
  useEffect(() => {
    if (bulkStatus) {
      queryClient.invalidateQueries({ queryKey: ['id-cards'] });
      queryClient.invalidateQueries({ queryKey: ['id-cards-stats'] });
    }
  }, [bulkStatus?.processedCards, bulkStatus?.status, queryClient]);

  const users: UserOption[] = useMemo(() => {
    if (!usersData || (usersData as any)?.success === false) return [];
    const raw = (usersData as any)?.data ?? [];
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    return raw
      .filter((u: any) => {
        const uid = u.userId || u.user_id || u.id;
        if (!uid || seen.has(uid)) return false;
        seen.add(uid);
        return true;
      })
      .map((u: any) => ({
        id: u.userId || u.user_id || u.id,
        firstName: u.firstName || u.first_name || '',
        lastName: u.lastName || u.last_name || '',
        email: u.email || '',
        role: u.role || '',
      }));
  }, [usersData]);

  // ── Fetch Templates ─────────────────────────────────────────────────────────
  const { data: templatesData, isLoading: templatesLoading, error: templatesError } = useQuery({
    queryKey: ['card-templates-list', format],
    queryFn: () => idCardService.listTemplates({ format }),
    enabled: isOpen,
    staleTime: 60_000,
    retry: 1,
  });

  const templates: any[] = useMemo(() => {
    if (!templatesData || (templatesData as any)?.success === false) return [];
    const raw = templatesData as any;
    let list: any[] = [];
    if (Array.isArray(raw?.templates)) list = raw.templates;
    else if (Array.isArray(raw?.data?.templates)) list = raw.data.templates;
    else if (Array.isArray(raw?.data)) list = raw.data;
    else if (Array.isArray(raw)) list = raw;

    const seen = new Set();
    return list.filter((t: any) => {
      const tid = t.id || t.templateId;
      if (!tid || seen.has(tid)) return false;
      seen.add(tid);
      return true;
    });
  }, [templatesData]);

  // ── Toggle user selection for bulk mode ─────────────────────────────────────
  const toggleUserSelection = (id: string) => {
    setSelectedUsers((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedUsers(users.map((u) => u.id));
  };

  const deselectAll = () => {
    setSelectedUsers([]);
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (mode === 'single' && !userId) {
      showToast.error('Please select a student or staff member');
      return;
    }
    if (mode === 'bulk' && selectedUsers.length === 0) {
      showToast.error('Please select at least one person');
      return;
    }

    setIsGenerating(true);
    try {
      if (mode === 'single') {
        const res = await idCardService.generateCard({
          userId,
          templateId: templateId || undefined,
          format,
          expirationDate: expirationDate || undefined,
        });
        if ((res as any).success === false) throw new Error((res as any).error ?? 'Generation failed');
        showToast.success('ID card generated successfully');
        onSuccess();
        onClose();
      } else {
        // Bulk generation — keep the modal open and show live progress.
        const res = await idCardService.createBulkJob({
          userIds: selectedUsers,
          format,
          templateId: templateId || undefined,
          ...(expirationDate ? { expirationDate } : {}),
        });
        if ((res as any).success === false) throw new Error((res as any).error ?? 'Bulk generation failed');
        const job = (res as any)?.job ?? (res as any)?.data?.job ?? res;
        const id = job?.jobId ?? job?.id ?? null;
        if (!id) throw new Error('Bulk job did not return an id');
        setBulkJobId(id);
        onSuccess();
      }
    } catch (error: any) {
      showToast.error(error?.response?.data?.error?.message || error.message || 'Failed to generate card');
    } finally {
      setIsGenerating(false);
    }
  };

  const cancelBulkJob = async () => {
    if (!bulkJobId) return;
    try {
      await idCardService.cancelBulkJob(bulkJobId);
      showToast.success('Job cancelled');
    } catch { showToast.error('Failed to cancel job'); }
  };

  // Default expiration: 1 year
  const minDate = new Date().toISOString().slice(0, 10);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate ID Card"
      size="xl"
      footer={
        bulkJobId ? undefined : (
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {mode === 'bulk' && selectedUsers.length > 0 && (
              <span className="font-semibold text-blue-600 dark:text-blue-400">{selectedUsers.length} person{selectedUsers.length > 1 ? 's' : ''} selected</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose} disabled={isGenerating}>Cancel</Button>
            <Button
              variant="default"
              onClick={handleGenerate}
              disabled={isGenerating || (mode === 'single' && !userId) || (mode === 'bulk' && selectedUsers.length === 0)}
            >
              {isGenerating ? 'Generating...' : mode === 'bulk' ? `Generate ${selectedUsers.length} Card${selectedUsers.length !== 1 ? 's' : ''}` : 'Generate Card'}
            </Button>
          </div>
        </div>
        )
      }
    >
      <div className="space-y-6 max-h-[65vh] overflow-y-auto px-1 -mx-1">
        {/* ── Bulk Progress (replaces form once a job is running) ── */}
        {bulkJobId ? (
          <div className="py-4 space-y-5 min-h-[200px]">
            {!bulkTerminal ? (
              <>
                <div className="flex items-center gap-3">
                  <Loader2 size={22} className="animate-spin text-blue-500 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Generating cards…</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {bulkStatus ? `${bulkStatus.processedCards} of ${bulkStatus.totalCards} processed` : 'Starting job…'}
                    </p>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${bulkStatus?.progress ?? 0}%` }} />
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={cancelBulkJob}>Cancel Job</Button>
                </div>
              </>
            ) : bulkStatus?.status === 'completed' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                    <CheckCircle size={26} className="text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-base">Batch Complete</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      <span className="text-emerald-600 font-bold">{bulkStatus.successfulCards}</span> generated
                      {bulkStatus.failedCards > 0 && <> · <span className="text-red-600 font-bold">{bulkStatus.failedCards}</span> failed</>}
                    </p>
                  </div>
                </div>

                {bulkStatus.pdfUrl && (
                  <a href={storageUrl(bulkStatus.pdfUrl)} target="_blank" rel="noopener noreferrer" download>
                    <Button className="gap-1.5 w-full"><Download size={15} /> Download All Cards (PDF)</Button>
                  </a>
                )}

                {bulkReport?.failed?.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
                    <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-2">{bulkReport.failed.length} card(s) failed</p>
                    <ul className="space-y-1 max-h-32 overflow-y-auto text-xs">
                      {bulkReport.failed.map((f: any, i: number) => (
                        <li key={i} className="flex justify-between gap-2 text-red-600 dark:text-red-400">
                          <span className="font-medium truncate">{f.userName || f.userId}</span>
                          <span className="opacity-80 truncate">{f.errorMessage}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={onClose}>Close</Button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <XCircle size={40} className="text-red-500 mx-auto" />
                <h3 className="font-bold text-gray-900 dark:text-white">
                  Job {bulkStatus?.status === 'cancelled' ? 'Cancelled' : 'Failed'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {bulkStatus?.status === 'cancelled' ? 'The batch was cancelled.' : 'The batch could not be completed.'}
                </p>
                <div className="flex justify-center gap-3">
                  <Button variant="outline" onClick={() => setBulkJobId(null)}>Try Again</Button>
                  <Button variant="ghost" onClick={onClose}>Close</Button>
                </div>
              </div>
            )}
          </div>
        ) : (<>
        {!preselectedUserId && (
          <div>
            <label className={labelCls}>Generation Mode</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('single')}
                className={`flex items-center gap-3 p-3 border-2 rounded-xl transition-all ${
                  mode === 'single'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-500/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                }`}
              >
                <User size={20} className={mode === 'single' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'} />
                <div className="text-left">
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Single User</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Generate one card</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMode('bulk')}
                className={`flex items-center gap-3 p-3 border-2 rounded-xl transition-all ${
                  mode === 'bulk'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-500/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                }`}
              >
                <Users size={20} className={mode === 'bulk' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'} />
                <div className="text-left">
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Bulk Generate</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Multiple users at once</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── User Selection ── */}
        {!preselectedUserId && (
          <div>
            <label className={labelCls}>
              {mode === 'single' ? 'Select Student or Staff *' : 'Select Students / Staff *'}
            </label>

            {/* Search + Role filter row */}
            <div className="flex flex-wrap gap-2 mb-2">
              <SearchBar
                placeholder="Search by name or email..."
                onSearch={setUserSearch}
                isLoading={usersLoading}
                defaultValue={userSearch}
                className="flex-1 min-w-[180px]"
              />
              <div className="relative w-[140px]">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full appearance-none pl-3 pr-7 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              {/* Class filter — students only */}
              {classApplies && (
                <div className="relative w-[160px]">
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="w-full appearance-none pl-3 pr-7 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    title="Filter students by class"
                  >
                    <option value="">All Classes</option>
                    {classOptions.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}{c.level ? ` (${c.level})` : ''}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              )}
            </div>

            {/* Single mode: dropdown */}
            {mode === 'single' && (
              <>
                <select
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  disabled={usersLoading || isGenerating}
                  className={selectCls}
                >
                  <option value="">— Choose a student or staff member —</option>
                  {users.map((user, idx) => (
                    <option key={`usr-${user.id}-${idx}`} value={user.id}>
                      {user.firstName} {user.lastName} — {roleDisplayName(user.role)}
                    </option>
                  ))}
                </select>
                {usersLoading && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Loading students and staff...</p>}
                {!usersLoading && users.length === 0 && !usersError && (usersData as any)?.success !== false && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">No results found. Try adjusting your search or role filter.</p>
                )}
                {((usersData as any)?.success === false) && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle size={11} /> Failed to load: {(usersData as any)?.error || 'Permission denied'}. Please ensure the server is running and you have admin access.
                  </p>
                )}
              </>
            )}

            {/* Bulk mode: checkbox list */}
            {mode === 'bulk' && (
              <div>
                {/* Select all / deselect */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    {usersLoading ? 'Loading...' : `${users.length} students/staff found`}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={selectAll} className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline">Select All</button>
                    <button onClick={deselectAll} className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 hover:underline">Deselect All</button>
                  </div>
                </div>

                {/* User list */}
                <div className="max-h-[180px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
                  {users.length === 0 && !usersLoading && (
                    <div className="p-4 text-center text-xs text-gray-500 dark:text-gray-400">
                      No students or staff found. Try adjusting your search or role filter.
                    </div>
                  )}
                  {users.map((user) => {
                    const isSelected = selectedUsers.includes(user.id);
                    return (
                      <label
                        key={user.id}
                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50 dark:bg-blue-950/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleUserSelection(user.id)}
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {user.firstName} {user.lastName}
                          </p>
                        </div>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 capitalize flex-shrink-0">
                          {roleDisplayName(user.role)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Card Format ── */}
        <div>
          <label className={labelCls}>Card Format *</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormat('pvc')}
              disabled={isGenerating}
              className={`relative flex flex-col items-center p-4 border-2 rounded-xl transition-all text-center cursor-pointer ${
                format === 'pvc'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-sm ring-1 ring-blue-500/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              } disabled:opacity-50`}
            >
              <CreditCard size={24} className={format === 'pvc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'} />
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-2">PVC Card</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Standard credit-card size (85.6mm × 53.98mm)</span>
            </button>
            <button
              type="button"
              onClick={() => setFormat('badge')}
              disabled={isGenerating}
              className={`relative flex flex-col items-center p-4 border-2 rounded-xl transition-all text-center cursor-pointer ${
                format === 'badge'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-sm ring-1 ring-blue-500/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              } disabled:opacity-50`}
            >
              <BadgeCheck size={24} className={format === 'badge' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'} />
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-2">Badge</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Lanyard badge (4" × 6")</span>
            </button>
          </div>
        </div>

        {/* ── Template Selection ── */}
        <div>
          <label className={labelCls}>Card Template</label>
          <div className="relative">
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={templatesLoading || isGenerating}
              className={selectCls}
            >
              <option value="">— Use Default Template (auto-detect by role) —</option>
              {templates.map((template: any) => (
                <option key={template.id || template.templateId} value={template.id || template.templateId}>
                  {template.name} {template.isDefault ? '★ Default' : ''} {template.version ? `(v${template.version})` : ''}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
          </div>
          {templatesLoading && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Loading templates...</p>}
          {!templatesLoading && templates.length === 0 && (templatesData as any)?.success !== false && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
              <AlertCircle size={11} /> No custom templates found. The system will use the built-in default design.
            </p>
          )}
          {(templatesData as any)?.success === false && (
            <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle size={11} /> Failed to load templates: {(templatesData as any)?.error}. Default design will be used.
            </p>
          )}
        </div>

        {/* ── Expiration Date ── */}
        <div>
          <label className={labelCls}>Expiration Date</label>
          <input
            type="date"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
            min={minDate}
            disabled={isGenerating}
            className={selectCls}
          />
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            Leave empty for default: 1 year from today.
          </p>
        </div>

        {/* ── Info box ── */}
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30 rounded-lg p-3">
          <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">
            The generated card will include: full name, role, photo (if available), unique card number, QR code for verification, barcode, issue and expiry dates, and school branding.
          </p>
        </div>
        </>)}
      </div>
    </Modal>
  );
};

export default CardGenerationModal;
