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
import { apiClient } from '@lib/apiClient';
import {
  CreditCard, BadgeCheck, Search, X, User, Users, CheckSquare,
  ChevronDown, AlertCircle,
} from 'lucide-react';

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
  const [templateId, setTemplateId] = useState('');
  const [format, setFormat] = useState<CardFormat>('pvc');
  const [expirationDate, setExpirationDate] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(preselectedUserId ? 'single' : 'single');
      setUserId(preselectedUserId || '');
      setSelectedUsers([]);
      setUserSearch('');
      setRoleFilter('');
      setTemplateId('');
      setFormat('pvc');
      setExpirationDate('');
    }
  }, [isOpen, preselectedUserId]);

  // ── Fetch Students & Staff ───────────────────────────────────────────────────
  const { data: usersData, isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ['school-members-for-cards', userSearch, roleFilter],
    queryFn: async () => {
      // Fetch students and teachers from their respective directory tables
      const params: any = { limit: 100 };
      if (userSearch) params.search = userSearch;
      if (roleFilter) params.role = roleFilter;
      return apiClient.get('/api/v1/id-cards/eligible-members', { params });
    },
    enabled: isOpen && !preselectedUserId,
    staleTime: 15_000,
    retry: 1,
  });

  const users: UserOption[] = useMemo(() => {
    if (!usersData || (usersData as any)?.success === false) return [];
    const raw = (usersData as any)?.data ?? [];
    if (!Array.isArray(raw)) return [];
    return raw.map((u: any) => ({
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
    // Backend returns { templates: [...], count } directly from apiClient
    // On error returns { success: false, error: '...' }
    if (!templatesData || (templatesData as any)?.success === false) return [];
    const raw = templatesData as any;
    if (Array.isArray(raw?.templates)) return raw.templates;
    if (Array.isArray(raw?.data)) return raw.data;
    return [];
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
      } else {
        // Bulk generation
        const res = await idCardService.createBulkJob({
          userIds: selectedUsers,
          format,
          templateId: templateId || undefined,
        });
        if ((res as any).success === false) throw new Error((res as any).error ?? 'Bulk generation failed');
        showToast.success(`Bulk job created for ${selectedUsers.length} cards`);
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      showToast.error(error.message || 'Failed to generate card');
    } finally {
      setIsGenerating(false);
    }
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
      }
    >
      <div className="space-y-6 max-h-[65vh] overflow-y-auto px-1 -mx-1">
        {/* ── Mode Toggle ── */}
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
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full pl-8 pr-8 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {userSearch && (
                  <button onClick={() => setUserSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <X size={13} />
                  </button>
                )}
              </div>
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
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
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
      </div>
    </Modal>
  );
};

export default CardGenerationModal;
