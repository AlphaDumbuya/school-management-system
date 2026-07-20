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
} from 'lucide-react';
import useAuthStore from '@store/authStore';
import schoolConfigService, { SchoolInfo, GradeScale, BillingInvoice, SubscriptionDetails } from '../services/schoolConfigService';

export const SettingsPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const isPrincipalOrSuper = user?.role === 'principal' || user?.role === 'super_admin';

  // Navigation
  const [activeTab, setActiveTab] = useState<string>('profile');

  // Loading States
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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
    id_student_prefix: 'STU',
    id_staff_prefix: 'TCH',
    id_separator: '-',
    id_padding: 4,
    id_include_year: true,
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

  // Trigger temporary Toast notifications
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

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
          setSchoolInfo(infoRes.data);
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
      logger.error('Failed to load settings data', error);
      showToast('Error loading configuration data', 'error');
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
        showToast('School information updated successfully!');
      } else {
        throw new Error(res.error || 'Failed to update school info');
      }
    } catch (err: any) {
      showToast(err.message || 'Error updating school info', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const res = await schoolConfigService.updateSettings(settings);
      if (res.success) {
        showToast('Settings saved successfully!');
      } else {
        throw new Error(res.error || 'Failed to save settings');
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGradingScale = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await schoolConfigService.saveGradingScale(newGradeScale);
      if (res.success) {
        showToast('Grading scale created!');
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
      showToast(err.message || 'Error creating grading scale', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGradingScale = async (id: string) => {
    if (!confirm('Are you sure you want to delete this grading scale?')) return;
    try {
      const res = await schoolConfigService.deleteGradingScale(id);
      if (res.success) {
        showToast('Grading scale deleted');
        fetchInitialData();
      } else {
        throw new Error(res.error || 'Failed to delete scale');
      }
    } catch (err: any) {
      showToast(err.message || 'Error deleting scale', 'error');
    }
  };

  const handleUpgradePlan = async (planType: 'freetong' | 'combra' | 'bintumani') => {
    setSaving(true);
    try {
      const res = await schoolConfigService.changePlan(planType, billingCycle);
      if (res.success) {
        showToast(`Successfully subscribed to ${planType.toUpperCase()}!`);
        fetchInitialData();
      } else {
        throw new Error(res.error || 'Upgrade failed');
      }
    } catch (err: any) {
      showToast(err.message || 'Error upgrading subscription plan', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Helper: generates standard ID preview dynamically
  const getIDPreview = () => {
    const prefix = settings.id_student_prefix || 'STU';
    const separator = settings.id_separator || '-';
    const yearPart = settings.id_include_year ? `2026${separator}` : '';
    const numberPart = String(42).padStart(settings.id_padding || 4, '0');
    return `${prefix}${separator}${yearPart}${numberPart}`;
  };

  // Tabs mapping
  const tabs = [
    { id: 'profile', label: 'My Profile', icon: <User size={18} />, adminOnly: false },
    { id: 'school', label: 'School Info', icon: <Building size={18} />, adminOnly: true },
    { id: 'academic', label: 'Academic Config', icon: <Calendar size={18} />, adminOnly: true },
    { id: 'id-format', label: 'ID Format', icon: <Building size={18} />, adminOnly: true },
    { id: 'grading', label: 'Grading Scale', icon: <GraduationCap size={18} />, adminOnly: true },
    { id: 'attendance', label: 'Attendance Rules', icon: <AlertCircle size={18} />, adminOnly: true },
    { id: 'financial', label: 'Financial Info', icon: <DollarSign size={18} />, adminOnly: true },
    { id: 'comms', label: 'Communications', icon: <Mail size={18} />, adminOnly: true },
    { id: 'billing', label: 'Plan & Billing', icon: <CreditCard size={18} />, adminOnly: true },
  ];

  return (
    <MainLayout>
      <PageShell
        title="Settings & Configuration"
        subtitle="Configure your personal preferences and school-wide administrative variables."
      >
        {/* ── Toast Feedback ── */}
        {toast && (
          <div className="fixed top-6 right-6 z-[100] animate-in fade-in slide-in-from-top-4">
            <div className={`rounded-xl px-5 py-3 shadow-lg flex items-center gap-3 border ${
              toast.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              {toast.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-500" /> : <AlertCircle size={18} className="text-rose-500" />}
              <span className="text-sm font-semibold">{toast.message}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* ── Left Sidebar Navigation ── */}
          <Card className="w-full lg:w-64 shrink-0 bg-white border border-gray-200 shadow-sm sticky top-6">
            <CardContent className="p-3">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  if (tab.adminOnly && !isPrincipalOrSuper) return null;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        active
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span className={active ? 'text-blue-600' : 'text-gray-400'}>{tab.icon}</span>
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
                {/* ── PROFILE TAB ── */}
                {activeTab === 'profile' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>My Profile</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">First Name</label>
                          <input
                            type="text"
                            value={user?.firstName ?? ''}
                            disabled
                            className="w-full px-3 py-2 border rounded-lg bg-gray-50 border-gray-200 text-gray-700 cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">Last Name</label>
                          <input
                            type="text"
                            value={user?.lastName ?? ''}
                            disabled
                            className="w-full px-3 py-2 border rounded-lg bg-gray-50 border-gray-200 text-gray-700 cursor-not-allowed"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs font-semibold text-gray-500 block mb-1">Email Address</label>
                          <input
                            type="email"
                            value={user?.email ?? ''}
                            disabled
                            className="w-full px-3 py-2 border rounded-lg bg-gray-50 border-gray-200 text-gray-700 cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">Role Type</label>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 capitalize mt-1">
                            {user?.role?.replace('_', ' ') ?? ''}
                          </span>
                        </div>
                      </div>

                      {/* Display Preferences */}
                      <hr className="my-6 border-gray-100" />
                      <h4 className="text-sm font-bold text-gray-800 mb-3">Display Settings</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">Language</label>
                          <select
                            value={settings.language}
                            onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value="YYYY-MM-DD">YYYY-MM-DD (2026-07-20)</option>
                            <option value="DD/MM/YYYY">DD/MM/YYYY (20/07/2026)</option>
                            <option value="MM/DD/YYYY">MM/DD/YYYY (07/20/2026)</option>
                          </select>
                        </div>
                      </div>

                      {isPrincipalOrSuper && (
                        <div className="flex justify-end mt-6">
                          <Button onClick={handleSaveSettings} disabled={saving}>
                            {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                            Save Preferences
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* ── SCHOOL INFO TAB ── */}
                {activeTab === 'school' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>School Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleSaveSchoolInfo} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="sm:col-span-2">
                            <label className="text-xs font-semibold text-gray-500 block mb-1">School Name</label>
                            <input
                              type="text"
                              value={schoolInfo.name ?? ''}
                              onChange={(e) => setSchoolInfo({ ...schoolInfo, name: e.target.value })}
                              required
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-500 block mb-1">Short Name / Code</label>
                            <input
                              type="text"
                              value={schoolInfo.short_name ?? ''}
                              onChange={(e) => setSchoolInfo({ ...schoolInfo, short_name: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-500 block mb-1">Accreditation Number</label>
                            <input
                              type="text"
                              value={schoolInfo.school_registration_number ?? ''}
                              onChange={(e) => setSchoolInfo({ ...schoolInfo, school_registration_number: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-500 block mb-1">Principal Name</label>
                            <input
                              type="text"
                              value={schoolInfo.principal_name ?? ''}
                              onChange={(e) => setSchoolInfo({ ...schoolInfo, principal_name: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-500 block mb-1">Principal Email</label>
                            <input
                              type="email"
                              value={schoolInfo.principal_email ?? ''}
                              onChange={(e) => setSchoolInfo({ ...schoolInfo, principal_email: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-xs font-semibold text-gray-500 block mb-1">School Logo URL</label>
                            <div className="flex gap-4 items-center">
                              <input
                                type="text"
                                placeholder="/storage/logos/default.png"
                                value={schoolInfo.logo_url ?? ''}
                                onChange={(e) => setSchoolInfo({ ...schoolInfo, logo_url: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                              />
                              {schoolInfo.logo_url && (
                                <img
                                  src={schoolInfo.logo_url}
                                  alt="Logo preview"
                                  className="w-10 h-10 object-contain rounded border"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              )}
                            </div>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-xs font-semibold text-gray-500 block mb-1">Physical Address</label>
                            <textarea
                              value={schoolInfo.address ?? ''}
                              onChange={(e) => setSchoolInfo({ ...schoolInfo, address: e.target.value })}
                              rows={3}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end pt-4">
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
                      <CardTitle>Academic Configuration</CardTitle>
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
                      <CardTitle>ID Number Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">Student Prefix</label>
                          <input
                            type="text"
                            placeholder="STU"
                            value={settings.id_student_prefix}
                            onChange={(e) => setSettings({ ...settings, id_student_prefix: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">Staff/Teacher Prefix</label>
                          <input
                            type="text"
                            placeholder="TCH"
                            value={settings.id_staff_prefix}
                            onChange={(e) => setSettings({ ...settings, id_staff_prefix: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">Separator</label>
                          <select
                            value={settings.id_separator}
                            onChange={(e) => setSettings({ ...settings, id_separator: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value="-">Hyphen (-)</option>
                            <option value="/">Slash (/)</option>
                            <option value="_">Underscore (_)</option>
                            <option value="">None (Empty)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">Counter Padding</label>
                          <select
                            value={settings.id_padding}
                            onChange={(e) => setSettings({ ...settings, id_padding: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value={3}>3 digits (e.g. 042)</option>
                            <option value={4}>4 digits (e.g. 0042)</option>
                            <option value={5}>5 digits (e.g. 00042)</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-3 py-2">
                          <input
                            type="checkbox"
                            id="id_include_year"
                            checked={settings.id_include_year}
                            onChange={(e) => setSettings({ ...settings, id_include_year: e.target.checked })}
                            className="rounded text-blue-600 focus:ring-blue-500 h-4.5 w-4.5 border-gray-300"
                          />
                          <label htmlFor="id_include_year" className="text-sm font-semibold text-gray-700">
                            Include current year in ID format
                          </label>
                        </div>
                      </div>

                      {/* Live Preview UI Card */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5 flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <Sparkles size={20} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Live Preview</p>
                            <p className="text-lg font-mono font-bold text-gray-800 mt-0.5">{getIDPreview()}</p>
                          </div>
                        </div>
                        <span className="text-xs text-blue-600 font-medium px-3 py-1 bg-white border border-blue-200 rounded-full">
                          Generated dynamically
                        </span>
                      </div>

                      <div className="flex justify-end mt-4">
                        <Button onClick={handleSaveSettings} disabled={saving}>
                          {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                          Save ID Format
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ── GRADING TAB ── */}
                {activeTab === 'grading' && (
                  <div className="space-y-6">
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
                        <CardTitle>Create Grading Scale</CardTitle>
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
                      <CardTitle>Attendance Thresholds & Rules</CardTitle>
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
                      <CardTitle>Financial Settings</CardTitle>
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
                      <CardTitle>Communication Sender Defaults</CardTitle>
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
                        <div className={`p-5 rounded-xl border flex flex-col justify-between ${
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
                        <div className={`p-5 rounded-xl border flex flex-col justify-between relative ${
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
                        <div className={`p-5 rounded-xl border flex flex-col justify-between ${
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
                              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase border-b border-gray-100">
                                <tr>
                                  <th className="px-6 py-3">Billing Date</th>
                                  <th className="px-6 py-3">Transaction ID</th>
                                  <th className="px-6 py-3">Amount</th>
                                  <th className="px-6 py-3">Status</th>
                                  <th className="px-6 py-3">Notes</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {billingHistory.map((inv) => (
                                  <tr key={inv.id} className="hover:bg-gray-50/50">
                                    <td className="px-6 py-4 font-medium text-gray-900">{new Date(inv.billing_date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-mono text-xs">{inv.transaction_id}</td>
                                    <td className="px-6 py-4 font-bold text-gray-900">${inv.amount}</td>
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

export default SettingsPage;
