import React, { useState, useEffect } from 'react';
import { MainLayout } from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { YearTransitionDialog } from '@components/academic/YearTransitionDialog';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { useAcademicYears } from '@hooks/useAcademicYears';
import {
  Settings as SettingsIcon,
  Building,
  GraduationCap,
  Calendar,
  AlertCircle,
  DollarSign,
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
  Smartphone,
  Copy,
  Check,
  Timer,
  Phone,
  XCircle,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import useAuthStore from '@store/authStore';
import schoolConfigService, { SchoolInfo, GradeScale, BillingInvoice, SubscriptionDetails } from '../services/schoolConfigService';
import { GRADING_PRESETS, scaleFromPreset } from '@lib/gradingPresets';
import { formatCurrency } from '@utils/formatting';
import authService from '../services/authService';
import { FileUploader } from '@components/admin/forms/FileUploader';
import { TwoFactorSettings } from '@components/settings/TwoFactorSettings';
import { StorageSettings } from '@components/settings/StorageSettings';
import { PaymentSettings } from '@components/settings/PaymentSettings';
import { OfflineStorageSettings } from '@components/offline/OfflineStorageSettings';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { isVerifiedUser } from '@services/verificationService';
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
import { apiClient } from '@lib/apiClient';
import { usePublicPlans, fmtLimit, fmtPrice, planAdds, PlanDef } from '@services/planService';
import { PlanAccessSummary } from '@components/billing/PlanAccessSummary';

/** Keep in sync with backend PasswordService.validatePasswordPolicy. */
const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'A lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'A number', test: (p) => /\d/.test(p) },
  { label: 'A symbol (e.g. ! @ # $)', test: (p) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p) },
];

export const SettingsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigateTo = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const isSuperAdmin = user?.role === 'super_admin';
  const isTeacher = user?.role === 'teacher';
  // The bursar: an accountant, or a teacher holding the Bursar duty. They work
  // under the school's payment policy, so they get a read-only view of it.
  const isBursar = user?.role === 'accountant' || (isTeacher && ((user as any)?.staffDuties ?? []).includes('accountant'));
  // The admissions office (or a teacher holding the Admissions duty) works under
  // the school's ID format and admissions rules: a read-only view of them.
  const isOffice = user?.role === 'admissions_officer' || (isTeacher && ((user as any)?.staffDuties ?? []).includes('admissions_officer'));
  const [officeLink, setOfficeLink] = useState<string>('');
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

  // In-app subscription USSD payment modal state (declared before the polling
  // effect below so it's initialized when the effect first runs).
  const [subPay, setSubPay] = useState<{
    sessionId: string;
    ussdCode: string | null;
    amount: number;
    expireTime: string | null;
    planType: 'freetong' | 'combra' | 'bintumani';
    status: 'ussd' | 'completed' | 'failed' | 'cancelled';
  } | null>(null);

  // While the in-app subscription USSD modal is open, poll the session status.
  // The webhook is authoritative, but polling reconciles server-side and updates
  // the UI promptly once the payer completes the mobile-money prompt.
  useEffect(() => {
    if (!subPay || subPay.status !== 'ussd') return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const res = await schoolConfigService.getSubscriptionCheckoutStatus(subPay.sessionId);
        const s = res.success ? res.data?.status : undefined;
        if (cancelled) return;
        if (s === 'completed') {
          setSubPay((p) => (p ? { ...p, status: 'completed' } : p));
          showToast.success(`Your plan is now ${subPay.planType.toUpperCase()}.`);
          fetchInitialData();
        } else if (s === 'failed' || s === 'expired') {
          setSubPay((p) => (p ? { ...p, status: 'failed' } : p));
        } else if (s === 'cancelled') {
          setSubPay((p) => (p ? { ...p, status: 'cancelled' } : p));
        }
      } catch { /* keep polling */ }
    }, 2500);
    return () => { cancelled = true; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subPay?.sessionId, subPay?.status]);

  // Loading States
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsLoadFailed, setSettingsLoadFailed] = useState(false);

  // "Start New Academic Year" rollover state.
  const [newYearOpen, setNewYearOpen] = useState(false);
  const [newYearName, setNewYearName] = useState('');
  const [newYearCloneClasses, setNewYearCloneClasses] = useState(true);
  const [startingNewYear, setStartingNewYear] = useState(false);

  // States for Settings fields
  const [schoolInfo, setSchoolInfo] = useState<Partial<SchoolInfo>>({});
  const [settings, setSettings] = useState<Record<string, any>>({
    academic_year: '', // filled from the school's active session below
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
    staff_signin_closes_at: '18:00',
    currency: 'SLE',
    // School-wide (general) payment policy. Each fee structure may override any
    // of these per class; when a structure leaves a field blank, this applies.
    fin_allow_installments: true,
    fin_min_percent_new: 0,
    fin_min_percent_continuing: 0,
    fin_min_percent_term: 0,
    fin_charges_compulsory_first_term: false,
    fin_late_fee_percent: 0,
    // Bursar Phase A: automatic late fees, discount approval, e-receipts.
    fin_late_fee_enabled: false,
    fin_late_fee_fixed: 0,
    fin_late_fee_grace_days: 0,
    fin_late_fee_cap: 0,
    fin_discount_approval_threshold: 0,
    fin_email_manual_receipts: true,
    language: 'en',
    date_format: 'YYYY-MM-DD',
    time_format: '12h',
    theme: 'light',
  });

  const [gradingScales, setGradingScales] = useState<GradeScale[]>([]);
  // New scales start from a standard (WASSCE / BECE / NPSE) or a custom one.
  const [gradePreset, setGradePreset] = useState<string>('wassce');
  const [newGradeScale, setNewGradeScale] = useState<GradeScale>(() => scaleFromPreset('wassce', true));
  const pickGradePreset = (id: string) => {
    setGradePreset(id);
    setNewGradeScale((cur) => scaleFromPreset(id, cur.is_default));
  };
  const updateBand = (i: number, patch: Partial<GradeScale['grades'][number]>) =>
    setNewGradeScale((cur) => ({ ...cur, grades: cur.grades.map((g, j) => (j === i ? { ...g, ...patch } : g)) }));

  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingInvoice[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const { data: planCatalog } = usePublicPlans();
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

      // The admissions office reads (never saves) the ID format + admissions link.
      if (isOffice && !isPrincipalOrSuper) {
        const [res, link]: any[] = await Promise.all([
          schoolConfigService.getSettings().catch(() => ({ success: false, data: {} })),
          apiClient.get('/api/v1/admissions/share-link').catch(() => null),
        ]);
        if (res.success && res.data) { setSettings((prev) => ({ ...prev, ...res.data })); setSettingsLoadFailed(false); }
        else setSettingsLoadFailed(true);
        const path = link?.data?.path;
        if (path) setOfficeLink(new URL(path, window.location.protocol.startsWith('http') ? window.location.origin : (link?.data?.public_base_url || window.location.origin)).toString());
      }

      // The bursar reads (never saves) the payment policy.
      if (isBursar && !isPrincipalOrSuper) {
        const res = await schoolConfigService.getSettings().catch(() => ({ success: false, data: {} }));
        if (res.success && res.data) {
          setSettings((prev) => ({ ...prev, ...res.data }));
          setSettingsLoadFailed(false);
        } else {
          setSettingsLoadFailed(true);
        }
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
          setSettingsLoadFailed(false);
        } else {
          // Never let a failed load + Save overwrite real settings with defaults.
          setSettingsLoadFailed(true);
          showToast.error("Couldn't load your school settings. Saving is disabled until they load — please refresh.");
        }
        if (!infoRes.success) {
          showToast.error("Couldn't load School Info. Please refresh before editing it.");
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

  // ── Validation helpers ──────────────────────────────────────────────────
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const URL_RE = /^https?:\/\/.+/i;
  const isPct = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 100;
  };

  /** Validate the School Info form. Returns an error message or null. */
  const validateSchoolInfo = (): string | null => {
    if (!schoolInfo.name || !schoolInfo.name.trim()) return 'School name is required.';
    if (schoolInfo.email && !EMAIL_RE.test(schoolInfo.email.trim())) return 'Please enter a valid school email address.';
    if (schoolInfo.principal_email && !EMAIL_RE.test(schoolInfo.principal_email.trim())) return 'Please enter a valid principal email address.';
    if (schoolInfo.website && !URL_RE.test(schoolInfo.website.trim())) return 'Website must start with http:// or https://';
    if (schoolInfo.founded_year !== undefined && schoolInfo.founded_year !== null && String(schoolInfo.founded_year).trim() !== '') {
      const y = Number(schoolInfo.founded_year);
      const now = new Date().getFullYear();
      if (!Number.isInteger(y) || y < 1800 || y > now) return `Founded year must be a year between 1800 and ${now}.`;
    }
    return null;
  };

  /** Validate the shared settings form, scoped to the active tab. */
  const validateSettingsForTab = (): string | null => {
    if (activeTab === 'academic') {
      const count = Number(settings.term_count) || 3;
      // Validate each active term's date ordering when both dates are provided.
      for (let i = 1; i <= count; i++) {
        const start = settings[`term_${i}_start`];
        const end = settings[`term_${i}_end`];
        if ((start && !end) || (!start && end)) {
          return `Term ${i}: please provide both a start and an end date, or leave both blank.`;
        }
        if (start && end && new Date(start) >= new Date(end)) {
          return `Term ${i}: the end date must be after the start date.`;
        }
      }
      return null;
    }
    if (activeTab === 'id-format') {
      const req: Array<[string, string]> = [
        ['id_student_prefix', 'Student prefix'],
        ['id_staff_prefix', 'Staff/Teacher prefix'],
        ['id_admission_prefix', 'Admission prefix'],
      ];
      for (const [key, label] of req) {
        if (!settings[key] || !String(settings[key]).trim()) return `${label} is required.`;
      }
      const pad = Number(settings.id_padding);
      if (!Number.isInteger(pad) || pad < 1 || pad > 10) return 'ID number padding must be between 1 and 10.';
      return null;
    }
    if (activeTab === 'attendance') {
      if (!isPct(settings.min_attendance_warning)) return 'Warning threshold must be between 0 and 100.';
      if (!isPct(settings.min_attendance_critical)) return 'Critical threshold must be between 0 and 100.';
      if (Number(settings.min_attendance_critical) > Number(settings.min_attendance_warning)) {
        return 'Critical threshold cannot be higher than the warning threshold.';
      }
      return null;
    }
    if (activeTab === 'financial') {
      const checks: Array<[any, string]> = [
        [settings.fin_min_percent_new, 'Minimum payment for new students'],
        [settings.fin_min_percent_continuing, 'Minimum payment for continuing students'],
        [settings.fin_min_percent_term, 'Per-term clearance minimum'],
        [settings.fin_late_fee_percent, 'Late-fee surcharge'],
      ];
      for (const [val, label] of checks) {
        if (!isPct(val)) return `${label} must be between 0 and 100.`;
      }
      const nonNeg: Array<[any, string]> = [
        [settings.fin_late_fee_fixed, 'Fixed late fee'], [settings.fin_late_fee_cap, 'Late fee cap'],
        [settings.fin_late_fee_grace_days, 'Grace days'], [settings.fin_discount_approval_threshold, 'Discount approval limit'],
      ];
      for (const [val, label] of nonNeg) {
        if (val !== '' && val != null && (!Number.isFinite(Number(val)) || Number(val) < 0)) return `${label} can't be negative.`;
      }
      if (!Number.isInteger(Number(settings.fin_late_fee_grace_days || 0))) return 'Grace days must be a whole number.';
      return null;
    }
    return null;
  };

  const handleSaveSchoolInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateSchoolInfo();
    if (err) { showToast.error(err); return; }
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

  // Suggest next year (e.g. current "2026/2027" → "2027/2028").
  const suggestNextYear = (): string => {
    const cur = String(activeAcademicYear || settings.academic_year || '').trim();
    const m = /^(\d{4})\/(\d{4})$/.exec(cur);
    if (m) { const a = Number(m[1]) + 1; return `${a}/${a + 1}`; }
    const y = new Date().getFullYear();
    return `${y}/${y + 1}`;
  };

  // For a year that was started before rollover carried everything forward:
  // pull last year's classes, setup and students into the current year.
  // The school's active academic year (real session), for year-keyed panels.
  const { activeYear: activeAcademicYear, isLoading: yearsLoading } = useAcademicYears();
  // No saved academic_year setting → show the real active session, not a guess.
  useEffect(() => {
    if (!yearsLoading && activeAcademicYear && !settings.academic_year) {
      setSettings((s) => (s.academic_year ? s : { ...s, academic_year: activeAcademicYear }));
    }
  }, [yearsLoading, activeAcademicYear, settings.academic_year]);
  const [carryingForward, setCarryingForward] = useState(false);
  const [carryDialogOpen, setCarryDialogOpen] = useState(false);
  const handleCarryForward = async () => {
    setCarryingForward(true);
    try {
      const res: any = await schoolConfigService.carryForwardIntoCurrentYear();
      if (res?.success === false) throw new Error(res?.error || 'Carry forward failed');
      const d = res?.data || {};
      if (!d.fromYear) {
        showToast.info('There is no earlier year to bring forward.');
      } else {
        showToast.success(
          `${d.fromYear} → ${d.toYear}: ${d.studentsMoved ?? 0} student(s) moved, ${d.classesCloned ?? 0} class(es) added, ` +
          `${d.assignmentsCopied ?? 0} teacher assignment(s) and ${d.timetableCopied ?? 0} timetable slot(s) copied. Set up this year's fees in Fee Structures.`,
        );
      }
      queryClient.invalidateQueries();
    } catch (err: any) {
      showToast.error(err?.response?.data?.message || err?.message || 'Carry forward failed');
    } finally {
      setCarryingForward(false);
    }
  };

  const openNewYearDialog = () => {
    setNewYearName(suggestNextYear());
    setNewYearCloneClasses(true);
    setNewYearOpen(true);
  };

  const handleStartNewYear = async () => {
    const name = newYearName.trim();
    if (!/^\d{4}\/\d{4}$/.test(name)) {
      showToast.error('Enter the new year in the format YYYY/YYYY (e.g. 2027/2028).');
      return;
    }
    setStartingNewYear(true);
    try {
      const res = await schoolConfigService.startNewAcademicYear({
        new_year_name: name,
        clone_classes: newYearCloneClasses,
      });
      if ((res as any).success !== false) {
        const d = (res as any).data || {};
        showToast.success(
          d.carriedForward
            ? `Started ${name}: ${d.studentsMoved ?? 0} student(s) and ${(d.classesCloned ?? 0) + (d.classesSkipped ?? 0)} class(es) moved in, with subjects, teachers and timetable. Set up this year's fees in Fee Structures.`
            : `Switched to ${name}.`,
        );
        setSettings((s) => ({ ...s, academic_year: name }));
        setNewYearOpen(false);
        queryClient.invalidateQueries();
      } else {
        throw new Error((res as any).error || 'Failed to start new academic year');
      }
    } catch (err: any) {
      showToast.error(err?.response?.data?.message || err?.message || 'Failed to start new academic year');
    } finally {
      setStartingNewYear(false);
    }
  };

  // Each tab owns ONLY its own keys — a save never writes another tab's values
  // (or hidden defaults) over what's stored.
  const TAB_KEYS: Record<string, (k: string) => boolean> = {
    profile: (k) => ['language', 'date_format'].includes(k),
    academic: (k) => k === 'term_count' || /^term_\d_(start|end)$/.test(k),
    'id-format': (k) => k.startsWith('id_'),
    attendance: (k) => ['min_attendance_warning', 'min_attendance_critical', 'late_cutoff_time', 'staff_signin_closes_at'].includes(k),
    financial: (k) => k.startsWith('fin_'),
  };

  const handleSaveSettings = async () => {
    if (settingsLoadFailed) {
      showToast.error("Your saved settings couldn't be loaded, so saving is disabled to protect them. Refresh the page and try again.");
      return;
    }
    const err = validateSettingsForTab();
    if (err) { showToast.error(err); return; }
    const owns = TAB_KEYS[activeTab];
    if (!owns) return;
    const payload = Object.fromEntries(Object.entries(settings).filter(([k]) => owns(k)));
    setSaving(true);
    try {
      const res = await schoolConfigService.updateSettings(payload);
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
    if (!EMAIL_RE.test(profileForm.email.trim())) {
      showToast.error('Please enter a valid email address.');
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
    // Same rules the server enforces, so the user isn't told only after saving.
    const unmet = PASSWORD_RULES.filter((r) => !r.test(passwordForm.newPassword));
    if (unmet.length) {
      showToast.error(`New password needs ${unmet.map((r) => r.label.toLowerCase()).join(', ')}.`);
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
    // Validate the new grading scale before saving.
    if (!newGradeScale.name || !newGradeScale.name.trim()) {
      showToast.error('Grading scale name is required.');
      return;
    }
    if (!newGradeScale.grades || newGradeScale.grades.length === 0) {
      showToast.error('Add at least one grade band.');
      return;
    }
    for (const g of newGradeScale.grades) {
      if (!g.grade || !String(g.grade).trim()) {
        showToast.error('Every grade band needs a letter/label.');
        return;
      }
      const min = Number(g.min_score);
      const max = Number(g.max_score);
      if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max > 100 || min > max) {
        showToast.error(`Grade "${g.grade}": scores must be 0–100 with min ≤ max.`);
        return;
      }
    }
    setSaving(true);
    try {
      const res = await schoolConfigService.saveGradingScale(newGradeScale);
      if (res.success) {
        showToast.success('Grading scale created!');
        fetchInitialData();
        // Reset scale form
        setGradePreset('wassce');
        setNewGradeScale(scaleFromPreset('wassce', false));
      } else {
        throw new Error(res.error || 'Failed to save grading scale');
      }
    } catch (err: any) {
      showToast.error(err.message || 'Error creating grading scale');
    } finally {
      setSaving(false);
    }
  };

  const [scaleToDelete, setScaleToDelete] = useState<string | null>(null);
  const handleDeleteGradingScale = async (id: string) => {
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

  // Plan ordering so the action button reads correctly (Upgrade / Downgrade /
  // Current) relative to the tenant's active plan. The trial defaults to
  // 'freetong', so an unset/blank plan is treated as the lowest tier.
  const PLAN_RANK: Record<string, number> = { freetong: 0, combra: 1, bintumani: 2 };

  // Feature lists shown on each plan card. `soon: true` marks a roadmap (V2)
  // capability that is NOT yet available to any plan — shown so the value story
  // is complete, but clearly badged "Soon" so it never misleads. Un-badged items
  // are shipping V1 features that ARE enforced (see backend PLAN_LIMITS.features
  // + subscriptionGuard). Note: SMS/WhatsApp are intentionally omitted (removed
  // in V1).
  // Plan cards come from the live plan catalog (super-admin editable), so the
  // prices, limits and features shown here are exactly what billing charges and
  // the server enforces.
  type PlanFeature = { label: string; soon?: boolean };
  const catalogPlans: PlanDef[] = planCatalog?.plans ?? [];
  catalogPlans.forEach((p, i) => { PLAN_RANK[p.id] = i; });
  const planCardFeatures = (plan: PlanDef, i: number): PlanFeature[] => {
    if (!planCatalog) return [];
    const prev = catalogPlans[i - 1];
    const limits: PlanFeature[] = [
      { label: fmtLimit(plan.max_students, 'students', planCatalog.unlimited) },
      { label: fmtLimit(plan.max_staff, 'staff', planCatalog.unlimited) },
    ];
    const features: PlanFeature[] = i === 0
      ? planCatalog.features.filter((f) => f.core || plan.features[f.key]).map((f) => ({ label: f.label, soon: f.soon }))
      : [{ label: `Everything in ${prev.name}` }, ...planAdds(plan, prev, planCatalog).map((f) => ({ label: f.label, soon: f.soon }))];
    return [...limits, ...features, ...(plan.highlights || []).map((h) => ({ label: h }))];
  };
  const PLAN_STYLE: Record<string, { ring: string; chip: string; check: string; button: string }> = {
    freetong: { ring: 'border-blue-500 bg-blue-50/10', chip: 'bg-blue-100 text-blue-800', check: 'text-emerald-500', button: '' },
    combra: { ring: 'border-purple-500 bg-purple-50/10 shadow-sm', chip: 'bg-purple-100 text-purple-800', check: 'text-purple-500', button: 'bg-purple-600 hover:bg-purple-700 text-white' },
    bintumani: { ring: 'border-amber-500 bg-amber-50/10', chip: 'bg-amber-100 text-amber-800', check: 'text-amber-500', button: 'bg-amber-500 hover:bg-amber-600 text-white' },
  };
  /** What a move from the current plan to `target` takes away (for the downgrade warning). */
  const planLosses = (target: string) => {
    const cur = catalogPlans.find((p) => p.id === currentPlan);
    const next = catalogPlans.find((p) => p.id === target);
    if (!planCatalog || !cur || !next) return { portals: [] as string[], features: [] as string[] };
    const lost = planCatalog.features.filter((f) => !f.core && !f.soon && cur.features[f.key] && !next.features[f.key]);
    return {
      portals: lost.filter((f) => f.key.startsWith('portal_')).map((f) => {
        const users = subscription?.portals?.[f.key as 'portal_parent']?.users || 0;
        return users ? `${f.label} (${users} account${users === 1 ? '' : 's'} can't sign in)` : f.label;
      }),
      features: lost.filter((f) => !f.key.startsWith('portal_')).map((f) => f.label),
    };
  };

  const currentPlan = (subscription?.subscription?.plan_type || 'freetong') as 'freetong' | 'combra' | 'bintumani';
  const planButtonLabel = (target: 'freetong' | 'combra' | 'bintumani'): string => {
    if (target === currentPlan) return 'Current Plan';
    return (PLAN_RANK[target] ?? 0) > (PLAN_RANK[currentPlan] ?? 0) ? 'Upgrade' : 'Downgrade';
  };

  const handleUpgradePlan = async (planType: 'freetong' | 'combra' | 'bintumani') => {
    // Downgrade: say exactly what changes before anything is charged.
    if ((PLAN_RANK[planType] ?? 0) < (PLAN_RANK[currentPlan] ?? 0)) {
      const { portals, features } = planLosses(planType);
      const target = catalogPlans.find((p) => p.id === planType)?.name || planType;
      const lines = [
        `Move to ${target}?`,
        portals.length ? `\nThese portals will switch off (their users can't sign in):\n• ${portals.join('\n• ')}` : '',
        features.length ? `\nThese become read-only (records are kept, nothing new can be added):\n• ${features.join('\n• ')}` : '',
        '\nNothing is deleted, and everything comes back if you upgrade again.',
      ].filter(Boolean).join('\n');
      if (!window.confirm(lines)) return;
    }
    setSaving(true);
    try {
      // Plan changes are PAID (subscription revenue → the platform's own Monime
      // account) and happen fully IN-APP via a USSD payment code — no redirect.
      // The plan only activates via webhook once payment is confirmed.
      const res = await schoolConfigService.changePlan(planType, billingCycle);
      if (res.success) {
        const d = (res as any).data || {};
        if (d.sessionId && d.sessionId !== 'immediate') {
          // Open the in-app USSD modal and poll for completion.
          setSubPay({
            sessionId: d.sessionId,
            ussdCode: d.ussdCode || null,
            amount: d.amount || 0,
            expireTime: d.expireTime || null,
            planType,
            status: 'ussd',
          });
          return;
        }
        // No payment needed (zero-cost change) — plan applied immediately.
        showToast.success(`Your plan is now ${planType.toUpperCase()}.`);
        fetchInitialData();
      } else {
        // Verification gate (only that error): guide the owner to verify.
        if ((res as any).code === 'SCHOOL_VERIFICATION_REQUIRED') {
          showToast.info('Verify your school first. It takes about two minutes, then come back to change your plan.');
          navigateTo('/verify-school');
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

  // Tabs mapping — ordered by logical grouping so related settings sit together:
  //   1) Personal (every user):        My Profile · Security · Offline & Storage
  //   2) School identity (admin):      School Info · Academic Config · ID Format
  //   3) Academic output (admin):      Grading & Results · Attendance Rules · Report Card
  //   4) Finance & system (admin):     Financial Info · Payments · Plan & Billing · File Storage
  const tabs = [
    // ── Personal (all roles) ──
    { id: 'profile', label: 'My Profile', icon: <User size={18} />, adminOnly: false },
    { id: 'security', label: 'Security', icon: <ShieldCheck size={18} />, adminOnly: false },
    { id: 'offline', label: 'Offline & Storage', icon: <HardDrive size={18} />, adminOnly: false, teacherOnly: true },
    { id: 'policy', label: 'Payment Policy', icon: <DollarSign size={18} />, adminOnly: false, bursarOnly: true },
    { id: 'admissions', label: 'Admissions & IDs', icon: <GraduationCap size={18} />, adminOnly: false, officeOnly: true },
    // ── School identity (admin) ──
    { id: 'school', label: 'School Info', icon: <Building size={18} />, adminOnly: true },
    { id: 'academic', label: 'Academic Config', icon: <Calendar size={18} />, adminOnly: true },
    { id: 'id-format', label: 'ID Format', icon: <Building size={18} />, adminOnly: true },
    // ── Academic output (admin) ──
    { id: 'grading', label: 'Grading & Results', icon: <GraduationCap size={18} />, adminOnly: true },
    { id: 'attendance', label: 'Attendance Rules', icon: <AlertCircle size={18} />, adminOnly: true },
    { id: 'report-card', label: 'Report Card', icon: <GraduationCap size={18} />, adminOnly: true },
    // ── Finance & system (admin) ──
    { id: 'financial', label: 'Financial Info', icon: <DollarSign size={18} />, adminOnly: true },
    { id: 'payments', label: 'Payments', icon: <CreditCard size={18} />, adminOnly: true },
    { id: 'billing', label: 'Plan & Billing', icon: <CreditCard size={18} />, adminOnly: true },
    { id: 'storage', label: 'File Storage', icon: <HardDrive size={18} />, adminOnly: true },
  ];
  const tabAllowed = (id: string) => {
    const t = tabs.find((x) => x.id === id);
    if (!t) return false;
    if (t.adminOnly && !isPrincipalOrSuper) return false;
    if ((t as any).teacherOnly && !isTeacher) return false;
    if ((t as any).bursarOnly && !isBursar) return false;
    if ((t as any).officeOnly && !isOffice) return false;
    return true;
  };
  // Unknown (?tab=typo) or not-permitted tabs fall back to My Profile instead
  // of rendering a blank panel or an admin form the user can't use.
  useEffect(() => {
    if (!tabAllowed(activeTab)) setActiveTab('profile');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isPrincipalOrSuper, isTeacher, isBursar, isOffice]);

  return (
    <MainLayout>
      <PageShell
        title="Settings & Configuration"
        subtitle={isSuperAdmin
          ? 'Manage your platform account profile and security.'
          : isPrincipalOrSuper
            ? 'Configure your personal preferences and school-wide administrative variables.'
            : user?.role === 'accountant'
              ? 'Manage your profile, password and sign-in security, and see the payment policy you work under.'
              : user?.role === 'admissions_officer'
                ? 'Manage your profile, password and sign-in security, and see the admissions rules and ID formats you work with.'
              : isTeacher
                ? 'Manage your profile, password, sign-in security and offline storage on this device.'
                : 'Manage your profile, password and sign-in security.'}
      >

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* ── Mobile Navigation Tabs ── */}
          <div className="w-full lg:hidden">
            <div className="overflow-x-auto pb-3">
              <div className="inline-flex gap-2 px-2">
                {tabs.map((tab) => {
                  if (tab.adminOnly && !isPrincipalOrSuper) return null;
                  if ((tab as any).teacherOnly && !isTeacher) return null;
                  if ((tab as any).bursarOnly && !isBursar) return null;
                  if ((tab as any).officeOnly && !isOffice) return null;
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
                  if ((tab as any).bursarOnly && !isBursar) return null;
                  if ((tab as any).officeOnly && !isOffice) return null;
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

                {/* ── PAYMENT POLICY (bursar, read-only) ── */}
                {activeTab === 'policy' && (() => {
                  const on = (v: any) => v === true || v === 'true';
                  const num = (v: any) => Number(v) || 0;
                  const le = (v: any) => `Le ${num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  const lateOn = on(settings.fin_late_fee_enabled);
                  const rows: Array<[string, string, string?]> = [
                    ['Currency', 'Le (Sierra Leonean Leones), fixed'],
                    ['Instalments (part payments)', settings.fin_allow_installments !== false && settings.fin_allow_installments !== 'false' ? 'Allowed' : 'Not allowed: families pay the full balance at once'],
                    ['Minimum payment, new students', `${num(settings.fin_min_percent_new)}% of their balance`],
                    ['Minimum payment, continuing students', `${num(settings.fin_min_percent_continuing)}% of their balance`],
                    ['Minimum cleared per term', `${num(settings.fin_min_percent_term)}%`],
                    ['Charges before tuition', on(settings.fin_charges_compulsory_first_term) ? 'Yes: a part payment clears other charges first' : 'No'],
                    ['Late fees', lateOn
                      ? `On: ${num(settings.fin_late_fee_fixed) > 0 ? le(settings.fin_late_fee_fixed) : `${num(settings.fin_late_fee_percent)}% of the unpaid balance`}, once per overdue fee, after ${num(settings.fin_late_fee_grace_days)} grace day${num(settings.fin_late_fee_grace_days) === 1 ? '' : 's'}${num(settings.fin_late_fee_cap) > 0 ? `, capped at ${le(settings.fin_late_fee_cap)}` : ''}`
                      : 'Off'],
                    ['Discounts you can give without approval', num(settings.fin_discount_approval_threshold) > 0 ? `Up to ${le(settings.fin_discount_approval_threshold)}; larger ones wait for the principal` : 'None: every discount you give waits for the principal'],
                    ['Receipt email for cash and bank payments', settings.fin_email_manual_receipts === false || settings.fin_email_manual_receipts === 'false' ? 'Off' : 'On: every payment you record is emailed to the family'],
                  ];
                  return (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2.5">
                          <span className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center"><DollarSign size={18} /></span>
                          School Payment Policy
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm text-gray-600">The rules every payment and discount follows. The principal sets them in Settings → Financial Info; ask them if something needs to change. A class can override the payment rules on its fee structure.</p>
                        {settingsLoadFailed
                          ? <p role="alert" className="text-sm text-red-600">Couldn't load the policy. Refresh the page to try again.</p>
                          : (
                            <dl className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                              {rows.map(([k, v]) => (
                                <div key={k} className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-2.5 text-sm">
                                  <dt className="text-gray-500">{k}</dt>
                                  <dd className="sm:col-span-2 font-medium text-gray-800">{v}</dd>
                                </div>
                              ))}
                            </dl>
                          )}
                        <a href="/finance/fees" className="inline-block text-xs font-semibold text-blue-700 underline hover:text-blue-900">See class overrides in Fee Structures →</a>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* ── ADMISSIONS & IDs (admissions office, read-only) ── */}
                {activeTab === 'admissions' && (() => {
                  const sep = settings.id_separator === 'none' || settings.id_separator == null ? '' : String(settings.id_separator);
                  const yf = settings.id_year_format || (settings.id_include_year === false ? 'none' : 'full');
                  const yr = String(new Date().getFullYear());
                  const yp = yf === 'full' ? yr : yf === 'short' ? yr.slice(-2) : '';
                  const pad = Number(settings.id_padding) || 5;
                  const sample = (prefix: string, from: any) => [prefix, yp, String((Number(from) || 0) + 1).padStart(pad, '0')].filter(Boolean).join(sep);
                  const rows: Array<[string, React.ReactNode]> = [
                    ['Intake year', <>{activeAcademicYear || '—'} <span className="text-gray-500 font-normal">(new applications and enrolments go into the current year)</span></>],
                    ['Application numbers', <span className="font-mono">{sample(settings.id_admission_prefix || 'ADM', settings.id_admission_start_from)}</span>],
                    ['Student numbers', <span className="font-mono">{sample(settings.id_student_prefix || settings.id_admission_prefix || 'STU', settings.id_student_start_from)}</span>],
                    ['Decisions emailed to families', 'Interview invitation, approved, waitlist and rejected (each once). Withdrawals and notes are never emailed.'],
                    ['Becoming a student', 'Only when you press Enrol on an approved application, into a class of the current year. Fees already billed to the class can be billed to the new student.'],
                    ['Online applications', 'Up to 5 per family per day; the same child sent twice keeps the first application.'],
                    ['ID card designs', 'You design student cards; the principal approves them. Cards are printed on approved designs only.'],
                  ];
                  return (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2.5">
                          <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><GraduationCap size={18} /></span>
                          Admissions &amp; ID Numbers
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm text-gray-600">The rules admissions follows. The principal sets the ID format in Settings → ID Format; ask them if something needs to change.</p>
                        {officeLink && (
                          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                            <p className="text-xs font-semibold text-blue-900 mb-1.5">Online application link</p>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input readOnly aria-label="Online application link" value={officeLink} onClick={(e) => e.currentTarget.select()} className="min-w-0 flex-1 text-sm bg-white" />
                              <Button size="sm" onClick={async () => { try { await navigator.clipboard.writeText(officeLink); showToast.success('Link copied'); } catch { showToast.error('Select and copy the link'); } }}><Copy size={14} className="mr-1" /> Copy</Button>
                            </div>
                          </div>
                        )}
                        {settingsLoadFailed
                          ? <p role="alert" className="text-sm text-red-600">Couldn't load the school's settings. Refresh the page to try again.</p>
                          : (
                            <dl className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                              {rows.map(([k, v]) => (
                                <div key={k} className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-2.5 text-sm">
                                  <dt className="text-gray-500">{k}</dt>
                                  <dd className="sm:col-span-2 font-medium text-gray-800">{v}</dd>
                                </div>
                              ))}
                            </dl>
                          )}
                        <div className="flex flex-wrap gap-4 text-xs font-semibold">
                          <a href="/students/admissions" className="text-blue-700 underline hover:text-blue-900">Open Admissions →</a>
                          <a href="/identity/templates" className="text-blue-700 underline hover:text-blue-900">Card designs →</a>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

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
                    {user?.role === 'principal' && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <ShieldCheck size={20} className={isVerifiedUser(user) ? 'text-emerald-600' : 'text-[#1d4ed8]'} aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 dark:text-white">School verification</p>
                            <p className="text-xs text-gray-500">
                              {isVerifiedUser(user)
                                ? 'Your school is verified. Your name is locked to the name on your ID.'
                                : "Not verified yet. You'll need it before changing your subscription plan."}
                            </p>
                          </div>
                        </div>
                        <Link to="/verify-school" className="text-sm font-semibold text-[#1d4ed8] hover:underline whitespace-nowrap">
                          {isVerifiedUser(user) ? 'View details' : 'Verify now'}
                        </Link>
                      </div>
                    )}
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
                          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
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
                                  aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
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
                                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
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
                                  aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                                >
                                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                              </div>
                            </div>
                          </div>
                          {/* Live checklist of the server's password rules. */}
                          {passwordForm.newPassword && (
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs" aria-label="Password requirements">
                              {PASSWORD_RULES.map((r) => {
                                const ok = r.test(passwordForm.newPassword);
                                return (
                                  <li key={r.label} className={ok ? 'text-emerald-600' : 'text-gray-500'}>
                                    {ok ? '✓' : '•'} {r.label}
                                  </li>
                                );
                              })}
                              {passwordForm.confirmPassword && (
                                <li className={passwordForm.confirmPassword === passwordForm.newPassword ? 'text-emerald-600' : 'text-rose-600'}>
                                  {passwordForm.confirmPassword === passwordForm.newPassword ? '✓ Passwords match' : '• Passwords don\'t match'}
                                </li>
                              )}
                            </ul>
                          )}
                          <p className="text-xs text-gray-400">You'll be signed out after changing your password, then sign in with the new one.</p>
                          <div className="flex justify-end pt-2">
                            <Button type="submit" disabled={savingPassword}>
                              {savingPassword ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                              Update Password
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>

                    {/* Display preferences (language & date format) — school-wide,
                        admin only. Other roles never load the school's settings,
                        so this card would show placeholder defaults, not the
                        school's real values. */}
                    {isPrincipalOrSuper && <Card>
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

                        <div className="flex justify-end mt-4">
                          <Button onClick={handleSaveSettings} disabled={saving}>
                            {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                            Save Global Preferences
                          </Button>
                        </div>
                      </CardContent>
                    </Card>}
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
                              <label className="text-xs font-semibold text-gray-500 block mb-1">School Name <span className="text-rose-500">*</span></label>
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
                                cameraAspect={1}
                                cameraGuide="frame"
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
                          {/* Read-only: the year only changes through "Start New Academic Year" below. */}
                          <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-900 font-semibold flex items-center justify-between">
                            <span>{activeAcademicYear || '—'}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Active</span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1">To move to the next year, use Start New Academic Year below.</p>
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

                      {/* ── Start New Academic Year (guided, non-destructive) ── */}
                      <div className="mt-8 border-t border-gray-100 pt-6">
                        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                          <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                            <Calendar size={16} /> Start a New Academic Year
                          </h4>
                          <p className="text-xs text-amber-800/90 mt-1 leading-relaxed">
                            Moves the whole school into the next year <strong>without deleting anything</strong>.
                            Last year is archived as history, and its classes, subjects, teacher assignments
                            and timetable are copied into the new year. Fee structures start fresh each year.
                            Every active student moves
                            into their class for the new year (students you already promoted land in their new
                            class). You can still promote from last year's results afterwards.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button variant="outline" onClick={openNewYearDialog} className="border-amber-300 text-amber-900 hover:bg-amber-100">
                              Start New Academic Year
                            </Button>
                            <Button variant="outline" onClick={() => setCarryDialogOpen(true)} disabled={carryingForward} className="border-amber-300 text-amber-900 hover:bg-amber-100">
                              {carryingForward ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                              Bring last year into this year
                            </Button>
                          </div>
                        </div>
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
                    <ReportSettingsPanel academicYear={activeAcademicYear} />

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
                                  onClick={() => s.scale_id && setScaleToDelete(s.scale_id)}
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
                          {/* Standard to start from */}
                          <div>
                            <span className="text-xs font-semibold text-gray-500 block mb-1.5">Start from a standard</span>
                            <div role="radiogroup" aria-label="Grading standard" className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                              {GRADING_PRESETS.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  role="radio"
                                  aria-checked={gradePreset === p.id}
                                  onClick={() => pickGradePreset(p.id)}
                                  className={`text-left rounded-xl border px-3 py-2.5 transition ${gradePreset === p.id ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-500/20' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                                >
                                  <span className="block text-sm font-bold text-gray-900">{p.id === 'custom' ? 'Custom' : p.id.toUpperCase()}</span>
                                  <span className="block text-[11px] text-gray-500">{p.level}{p.id !== 'custom' ? ` · ${p.grades[0].grade}–${p.grades[p.grades.length - 1].grade}` : ' · your own bands'}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-semibold text-gray-500 block mb-1">Scale Name</label>
                              <input
                                type="text"
                                placeholder="e.g. Our JSS scale"
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
                                <option value="numeric">Numeric Grades (1-9)</option>
                              </select>
                            </div>
                          </div>

                          {/* Grade bands (editable) */}
                          <div className="rounded-xl border border-gray-200 overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                                <tr>
                                  <th scope="col" className="px-3 py-2 text-left">Grade</th>
                                  <th scope="col" className="px-3 py-2 text-left">From %</th>
                                  <th scope="col" className="px-3 py-2 text-left">To %</th>
                                  <th scope="col" className="px-3 py-2 text-left">Remark</th>
                                  <th scope="col" className="px-3 py-2"><span className="sr-only">Remove</span></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {newGradeScale.grades.map((g, i) => (
                                  <tr key={i}>
                                    <td className="px-3 py-1.5">
                                      <input aria-label={`Grade ${i + 1}`} value={g.grade} onChange={(e) => updateBand(i, { grade: e.target.value })} className="w-16 px-2 py-1 border border-gray-300 rounded-md font-bold" />
                                    </td>
                                    <td className="px-3 py-1.5">
                                      <input aria-label={`Grade ${g.grade} from`} type="number" min={0} max={100} value={g.min_score} onChange={(e) => updateBand(i, { min_score: Number(e.target.value) })} className="w-20 px-2 py-1 border border-gray-300 rounded-md" />
                                    </td>
                                    <td className="px-3 py-1.5">
                                      <input aria-label={`Grade ${g.grade} to`} type="number" min={0} max={100} value={g.max_score} onChange={(e) => updateBand(i, { max_score: Number(e.target.value) })} className="w-20 px-2 py-1 border border-gray-300 rounded-md" />
                                    </td>
                                    <td className="px-3 py-1.5">
                                      <input aria-label={`Grade ${g.grade} remark`} value={g.description || ''} onChange={(e) => updateBand(i, { description: e.target.value })} className="w-full min-w-[110px] px-2 py-1 border border-gray-300 rounded-md" />
                                    </td>
                                    <td className="px-3 py-1.5 text-right">
                                      <button
                                        type="button"
                                        aria-label={`Remove grade ${g.grade}`}
                                        onClick={() => setNewGradeScale((cur) => ({ ...cur, grades: cur.grades.filter((_, j) => j !== i) }))}
                                        className="p-1.5 rounded-md text-rose-600 hover:bg-rose-50"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => setNewGradeScale((cur) => ({ ...cur, grades: [...cur.grades, { grade: '', min_score: 0, max_score: 0, grade_points: 0, description: '' }] }))}
                              className="text-xs font-semibold text-violet-700 hover:underline"
                            >
                              + Add grade
                            </button>
                            <label className="flex items-center gap-2 text-xs text-gray-600">
                              <input type="checkbox" checked={newGradeScale.is_default} onChange={(e) => setNewGradeScale({ ...newGradeScale, is_default: e.target.checked })} />
                              Make this the default scale
                            </label>
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
                        <div>
                          <label htmlFor="staff-signin-closes" className="text-xs font-semibold text-gray-500 block mb-1">Staff sign-in closes at</label>
                          <input
                            id="staff-signin-closes"
                            type="time"
                            value={settings.staff_signin_closes_at || '18:00'}
                            onChange={(e) => setSettings({ ...settings, staff_signin_closes_at: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                          <p className="text-[10px] text-gray-400 mt-1">Staff sign themselves in for today only, until this time. After it, you record their attendance.</p>
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
                          <label className="text-xs font-semibold text-gray-500 block mb-1">Currency</label>
                          {/* Currency is fixed to Sierra Leonean Leones (Le) system-wide —
                              all fees, receipts, invoices and emails render in Leones. */}
                          <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 flex items-center justify-between">
                            <span className="font-medium">Le — Sierra Leonean Leones</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Fixed</span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-1">All amounts across the system are in Leones.</p>
                        </div>
                      </div>

                      {/* ── School-wide Payment Policy ── */}
                      <div>
                        <h4 className="text-sm font-bold text-gray-800 mb-1">School Payment Policy</h4>
                        <p className="text-xs text-gray-500 mb-4">
                          These rules apply to every class by default and are enforced automatically
                          whenever a fee is paid (online or recorded manually). A specific class can
                          override any of them on its fee structure.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="text-xs font-semibold text-gray-500 block mb-1">Min. payment — New students (%)</label>
                            <input
                              type="number" min={0} max={100}
                              value={settings.fin_min_percent_new ?? 0}
                              onChange={(e) => setSettings({ ...settings, fin_min_percent_new: Number(e.target.value) })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Minimum % of their balance a new student must pay.</p>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-500 block mb-1">Min. payment — Continuing (%)</label>
                            <input
                              type="number" min={0} max={100}
                              value={settings.fin_min_percent_continuing ?? 0}
                              onChange={(e) => setSettings({ ...settings, fin_min_percent_continuing: Number(e.target.value) })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Minimum % for a continuing (returning) student.</p>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-500 block mb-1">Min. per-term clearance (%)</label>
                            <input
                              type="number" min={0} max={100}
                              value={settings.fin_min_percent_term ?? 0}
                              onChange={(e) => setSettings({ ...settings, fin_min_percent_term: Number(e.target.value) })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Minimum % that must be cleared per term.</p>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-500 block mb-1">Late-fee surcharge (%)</label>
                            <input
                              type="number" min={0} max={100}
                              value={settings.fin_late_fee_percent ?? 0}
                              onChange={(e) => setSettings({ ...settings, fin_late_fee_percent: Number(e.target.value) })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">% of the unpaid balance, charged once per overdue fee (when late fees are on).</p>
                          </div>
                        </div>

                        {/* Late fees, discount approval and e-receipts (bursar) */}
                        <div className="mt-5 rounded-xl border border-gray-200 p-4 space-y-3">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={settings.fin_late_fee_enabled === true || settings.fin_late_fee_enabled === 'true'}
                              onChange={(e) => setSettings({ ...settings, fin_late_fee_enabled: e.target.checked })}
                              className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-gray-300" />
                            <span className="text-sm text-gray-700"><span className="font-semibold">Charge late fees automatically.</span>{' '}
                              <span className="text-gray-500">Every night, each fee still unpaid after its due date (plus the grace days) gets one late fee. Families keeping to an instalment plan are skipped. The bursar can waive any late fee.</span></span>
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label htmlFor="fin-late-fixed" className="text-xs font-semibold text-gray-500 block mb-1">Fixed late fee (Le)</label>
                              <input id="fin-late-fixed" placeholder="e.g. 50" type="number" min={0} value={settings.fin_late_fee_fixed ?? 0}
                                onChange={(e) => setSettings({ ...settings, fin_late_fee_fixed: Number(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white" />
                              <p className="text-[10px] text-gray-400 mt-1">When above 0, used instead of the %.</p>
                            </div>
                            <div>
                              <label htmlFor="fin-late-grace" className="text-xs font-semibold text-gray-500 block mb-1">Grace days</label>
                              <input id="fin-late-grace" placeholder="e.g. 7" type="number" min={0} step={1} value={settings.fin_late_fee_grace_days ?? 0}
                                onChange={(e) => setSettings({ ...settings, fin_late_fee_grace_days: Number(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white" />
                              <p className="text-[10px] text-gray-400 mt-1">Days after the due date before a late fee.</p>
                            </div>
                            <div>
                              <label htmlFor="fin-late-cap" className="text-xs font-semibold text-gray-500 block mb-1">Late fee cap (Le)</label>
                              <input id="fin-late-cap" placeholder="e.g. 500" type="number" min={0} value={settings.fin_late_fee_cap ?? 0}
                                onChange={(e) => setSettings({ ...settings, fin_late_fee_cap: Number(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white" />
                              <p className="text-[10px] text-gray-400 mt-1">0 = no cap.</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                            <div>
                              <label htmlFor="fin-disc-limit" className="text-xs font-semibold text-gray-500 block mb-1">Discounts the bursar can approve alone, up to (Le)</label>
                              <input id="fin-disc-limit" placeholder="e.g. 1000" type="number" min={0} value={settings.fin_discount_approval_threshold ?? 0}
                                onChange={(e) => setSettings({ ...settings, fin_discount_approval_threshold: Number(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white" />
                              <p className="text-[10px] text-gray-400 mt-1">0 = every discount the bursar gives waits for your approval.</p>
                            </div>
                            <label className="flex items-start gap-3 cursor-pointer mt-5">
                              <input type="checkbox" checked={settings.fin_email_manual_receipts !== false && settings.fin_email_manual_receipts !== 'false'}
                                onChange={(e) => setSettings({ ...settings, fin_email_manual_receipts: e.target.checked })}
                                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-gray-300 mt-0.5" />
                              <span className="text-sm text-gray-700"><span className="font-semibold">Email a receipt for every payment.</span>{' '}
                                <span className="text-gray-500">Cash and bank payments recorded by the bursar get an emailed PDF receipt, like online payments.</span></span>
                            </label>
                          </div>
                        </div>

                        <div className="mt-4 space-y-3">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.fin_allow_installments !== false}
                              onChange={(e) => setSettings({ ...settings, fin_allow_installments: e.target.checked })}
                              className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-gray-300"
                            />
                            <span className="text-sm text-gray-700">
                              <span className="font-semibold">Allow instalments (part payments).</span>{' '}
                              <span className="text-gray-500">When off, families must pay the full balance in one go.</span>
                            </span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.fin_charges_compulsory_first_term === true}
                              onChange={(e) => setSettings({ ...settings, fin_charges_compulsory_first_term: e.target.checked })}
                              className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-gray-300"
                            />
                            <span className="text-sm text-gray-700">
                              <span className="font-semibold">Charges compulsory first.</span>{' '}
                              <span className="text-gray-500">A part payment must clear all non-tuition charges before tuition.</span>
                            </span>
                          </label>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
                        <a href="/finance/fees" className="text-xs font-semibold text-blue-700 underline hover:text-blue-900">
                          Override per class in Fee Structures →
                        </a>
                        <Button onClick={handleSaveSettings} disabled={saving}>
                          {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                          Save Payment Policy
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Communications tab removed: the tenant email sender is the
                    school's verified sender (managed via school profile / setup),
                    per-recipient email prefs live on each user, and SMS is not
                    active in this version — so the tab had no functional fields. */}

                {/* ── FILE STORAGE TAB ── */}
                {/* ── PAYMENTS TAB (school's own Monime account for fee collection) ── */}
                {activeTab === 'payments' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Payments</CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        Connect your school's own Monime account so online fee payments settle directly into your account.
                      </p>
                    </CardHeader>
                    <CardContent>
                      <PaymentSettings />
                    </CardContent>
                  </Card>
                )}

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

                {/* In-app subscription USSD payment modal (mobile money). */}
                {subPay && (
                  <SubscriptionUssdModal
                    state={subPay}
                    onClose={() => setSubPay(null)}
                  />
                )}

                {/* ── PLAN & BILLING TAB ── */}
                {activeTab === 'billing' && (
                  <div className="space-y-6">
                    {/* Trial banner — new schools explore the top plan free for a
                        limited time, then drop to Freetong (never locked out). */}
                    {subscription?.subscription?.is_trial && subscription?.subscription?.end_date && (() => {
                      const end = new Date(subscription.subscription.end_date as string);
                      const daysLeft = Math.max(0, Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                      return (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                          <Sparkles size={18} className="text-amber-500 shrink-0 mt-0.5" />
                          <div className="text-sm text-amber-900">
                            <p className="font-bold">
                              You're on a free {String(subscription.subscription.plan_type).toUpperCase()} trial — {daysLeft} day{daysLeft === 1 ? '' : 's'} left.
                            </p>
                            <p className="text-xs text-amber-800/80 mt-0.5">
                              Explore every feature. When the trial ends you'll move to the free Freetong plan automatically — you won't be locked out. Upgrade any time to keep the extras.
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Comp banner — platform owner granted this plan for free. */}
                    {subscription?.subscription?.is_comp && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
                        <Sparkles size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                        <div className="text-sm text-emerald-900">
                          <p className="font-bold">
                            Complimentary {String(subscription.subscription.plan_type).toUpperCase()} plan — a gift from WiSkul.
                          </p>
                          <p className="text-xs text-emerald-800/80 mt-0.5">
                            {subscription.subscription.end_date
                              ? `Active until ${new Date(subscription.subscription.end_date).toLocaleDateString()}. `
                              : 'No expiry. '}
                            You're enjoying full access at no cost. If this offer is later removed you'll move to the free Freetong plan without losing any data.
                          </p>
                        </div>
                      </div>
                    )}

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
                            Yearly
                          </button>
                        </div>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {planCatalog && subscription?.entitlements && (
                          <div className="md:col-span-3">
                            <PlanAccessSummary
                              planName={subscription.entitlements.plan_name}
                              features={planCatalog.features}
                              access={subscription.entitlements.features}
                              portals={subscription.portals}
                            />
                          </div>
                        )}
                        {!planCatalog && (
                          <p className="md:col-span-3 text-sm text-gray-500">Loading plans…</p>
                        )}
                        {catalogPlans.map((plan, i) => {
                          const style = PLAN_STYLE[plan.id] || PLAN_STYLE.freetong;
                          const isCurrent = currentPlan === plan.id;
                          const price = billingCycle === 'monthly' ? plan.monthly_price : plan.yearly_price;
                          return (
                            <div key={plan.id} className={`p-4 sm:p-5 rounded-xl border flex flex-col justify-between relative ${isCurrent ? style.ring : 'border-gray-200 bg-white'}`}>
                              {plan.featured && !isCurrent && (
                                <div className={`absolute top-3 right-3 ${style.chip} text-[8px] font-bold px-2 py-0.5 rounded-full`}>{plan.badge || 'Most Popular'}</div>
                              )}
                              <div>
                                <div className="flex justify-between items-start gap-2">
                                  <h4 className="font-extrabold text-gray-900 text-lg">{plan.name}</h4>
                                  {isCurrent && (
                                    <span className={`${style.chip} text-[9px] font-bold px-2 py-0.5 rounded-full`}>Current</span>
                                  )}
                                </div>
                                {plan.tagline && <p className="text-gray-400 text-xs mt-1 italic">{plan.tagline}</p>}
                                <p className="text-2xl font-black text-gray-900 mt-4">
                                  {fmtPrice(price)}
                                  <span className="text-xs text-gray-400 font-normal"> / {billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                                </p>

                                <ul className="space-y-2 mt-6 text-xs text-gray-600">
                                  {planCardFeatures(plan, i).map((f) => (
                                    <li key={f.label} className={`flex items-center gap-2 ${f.soon ? 'text-gray-400' : ''}`}>
                                      <CheckCircle2 size={12} aria-hidden="true" className={f.soon ? 'text-gray-300' : style.check} /> {f.label}
                                      {f.soon && <span className="ml-1 text-[10px] italic text-gray-400">(coming soon)</span>}
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <Button
                                variant={isCurrent ? 'outline' : 'default'}
                                onClick={() => handleUpgradePlan(plan.id)}
                                disabled={isCurrent || saving}
                                className={`w-full mt-8 ${isCurrent ? '' : style.button}`}
                              >
                                {planButtonLabel(plan.id)}
                              </Button>
                            </div>
                          );
                        })}
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

      <YearTransitionDialog
        isOpen={carryDialogOpen}
        onClose={() => setCarryDialogOpen(false)}
        onConfirm={handleCarryForward}
        toYear={settings.academic_year || null}
      />

      <ConfirmationDialog
        isOpen={!!scaleToDelete}
        onClose={() => setScaleToDelete(null)}
        onConfirm={() => (scaleToDelete ? handleDeleteGradingScale(scaleToDelete) : undefined)}
        title="Delete grading scale"
        message="Delete this grading scale? This cannot be undone."
        confirmLabel="Delete scale"
      />

      {/* ── Start New Academic Year dialog ── */}
      {newYearOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => !startingNewYear && setNewYearOpen(false)}>
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Start New Academic Year</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                The current year is archived (history preserved). This activates the new year and can carry your classes forward.
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">New academic year (YYYY/YYYY)</label>
                <input
                  type="text"
                  value={newYearName}
                  onChange={(e) => setNewYearName(e.target.value)}
                  placeholder="2027/2028"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
              <label className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newYearCloneClasses}
                  onChange={(e) => setNewYearCloneClasses(e.target.checked)}
                  className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="text-sm text-gray-800">Move classes, setup and students into the new year</span>
              </label>
              <p className="text-[11px] text-gray-400">
                Nothing is deleted. Last year's results, attendance and fees stay as history. Billing for the new year is not created automatically.
              </p>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewYearOpen(false)} disabled={startingNewYear}>Cancel</Button>
              <Button onClick={handleStartNewYear} disabled={startingNewYear}>
                {startingNewYear ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                {startingNewYear ? 'Starting…' : 'Start New Year'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Report Card Border Settings (admin-only)
// Lets principals pick a border style for the Sierra Leone booklet report card.
// Persisted to school_config_settings under key 'report_card_border_style'.
// ──────────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────────
// SubscriptionUssdModal — in-app mobile-money (USSD) payment for a plan upgrade.
// The whole payment stays INSIDE the app: we show the USSD code the payer dials
// on their phone (Orange Money / Afrimoney) and poll for completion. Money goes
// to the PLATFORM's Monime account (subscription revenue).
// ──────────────────────────────────────────────────────────────────────────────
const SubscriptionUssdModal: React.FC<{
  state: {
    sessionId: string;
    ussdCode: string | null;
    amount: number;
    expireTime: string | null;
    planType: 'freetong' | 'combra' | 'bintumani';
    status: 'ussd' | 'completed' | 'failed' | 'cancelled';
  };
  onClose: () => void;
}> = ({ state, onClose }) => {
  const { ussdCode, amount, expireTime, planType, status } = state;
  const [copied, setCopied] = useState(false);
  const fmtLe = (n: number) => `Le ${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Countdown to the code's expiry (30 min set on the backend).
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!expireTime || status !== 'ussd') { setRemaining(null); return; }
    const target = new Date(expireTime).getTime();
    if (Number.isNaN(target)) { setRemaining(null); return; }
    const tick = () => setRemaining(Math.max(0, Math.round((target - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expireTime, status]);
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const expired = remaining === 0;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const copy = async () => {
    if (!ussdCode) return;
    try { await navigator.clipboard.writeText(ussdCode); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };

  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const telHref = ussdCode ? `tel:${encodeURIComponent(ussdCode)}` : undefined;

  const terminal = status === 'completed' || status === 'failed' || status === 'cancelled';
  const result = {
    completed: { icon: <CheckCircle2 size={48} className="text-emerald-500" />, title: 'Payment successful', desc: `Your school is now on the ${planType.toUpperCase()} plan.` },
    failed:    { icon: <XCircle size={48} className="text-rose-500" />, title: 'Payment failed', desc: 'We could not confirm your payment. If money was deducted, it will be reversed automatically.' },
    cancelled: { icon: <XCircle size={48} className="text-gray-400" />, title: 'Payment cancelled', desc: 'The payment was cancelled. No charge was made and your plan is unchanged.' },
  }[status as 'completed' | 'failed' | 'cancelled'] ?? null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-md my-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-indigo-600 to-blue-600">
          <div className="flex items-center gap-2 text-white font-bold"><CreditCard size={18} /> Upgrade to {planType.toUpperCase()}</div>
          <button onClick={onClose} aria-label="Close" className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white hover:bg-gray-100 ring-1 ring-white/60 shadow-sm transition shrink-0 leading-none">
            <span className="text-indigo-700 text-xl font-black leading-none -mt-0.5">&times;</span>
          </button>
        </div>

        <div className="p-6">
          {status === 'ussd' && (
            <div className="text-center">
              <div className="flex justify-center mb-3"><div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center"><Smartphone size={24} /></div></div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">Dial to pay <span className="text-indigo-600">{fmtLe(amount)}</span></h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">On the phone with your mobile money (Orange Money or Afrimoney), dial this code and follow the prompts:</p>
              {ussdCode ? (
                <>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <code className="text-xl font-black tracking-wide text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 select-all">{ussdCode}</code>
                    <button onClick={copy} title="Copy code" className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition">
                      {copied ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                  </div>
                  {telHref && (
                    <a href={telHref} className="mt-3 w-full inline-flex items-center justify-center gap-2 font-semibold rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-5 py-2.5 text-sm shadow-sm hover:shadow-md transition">
                      <Phone size={16} /> Dial now to pay
                    </a>
                  )}
                  {!isMobile && (
                    <p className="mt-2 text-[11px] text-gray-400">Tip: "Dial now" opens the phone dialer on a mobile device. On a computer, copy the code and dial it on your phone.</p>
                  )}
                </>
              ) : (
                <p className="mt-4 text-sm text-amber-600">Check your phone for a mobile-money prompt to approve this payment.</p>
              )}
              {remaining != null && (
                expired ? (
                  <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded-full px-3 py-1">
                    <Timer size={13} /> Code expired — close and try again
                  </div>
                ) : (
                  <div className={`mt-3 inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1 ${remaining <= 60 ? 'text-amber-700 bg-amber-50 dark:bg-amber-950/30' : 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800'}`}>
                    <Timer size={13} /> Expires in {mmss(remaining)}
                  </div>
                )
              )}
              {!expired && (
                <div className="mt-5 flex items-center justify-center gap-2 text-xs text-gray-400">
                  <Loader2 size={12} className="animate-spin" /> Waiting for your payment…
                </div>
              )}
              <p className="mt-2 text-[11px] text-gray-400">Keep this window open. Your plan activates automatically once payment is confirmed.</p>
              <button onClick={onClose} className="mt-4 text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Cancel</button>
            </div>
          )}

          {terminal && result && (
            <div className="text-center">
              <div className="flex justify-center mb-4">{result.icon}</div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">{result.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{result.desc}</p>
              <button onClick={onClose} className="mt-6 inline-flex items-center justify-center gap-2 font-semibold rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-2.5 text-sm hover:opacity-90 transition">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

/** apiClient never throws — turn a `{ success: false }` response into an error. */
const assertSaved = (res: any) => {
  if (res && res.success === false) throw new Error(res.error || 'Save failed');
  return res;
};

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
  // Front-cover official stamp/seal and principal's signature images. When set,
  // they replace the placeholder SEAL circle / script name on the report card.
  const [stampUrl, setStampUrl] = useState<string>('');
  const [signatureUrl, setSignatureUrl] = useState<string>('');
  // Size multipliers (0.5–2) for the front-cover stamp & signature images.
  const [stampScale, setStampScale] = useState(1);
  const [signatureScale, setSignatureScale] = useState(1);
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
          if (typeof value.stamp_url === 'string') setStampUrl(value.stamp_url);
          if (typeof value.signature_url === 'string') setSignatureUrl(value.signature_url);
          if (typeof value.stamp_scale === 'number') setStampScale(value.stamp_scale);
          if (typeof value.signature_scale === 'number') setSignatureScale(value.signature_scale);
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
      assertSaved(await schoolConfigService.updateSetting('report_card_border_style', {
        preset: selectedPreset,
        color: customColor,
        width: customWidth,
        style: customStyle,
        padding: customPadding,
        radius: customRadius,
      }));
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
      assertSaved(await schoolConfigService.updateSetting('report_card_border_style', { preset: 'classic', color: '#1f2937', width: 2, style: 'solid', padding: 8, radius: 0 }));
      queryClient.invalidateQueries({ queryKey: ['report-card-border-style'] });
      showToast.success('Reset to classic style.');
    } catch {
      showToast.error('Failed to reset border style');
    }
  };

  const handleSaveDisplay = async () => {
    setSavingDisplay(true);
    try {
      assertSaved(await schoolConfigService.updateSetting('report_card_display_opts', {
        show_watermark: showWatermark,
        watermark_opacity: watermarkOpacity,
        watermark_size: watermarkSize,
        show_student_photo: showStudentPhoto,
        photo_frame: photoFrame,
        stamp_url: stampUrl || null,
        signature_url: signatureUrl || null,
        stamp_scale: stampScale,
        signature_scale: signatureScale,
      }));
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
                  stampUrl={stampUrl || undefined}
                  signatureUrl={signatureUrl || undefined}
                  stampScale={stampScale}
                  signatureScale={signatureScale}
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
            Display the school logo as a faint watermark on the back cover of the report booklet.
            This adds a professional, tamper-evident security overlay to the printed report card.
          </p>

          {/* Toggle */}
          <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-100">
            <div className="flex items-start gap-3 min-w-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">Show logo watermark</p>
                <p className="text-xs text-gray-500">Display the school logo faintly on the back cover.</p>
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
          SECTION 4 — OFFICIAL STAMP & PRINCIPAL'S SIGNATURE (front cover)
          ══════════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <CardTitle>Official Stamp & Principal's Signature</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-gray-600">
            Upload the school's official stamp/seal and the principal's signature. When set,
            they replace the placeholder boxes at the bottom of the report card's front cover —
            so every generated card is pre-stamped and pre-signed. You can snap a photo of a
            signature or stamp on plain paper — the white background is removed automatically so
            it overlays cleanly. Leave either blank to keep the default placeholder.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Official Stamp */}
            <div>
              <label className="text-sm font-semibold text-gray-800 block mb-1.5">Official Stamp / Seal</label>
              <FileUploader
                value={stampUrl}
                onChange={(url) => setStampUrl(url || '')}
                accept="image/png,image/jpeg,image/webp"
                placeholder="Click or drag to upload the school stamp (PNG/JPG)"
                previewType="image"
                inlineImage
                removeBackground
                maxSizeMB={2}
              />
              <p className="text-[11px] text-gray-400 mt-1">The white paper background is removed automatically. Appears in the "Official Stamp" box on the front cover.</p>
              {stampUrl && (
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Stamp size: <span className="text-gray-900">{Math.round(stampScale * 100)}%</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range" min={0.5} max={2} step={0.05}
                      value={stampScale}
                      onChange={(e) => setStampScale(Number(e.target.value))}
                      className="flex-1 accent-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => setStampScale(1)}
                      className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200"
                    >
                      Reset
                    </button>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5"><span>Smaller</span><span>Larger</span></div>
                </div>
              )}
            </div>

            {/* Principal's Signature */}
            <div>
              <label className="text-sm font-semibold text-gray-800 block mb-1.5">Principal's Signature</label>
              <FileUploader
                value={signatureUrl}
                onChange={(url) => setSignatureUrl(url || '')}
                accept="image/png,image/jpeg,image/webp"
                placeholder="Click or drag to upload the signature (PNG/JPG)"
                previewType="image"
                inlineImage
                removeBackground
                maxSizeMB={2}
              />
              <p className="text-[11px] text-gray-400 mt-1">The white paper background is removed automatically. Appears in the "Principal's Signature" box on the front cover.</p>
              {signatureUrl && (
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Signature size: <span className="text-gray-900">{Math.round(signatureScale * 100)}%</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range" min={0.5} max={2} step={0.05}
                      value={signatureScale}
                      onChange={(e) => setSignatureScale(Number(e.target.value))}
                      className="flex-1 accent-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => setSignatureScale(1)}
                      className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200"
                    >
                      Reset
                    </button>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5"><span>Smaller</span><span>Larger</span></div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <ImageIcon size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              The <strong>Front Cover Preview</strong> in the Border section above updates in real time as you
              upload. {stampUrl ? 'The uploaded stamp is currently shown.' : 'No stamp uploaded — the placeholder seal shows.'}{' '}
              {signatureUrl ? 'The uploaded signature is currently shown.' : 'No signature uploaded — the placeholder shows.'}
            </p>
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
