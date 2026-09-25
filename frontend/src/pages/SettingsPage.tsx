import React, { useState, useEffect } from 'react';
import { MainLayout } from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import {
  Settings as SettingsIcon,
  Building,
  GraduationCap,
  Calendar,
  AlertCircle,
  DollarSign,
  Mail,
  User,
  CreditCard,
  CheckCircle2,
  Lock,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
  Eye,
  EyeOff,
  ShieldCheck,
  HardDrive,
  Image as ImageIcon,
  Droplet,
} from 'lucide-react';
import useAuthStore from '@store/authStore';
import schoolConfigService, { SchoolInfo, GradeScale, BillingInvoice, SubscriptionDetails } from '../services/schoolConfigService';
import { formatCurrency } from '@utils/formatting';
import authService from '../services/authService';
import { FileUploader } from '@components/admin/forms/FileUploader';
import { TwoFactorSettings } from '@components/settings/TwoFactorSettings';
import { StorageSettings } from '@components/settings/StorageSettings';
import { OfflineStorageSettings } from '@components/offline/OfflineStorageSettings';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BookletContent, PHOTO_FRAME_OPTIONS, type PhotoFrameStyle } from './academic/components/BookletContent';
import { ReportSettingsPanel } from './academic/components/ReportSettingsPanel';
import type { ReportCard as ReportCardType } from '../services/reportCardService';
import {
  LINE_PRESETS,
  FRAME_PRESETS,
  svgToDataUrl,
  getFramePreset,
  borderKind,
} from '@lib/reportCardBorders';
import { showToast } from '@utils/toast';

export const SettingsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const isSuperAdmin = user?.role === 'super_admin';
  const isTeacher = user?.role === 'teacher';
  // A tenant/school admin (principal) manages the school-config tabs. The super
  // admin is the PLATFORM operator and has no school to configure — they only
  // get Profile + Security (2FA). `isPrincipalOrSuper` gates school-config data
  // loading and school-scoped fields; the super admin must NOT trigger those.
  const isPrincipalOrSuper = user?.role === 'principal';

  // Profile Form States
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });

  // Sync profileForm state when user loads or updates
  useEffect(() => {
    if (user) {
      setProfileForm({
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        email: user.email ?? '',
      });
    }
  }, [user]);

  // Password Form States
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Password Visibility States
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form saving states
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Navigation — allow deep-linking to a tab via ?tab= (e.g. /settings?tab=profile).
  const [activeTab, setActiveTab] = useState<string>(searchParams.get('tab') || 'profile');

  // Keep the active tab in sync if the URL query changes (e.g. header links).
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t) setActiveTab(t);
  }, [searchParams]);

  // The super admin only has Profile + Security — if they somehow land on a
  // school-config tab (e.g. a stale deep link), snap them back to Profile.
  useEffect(() => {
    if (isSuperAdmin && activeTab !== 'profile' && activeTab !== 'security') {
      setActiveTab('profile');
    }
  }, [isSuperAdmin, activeTab]);

  // Loading States
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // States for Settings fields
  const [schoolInfo, setSchoolInfo] = useState<Partial<SchoolInfo>>({});
  const [settings, setSettings] = useState<Record<string, any>>({
    academic_year: '2026/2027',
    term_count: 3,
    term_1_start: '',
    term_1_end: '',
    term_2_start: '',
    term_2_end: '',
    term_3_start: '',
    term_3_end: '',
    // ID Format settings
    id_student_prefix: 'STU',
    id_staff_prefix: 'TCH',
    id_admission_prefix: 'ADM',
    id_separator: '-',
    id_padding: 5,
    id_year_format: 'short',   // 'full' | 'short' | 'none'
    id_include_year: true,     // legacy compat
    // Continue-from: last number already used (system continues from +1)
    id_student_start_from: '',
    id_staff_start_from: '',
    id_admission_start_from: '',
    min_attendance_warning: 75,
    min_attendance_critical: 60,
    late_cutoff_time: '08:30',
    currency: 'USD',
    payment_methods: ['cash'],
    late_fee_rate: 0,
    system_email: '',
    sms_sender_name: 'WiSkul',
    whatsapp_enabled: false,
    email_notifications_enabled: true,
    sms_notifications_enabled: true,
    language: 'en',
    date_format: 'YYYY-MM-DD',
    time_format: '12h',
    theme: 'light',
  });

  const [gradingScales, setGradingScales] = useState<GradeScale[]>([]);
  const [newGradeScale, setNewGradeScale] = useState<GradeScale>({
    name: '',
    description: '',
    scale_type: 'letter',
    min_value: 0,
    max_value: 100,
    is_default: true,
    is_active: true,
    grades: [
      { grade: 'A', min_score: 90, max_score: 100, grade_points: 4.0, description: 'Excellent' },
      { grade: 'B', min_score: 80, max_score: 89, grade_points: 3.0, description: 'Very Good' },
      { grade: 'C', min_score: 70, max_score: 79, grade_points: 2.0, description: 'Good' },
      { grade: 'D', min_score: 50, max_score: 69, grade_points: 1.0, description: 'Satisfactory' },
      { grade: 'F', min_score: 0, max_score: 49, grade_points: 0.0, description: 'Fail' },
    ],
  });

  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingInvoice[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [aiAnalysis, setAiAnalysis] = useState<{
    healthStatus: 'healthy' | 'warning' | 'critical';
    summary: string;
    insights: string[];
    recommendations: string[];
  } | null>(null);

  // Initial Data Fetch
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Basic Profile - Any logged in user
      if (activeTab === 'profile') {
        // Handled locally from authStore for now
      }

      // School Info & Global Settings - Only if authorized
      if (isPrincipalOrSuper) {
        const [infoRes, settingsRes, scalesRes, subRes, billingRes, aiRes] = await Promise.all([
          schoolConfigService.getSchoolInfo().catch(() => ({ success: false, data: {} })),
          schoolConfigService.getSettings().catch(() => ({ success: false, data: {} })),
          schoolConfigService.getGradingScales().catch(() => ({ success: false, data: [] })),
          schoolConfigService.getActiveSubscription().catch(() => ({ success: false, data: null })),
          schoolConfigService.getBillingHistory().catch(() => ({ success: false, data: [] })),
          schoolConfigService.getSubscriptionAIAnalysis().catch(() => ({ success: false, data: null })),
        ]);

        if (infoRes.success && infoRes.data) {
          setSchoolInfo({
            ...infoRes.data,
            timezone: infoRes.data.timezone || 'Africa/Freetown'
          });
        }
        if (settingsRes.success && settingsRes.data) {
          setSettings((prev) => ({ ...prev, ...settingsRes.data }));
        }
        if (scalesRes.success && scalesRes.data) {
          setGradingScales(scalesRes.data);
        }
        if (subRes.success && subRes.data) {
          setSubscription(subRes.data);
        }
        if (billingRes.success && billingRes.data) {
          setBillingHistory(billingRes.data);
        }
        if (aiRes.success && aiRes.data) {
          setAiAnalysis(aiRes.data);
        }
      }
    } catch (error) {
      console.error('Failed to load settings data', error);
      showToast.error('Error loading configuration data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSchoolInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await schoolConfigService.updateSchoolInfo(schoolInfo);
      if (res.success) {
        showToast.success('School information updated successfully!');
        if (user) {
          setUser({
            ...user,
            schoolLogoUrl: schoolInfo.logo_url ?? user.schoolLogoUrl,
            schoolName: schoolInfo.name ?? user.schoolName,
          });
        }
        // Refresh anything that shows school branding (report cards, ID cards,
        // headers, etc.) so the new name/logo take effect immediately without a
        // reload. The report card page caches this under ['school-info'].
        queryClient.invalidateQueries({ queryKey: ['school-info'] });
      } else {
        throw new Error(res.error || 'Failed to update school info');
      }
    } catch (err: any) {
      showToast.error(err.message || 'Error updating school info');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const res = await schoolConfigService.updateSettings(settings);
      if (res.success) {
        showToast.success('Settings saved successfully!');
      } else {
        throw new Error(res.error || 'Failed to save settings');
      }
    } catch (err: any) {
      showToast.error(err.message || 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    
    if (!profileForm.firstName.trim() || !profileForm.lastName.trim() || !profileForm.email.trim()) {
      showToast.error('Please fill in all personal details fields.');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await authService.updateProfile(user.id, {
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        email: profileForm.email,
      });

      if (res.success && res.data) {
        setUser(res.data);
        showToast.success('Profile updated successfully!');
      } else {
        throw new Error(res.error || 'Failed to update profile');
      }
    } catch (err: any) {
      showToast.error(err.message || 'Error updating profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      showToast.error('All password fields are required.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast.error('New password and confirm password do not match.');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      showToast.error('New password must be at least 8 characters long.');
      return;
    }
    if (passwordForm.currentPassword === passwordForm.newPassword) {
      showToast.error('New password must be different from current password.');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await authService.changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword
      );

      if (res.success) {
        showToast.success('Password changed successfully! Logging you out...');
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        setTimeout(async () => {
          await logout();
        }, 1500);
      } else {
        throw new Error(res.error || 'Failed to change password');
      }
    } catch (err: any) {
      showToast.error(err.message || 'Error changing password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSaveGradingScale = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await schoolConfigService.saveGradingScale(newGradeScale);
      if (res.success) {
        showToast.success('Grading scale created!');
        fetchInitialData();
        // Reset scale form
        setNewGradeScale({
          name: '',
          description: '',
          scale_type: 'letter',
          min_value: 0,
          max_value: 100,
          is_default: false,
          is_active: true,
          grades: [
            { grade: 'A', min_score: 90, max_score: 100, grade_points: 4.0, description: 'Excellent' },
            { grade: 'B', min_score: 80, max_score: 89, grade_points: 3.0, description: 'Very Good' },
            { grade: 'C', min_score: 70, max_score: 79, grade_points: 2.0, description: 'Good' },
            { grade: 'D', min_score: 50, max_score: 69, grade_points: 1.0, description: 'Satisfactory' },
            { grade: 'F', min_score: 0, max_score: 49, grade_points: 0.0, description: 'Fail' },
          ],
        });
      } else {
        throw new Error(res.error || 'Failed to save grading scale');
      }
    } catch (err: any) {
      showToast.error(err.message || 'Error creating grading scale');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGradingScale = async (id: string) => {
    if (!confirm('Are you sure you want to delete this grading scale?')) return;
    try {
      const res = await schoolConfigService.deleteGradingScale(id);
      if (res.success) {
        showToast.success('Grading scale deleted');
        fetchInitialData();
      } else {
        throw new Error(res.error || 'Failed to delete scale');
      }
    } catch (err: any) {
      showToast.error(err.message || 'Error deleting scale');
    }
  };

  const handleUpgradePlan = async (planType: 'freetong' | 'combra' | 'bintumani') => {
    setSaving(true);
    try {
      const res = await schoolConfigService.changePlan(planType, billingCycle);
      if (res.success) {
        showToast.success(`Successfully subscribed to ${planType.toUpperCase()}!`);
        fetchInitialData();
      } else {
        // Verification gate: guide the owner to verify instead of a raw error.
        if ((res as any).statusCode === 403 || /verification/i.test(res.error || '')) {
          showToast.error('Verify your school to change your billing plan.');
          window.location.assign('/verify-school');
          return;
        }
        throw new Error(res.error || 'Upgrade failed');
      }
    } catch (err: any) {
      showToast.error(err.message || 'Error upgrading subscription plan');
    } finally {
      setSaving(false);
    }
  };

  // Helper: generates ID preview dynamically for a given prefix type
  const buildIDPreview = (prefix: string, startFrom?: string | number) => {
    const sep = settings.id_separator === 'none' ? '' : (settings.id_separator ?? '-');
    const yearFmt = settings.id_year_format || (settings.id_include_year ? 'full' : 'none');
    const fullYear = new Date().getFullYear();
    const shortYear = String(fullYear).slice(-2);
    const yearStr = yearFmt === 'full' ? String(fullYear) : yearFmt === 'short' ? shortYear : '';
    const pad = settings.id_padding || 5;
    // Use startFrom+1 if set, otherwise use sample 42
    const sf = startFrom !== undefined && startFrom !== '' ? Number(startFrom) : undefined;
    const sampleNum = sf !== undefined && !isNaN(sf) ? sf + 1 : 42;
    const numStr = String(sampleNum).padStart(pad, '0');
    const parts = [prefix || 'STU'];
    if (yearStr) parts.push(yearStr);
    parts.push(numStr);
    return parts.join(sep);
  };
  const getIDPreview = () => buildIDPreview(settings.id_student_prefix || 'STU', settings.id_student_start_from);

  // Tabs mapping
  const tabs = [
    { id: 'profile', label: 'My Profile', icon: <User size={18} />, adminOnly: false },
    { id: 'security', label: 'Security', icon: <ShieldCheck size={18} />, adminOnly: false },
    { id: 'offline', label: 'Offline & Storage', icon: <HardDrive size={18} />, adminOnly: false, teacherOnly: true },
    { id: 'school', label: 'School Info', icon: <Building size={18} />, adminOnly: true },
    { id: 'academic', label: 'Academic Config', icon: <Calendar size={18} />, adminOnly: true },
    { id: 'id-format', label: 'ID Format', icon: <Building size={18} />, adminOnly: true },
    { id: 'grading', label: 'Grading & Results', icon: <GraduationCap size={18} />, adminOnly: true },
    { id: 'attendance', label: 'Attendance Rules', icon: <AlertCircle size={18} />, adminOnly: true },
    { id: 'financial', label: 'Financial Info', icon: <DollarSign size={18} />, adminOnly: true },
    { id: 'comms', label: 'Communications', icon: <Mail size={18} />, adminOnly: true },
    { id: 'storage', label: 'File Storage', icon: <HardDrive size={18} />, adminOnly: true },
    { id: 'billing', label: 'Plan & Billing', icon: <CreditCard size={18} />, adminOnly: true },
    { id: 'report-card', label: 'Report Card', icon: <GraduationCap size={18} />, adminOnly: true },
  ];

  return (
    <MainLayout>
      <PageShell
        title="Settings & Configuration"
        subtitle={isSuperAdmin
          ? 'Manage your platform account profile and security.'
          : 'Configure your personal preferences and school-wide administrative variables.'}
      >

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* ── Mobile Navigation Tabs ── */}
          <div className="w-full lg:hidden">
            <div className="overflow-x-auto pb-3">
              <div className="inline-flex gap-2 px-2">
                {tabs.map((tab) => {
                  if (tab.adminOnly && !isPrincipalOrSuper) return null;
                  if ((tab as any).teacherOnly && !isTeacher) return null;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`inline-flex items-center gap-2 min-w-[120px] px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                        active
                          ? 'bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] text-white shadow-md shadow-blue-500/30'
                          : 'bg-white text-gray-700 border border-gray-200 hover:bg-blue-50 hover:text-blue-700'
                      }`}
                    >
                      <span className={active ? 'text-white' : 'text-gray-500'}>{tab.icon}</span>
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Left Sidebar Navigation ── */}
          <Card className="hidden lg:block w-full lg:w-64 shrink-0 bg-white border border-gray-200 shadow-sm sticky top-6">
            <CardContent className="p-3">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  if (tab.adminOnly && !isPrincipalOrSuper) return null;
                  if ((tab as any).teacherOnly && !isTeacher) return null;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        active
                          ? 'bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] text-white shadow-md shadow-blue-500/30'
                          : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'
                      }`}
                    >
                      <span className={active ? 'text-white' : 'text-blue-500'}>{tab.icon}</span>
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>

          {/* ── Right Content Area ── */}
          <div className="flex-1 w-full space-y-6">
            {loading ? (
              <div className="min-h-[400px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            ) : (
              <>
                {/* ── SECURITY TAB ── */}
                {activeTab === 'security' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><ShieldCheck size={18} /></span>
                        Account Security
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <TwoFactorSettings />
                    </CardContent>
                  </Card>
                )}

                {/* ── OFFLINE & STORAGE TAB (teachers) ── */}
                {activeTab === 'offline' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><HardDrive size={18} /></span>
                        Offline & Storage
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <OfflineStorageSettings />
                    </CardContent>
                  </Card>
                )}

                {/* ── PROFILE TAB ── */}
                {activeTab === 'profile' && (
                  <div className="space-y-6">
                    {/* Personal Details Form */}
                    <Card>
                      <CardHeader>
                        <CardTitle>My Profile</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <form onSubmit={handleSaveProfile} className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">First Name</label>
                              <input
                                type="text"
                                value={profileForm.firstName}
                                onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 transition"
                                required
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">Last Name</label>
                              <input
                                type="text"
                                value={profileForm.lastName}
                                onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 transition"
                                required
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="text-xs font-semibold text-gray-500 block mb-1">Email Address</label>
                              <input
                                type="email"
                                value={profileForm.email}
                                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 transition"
                                required
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">Role Type</label>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 capitalize mt-1 select-none">
                                {user?.role?.replace('_', ' ') ?? ''}
                              </span>
                            </div>
                          </div>
                          <div className="flex justify-end pt-2">
                            <Button type="submit" disabled={savingProfile}>
                              {savingProfile ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                              Save Profile Details
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>

                    {/* Change Password Form */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2.5">
                          <span className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center"><Lock size={18} /></span>
                          Security & Password
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <form onSubmit={handleSavePassword} className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">Current Password</label>
                              <div className="relative">
                                <input
                                  type={showCurrentPassword ? "text" : "password"}
                                  value={passwordForm.currentPassword}
                                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                  className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 transition"
                                  placeholder="••••••••"
                                  required
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                                >
                                  {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">New Password</label>
                              <div className="relative">
                                <input
                                  type={showNewPassword ? "text" : "password"}
                                  value={passwordForm.newPassword}
                                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                  className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 transition"
                                  placeholder="Min 8 chars"
                                  required
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowNewPassword(!showNewPassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                                >
                                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">Confirm New Password</label>
                              <div className="relative">
                                <input
                                  type={showConfirmPassword ? "text" : "password"}
                                  value={passwordForm.confirmPassword}
                                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                  className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 transition"
                                  placeholder="••••••••"
                                  required
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                                >
                                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end pt-2">
                            <Button type="submit" disabled={savingPassword}>
                              {savingPassword ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                              Update Password
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>

                    {/* Display preferences (language & date format) */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2.5">
                          <span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><SettingsIcon size={18} /></span>
                          Display Settings (Global Configuration)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-semibold text-gray-500 block mb-1">Language</label>
                            <select
                              value={settings.language}
                              onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                              disabled={!isPrincipalOrSuper}
                              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 ${!isPrincipalOrSuper ? 'cursor-not-allowed bg-gray-50 text-gray-400' : ''}`}
                            >
                              <option value="en">English (Default)</option>
                              <option value="krio">Krio</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-500 block mb-1">Date Format</label>
                            <select
                              value={settings.date_format}
                              onChange={(e) => setSettings({ ...settings, date_format: e.target.value })}
                              disabled={!isPrincipalOrSuper}
                              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 ${!isPrincipalOrSuper ? 'cursor-not-allowed bg-gray-50 text-gray-400' : ''}`}
                            >
                              <option value="YYYY-MM-DD">YYYY-MM-DD (2026-07-20)</option>
                              <option value="DD/MM/YYYY">DD/MM/YYYY (20/07/2026)</option>
                              <option value="MM/DD/YYYY">MM/DD/YYYY (07/20/2026)</option>
                            </select>
                          </div>
                        </div>

                        {isPrincipalOrSuper ? (
                          <div className="flex justify-end mt-4">
                            <Button onClick={handleSaveSettings} disabled={saving}>
                              {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                              Save Global Preferences
                            </Button>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 mt-2 italic">
                            Only school administrators can update these display settings.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* ── SCHOOL INFO TAB ── */}
                {activeTab === 'school' && (
                  <Card className="shadow-md border border-gray-100 bg-white">
                    <CardHeader className="pb-4 border-b border-gray-50">
                      <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Building className="text-blue-500" size={22} />
                        School Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <form onSubmit={handleSaveSchoolInfo} className="space-y-6">
                        {/* Section 1: School Basics */}
                        <div>
                          <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-1 border-b border-gray-100 uppercase tracking-wider text-xs">
                            General Details
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                              <label className="text-xs font-semibold text-gray-500 block mb-1">School Name</label>
                              <input
                                type="text"
                                value={schoolInfo.name ?? ''}
                                onChange={(e) => setSchoolInfo({ ...schoolInfo, name: e.target.value })}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 transition"
                                placeholder="e.g. Sierra Leone Grammar School"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">Short Name / Code</label>
                              <input
                                type="text"
                                value={schoolInfo.short_name ?? ''}
                                onChange={(e) => setSchoolInfo({ ...schoolInfo, short_name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 transition"
                                placeholder="e.g. SLGS"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">Founded Year</label>
                              <input
                                type="number"
                                value={schoolInfo.founded_year ?? ''}
                                onChange={(e) => setSchoolInfo({ ...schoolInfo, founded_year: e.target.value ? parseInt(e.target.value) : undefined })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 transition"
                                placeholder="e.g. 1845"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">School Motto</label>
                              <input
                                type="text"
                                value={(schoolInfo as any).motto ?? (schoolInfo as any).school_motto ?? ''}
                                onChange={(e) => setSchoolInfo({ ...schoolInfo, motto: e.target.value } as any)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 transition"
                                placeholder="e.g. Learning for Success"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">Registration/Accreditation Number</label>
                              <input
                                type="text"
                                value={schoolInfo.school_registration_number ?? ''}
                                onChange={(e) => setSchoolInfo({ ...schoolInfo, school_registration_number: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 transition"
                                placeholder="e.g. REG-48291"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">EMIS Code</label>
                              <input
                                type="text"
                                value={schoolInfo.emis_code ?? ''}
                                onChange={(e) => setSchoolInfo({ ...schoolInfo, emis_code: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 transition"
                                placeholder="MBSSE / EMIS school code — used for verification"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">Accreditation Status</label>
                              <select
                                value={schoolInfo.accreditation_status ?? ''}
                                onChange={(e) => setSchoolInfo({ ...schoolInfo, accreditation_status: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 transition"
                              >
                                <option value="">Select status...</option>
                                <option value="accredited">Accredited</option>
                                <option value="pending">Pending</option>
                                <option value="provisionary">Provisionary</option>
                                <option value="expired">Expired</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Section 2: Contact Details */}
                        <div>
                          <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-1 border-b border-gray-100 uppercase tracking-wider text-xs">
                            Contact Information
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">School General Email</label>
                              <input
                                type="email"
                                value={schoolInfo.email ?? ''}
                                onChange={(e) => setSchoolInfo({ ...schoolInfo, email: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 transition"
                                placeholder="e.g. info@school.com"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">School Phone Number</label>
                              <input
                                type="text"
                                value={schoolInfo.phone ?? ''}
                                onChange={(e) => setSchoolInfo({ ...schoolInfo, phone: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 transition"
                                placeholder="e.g. +232 76 123456"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">School Website URL</label>
                              <input
                                type="url"
                                value={schoolInfo.website ?? ''}
                                onChange={(e) => setSchoolInfo({ ...schoolInfo, website: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 transition"
                                placeholder="e.g. https://school.edu"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Section 3: Administration */}
                        <div>
                          <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-1 border-b border-gray-100 uppercase tracking-wider text-xs">
                            Administration
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">Principal Name</label>
                              <input
                                type="text"
                                value={schoolInfo.principal_name ?? ''}
                                onChange={(e) => setSchoolInfo({ ...schoolInfo, principal_name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 transition"
                                placeholder="e.g. Dr. John Kamara"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">Principal Email Address</label>
                              <input
                                type="email"
                                value={schoolInfo.principal_email ?? ''}
                                onChange={(e) => setSchoolInfo({ ...schoolInfo, principal_email: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 transition"
                                placeholder="e.g. principal@school.com"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Section 4: Logo & Appearance */}
                        <div>
                          <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-1 border-b border-gray-100 uppercase tracking-wider text-xs">
                            Logo & Appearance
                          </h3>
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">School Logo</label>
                              <FileUploader
                                value={schoolInfo.logo_url}
                                onChange={(url) => setSchoolInfo({ ...schoolInfo, logo_url: url })}
                                accept="image/*"
                                placeholder="Click or drag to upload school logo"
                                previewType="image"
                                enableCamera={true}
                                maxSizeMB={2}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Section 5: Address & Location */}
                        <div>
                          <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-1 border-b border-gray-100 uppercase tracking-wider text-xs">
                            Address & Location
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-3">
                              <label className="text-xs font-semibold text-gray-500 block mb-1">Physical Address</label>
                              <textarea
                                value={schoolInfo.address ?? ''}
                                onChange={(e) => setSchoolInfo({ ...schoolInfo, address: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 transition"
                                placeholder="e.g. 123 Regent Road, Hill Station"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">City</label>
                              <input
                                type="text"
                                value={schoolInfo.city ?? ''}
                                onChange={(e) => setSchoolInfo({ ...schoolInfo, city: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 transition"
                                placeholder="e.g. Freetown"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">State / Province</label>
                              <select
                                value={schoolInfo.state ?? ''}
                                onChange={(e) => setSchoolInfo({ ...schoolInfo, state: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 transition"
                              >
                                <option value="">Select Province...</option>
                                <option value="Western Area">Western Area</option>
                                <option value="Northern Province">Northern Province</option>
                                <option value="North West Province">North West Province</option>
                                <option value="Southern Province">Southern Province</option>
                                <option value="Eastern Province">Eastern Province</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">Postal Code</label>
                              <select
                                value={schoolInfo.postal_code ?? ''}
                                onChange={(e) => setSchoolInfo({ ...schoolInfo, postal_code: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 transition"
                              >
                                <option value="">Select Postal Code...</option>
                                <option value="00232">00232 (General / Calling Fallback)</option>
                                <option value="99100">99100 (Freetown / Western Area Urban)</option>
                                <option value="99101">99101 (Waterloo / Western Area Rural)</option>
                                <option value="99102">99102 (Bo District / Southern Province)</option>
                                <option value="99103">99103 (Kenema District / Eastern Province)</option>
                                <option value="99104">99104 (Makeni / Bombali District / Northern Province)</option>
                                <option value="99105">99105 (Port Loko District / North West Province)</option>
                                <option value="99106">99106 (Koidu / Kono District / Eastern Province)</option>
                                <option value="99107">99107 (Kailahun District / Eastern Province)</option>
                                <option value="99108">99108 (Bonthe District / Southern Province)</option>
                                <option value="99109">99109 (Moyamba District / Southern Province)</option>
                                <option value="99110">99110 (Pujehun District / Southern Province)</option>
                                <option value="99111">99111 (Kabala / Koinadugu District / Northern Province)</option>
                                <option value="99112">99112 (Magburaka / Tonkolili District / Northern Province)</option>
                                <option value="99113">99113 (Kambia District / North West Province)</option>
                                <option value="99114">99114 (Kamakwie / Karene District / North West Province)</option>
                                <option value="99115">99115 (Mongo / Falaba District / Northern Province)</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">Country</label>
                              <input
                                type="text"
                                value={schoolInfo.country ?? ''}
                                onChange={(e) => setSchoolInfo({ ...schoolInfo, country: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 transition"
                                placeholder="e.g. Sierra Leone"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">Timezone</label>
                              <select
                                value={schoolInfo.timezone || 'Africa/Freetown'}
                                onChange={(e) => setSchoolInfo({ ...schoolInfo, timezone: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 transition"
                              >
                                <option value="Africa/Freetown">Africa/Freetown (GMT+00:00)</option>
                                <option value="UTC">UTC (GMT+00:00)</option>
                                <option value="GMT">GMT (GMT+00:00)</option>
                                <option value="Africa/Lagos">Africa/Lagos (GMT+01:00)</option>
                                <option value="Africa/Accra">Africa/Accra (GMT+00:00)</option>
                                <option value="Africa/Nairobi">Africa/Nairobi (GMT+03:00)</option>
                                <option value="Africa/Johannesburg">Africa/Johannesburg (GMT+02:00)</option>
                                <option value="Europe/London">Europe/London (GMT+01:00 / BST)</option>
                                <option value="Europe/Paris">Europe/Paris (GMT+02:00)</option>
                                <option value="America/New_York">America/New_York (EST/EDT)</option>
                                <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                                <option value="Asia/Kolkata">Asia/Kolkata (GMT+05:30)</option>
                                <option value="Asia/Singapore">Asia/Singapore (GMT+08:00)</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-100">
                          <Button type="submit" disabled={saving}>
                            {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                            Save School Details
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {/* ── ACADEMIC TAB ── */}
                {activeTab === 'academic' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center"><Calendar size={18} /></span>
                        Academic Configuration
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">Current Academic Year</label>
                          <input
                            type="text"
                            placeholder="2026/2027"
                            value={settings.academic_year}
                            onChange={(e) => setSettings({ ...settings, academic_year: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">Terms Count</label>
                          <select
                            value={settings.term_count}
                            onChange={(e) => setSettings({ ...settings, term_count: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value={2}>2 Terms (Semesters)</option>
                            <option value={3}>3 Terms (Standard)</option>
                          </select>
                        </div>
                      </div>

                      <hr className="my-6 border-gray-100" />
                      <h4 className="text-sm font-bold text-gray-800 mb-3">Term Date Boundaries</h4>
                      
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-semibold text-gray-500 block mb-1">Term 1 Start</label>
                            <input
                              type="date"
                              value={settings.term_1_start || ''}
                              onChange={(e) => setSettings({ ...settings, term_1_start: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-500 block mb-1">Term 1 End</label>
                            <input
                              type="date"
                              value={settings.term_1_end || ''}
                              onChange={(e) => setSettings({ ...settings, term_1_end: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-semibold text-gray-500 block mb-1">Term 2 Start</label>
                            <input
                              type="date"
                              value={settings.term_2_start || ''}
                              onChange={(e) => setSettings({ ...settings, term_2_start: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-500 block mb-1">Term 2 End</label>
                            <input
                              type="date"
                              value={settings.term_2_end || ''}
                              onChange={(e) => setSettings({ ...settings, term_2_end: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>
                        </div>

                        {settings.term_count === 3 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">Term 3 Start</label>
                              <input
                                type="date"
                                value={settings.term_3_start || ''}
                                onChange={(e) => setSettings({ ...settings, term_3_start: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">Term 3 End</label>
                              <input
                                type="date"
                                value={settings.term_3_end || ''}
                                onChange={(e) => setSettings({ ...settings, term_3_end: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end mt-6">
                        <Button onClick={handleSaveSettings} disabled={saving}>
                          {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                          Save Academic Config
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ── ID FORMAT TAB ── */}
                {activeTab === 'id-format' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center"><CreditCard size={18} /></span>
                        ID Number Configuration
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">

                      {/* Info Banner */}
                      <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                        <div className="w-5 h-5 text-amber-500 shrink-0 mt-0.5"><Sparkles size={18} /></div>
                        <div>
                          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Custom ID Format</p>
                          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Set unique ID prefixes for your school. New IDs will use this format. Existing IDs are not changed.</p>
                        </div>
                      </div>

                      {/* Prefixes */}
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Prefixes</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">Student Prefix <span className="text-gray-400 font-normal">(default: STU)</span></label>
                            <input
                              type="text"
                              placeholder="STU"
                              maxLength={8}
                              value={settings.id_student_prefix ?? 'STU'}
                              onChange={(e) => setSettings({ ...settings, id_student_prefix: e.target.value.toUpperCase() })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono uppercase"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Preview: <span className="font-mono font-semibold text-gray-700 dark:text-gray-200">{buildIDPreview(settings.id_student_prefix || 'STU')}</span></p>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">Staff / Teacher Prefix <span className="text-gray-400 font-normal">(default: TCH)</span></label>
                            <input
                              type="text"
                              placeholder="TCH"
                              maxLength={8}
                              value={settings.id_staff_prefix ?? 'TCH'}
                              onChange={(e) => setSettings({ ...settings, id_staff_prefix: e.target.value.toUpperCase() })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono uppercase"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Preview: <span className="font-mono font-semibold text-gray-700 dark:text-gray-200">{buildIDPreview(settings.id_staff_prefix || 'TCH')}</span></p>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">Admission Prefix <span className="text-gray-400 font-normal">(default: ADM)</span></label>
                            <input
                              type="text"
                              placeholder="ADM"
                              maxLength={8}
                              value={settings.id_admission_prefix ?? 'ADM'}
                              onChange={(e) => setSettings({ ...settings, id_admission_prefix: e.target.value.toUpperCase() })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono uppercase"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Preview: <span className="font-mono font-semibold text-gray-700 dark:text-gray-200">{buildIDPreview(settings.id_admission_prefix || 'ADM')}</span></p>
                          </div>
                        </div>
                      </div>

                      {/* Format Options */}
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Format Options</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                          {/* Separator */}
                          <div>
                            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">Separator</label>
                            <select
                              value={settings.id_separator ?? '-'}
                              onChange={(e) => setSettings({ ...settings, id_separator: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                              <option value="-">Hyphen  ( - )</option>
                              <option value="/">Slash  ( / )</option>
                              <option value="_">Underscore  ( _ )</option>
                              <option value=".">Dot  ( . )</option>
                              <option value="none">None (no separator)</option>
                            </select>
                          </div>

                          {/* Year Format */}
                          <div>
                            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">Year in ID</label>
                            <select
                              value={settings.id_year_format ?? 'short'}
                              onChange={(e) => setSettings({ ...settings, id_year_format: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                              <option value="full">Full year (e.g. 2026)</option>
                              <option value="short">Short year (e.g. 26)</option>
                              <option value="none">No year</option>
                            </select>
                          </div>

                          {/* Counter Padding */}
                          <div>
                            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">Counter Digits</label>
                            <select
                              value={settings.id_padding ?? 5}
                              onChange={(e) => setSettings({ ...settings, id_padding: Number(e.target.value) })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                              <option value={3}>3 digits  (e.g. 042)</option>
                              <option value={4}>4 digits  (e.g. 0042)</option>
                              <option value={5}>5 digits  (e.g. 00042)</option>
                              <option value={6}>6 digits  (e.g. 000042)</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Live Preview Cards */}
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Live Preview</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {[
                            { label: 'Student ID', prefix: settings.id_student_prefix || 'STU', startFrom: settings.id_student_start_from, color: 'from-blue-50 to-indigo-50 border-blue-100 dark:from-blue-900/20 dark:to-indigo-900/20 dark:border-blue-800', dot: 'bg-blue-500' },
                            { label: 'Teacher ID', prefix: settings.id_staff_prefix || 'TCH', startFrom: settings.id_staff_start_from, color: 'from-purple-50 to-violet-50 border-purple-100 dark:from-purple-900/20 dark:to-violet-900/20 dark:border-purple-800', dot: 'bg-purple-500' },
                            { label: 'Admission No.', prefix: settings.id_admission_prefix || 'ADM', startFrom: settings.id_admission_start_from, color: 'from-emerald-50 to-teal-50 border-emerald-100 dark:from-emerald-900/20 dark:to-teal-900/20 dark:border-emerald-800', dot: 'bg-emerald-500' },
                          ].map((item) => (
                            <div key={item.label} className={`bg-gradient-to-br ${item.color} border rounded-xl p-4`}>
                              <div className="flex items-center gap-2 mb-2">
                                <div className={`w-2 h-2 rounded-full ${item.dot}`} />
                                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">{item.label}</p>
                              </div>
                              <p className="text-xl font-mono font-bold text-gray-800 dark:text-white">{buildIDPreview(item.prefix, item.startFrom)}</p>
                              <p className="text-[10px] text-gray-400 mt-1">
                                {item.startFrom && item.startFrom !== '' ? `Continues from ${item.startFrom}` : 'Next assigned ID (sample)'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ── Continue-From Section ── */}
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Continue From an Existing Numbering System</h4>
                          <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full">Optional</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                          If your school already has ID numbers (e.g. the last student was 20345), enter that last-used number here.
                          The system will continue from the <strong>next number</strong> (20346, 20347…) with no gaps or duplicates.
                          Leave blank to let the system auto-count from the database.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {[
                            { key: 'id_student_start_from', label: 'Last Student Number', placeholder: 'e.g. 20345', prefix: settings.id_student_prefix || 'STU' },
                            { key: 'id_staff_start_from', label: 'Last Teacher Number', placeholder: 'e.g. 150', prefix: settings.id_staff_prefix || 'TCH' },
                            { key: 'id_admission_start_from', label: 'Last Admission Number', placeholder: 'e.g. 5000', prefix: settings.id_admission_prefix || 'ADM' },
                          ].map((item) => {
                            const val = settings[item.key];
                            const nextNum = val !== '' && !isNaN(Number(val)) ? Number(val) + 1 : null;
                            const pad = settings.id_padding || 5;
                            const sep = settings.id_separator === 'none' ? '' : (settings.id_separator ?? '-');
                            const yearFmt = settings.id_year_format || 'short';
                            const yr = yearFmt === 'full' ? String(new Date().getFullYear()) : yearFmt === 'short' ? String(new Date().getFullYear()).slice(-2) : '';
                            const nextParts = [item.prefix];
                            if (yr) nextParts.push(yr);
                            if (nextNum !== null) nextParts.push(String(nextNum).padStart(pad, '0'));
                            return (
                              <div key={item.key}>
                                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">{item.label}</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder={item.placeholder}
                                  value={settings[item.key] ?? ''}
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/[^0-9]/g, '');
                                    setSettings({ ...settings, [item.key]: raw });
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                                />
                                {nextNum !== null ? (
                                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                                    ✓ Next ID: <span className="font-mono font-bold">{nextParts.join(sep)}</span>
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-gray-400 mt-1">Leave blank = auto-count</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex justify-end mt-2">
                        <Button onClick={handleSaveSettings} disabled={saving}>
                          {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                          Save ID Format Settings
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ── GRADING TAB ── */}
                {activeTab === 'grading' && (
                  <div className="space-y-6">
                    {/* Grade controls + result release (moved here from the Results page,
                        since all configuration belongs in Settings). Principal-only;
                        the panel and its backend routes both enforce this. */}
                    <ReportSettingsPanel academicYear={`${new Date().getFullYear()}/${new Date().getFullYear() + 1}`} />

                    {/* List active scales */}
                    <Card>
                      <CardHeader className="flex justify-between items-center flex-row">
                        <CardTitle>Active Grading Scales</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        {gradingScales.length === 0 ? (
                          <p className="text-sm text-gray-500 p-6 text-center">No grading scales configured. Standard scales will apply.</p>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {gradingScales.map((s) => (
                              <div key={s.scale_id} className="p-4 flex items-center justify-between gap-4">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-gray-800 text-sm">{s.name}</h4>
                                    {s.is_default && (
                                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                                        Default
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 mt-0.5">Scale: {s.min_value} - {s.max_value} ({s.scale_type})</p>
                                </div>
                                <Button
                                  variant="ghost"
                                  onClick={() => s.scale_id && handleDeleteGradingScale(s.scale_id)}
                                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 p-2 h-auto"
                                >
                                  <Trash2 size={16} />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Create New Scale */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2.5">
                          <span className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center"><GraduationCap size={18} /></span>
                          Create Grading Scale
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <form onSubmit={handleSaveGradingScale} className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">Scale Name</label>
                              <input
                                type="text"
                                placeholder="WASSCE standard, Cambridge A-F, etc."
                                value={newGradeScale.name}
                                onChange={(e) => setNewGradeScale({ ...newGradeScale, name: e.target.value })}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">Scale Type</label>
                              <select
                                value={newGradeScale.scale_type}
                                onChange={(e) => setNewGradeScale({ ...newGradeScale, scale_type: e.target.value as any })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                              >
                                <option value="letter">Letter Grades (A-F)</option>
                                <option value="percentage">Percentages (0-100)</option>
                                <option value="numeric">Numeric Points (1-9)</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={saving}>
                              {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                              Create Grading Scale
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* ── ATTENDANCE TAB ── */}
                {activeTab === 'attendance' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><AlertCircle size={18} /></span>
                        Attendance Thresholds & Rules
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">Warning Threshold (%)</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={settings.min_attendance_warning}
                            onChange={(e) => setSettings({ ...settings, min_attendance_warning: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">Critical Threshold (%)</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={settings.min_attendance_critical}
                            onChange={(e) => setSettings({ ...settings, min_attendance_critical: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">Late Cutoff Time</label>
                          <input
                            type="time"
                            value={settings.late_cutoff_time}
                            onChange={(e) => setSettings({ ...settings, late_cutoff_time: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end mt-4">
                        <Button onClick={handleSaveSettings} disabled={saving}>
                          {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                          Save Attendance Rules
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ── FINANCIAL TAB ── */}
                {activeTab === 'financial' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center"><DollarSign size={18} /></span>
                        Financial Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">System Currency</label>
                          <select
                            value={settings.currency}
                            onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value="SLE">SLE - Leones (Sierra Leone)</option>
                            <option value="NLe">NLe - New Leones (Sierra Leone)</option>
                            <option value="USD">USD - US Dollar ($)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">Late Payment Charge (%)</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={settings.late_fee_rate}
                            onChange={(e) => setSettings({ ...settings, late_fee_rate: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end mt-4">
                        <Button onClick={handleSaveSettings} disabled={saving}>
                          {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                          Save Financial Configuration
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ── COMMUNICATIONS TAB ── */}
                {activeTab === 'comms' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Mail size={18} /></span>
                        Communication Sender Defaults
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <label className="text-xs font-semibold text-gray-500 block mb-1">Sender Email</label>
                          <input
                            type="email"
                            placeholder="notifications@school.com"
                            value={settings.system_email}
                            onChange={(e) => setSettings({ ...settings, system_email: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">SMS Sender Name</label>
                          <input
                            type="text"
                            maxLength={11}
                            placeholder="WiSkul"
                            value={settings.sms_sender_name}
                            onChange={(e) => setSettings({ ...settings, sms_sender_name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                      </div>

                      <hr className="my-6 border-gray-100" />
                      <h4 className="text-sm font-bold text-gray-800 mb-3">Notification Channels</h4>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="email_notifications_enabled"
                            checked={settings.email_notifications_enabled}
                            onChange={(e) => setSettings({ ...settings, email_notifications_enabled: e.target.checked })}
                            className="rounded text-blue-600 focus:ring-blue-500 h-4.5 w-4.5 border-gray-300"
                          />
                          <label htmlFor="email_notifications_enabled" className="text-sm font-semibold text-gray-700">Enable outbound Email notifications (Brevo SMTP)</label>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="sms_notifications_enabled"
                            checked={settings.sms_notifications_enabled}
                            onChange={(e) => setSettings({ ...settings, sms_notifications_enabled: e.target.checked })}
                            className="rounded text-blue-600 focus:ring-blue-500 h-4.5 w-4.5 border-gray-300"
                          />
                          <label htmlFor="sms_notifications_enabled" className="text-sm font-semibold text-gray-700">Enable outbound SMS alerts (Twilio)</label>
                        </div>
                      </div>

                      <div className="flex justify-end mt-4">
                        <Button onClick={handleSaveSettings} disabled={saving}>
                          {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                          Save Communication Config
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ── FILE STORAGE TAB ── */}
                {activeTab === 'storage' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><HardDrive size={18} /></span>
                        File Storage (Uploads)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <StorageSettings />
                    </CardContent>
                  </Card>
                )}

                {/* ── REPORT CARD CUSTOMIZATION TAB ──
                    Includes: border styles, watermark, student photo, and display options */}
                {activeTab === 'report-card' && (
                  <ReportCardBorderSettings schoolInfo={schoolInfo} />
                )}

                {/* ── PLAN & BILLING TAB ── */}
                {activeTab === 'billing' && (
                  <div className="space-y-6">
                    {/* Current active plan */}
                    <Card className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white relative overflow-hidden border-none shadow-md">
                      <div className="absolute right-[-5%] top-[-10%] w-[200px] h-[200px] rounded-full bg-blue-500/10 blur-xl" />
                      <CardContent className="p-6 relative z-10 flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center">
                        <div>
                          <span className="text-[10px] tracking-[0.2em] font-bold uppercase text-blue-300">Active Subscription</span>
                          <h3 className="text-2xl font-black mt-1 capitalize">Plan: {subscription?.subscription?.plan_type ?? 'Trial (Freetong)'}</h3>
                          <p className="text-sm text-blue-200/80 mt-1">Status: <span className="font-bold text-emerald-400 capitalize">{subscription?.subscription?.status ?? 'Active'}</span></p>
                        </div>
                        
                        <div className="flex gap-4">
                          <div className="bg-white/10 px-4 py-2.5 rounded-lg border border-white/10 text-center">
                            <p className="text-[10px] text-blue-200 uppercase tracking-wider font-semibold">Active Students</p>
                            <p className="text-lg font-bold mt-0.5">{subscription?.usage?.students?.current ?? 0} / {subscription?.usage?.students?.max ?? 200}</p>
                          </div>
                          <div className="bg-white/10 px-4 py-2.5 rounded-lg border border-white/10 text-center">
                            <p className="text-[10px] text-blue-200 uppercase tracking-wider font-semibold">Active Staff</p>
                            <p className="text-lg font-bold mt-0.5">{subscription?.usage?.staff?.current ?? 0} / {subscription?.usage?.staff?.max ?? 15}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* AI Subscription Advisor Panel */}
                    {aiAnalysis && (
                      <Card className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100 shadow-sm relative overflow-hidden">
                        <div className="absolute right-0 top-0 text-[100px] text-violet-500/5 select-none font-black translate-x-10 translate-y-[-20px]">
                          AI
                        </div>
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            <div className="p-2.5 bg-violet-100 text-violet-600 rounded-xl animate-pulse">
                              <Sparkles size={22} />
                            </div>
                            <div className="space-y-3 flex-1">
                              <div>
                                <h4 className="font-extrabold text-violet-900 text-sm flex items-center gap-2">
                                  AI billing advisor
                                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                    aiAnalysis.healthStatus === 'critical' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                                    aiAnalysis.healthStatus === 'warning' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 
                                    'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  }`}>
                                    {aiAnalysis.healthStatus}
                                  </span>
                                </h4>
                                <p className="text-xs text-violet-800/80 mt-1">{aiAnalysis.summary}</p>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                <div>
                                  <p className="text-[10px] text-violet-700 font-bold uppercase tracking-wider">Key Insights</p>
                                  <ul className="list-disc list-inside text-xs text-gray-700 space-y-1.5 mt-1.5">
                                    {aiAnalysis.insights.map((insight, idx) => (
                                      <li key={idx}>{insight}</li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <p className="text-[10px] text-violet-700 font-bold uppercase tracking-wider">AI Recommendations</p>
                                  <ul className="list-disc list-inside text-xs text-gray-700 space-y-1.5 mt-1.5 font-medium">
                                    {aiAnalysis.recommendations.map((rec, idx) => (
                                      <li key={idx} className="text-violet-900">{rec}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Choose Plan Panel */}
                    <Card>
                      <CardHeader className="flex flex-row justify-between items-center">
                        <div>
                          <CardTitle>Available Plans</CardTitle>
                          <p className="text-xs text-gray-500 mt-0.5">Select a higher tier to upgrade your school limits and enable features.</p>
                        </div>
                        
                        {/* Toggle billing cycle */}
                        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                          <button
                            onClick={() => setBillingCycle('monthly')}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                              billingCycle === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                            }`}
                          >
                            Monthly
                          </button>
                          <button
                            onClick={() => setBillingCycle('yearly')}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                              billingCycle === 'yearly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                            }`}
                          >
                            Yearly (Save 15%)
                          </button>
                        </div>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Plan Card: Freetong */}
                        <div className={`p-4 sm:p-5 rounded-xl border flex flex-col justify-between ${
                          subscription?.subscription?.plan_type === 'freetong' 
                            ? 'border-blue-500 bg-blue-50/10' 
                            : 'border-gray-200 bg-white'
                        }`}>
                          <div>
                            <div className="flex justify-between items-start">
                              <h4 className="font-extrabold text-gray-900 text-lg">Freetong</h4>
                              {subscription?.subscription?.plan_type === 'freetong' && (
                                <span className="bg-blue-100 text-blue-800 text-[9px] font-bold px-2 py-0.5 rounded-full">Current</span>
                              )}
                            </div>
                            <p className="text-gray-400 text-xs mt-1 italic">"Start free, grow strong"</p>
                            <p className="text-2xl font-black text-gray-900 mt-4">
                              {(() => {
                                const symbol = settings.currency === 'SLE' ? 'Le ' : settings.currency === 'NLe' ? 'NLe ' : '$';
                                return `${symbol}${billingCycle === 'monthly' ? '400' : '4000'}`;
                              })()}
                              <span className="text-xs text-gray-400 font-normal"> / {billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                            </p>
                            
                            <ul className="space-y-2 mt-6 text-xs text-gray-600">
                              <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500" /> Up to 200 Students</li>
                              <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500" /> Up to 15 Staff</li>
                              <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500" /> Student directory</li>
                              <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500" /> Attendance tracking</li>
                              <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500" /> Fee invoices & receipts</li>
                            </ul>
                          </div>

                          <Button
                            variant={subscription?.subscription?.plan_type === 'freetong' ? 'outline' : 'default'}
                            onClick={() => handleUpgradePlan('freetong')}
                            disabled={subscription?.subscription?.plan_type === 'freetong' || saving}
                            className="w-full mt-8"
                          >
                            {subscription?.subscription?.plan_type === 'freetong' ? 'Active Plan' : 'Downgrade'}
                          </Button>
                        </div>

                        {/* Plan Card: Combra */}
                        <div className={`p-4 sm:p-5 rounded-xl border flex flex-col justify-between relative ${
                          subscription?.subscription?.plan_type === 'combra' 
                            ? 'border-purple-500 bg-purple-50/10 shadow-sm' 
                            : 'border-gray-200 bg-white'
                        }`}>
                          <div className="absolute top-3 right-3 bg-purple-100 text-purple-800 text-[8px] font-bold px-2 py-0.5 rounded-full">
                            Most Popular
                          </div>
                          <div>
                            <div className="flex justify-between items-start">
                              <h4 className="font-extrabold text-gray-900 text-lg">Combra</h4>
                              {subscription?.subscription?.plan_type === 'combra' && (
                                <span className="bg-purple-100 text-purple-800 text-[9px] font-bold px-2 py-0.5 rounded-full">Current</span>
                              )}
                            </div>
                            <p className="text-gray-400 text-xs mt-1 italic">"A mother managing her children"</p>
                            <p className="text-2xl font-black text-gray-900 mt-4">
                              {(() => {
                                const symbol = settings.currency === 'SLE' ? 'Le ' : settings.currency === 'NLe' ? 'NLe ' : '$';
                                return `${symbol}${billingCycle === 'monthly' ? '900' : '9000'}`;
                              })()}
                              <span className="text-xs text-gray-400 font-normal"> / {billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                            </p>
                            
                            <ul className="space-y-2 mt-6 text-xs text-gray-600">
                              <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-purple-500" /> Up to 500 Students</li>
                              <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-purple-500" /> Up to 40 Staff</li>
                              <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-purple-500" /> Everything in Freetong</li>
                              <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-purple-500" /> **Exams, results & cards**</li>
                              <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-purple-500" /> **ID card PVC badge maker**</li>
                              <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-purple-500" /> **WhatsApp integration**</li>
                            </ul>
                          </div>

                          <Button
                            variant={subscription?.subscription?.plan_type === 'combra' ? 'outline' : 'default'}
                            onClick={() => handleUpgradePlan('combra')}
                            disabled={subscription?.subscription?.plan_type === 'combra' || saving}
                            className="w-full mt-8 bg-purple-600 hover:bg-purple-700 text-white"
                          >
                            {subscription?.subscription?.plan_type === 'combra' ? 'Active Plan' : 'Select Combra'}
                          </Button>
                        </div>

                        {/* Plan Card: Bintumani */}
                        <div className={`p-4 sm:p-5 rounded-xl border flex flex-col justify-between ${
                          subscription?.subscription?.plan_type === 'bintumani' 
                            ? 'border-amber-500 bg-amber-50/10' 
                            : 'border-gray-200 bg-white'
                        }`}>
                          <div>
                            <div className="flex justify-between items-start">
                              <h4 className="font-extrabold text-gray-900 text-lg">Bintumani</h4>
                              {subscription?.subscription?.plan_type === 'bintumani' && (
                                <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-2 py-0.5 rounded-full">Current</span>
                              )}
                            </div>
                            <p className="text-gray-400 text-xs mt-1 italic">"The highest peak"</p>
                            <p className="text-2xl font-black text-gray-900 mt-4">
                              {(() => {
                                const symbol = settings.currency === 'SLE' ? 'Le ' : settings.currency === 'NLe' ? 'NLe ' : '$';
                                return `${symbol}${billingCycle === 'monthly' ? '1750' : '17500'}`;
                              })()}
                              <span className="text-xs text-gray-400 font-normal"> / {billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                            </p>
                            
                            <ul className="space-y-2 mt-6 text-xs text-gray-600">
                              <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-amber-500" /> **Unlimited Students & Staff**</li>
                              <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-amber-500" /> Everything in Combra</li>
                              <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-amber-500" /> **AI analysis & insights**</li>
                              <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-amber-500" /> **Payroll & Salaries**</li>
                              <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-amber-500" /> **Scholarships manager**</li>
                              <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-amber-500" /> Custom branding option</li>
                            </ul>
                          </div>

                          <Button
                            variant={subscription?.subscription?.plan_type === 'bintumani' ? 'outline' : 'default'}
                            onClick={() => handleUpgradePlan('bintumani')}
                            disabled={subscription?.subscription?.plan_type === 'bintumani' || saving}
                            className="w-full mt-8 bg-amber-500 hover:bg-amber-600 text-white"
                          >
                            {subscription?.subscription?.plan_type === 'bintumani' ? 'Active Plan' : 'Upgrade to Bintumani'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Billing history table */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Billing & Invoice History</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        {billingHistory.length === 0 ? (
                          <p className="text-sm text-gray-500 p-6 text-center">No billing history found.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-600">
                              <thead className="bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] text-xs font-bold text-white uppercase tracking-wider">
                                <tr>
                                  <th className="px-6 py-3.5">Billing Date</th>
                                  <th className="px-6 py-3.5">Transaction ID</th>
                                  <th className="px-6 py-3.5">Amount</th>
                                  <th className="px-6 py-3.5">Status</th>
                                  <th className="px-6 py-3.5">Notes</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {billingHistory.map((inv, rowIndex) => (
                                  <tr key={inv.id} className={`transition-colors hover:bg-sky-100 ${rowIndex % 2 === 1 ? 'bg-sky-50' : 'bg-white'}`}>
                                    <td className="px-6 py-4 font-medium text-gray-900">{new Date(inv.billing_date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-mono text-xs">{inv.transaction_id}</td>
                                    <td className="px-6 py-4 font-bold text-gray-900">{formatCurrency(Number(inv.amount) || 0, inv.currency || 'SLE')}</td>
                                    <td className="px-6 py-4">
                                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 uppercase">
                                        {inv.status}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-gray-400">{inv.notes || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </PageShell>
    </MainLayout>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Report Card Border Settings (admin-only)
// Lets principals pick a border style for the Sierra Leone booklet report card.
// Persisted to school_config_settings under key 'report_card_border_style'.
// ──────────────────────────────────────────────────────────────────────────────

const ReportCardBorderSettings: React.FC<{ schoolInfo?: Partial<SchoolInfo> }> = ({ schoolInfo }) => {
  // ── Border state ──
  const [selectedPreset, setSelectedPreset] = useState<string>('classic');
  const [customColor, setCustomColor] = useState('#1f2937');
  const [customWidth, setCustomWidth] = useState(2);
  const [customStyle, setCustomStyle] = useState<'solid' | 'double' | 'dashed' | 'dotted' | 'groove' | 'ridge' | 'inset' | 'outset' | 'none'>('solid');
  const [customPadding, setCustomPadding] = useState(8);
  const [customRadius, setCustomRadius] = useState(0);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  // ── Display options state (watermark + student photo) ──
  const [showWatermark, setShowWatermark] = useState(true);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.06);
  const [watermarkSize, setWatermarkSize] = useState(450);
  const [showStudentPhoto, setShowStudentPhoto] = useState(true);
  const [photoFrame, setPhotoFrame] = useState<PhotoFrameStyle>('gold');
  const [savingDisplay, setSavingDisplay] = useState(false);

  // ── Mock data for the live BookletContent preview ──
  const previewSchool = schoolInfo ?? {};
  const previewSchoolName = previewSchool.name || 'Demo School International';
  const previewSchoolAddress = [previewSchool.address, previewSchool.city].filter(Boolean).join(', ') || '123 Education Drive, Freetown';
  const previewSchoolLogo = previewSchool.logo_url || undefined;
  const previewShortName = previewSchool.short_name || 'DSI';
  const previewMotto = (previewSchool as any).motto || (previewSchool as any).school_motto || 'Learning for Success';

  const previewCard: ReportCardType = {
    student: {
      id: 'preview-student',
      admission_no: 'ADM-2026-001',
      name: 'Jane Mariama Sesay',
      class_name: 'JSS 2A',
      class_level: 'Junior Secondary School',
      form_teacher_name: 'Mr. A. Kamara',
      pupil_age: 13,
      class_average_age: 12.8,
      number_in_form: 35,
      photo_url: undefined, // no real photo in Settings preview
    },
    academic_year: '2026',
    subjects: [
      { subject_id: '1', subject_name: 'English Language', subject_code: 'ENG', terms: { first_term: { test1: 75, test2: 80, mean: 77.5, rank: 3 }, second_term: { test1: 82, test2: 78, mean: 80, rank: 2 }, third_term: { test1: 85, test2: 88, mean: 86.5, rank: 1 } }, yearly_mean: 81.3, yearly_rank: 2 },
      { subject_id: '2', subject_name: 'Mathematics', subject_code: 'MTH', terms: { first_term: { test1: 60, test2: 65, mean: 62.5, rank: 5 }, second_term: { test1: 70, test2: 72, mean: 71, rank: 4 }, third_term: { test1: 75, test2: 78, mean: 76.5, rank: 3 } }, yearly_mean: 70, yearly_rank: 4 },
      { subject_id: '3', subject_name: 'Integrated Science', subject_code: 'SCI', terms: { first_term: { test1: 80, test2: 85, mean: 82.5, rank: 2 }, second_term: { test1: 78, test2: 82, mean: 80, rank: 3 }, third_term: { test1: 88, test2: 90, mean: 89, rank: 1 } }, yearly_mean: 83.8, yearly_rank: 2 },
      { subject_id: '4', subject_name: 'Social Studies', subject_code: 'SST', terms: { first_term: { test1: 70, test2: 75, mean: 72.5, rank: 4 }, second_term: { test1: 72, test2: 78, mean: 75, rank: 3 }, third_term: { test1: 80, test2: 82, mean: 81, rank: 2 } }, yearly_mean: 76.2, yearly_rank: 3 },
    ],
    term_summaries: {
      first_term: { combined_score: 294, percentage: 73.5, position: 4, class_size: 35, on_time: 38, late: 2, absent: 0, conduct: 'B', teacher_comment: 'Jane is making good progress. Keep it up!' },
      second_term: { combined_score: 306, percentage: 76.5, position: 3, class_size: 35, on_time: 39, late: 1, absent: 0, conduct: 'A', teacher_comment: 'Steady improvement. Well done.' },
      third_term: null,
    },
    yearly_summary: { combined_score: 600, percentage: 75.0, position: 3, class_size: 35, promotion_recommendation: 'Promoted to SSS 1', outcome: 'promoted' },
    domain_ratings: { affective: {}, psychomotor: {} },
    affective_traits: [],
    psychomotor_skills: [],
    conduct_legend: { 'A': 'Excellent', 'B': 'Good', 'C': 'Satisfactory', 'D': 'Needs Improvement' },
    meta: { principal_comment: 'A diligent and respectful pupil. Continue to work hard.', promotion_status: 'Promoted', average_age: '12.8 yrs' },
  };

  // Build the current border style object for the preview
  const previewBorderStyle = {
    preset: selectedPreset,
    color: customColor,
    width: customWidth,
    style: customStyle,
    padding: customPadding,
    radius: customRadius,
  };

  // Load saved border settings on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const value = await schoolConfigService.getSetting('report_card_border_style');
        if (mounted && value) {
          const known = [...LINE_PRESETS, ...FRAME_PRESETS].some((p) => p.id === value.preset);
          if (value.preset && known) {
            setSelectedPreset(value.preset);
          }
          if (value.color) setCustomColor(value.color);
          if (typeof value.width === 'number') setCustomWidth(value.width);
          const validStyles = ['solid', 'double', 'dashed', 'dotted', 'groove', 'ridge', 'inset', 'outset', 'none'];
          if (value.style && validStyles.includes(value.style)) {
            setCustomStyle(value.style);
          }
          if (typeof value.padding === 'number') setCustomPadding(value.padding);
          if (typeof value.radius === 'number') setCustomRadius(value.radius);
        }
      } catch {
        // ignore — use defaults
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load saved display options on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const value = await schoolConfigService.getSetting('report_card_display_opts');
        if (mounted && value && typeof value === 'object') {
          if (typeof value.show_watermark === 'boolean') setShowWatermark(value.show_watermark);
          if (typeof value.watermark_opacity === 'number') setWatermarkOpacity(value.watermark_opacity);
          if (typeof value.watermark_size === 'number') setWatermarkSize(value.watermark_size);
          if (typeof value.show_student_photo === 'boolean') setShowStudentPhoto(value.show_student_photo);
          if (typeof value.photo_frame === 'string') setPhotoFrame(value.photo_frame as PhotoFrameStyle);
        }
      } catch {
        // ignore — use defaults
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleSaveBorder = async () => {
    setSaving(true);
    try {
      await schoolConfigService.updateSetting('report_card_border_style', {
        preset: selectedPreset,
        color: customColor,
        width: customWidth,
        style: customStyle,
        padding: customPadding,
        radius: customRadius,
      });
      showToast.success('Report card border style saved.');
      queryClient.invalidateQueries({ queryKey: ['report-card-border-style'] });
    } catch {
      showToast.error('Failed to save border style');
    } finally {
      setSaving(false);
    }
  };

  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    // Seed the advanced controls from the chosen preset so the colour picker
    // etc. reflect a sensible starting point.
    const frame = getFramePreset(presetId);
    if (frame) {
      setCustomColor(frame.color);
      setCustomPadding(frame.padding);
      setCustomWidth(frame.thickness);
      return;
    }
    const line = LINE_PRESETS.find((l) => l.id === presetId);
    if (line) {
      setCustomColor(line.color);
      setCustomWidth(line.width);
      setCustomPadding(line.padding);
      setCustomRadius(line.radius);
      if (line.style !== 'none') setCustomStyle(line.style);
    }
  };

  const handleResetBorder = async () => {
    setSelectedPreset('classic');
    setCustomColor('#1f2937');
    setCustomWidth(2);
    setCustomStyle('solid');
    setCustomPadding(8);
    setCustomRadius(0);
    try {
      await schoolConfigService.updateSetting('report_card_border_style', { preset: 'classic', color: '#1f2937', width: 2, style: 'solid', padding: 8, radius: 0 });
      queryClient.invalidateQueries({ queryKey: ['report-card-border-style'] });
      showToast.success('Reset to classic style.');
    } catch {
      showToast.error('Failed to reset border style');
    }
  };

  const handleSaveDisplay = async () => {
    setSavingDisplay(true);
    try {
      await schoolConfigService.updateSetting('report_card_display_opts', {
        show_watermark: showWatermark,
        watermark_opacity: watermarkOpacity,
        watermark_size: watermarkSize,
        show_student_photo: showStudentPhoto,
        photo_frame: photoFrame,
      });
      showToast.success('Display options saved.');
      queryClient.invalidateQueries({ queryKey: ['report-card-display-opts'] });
    } catch {
      showToast.error('Failed to save display options');
    } finally {
      setSavingDisplay(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 1 — BORDER STYLE
          ══════════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <CardTitle>Report Card Border</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-gray-600">
            The border decorates the <strong>front cover only</strong> of the report booklet.
            Pick a decorative frame or a simple line, then fine-tune the accent colour. Changes
            apply to every generated report card once saved.
          </p>

          {/* ── Border style select + live swatch ── */}
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="flex-1 w-full">
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">Border style</label>
              <select
                value={selectedPreset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <optgroup label="Decorative frames">
                  {FRAME_PRESETS.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Simple borders">
                  {LINE_PRESETS.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </optgroup>
              </select>
              <p className="text-xs text-gray-500 mt-1.5">
                {getFramePreset(selectedPreset)?.description
                  ?? LINE_PRESETS.find((l) => l.id === selectedPreset)?.description
                  ?? 'Choose a border style for the front cover.'}
              </p>
            </div>

            {/* Live swatch of the currently selected style */}
            <div className="flex-shrink-0">
              <span className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Preview</span>
              <div className="w-[110px] h-[150px] rounded-lg bg-white ring-1 ring-gray-200 overflow-hidden relative shadow-sm">
                {borderKind(selectedPreset) === 'frame'
                  ? <img src={svgToDataUrl(getFramePreset(selectedPreset)!.build(customColor, customWidth))} alt="" className="absolute inset-0 w-full h-full" />
                  : borderKind(selectedPreset) === 'none'
                    ? <div className="absolute inset-2 border border-dashed border-gray-300 rounded" />
                    : (() => {
                        const l = LINE_PRESETS.find((x) => x.id === selectedPreset)!;
                        return <div className="absolute inset-2" style={{ border: `${Math.max(2, customWidth)}px ${customStyle} ${customColor}`, borderRadius: customRadius }} />;
                      })()}
              </div>
            </div>
          </div>

          {/* ── Accent colour + advanced (context-aware) ── */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="text-sm font-semibold text-gray-700 sm:w-40">Accent colour</label>
              <div className="flex items-center gap-2 flex-1">
                <input type="color" value={customColor} onChange={(e) => setCustomColor(e.target.value)} className="h-10 w-14 rounded border border-gray-300 cursor-pointer" />
                <input type="text" value={customColor} onChange={(e) => setCustomColor(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm" placeholder="#1f2937" />
              </div>
            </div>

            {/* Line-only options — hidden for frames (which don't use width/style/radius) */}
            {borderKind(selectedPreset) === 'line' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Width (px)</label>
                  <input type="number" min={1} max={12} value={customWidth} onChange={(e) => setCustomWidth(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Style</label>
                  <select value={customStyle} onChange={(e) => setCustomStyle(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white">
                    <option value="solid">Solid</option>
                    <option value="double">Double</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                    <option value="groove">Groove</option>
                    <option value="ridge">Ridge</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Radius (px)</label>
                  <input type="number" min={0} max={40} value={customRadius} onChange={(e) => setCustomRadius(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Padding (px)</label>
                  <input type="number" min={0} max={60} value={customPadding} onChange={(e) => setCustomPadding(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
                </div>
              </div>
            )}
            {borderKind(selectedPreset) === 'frame' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Border thickness: <span className="text-gray-900">{customWidth}</span>
                  </label>
                  <input
                    type="range"
                    min={6}
                    max={160}
                    step={2}
                    value={customWidth}
                    onChange={(e) => setCustomWidth(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>Very thin</span><span>Very bold</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Content padding (px)</label>
                  <input type="number" min={16} max={90} value={customPadding} onChange={(e) => setCustomPadding(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
                  <p className="text-[10px] text-gray-400 mt-1">Space between the frame and the cover content.</p>
                </div>
              </div>
            )}
          </div>

          {/* Live preview — real BookletContent front cover with the chosen frame */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Front Cover Preview</h4>
            <p className="text-xs text-gray-500 mb-3">The border shows on the front cover only. Back cover and inner sheets stay clean.</p>
            <div className="bg-gray-100 p-3 sm:p-6 rounded-lg overflow-x-auto">
              <div className="mx-auto w-full" style={{ maxWidth: 600, transformOrigin: 'top center' }}>
                <BookletContent
                  card={previewCard}
                  school={{ ...previewSchool, motto: previewMotto }}
                  schoolName={previewSchoolName}
                  schoolAddress={previewSchoolAddress}
                  schoolLogo={previewSchoolLogo}
                  shortName={previewShortName}
                  showCover
                  showInner={false}
                  showGrading={false}
                  borderStyle={previewBorderStyle}
                  showWatermark={showWatermark}
                  watermarkOpacity={watermarkOpacity}
                  watermarkSize={watermarkSize}
                  showStudentPhoto={showStudentPhoto}
                  photoFrame={photoFrame}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-2 border-t">
            <Button onClick={handleSaveBorder} disabled={saving} className="gap-2">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {saving ? 'Saving…' : 'Save Border Style'}
            </Button>
            <Button variant="ghost" onClick={handleResetBorder}>
              Reset to Classic
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 2 — WATERMARK (inner sheet background)
          ══════════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <CardTitle>Watermark</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-gray-600">
            Display the school logo as a faint watermark behind the results grid and the back cover.
            This adds a professional, tamper-evident security overlay to the printed report card.
          </p>

          {/* Toggle */}
          <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-100">
            <div className="flex items-start gap-3 min-w-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">Show logo watermark</p>
                <p className="text-xs text-gray-500">Display the school logo faintly behind the results grid.</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={showWatermark}
              onClick={() => setShowWatermark(!showWatermark)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                showWatermark ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showWatermark ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {showWatermark && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Opacity */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Opacity: {(watermarkOpacity * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min={0.01}
                  max={0.3}
                  step={0.01}
                  value={watermarkOpacity}
                  onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-[10px] text-gray-400 mt-1">6% is the recommended subtle overlay.</p>
              </div>
              {/* Size */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Logo Size (px)</label>
                <input
                  type="number"
                  min={100}
                  max={800}
                  value={watermarkSize}
                  onChange={(e) => setWatermarkSize(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
                <p className="text-[10px] text-gray-400 mt-1">450px fills a standard A4 landscape page.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 3 — STUDENT PHOTO (front cover)
          ══════════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <CardTitle>Student Photo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-gray-600">
            Show or hide the student's passport photo on the front cover of the report card.
            The photo appears as the focal point in the centre of the cover sheet.
            If a student has no photo on file, a placeholder box is shown instead.
          </p>

          {/* Toggle */}
          <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-100">
            <div className="flex items-start gap-3 min-w-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">Show student photo on front cover</p>
                <p className="text-xs text-gray-500">Displays the student's uploaded photo in the centre of the cover.</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={showStudentPhoto}
              onClick={() => setShowStudentPhoto(!showStudentPhoto)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                showStudentPhoto ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showStudentPhoto ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Photo frame style (only relevant when the photo is shown) */}
          {showStudentPhoto && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
              <label className="text-sm font-semibold text-gray-700 sm:w-40">Photo frame</label>
              <select
                value={photoFrame}
                onChange={(e) => setPhotoFrame(e.target.value as PhotoFrameStyle)}
                className="w-full sm:max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PHOTO_FRAME_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400">Choose the frame around the photo, or remove it.</p>
            </div>
          )}

          {/* Note — preview is in the Border section above */}
          <div className="border-t pt-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <ImageIcon size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-900">Preview available above</p>
                <p className="text-xs text-blue-700 mt-1">
                  The complete front &amp; back page preview in the <strong>Border</strong> section above
                  updates in real-time with this photo toggle. {showStudentPhoto
                    ? 'The student photo is currently shown in the centre of the front cover.'
                    : 'The student photo is currently hidden from the front cover.'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════════
          SAVE DISPLAY OPTIONS
          ══════════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleSaveDisplay} disabled={savingDisplay} className="gap-2">
          {savingDisplay ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          {savingDisplay ? 'Saving…' : 'Save Display Options'}
        </Button>
      </div>
    </div>
  );
};

export default SettingsPage;
