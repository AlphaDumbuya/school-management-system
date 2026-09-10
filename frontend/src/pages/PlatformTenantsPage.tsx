import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Users,
  HardDrive,
  Search,
  Plus,
  SlidersHorizontal,
  X,
  Play,
  Pause,
  Trash2,
  Shield,
  Loader2,
  Activity,
  Globe,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Lock,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { Button } from '@components/ui/button';
import { Modal } from '@components/admin/feedback/Modal';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { SearchBar } from '@components/admin/table/SearchBar';
import { showToast } from '@utils/toast';
import platformService, { PlatformTenant, PlatformStatistics } from '../services/platformService';
import {
  SUSPENSION_CATEGORIES,
  SUSPENSION_REASONS,
  CUSTOM_REASON,
  defaultReasonFor,
  type SuspensionCategory,
} from '@lib/suspensionReasons';

export const PlatformTenantsPage: React.FC = () => {
  const navigate = useNavigate();
  
  const closeRegisterModal = useCallback(() => {
    setIsRegisterOpen(false);
    setRegisterStep(1);
  }, []);

  const closeDetailsModal = useCallback(() => {
    setIsDetailsOpen(false);
  }, []);

  const closeSuspendModal = useCallback(() => {
    setIsSuspendOpen(false);
  }, []);

  const closeDeleteModal = useCallback(() => {
    setIsDeleteOpen(false);
  }, []);

  const closeSuccessModal = useCallback(() => {
    setIsSuccessModalOpen(false);
    setGeneratedCredentials(null);
  }, []);

  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [statistics, setStatistics] = useState<PlatformStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Pagination
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1); // 1-indexed
  const [total, setTotal] = useState(0);

  // Modals state
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isSuspendOpen, setIsSuspendOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [selectedTenant, setSelectedTenant] = useState<PlatformTenant | null>(null);
  const [suspensionCategory, setSuspensionCategory] = useState<SuspensionCategory>('payment');
  // Selected preset reason (or CUSTOM_REASON sentinel) + the free-text custom reason.
  const [reasonPreset, setReasonPreset] = useState<string>(defaultReasonFor('payment'));
  const [customReason, setCustomReason] = useState('');
  // Effective reason sent to the API.
  const suspensionReason = reasonPreset === CUSTOM_REASON ? customReason.trim() : reasonPreset;

  // When the category changes, reset the reason to that category's first preset.
  const onCategoryChange = (cat: SuspensionCategory) => {
    setSuspensionCategory(cat);
    setReasonPreset(defaultReasonFor(cat));
    setCustomReason('');
  };

  // Email sender modal state
  const [isEmailSenderOpen, setIsEmailSenderOpen] = useState(false);
  const [emailSender, setEmailSender] = useState<{ mode: 'platform' | 'own'; verified: boolean; fromAddress: string | null; contactEmail: string | null } | null>(null);
  const [emailSenderFrom, setEmailSenderFrom] = useState('');

  // Register Form State
  const [registerStep, setRegisterStep] = useState(1);
  const [generatedCredentials, setGeneratedCredentials] = useState<{ email: string; pass: string; schoolName: string } | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    name: '',
    slug: '',
    description: '',
    domain: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    timezone: 'Africa/Freetown',
    max_users: 500,
    max_storage_gb: 10,
  });

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const computedSlug = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const currentSlug = registerForm.slug;
    const previousComputedSlug = registerForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!currentSlug || currentSlug === previousComputedSlug) {
      setRegisterForm({ ...registerForm, name: val, slug: computedSlug });
    } else {
      setRegisterForm({ ...registerForm, name: val });
    }
  };

  const handleNextStep = () => {
    if (registerStep === 1) {
      if (!registerForm.name || !registerForm.slug) {
        showToast.warning('School name and URL slug are required.');
        return;
      }
    }
    if (registerStep === 2) {
      if (!registerForm.contact_email) {
        showToast.warning('Contact email is required.');
        return;
      }
    }
    setRegisterStep((prev) => prev + 1);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, tenantsRes] = await Promise.all([
        platformService.getStatistics().catch(() => ({ success: false, data: null })),
        platformService.getTenants({
          search: search || undefined,
          status: statusFilter || undefined,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        }).catch(() => ({ success: false, data: [] as PlatformTenant[], total: 0 })),
      ]);

      if (statsRes.success && statsRes.data) {
        setStatistics(statsRes.data);
      }
      if (tenantsRes.success && tenantsRes.data) {
        setTenants(tenantsRes.data);
        setTotal((tenantsRes as any).total ?? tenantsRes.data.length);
      }
    } catch (err) {
      console.error('Error fetching platform data:', err);
      showToast.error('Failed to load platform data');
    } finally {
      setLoading(false);
    }
  };

  // Reset to page 1 whenever the search/filter changes.
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, page]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerForm.name || !registerForm.slug || !registerForm.contact_email) {
      showToast.error('Please fill in all required fields.');
      return;
    }

    setSaving(true);
    const autoPassword = 'WiSkul@' + Math.random().toString(36).substring(2, 8).toUpperCase() + '!';
    const payload = {
      ...registerForm,
      adminFirstName: 'Principal',
      adminLastName: registerForm.name,
      adminEmail: registerForm.contact_email,
      adminPassword: autoPassword,
    };

    try {
      const res = await platformService.createTenant(payload);
      if (res.success) {
        showToast.success('School/Tenant registered successfully!');
        setIsRegisterOpen(false);
        setRegisterStep(1);
        setGeneratedCredentials({
          email: registerForm.contact_email,
          pass: autoPassword,
          schoolName: registerForm.name,
        });
        setIsSuccessModalOpen(true);
        setRegisterForm({
          name: '',
          slug: '',
          description: '',
          domain: '',
          contact_email: '',
          contact_phone: '',
          address: '',
          timezone: 'Africa/Freetown',
          max_users: 500,
          max_storage_gb: 10,
        });
        fetchData();
      }
    } catch (err: any) {
      showToast.error(err.response?.data?.error || 'Failed to register tenant');
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (tenant: PlatformTenant) => {
    try {
      const res = await platformService.activateTenant(tenant.id);
      if (res.success) {
        showToast.success(`Tenant "${tenant.name}" has been activated.`);
        fetchData();
      }
    } catch (err: any) {
      showToast.error('Failed to activate tenant');
    }
  };

  const openEmailSender = async (tenant: PlatformTenant) => {
    setSelectedTenant(tenant);
    setEmailSender(null);
    setEmailSenderFrom('');
    setIsEmailSenderOpen(true);
    try {
      const res = await platformService.getTenantEmailSender(tenant.id);
      if (res.success && res.data) {
        setEmailSender(res.data);
        setEmailSenderFrom(res.data.fromAddress || res.data.contactEmail || '');
      }
    } catch {
      showToast.error('Could not load email sender settings');
    }
  };

  const applyEmailSender = async (mode: 'platform' | 'own') => {
    if (!selectedTenant) return;
    setSaving(true);
    try {
      const res = await platformService.setTenantEmailSender(selectedTenant.id, mode, mode === 'own' ? emailSenderFrom.trim() || undefined : undefined);
      if (res.success) {
        showToast.success(res.message || 'Email sender updated');
        setEmailSender((prev) => prev ? { ...prev, mode, verified: mode === 'own', fromAddress: mode === 'own' ? (emailSenderFrom.trim() || prev.contactEmail) : null } : prev);
      } else {
        showToast.error((res as any).error || 'Failed to update email sender');
      }
    } catch (err: any) {
      showToast.error(err?.response?.data?.error || 'Failed to update email sender');
    } finally {
      setSaving(false);
    }
  };

  const handleSuspendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant || !suspensionReason) return;
    await doSuspend(false);
  };

  const doSuspend = async (override: boolean) => {
    if (!selectedTenant || !suspensionReason) return;
    setSaving(true);
    try {
      const res = await platformService.suspendTenant(selectedTenant.id, suspensionReason, suspensionCategory, override);
      if (res.success) {
        showToast.success(`Tenant "${selectedTenant.name}" has been suspended.`);
        setIsSuspendOpen(false);
        onCategoryChange('payment');
        setSelectedTenant(null);
        fetchData();
      }
    } catch (err: any) {
      // Category/state mismatch (e.g. "payment" chosen but plan is active) — let
      // the admin confirm an override rather than sending a false notice.
      if (err?.response?.status === 409 && err?.response?.data?.code === 'SUSPENSION_CATEGORY_MISMATCH') {
        const msg = err.response.data.error || 'The selected category does not match this school’s current status.';
        if (window.confirm(`${msg}\n\nSuspend anyway with this category?`)) {
          await doSuspend(true);
          return;
        }
      } else {
        showToast.error(err?.response?.data?.error || 'Failed to suspend tenant');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!selectedTenant) return;

    setSaving(true);
    try {
      const res = await platformService.deleteTenant(selectedTenant.id);
      if (res.success) {
        showToast.success(`Tenant "${selectedTenant.name}" deleted successfully.`);
        setIsDeleteOpen(false);
        setSelectedTenant(null);
        fetchData();
      }
    } catch (err: any) {
      showToast.error('Failed to delete tenant');
    } finally {
      setSaving(false);
    }
  };

  const statusToVariant = (status: string): 'active' | 'suspended' | 'trial' | 'expired' => {
    return status as any;
  };

  return (
    <MainLayout>
      <PageShell
        title="Tenant Management"
        subtitle="Configure, audit, and onboarding tenants and SaaS partner schools."
        breadcrumbs={[{ label: 'Platform Dashboard', path: '/platform/dashboard' }, { label: 'Tenants' }]}
        onRefresh={fetchData}
        isRefreshing={loading}
        actions={
          <Button onClick={() => setIsRegisterOpen(true)} className="flex items-center gap-1.5 bg-[#00d4aa] text-[#1a1a2e] hover:bg-[#00e6b8] font-bold">
            <Plus size={16} />
            Register New School
          </Button>
        }
      >
        {/* KPI Panel */}
        {statistics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
            <KPICard
              title="Total Tenants"
              value={statistics.totalTenants}
              subtitle="Registered schools"
              icon={<div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500"><Building2 size={20} /></div>}
            />
            <KPICard
              title="Active Tiers"
              value={statistics.activeTenants}
              subtitle={`${statistics.trialTenants} active trials`}
              icon={<div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500"><Activity size={20} /></div>}
            />
            <KPICard
              title="Suspended"
              value={statistics.suspendedTenants}
              subtitle="Access suspended"
              icon={<div className="p-2.5 rounded-xl bg-red-500/10 text-red-500"><Pause size={20} /></div>}
            />
            <KPICard
              title="Platform Users"
              value={statistics.totalUsers}
              subtitle={`${statistics.totalStudents} total students`}
              icon={<div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500"><Users size={20} /></div>}
            />
          </div>
        )}

        {/* Search & Filter bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="w-full sm:max-w-md">
            <SearchBar
              placeholder="Search schools by name, slug or email..."
              defaultValue={search}
              onSearch={(val) => setSearch(val)}
              isLoading={loading}
              resultCount={tenants.length}
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto items-center">
            <SlidersHorizontal size={16} className="text-gray-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-44 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="trial">Trial</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>

        {/* Tenants List */}
        {loading ? (
          <div className="flex items-center justify-center py-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-blue-500" size={32} />
              <span className="text-sm text-gray-500">Loading schools list...</span>
            </div>
          </div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
            <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">No schools found</h3>
            <p className="text-sm text-gray-500 mt-1">Try refining your search filters or register a new tenant.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">School / Tenant</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Domain / Slug</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Limits (Users/Storage)</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Registered</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {tenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                            <Building2 size={18} />
                          </div>
                          <div>
                            <span className="font-bold text-gray-900 dark:text-gray-100 block text-sm">{tenant.name}</span>
                            <span className="text-xs text-gray-400 block">{tenant.contact_email || 'No email'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono text-gray-600 dark:text-gray-300 block">{tenant.slug}</span>
                        <span className="text-xs text-gray-400 block flex items-center gap-1">
                          <Globe size={11} /> {tenant.domain || 'Internal default'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={tenant.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700 dark:text-gray-300 block">
                          <Users size={12} className="inline mr-1" /> {tenant.max_users || 500} Users
                        </span>
                        <span className="text-xs text-gray-400 block">
                          <HardDrive size={12} className="inline mr-1" /> {tenant.max_storage_gb || 10} GB Storage
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {new Date(tenant.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 flex-nowrap">
                          <Button
                            size="sm"
                            className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-semibold"
                            onClick={() => navigate(`/platform/tenants/${tenant.id}`)}
                          >
                            Manage
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedTenant(tenant);
                              setIsDetailsOpen(true);
                            }}
                          >
                            Details
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-[#1d4ed8] border-blue-200 hover:bg-blue-50"
                            title="Email sender settings"
                            onClick={() => openEmailSender(tenant)}
                          >
                            <Mail size={12} className="mr-1" /> Email
                          </Button>
                          {tenant.status === 'suspended' ? (
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                              onClick={() => handleActivate(tenant)}
                            >
                              <Play size={12} className="mr-1" /> Activate
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 border-amber-200"
                              onClick={() => {
                                setSelectedTenant(tenant);
                                setIsSuspendOpen(true);
                              }}
                            >
                              <Pause size={12} className="mr-1" /> Suspend
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/20"
                            onClick={() => {
                              setSelectedTenant(tenant);
                              setIsDeleteOpen(true);
                            }}
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination footer (always visible) */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300">
              <span>
                Showing <strong>{total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}</strong>–<strong>{Math.min(page * PAGE_SIZE, total)}</strong> of <strong>{total}</strong> {total === 1 ? 'school' : 'schools'}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
                <span className="text-xs text-gray-500">Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span>
                <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / PAGE_SIZE)} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          </div>
        )}
      </PageShell>

      {/* MODAL 1: REGISTER NEW SCHOOL / TENANT WIZARD */}
      <Modal isOpen={isRegisterOpen} onClose={closeRegisterModal} title="Platform Onboarding Portal" size="xl">
        {/* Step progress indicators */}
        <div className="flex items-center justify-between mb-8 px-6">
          {[
            { step: 1, label: 'Identity', desc: 'School Branding & Slugs' },
            { step: 2, label: 'Contact', desc: 'Locale & Core Support' },
            { step: 3, label: 'Limits', desc: 'Resource Seat Limits' },
          ].map((s) => (
            <React.Fragment key={s.step}>
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold transition-all shadow-sm ${
                    registerStep === s.step
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/40'
                      : registerStep > s.step
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                  }`}
                >
                  {registerStep > s.step ? '✓' : s.step}
                </div>
                <div className="hidden sm:block">
                  <span className={`text-xs font-bold block ${registerStep === s.step ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>{s.label}</span>
                  <span className="text-[9px] text-gray-400 font-semibold block">{s.desc}</span>
                </div>
              </div>
              {s.step < 3 && (
                <div
                  className={`flex-1 h-0.5 mx-4 transition-colors ${
                    registerStep > s.step ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        <form onSubmit={handleRegisterSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* LEFT COLUMN: INTERACTIVE DEMO CARD */}
            <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden shadow-xl border border-indigo-900/30 min-h-[385px]">
              {/* Background glowing pattern */}
              <div className="absolute right-[-20%] top-[-20%] w-60 h-60 rounded-full bg-blue-500/10 blur-[80px]" />
              <div className="absolute left-[-20%] bottom-[-20%] w-60 h-60 rounded-full bg-indigo-500/10 blur-[80px]" />

              <div className="space-y-4 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 shadow-inner">
                  {registerStep === 1 && <Building2 size={20} className="text-blue-400" />}
                  {registerStep === 2 && <Mail size={20} className="text-emerald-400" />}
                  {registerStep === 3 && <HardDrive size={20} className="text-purple-400" />}
                </div>

                {registerStep === 1 && (
                  <>
                    <h4 className="text-lg font-extrabold tracking-tight">Define School Identity</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Establish the brand name, metadata, and browser URL configurations for your new tenant space.
                    </p>

                    {/* Live Browser URL Mockup */}
                    <div className="mt-6 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                      <div className="bg-slate-800/80 px-3 py-2 flex items-center gap-1.5 border-b border-slate-700/50">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                        <div className="ml-2 flex-1 bg-slate-950/80 px-2 py-0.5 rounded text-[9px] text-slate-400 truncate text-center font-mono">
                          wiskul.sl/{registerForm.slug || 'slug'}
                        </div>
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="text-[10px] font-bold text-slate-300 tracking-wide truncate">
                          {registerForm.name || 'Wiskul New Academy'}
                        </div>
                        <div className="h-1.5 w-2/3 bg-slate-800 rounded" />
                        <div className="h-1.5 w-1/2 bg-slate-850 rounded" />
                      </div>
                    </div>
                  </>
                )}

                {registerStep === 2 && (
                  <>
                    <h4 className="text-lg font-extrabold tracking-tight">Configure Locale & Time</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Set up communication contacts and target region timezones to handle scheduling offsets and school notifications.
                    </p>

                    <div className="mt-6 bg-slate-900/60 backdrop-blur border border-slate-800/80 rounded-xl p-4 space-y-3.5 shadow-2xl text-xs">
                      <div className="flex items-center gap-2 text-slate-300">
                        <Mail size={14} className="text-emerald-400 shrink-0" />
                        <span className="truncate">{registerForm.contact_email || 'Provide email address'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <Phone size={14} className="text-emerald-400 shrink-0" />
                        <span>{registerForm.contact_phone || 'Provide phone number'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <MapPin size={14} className="text-emerald-400 shrink-0" />
                        <span className="truncate">{registerForm.address || 'Provide address details'}</span>
                      </div>
                    </div>
                  </>
                )}

                {registerStep === 3 && (
                  <>
                    <h4 className="text-lg font-extrabold tracking-tight">Resource Management</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Configure user seating and storage quotas. Tiers can be scaled or updated through the Subscriptions page at any time.
                    </p>

                    {/* Progress bars preview */}
                    <div className="mt-6 bg-slate-900/60 backdrop-blur border border-slate-800/80 rounded-xl p-4 space-y-4 shadow-2xl">
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-300 font-bold mb-1">
                          <span>Max Users Allocation</span>
                          <span>{registerForm.max_users} seats</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-blue-500 h-full rounded-full" style={{ width: '40%' }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-300 font-bold mb-1">
                          <span>File Storage Allocation</span>
                          <span>{registerForm.max_storage_gb} GB</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-purple-500 h-full rounded-full" style={{ width: '60%' }} />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Bottom tag */}
              <div className="flex items-center gap-2 border-t border-white/10 pt-4 relative z-10">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">WiSkul Onboarding Engine</span>
              </div>
            </div>

            {/* RIGHT COLUMN: DETAILED STEP FORM */}
            <div className="lg:col-span-7 flex flex-col justify-between min-h-[385px]">
              <div className="space-y-4">
                {registerStep === 1 && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div>
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">School Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Freetown Science Academy"
                        value={registerForm.name}
                        onChange={handleNameChange}
                        className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Tenant URL Slug *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. freetown-science"
                        value={registerForm.slug}
                        onChange={(e) => setRegisterForm({ ...registerForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                        className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                      <span className="text-[10px] text-gray-400 mt-1 block">Used for routing dashboard portals and databases. Only lowercase letters, numbers, and dashes.</span>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Short Description</label>
                      <textarea
                        rows={3}
                        placeholder="Describe this school space..."
                        value={registerForm.description}
                        onChange={(e) => setRegisterForm({ ...registerForm, description: e.target.value })}
                        className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Custom Domain Name (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. academy.freetown.edu"
                        value={registerForm.domain}
                        onChange={(e) => setRegisterForm({ ...registerForm, domain: e.target.value })}
                        className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      />
                    </div>
                  </div>
                )}

                {registerStep === 2 && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div>
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Contact & Administrative Email *</label>
                      <input
                        type="email"
                        required
                        placeholder="admin@academy.freetown.edu"
                        value={registerForm.contact_email}
                        onChange={(e) => setRegisterForm({ ...registerForm, contact_email: e.target.value })}
                        className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Contact Phone Number</label>
                      <input
                        type="text"
                        placeholder="+232 77 123456"
                        value={registerForm.contact_phone}
                        onChange={(e) => setRegisterForm({ ...registerForm, contact_phone: e.target.value })}
                        className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Physical Address</label>
                      <input
                        type="text"
                        placeholder="e.g. Wilkinson Road, Freetown"
                        value={registerForm.address}
                        onChange={(e) => setRegisterForm({ ...registerForm, address: e.target.value })}
                        className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Timezone Location</label>
                      <select
                        value={registerForm.timezone}
                        onChange={(e) => setRegisterForm({ ...registerForm, timezone: e.target.value })}
                        className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-750 dark:text-gray-200 transition-all font-medium"
                      >
                        <option value="Africa/Freetown">Africa/Freetown (GMT+00:00)</option>
                        <option value="UTC">UTC (GMT+00:00)</option>
                        <option value="GMT">GMT (GMT+00:00)</option>
                        <option value="Africa/Lagos">Africa/Lagos (GMT+01:00)</option>
                        <option value="Africa/Accra">Africa/Accra (GMT+00:00)</option>
                        <option value="Africa/Nairobi">Africa/Nairobi (GMT+03:00)</option>
                        <option value="Africa/Johannesburg">Africa/Johannesburg (GMT+02:00)</option>
                        <option value="Europe/London">Europe/London (GMT+01:00)</option>
                        <option value="Europe/Paris">Europe/Paris (GMT+02:00)</option>
                        <option value="America/New_York">America/New_York (EST/EDT)</option>
                        <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                        <option value="Asia/Kolkata">Asia/Kolkata (GMT+05:30)</option>
                        <option value="Asia/Singapore">Asia/Singapore (GMT+08:00)</option>
                      </select>
                    </div>
                  </div>
                )}

                {registerStep === 3 && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div>
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Max Users Seat Limit</label>
                      <input
                        type="number"
                        value={registerForm.max_users}
                        onChange={(e) => setRegisterForm({ ...registerForm, max_users: Number(e.target.value) })}
                        className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Max File Storage Limit (GB)</label>
                      <input
                        type="number"
                        value={registerForm.max_storage_gb}
                        onChange={(e) => setRegisterForm({ ...registerForm, max_storage_gb: Number(e.target.value) })}
                        className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium font-mono"
                      />
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-xl p-3.5 flex gap-2">
                      <Clock size={16} className="text-blue-500 shrink-0 mt-0.5" />
                      <div className="text-xs text-blue-800 dark:text-blue-300 font-medium">
                        Onboarding is the final step. Saving this will write the records to the DB and generate login details.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation buttons */}
              <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-700 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl px-4 py-2 text-xs font-bold"
                  onClick={() => {
                    setIsRegisterOpen(false);
                    setRegisterStep(1);
                  }}
                >
                  Cancel
                </Button>
                {registerStep > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl px-4 py-2 text-xs font-bold"
                    onClick={() => setRegisterStep((prev) => prev - 1)}
                  >
                    Back
                  </Button>
                )}
                {registerStep < 3 ? (
                  <Button
                    type="button"
                    onClick={handleNextStep}
                    className="bg-blue-600 text-white hover:bg-blue-700 rounded-xl px-4 py-2 text-xs font-bold"
                  >
                    Next Step
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={saving}
                    className="bg-blue-600 text-white hover:bg-blue-700 rounded-xl px-5 py-2 text-xs font-bold"
                  >
                    {saving && <Loader2 className="animate-spin mr-1.5" size={14} />}
                    Complete Onboarding
                  </Button>
                )}
              </div>
            </div>

          </div>
        </form>
      </Modal>

      {/* MODAL: EMAIL SENDER */}
      <Modal isOpen={isEmailSenderOpen && !!selectedTenant} onClose={() => setIsEmailSenderOpen(false)} title="Transactional Email Sender" size="md">
        {selectedTenant && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Mail size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">{selectedTenant.name}</h3>
                <span className="text-xs text-gray-400">{emailSender?.contactEmail || selectedTenant.contact_email || 'No school email set'}</span>
              </div>
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              <strong>Setup step:</strong> only switch to “School’s own email” <em>after</em> you have verified the
              school’s sender/domain in Brevo. Until then, keep it on the platform sender (delivers reliably).
            </div>

            {!emailSender ? (
              <div className="py-8 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={22} /></div>
            ) : (
              <>
                <div className="text-sm">
                  Current mode:{' '}
                  <span className={`font-bold ${emailSender.mode === 'own' ? 'text-emerald-600' : 'text-blue-600'}`}>
                    {emailSender.mode === 'own' ? "School's own email" : 'Platform sender (default)'}
                  </span>
                </div>

                {/* Platform option */}
                <label className={`block rounded-xl border p-4 cursor-pointer transition-all ${emailSender.mode === 'platform' ? 'border-blue-400 ring-2 ring-blue-500/20 bg-blue-50/40' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-start gap-3">
                    <input type="radio" name="senderMode" checked={emailSender.mode === 'platform'} onChange={() => setEmailSender({ ...emailSender, mode: 'platform' })} className="mt-1" />
                    <div>
                      <p className="font-semibold text-sm text-gray-900">Platform sender (recommended default)</p>
                      <p className="text-xs text-gray-500 mt-0.5">Sends from the platform address showing the school’s name, with the school’s email as reply-to. Works immediately, no verification needed.</p>
                    </div>
                  </div>
                </label>

                {/* Own option */}
                <label className={`block rounded-xl border p-4 cursor-pointer transition-all ${emailSender.mode === 'own' ? 'border-emerald-400 ring-2 ring-emerald-500/20 bg-emerald-50/40' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-start gap-3">
                    <input type="radio" name="senderMode" checked={emailSender.mode === 'own'} onChange={() => setEmailSender({ ...emailSender, mode: 'own' })} className="mt-1" />
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-gray-900">School’s own verified email</p>
                      <p className="text-xs text-gray-500 mt-0.5 mb-2">Sends fully from the school’s address. Requires the domain to be verified in Brevo.</p>
                      <input
                        type="email"
                        value={emailSenderFrom}
                        onChange={(e) => setEmailSenderFrom(e.target.value)}
                        placeholder="noreply@school.edu.sl"
                        disabled={emailSender.mode !== 'own'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:bg-gray-50 disabled:text-gray-400"
                      />
                    </div>
                  </div>
                </label>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <Button variant="outline" onClick={() => setIsEmailSenderOpen(false)}>Cancel</Button>
                  <Button
                    disabled={saving || (emailSender.mode === 'own' && !emailSenderFrom.trim())}
                    onClick={() => applyEmailSender(emailSender.mode)}
                    className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* MODAL 2: TENANT DETAILS */}
      <Modal isOpen={isDetailsOpen && !!selectedTenant} onClose={closeDetailsModal} title="School/Tenant Details" size="md">
        {selectedTenant && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-gray-700">
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Building2 size={24} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg leading-tight">{selectedTenant.name}</h3>
                <span className="text-sm font-mono text-gray-400">{selectedTenant.slug}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Globe className="text-gray-400 shrink-0" size={16} />
                <div>
                  <span className="text-[10px] text-gray-400 block uppercase font-bold">Domain</span>
                  <span className="text-xs text-gray-700 dark:text-gray-300 font-medium truncate">{selectedTenant.domain || 'Default'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="text-gray-400 shrink-0" size={16} />
                <div>
                  <span className="text-[10px] text-gray-400 block uppercase font-bold">Contact Email</span>
                  <span className="text-xs text-gray-700 dark:text-gray-300 font-medium truncate">{selectedTenant.contact_email || 'None'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="text-gray-400 shrink-0" size={16} />
                <div>
                  <span className="text-[10px] text-gray-400 block uppercase font-bold">Contact Phone</span>
                  <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">{selectedTenant.contact_phone || 'None'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="text-gray-400 shrink-0" size={16} />
                <div>
                  <span className="text-[10px] text-gray-400 block uppercase font-bold">Address</span>
                  <span className="text-xs text-gray-700 dark:text-gray-300 font-medium truncate">{selectedTenant.address || 'None'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="text-gray-400 shrink-0" size={16} />
                <div>
                  <span className="text-[10px] text-gray-400 block uppercase font-bold">Registered On</span>
                  <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                    {new Date(selectedTenant.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="text-gray-400 shrink-0" size={16} />
                <div>
                  <span className="text-[10px] text-gray-400 block">STATUS</span>
                  <StatusBadge status={selectedTenant.status} />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-150 dark:border-gray-800 space-y-3">
              <h4 className="font-bold text-xs text-gray-500 uppercase tracking-wider">Tenant Subscription Limits & Usage</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-gray-400 block">MAX USER LIMIT</span>
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{selectedTenant.max_users || 500} Users</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 block">MAX STORAGE LIMIT</span>
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{selectedTenant.max_storage_gb || 10} GB</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
              <Button type="button" onClick={() => setIsDetailsOpen(false)}>
                Close Details
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 3: SUSPEND TENANT */}
      <Modal isOpen={isSuspendOpen && !!selectedTenant} onClose={closeSuspendModal} title="Suspend Tenant Access" size="sm">
        {selectedTenant && (
          <form onSubmit={handleSuspendSubmit} className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-4 rounded-xl flex gap-3 text-amber-700 dark:text-amber-300">
              <Lock size={20} className="shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold block mb-1">Temporary lock execution</span>
                Suspending <strong>{selectedTenant.name}</strong> will instantly block all students, teachers, parents, and administrative staff from logging into their portal.
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Suspension Category *</label>
              <select
                required
                value={suspensionCategory}
                onChange={(e) => onCategoryChange(e.target.value as SuspensionCategory)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-100"
              >
                {SUSPENSION_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">Tailors the resolution steps in the notification email.</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Suspension Reason *</label>
              <select
                value={reasonPreset}
                onChange={(e) => setReasonPreset(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-100"
              >
                {SUSPENSION_REASONS[suspensionCategory].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
                <option value={CUSTOM_REASON}>Custom reason…</option>
              </select>
              {reasonPreset === CUSTOM_REASON && (
                <textarea
                  required
                  rows={2}
                  autoFocus
                  placeholder="Type the specific reason"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-100"
                />
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsSuspendOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !suspensionReason} className="bg-amber-600 text-white hover:bg-amber-700">
                {saving && <Loader2 className="animate-spin mr-1.5" size={14} />}
                Suspend Access
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL 4: DELETE TENANT */}
      <ConfirmationDialog
        isOpen={isDeleteOpen && !!selectedTenant}
        onClose={closeDeleteModal}
        onConfirm={handleDeleteSubmit}
        title="Permanently Delete School?"
        message={`Are you absolutely sure you want to delete "${selectedTenant?.name || ''}"? This action is permanent and will cascade delete all users, classes, grades, accounting, records, and databases associated with this school. This cannot be undone.`}
        confirmText="Permanently Delete"
        cancelText="Keep Tenant"
      />

      {/* SUCCESS CREDENTIALS MODAL */}
      <Modal isOpen={isSuccessModalOpen && !!generatedCredentials} onClose={closeSuccessModal} title="School Onboarded Successfully" size="sm">
        {generatedCredentials && (
          <div className="space-y-4">
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 flex gap-3 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold block mb-1">Onboarding Complete!</span>
                School <strong>{generatedCredentials.schoolName}</strong> has been successfully provisioned. The principal account has been auto-generated.
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Principal Email (Login ID)</span>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold font-mono text-gray-800 dark:text-gray-100 select-all">{generatedCredentials.email}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-blue-600 font-bold text-xs"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedCredentials.email);
                      showToast.success('Copied email to clipboard!');
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Generated Temporary Password</span>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold font-mono text-gray-800 dark:text-gray-100 select-all">{generatedCredentials.pass}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-blue-600 font-bold text-xs"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedCredentials.pass);
                      showToast.success('Copied password to clipboard!');
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-3.5 flex gap-2">
              <Clock size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                Please copy these credentials and share them with the school principal. They will be prompted to change this password on their first login.
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                className="bg-blue-600 text-white hover:bg-blue-700 w-full font-bold"
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  setGeneratedCredentials(null);
                }}
              >
                Close & Return
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </MainLayout>
  );
};

export default PlatformTenantsPage;
