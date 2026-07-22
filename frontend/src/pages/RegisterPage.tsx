/**
 * RegisterPage — Interactive Self-Service School Onboarding
 * Featuring:
 *  - Value Discovery / Pre-registration Overview
 *  - AI Setup Assistant with real-time speech & live ID preview card
 *  - Wide multi-column desktop layout (max-w-6xl)
 *  - Integrated School Info & ID Format configuration (with optional skip & settings indicators)
 */

import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  FaSpinner,
  FaEye,
  FaEyeSlash,
  FaBuilding,
  FaUserCheck,
  FaArrowRight,
  FaCheckCircle,
  FaRobot,
  FaIdCard,
  FaShieldAlt,
  FaGlobe,
  FaGraduationCap,
  FaRocket,
  FaInfoCircle,
  FaArrowLeft,
} from 'react-icons/fa';
import { Sparkles } from 'lucide-react';
import { authService } from '@services/authService';
import useAuthStore from '@store/authStore';
import { showToast } from '@utils/toast';

const registerSchema = z.object({
  // Step 1: School Identity
  school_name: z.string().min(2, 'School name is required'),
  school_type: z.string().default('Mixed'),
  country: z.string().default('Sierra Leone'),
  city: z.string().optional(),
  address: z.string().optional(),
  contact_phone: z.string().optional(),
  school_motto: z.string().optional(),

  // Step 2: ID Numbering & Format
  id_student_prefix: z.string().default('STU'),
  id_staff_prefix: z.string().default('TCH'),
  id_admission_prefix: z.string().default('ADM'),
  id_student_start_from: z.string().optional(),

  // Step 3: Admin Profile
  admin_first_name: z.string().min(1, 'First name is required'),
  admin_last_name: z.string().min(1, 'Last name is required'),
  contact_email: z.string().min(1, 'Email is required').email('Valid email address required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);

  // View state: 'overview' (pre-registration pitch) vs 'wizard' (form)
  const [viewMode, setViewMode] = useState<'overview' | 'wizard'>('overview');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      school_name: '',
      school_type: 'Mixed',
      country: 'Sierra Leone',
      city: '',
      address: '',
      contact_phone: '',
      school_motto: '',
      id_student_prefix: 'STU',
      id_staff_prefix: 'TCH',
      id_admission_prefix: 'ADM',
      id_student_start_from: '',
      admin_first_name: '',
      admin_last_name: '',
      contact_email: '',
      password: '',
    },
  });

  // Watch form fields for live AI reactions & live ID preview
  const watchedSchoolName = watch('school_name');
  const watchedFirstName = watch('admin_first_name');
  const watchedLastName = watch('admin_last_name');
  const watchedStudentPrefix = watch('id_student_prefix') || 'STU';
  const watchedStaffPrefix = watch('id_staff_prefix') || 'TCH';
  const watchedAdmissionPrefix = watch('id_admission_prefix') || 'ADM';
  const watchedStartFrom = watch('id_student_start_from');

  // Compute live sample student ID for preview
  const sampleStudentId = useMemo(() => {
    const year = new Date().getFullYear();
    const prefix = (watchedStudentPrefix || 'STU').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const startNum = watchedStartFrom && !isNaN(Number(watchedStartFrom)) ? Number(watchedStartFrom) : 1;
    const formattedNum = String(startNum).padStart(5, '0');
    return `${prefix}-${year}-${formattedNum}`;
  }, [watchedStudentPrefix, watchedStartFrom]);

  const sampleStaffId = useMemo(() => {
    const prefix = (watchedStaffPrefix || 'TCH').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `${prefix}-2026-001`;
  }, [watchedStaffPrefix]);

  const sampleAdmissionId = useMemo(() => {
    const prefix = (watchedAdmissionPrefix || 'ADM').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `${prefix}-2026-00001`;
  }, [watchedAdmissionPrefix]);

  // AI Assistant Speech Message Generator
  const aiMessage = useMemo(() => {
    if (step === 1) {
      if (!watchedSchoolName) {
        return "Hello! I'm WiSkul AI Assistant. Enter your official school name to get started. I'll automatically generate your private school portal link.";
      }
      return `"${watchedSchoolName}" sounds awesome! Select your school level or country. You can fill optional fields now or complete them later in Settings.`;
    }
    if (step === 2) {
      return `Great work! Now let's set up how your student, staff, and admission numbers will be generated. Look at the live preview box below to see how your IDs will look!`;
    }
    if (step === 3) {
      const nameGreeting = watchedFirstName ? `Principal ${watchedFirstName}` : 'Administrator';
      return `Almost done, ${nameGreeting}! Create your admin security credentials. Once created, your private school tenant will be provisioned instantly.`;
    }
    return "I'm here to help guide your setup!";
  }, [step, watchedSchoolName, watchedFirstName]);

  const handleNextStep1 = async () => {
    const valid = await trigger(['school_name']);
    if (valid) setStep(2);
    else showToast.warning('Please enter your school name.');
  };

  const handleNextStep2 = async () => {
    setStep(3);
  };

  const onSubmit = async (values: RegisterFormValues) => {
    setIsSubmitting(true);
    try {
      const res = await authService.registerSchool({
        ...values,
        id_student_start_from: values.id_student_start_from ? Number(values.id_student_start_from) : undefined,
      });
      if (res.success && res.data) {
        setUser(res.data.user);
        showToast.success(`Welcome to WiSkul, ${values.admin_first_name}! Your school workspace is ready.`);
        navigate('/admin/dashboard', { replace: true });
      } else {
        showToast.error(res.error || 'Failed to register school.');
      }
    } catch (err: any) {
      showToast.error(err?.response?.data?.message || err?.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden font-sans">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-cyan-500/10 to-indigo-600/10 blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tl from-purple-600/10 to-teal-500/10 blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `linear-gradient(rgba(0,212,170,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,170,0.4) 1px, transparent 1px)`,
            backgroundSize: '80px 80px',
          }}
        />
      </div>

      {/* Header Bar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto flex items-center justify-between py-2 mb-6">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <img src="/logo.png" alt="WiSkul" className="w-10 h-10 rounded-xl object-contain shadow-lg" />
          <span className="text-xl font-black tracking-tight text-white">
            Wi<span className="text-[#00d4aa]">Skul</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline-text text-xs text-gray-400">Already registered?</span>
          <Link
            to="/login"
            className="px-4 py-2 text-xs font-bold text-[#00d4aa] border border-[#00d4aa]/30 rounded-xl hover:bg-[#00d4aa]/10 transition-colors"
          >
            Sign In to Portal
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-7xl mx-auto my-auto py-4">
        {/* ── MODE 1: PRE-REGISTRATION VALUE DISCOVERY VIEW ──────────────────────────────── */}
        {viewMode === 'overview' ? (
          <div className="space-y-12 animate-fade-in py-4">
            {/* Hero Section */}
            <div className="text-center max-w-3xl mx-auto space-y-5">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#00d4aa]/10 border border-[#00d4aa]/30 text-[#00d4aa] text-xs font-bold uppercase tracking-widest shadow-inner">
                <FaRocket className="animate-pulse" /> Self-Service School Onboarding · 100% Free Launch
              </div>
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                Modern School Management, Built for Your Success
              </h1>
              <p className="text-gray-300 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
                Set up your school in less than 2 minutes. Get instant access to student directories, digital ID card generation, admissions workflows, class registers, and parent portals — free of charge.
              </p>
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setViewMode('wizard')}
                  className="w-full sm:w-auto px-8 py-4 bg-[#00d4aa] hover:bg-[#00e6b8] text-[#1a1a2e] font-black text-sm tracking-wider rounded-2xl shadow-[0_0_35px_rgba(0,212,170,0.3)] hover:scale-[1.02] transition-all flex items-center justify-center gap-3 cursor-pointer"
                >
                  START FREE SCHOOL SETUP <FaArrowRight />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/features')}
                  className="w-full sm:w-auto px-6 py-4 bg-white/5 hover:bg-white/10 text-white font-bold text-sm rounded-2xl border border-white/10 transition-colors"
                >
                  Explore All Features
                </button>
              </div>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
              <FeatureCard
                icon={<FaBuilding className="text-[#00d4aa]" />}
                title="Instant Isolated Workspace"
                desc="Your school gets a dedicated tenant space with automated student ID formatting and academic session setup."
              />
              <FeatureCard
                icon={<FaIdCard className="text-purple-400" />}
                title="Automated ID Numbering"
                desc="Customize student, staff, and admission ID prefixes (e.g. STU-2026-00001) for seamless tracking."
              />
              <FeatureCard
                icon={<FaUserCheck className="text-cyan-400" />}
                title="Admissions & Auto-Sync"
                desc="Approved admission applications automatically convert into enrolled student records and portal logins."
              />
              <FeatureCard
                icon={<FaShieldAlt className="text-[#00d4aa]" />}
                title="Multi-Role Portals"
                desc="Dedicated portals for Principals, Teachers, Students, and Parents with multi-child guardian support."
              />
            </div>

            {/* Info Notice Box */}
            <div className="bg-[#16213e]/80 border border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 max-w-4xl mx-auto backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <FaInfoCircle size={22} className="text-[#00d4aa] flex-shrink-0 mt-0.5" />
                <div className="text-xs text-gray-300 space-y-1">
                  <p className="font-bold text-white text-sm">Flexible & Easy Setup</p>
                  <p>You only need your School Name and Administrator Email to start. All secondary settings (motto, custom prefixes, address) can be filled now or adjusted anytime in School Settings.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewMode('wizard')}
                className="px-5 py-2.5 bg-[#00d4aa] text-[#1a1a2e] font-bold text-xs rounded-xl hover:bg-[#00e6b8] transition-colors whitespace-nowrap"
              >
                Proceed to Setup →
              </button>
            </div>
          </div>
        ) : (
          /* ── MODE 2: DESKTOP WIDE 2-COLUMN WIZARD FORM ──────────────────────────────── */
          <div className="w-full animate-fade-in">
            <button
              type="button"
              onClick={() => setViewMode('overview')}
              className="mb-4 text-xs font-semibold text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FaArrowLeft /> Back to Overview & Benefits
            </button>

            {/* Wide desktop container max-w-6xl */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT COLUMN: WiSkul AI Assistant Panel & Live ID Preview (4 cols) */}
              <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-6">
                {/* AI Assistant Box */}
                <div className="bg-gradient-to-b from-[#16213e] to-[#12192f] border border-[#00d4aa]/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#00d4aa]/10 rounded-full blur-xl pointer-events-none" />

                  <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl bg-[#00d4aa]/20 border border-[#00d4aa]/50 flex items-center justify-center text-[#00d4aa]">
                        <FaRobot size={20} />
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#16213e] rounded-full animate-ping" />
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#16213e] rounded-full" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                        WiSkul AI Guidance <Sparkles className="text-amber-300 w-3.5 h-3.5" />
                      </h3>
                      <p className="text-[11px] text-[#00d4aa] font-medium">Real-Time Setup Assistant</p>
                    </div>
                  </div>

                  {/* Dynamic Speech Box */}
                  <div className="bg-[#1a1a2e]/90 border border-white/10 rounded-xl p-4 text-xs text-gray-200 leading-relaxed shadow-inner">
                    <p className="italic">"{aiMessage}"</p>
                  </div>
                </div>

                {/* LIVE ID PREVIEW CARD (Responds in real-time) */}
                <div className="bg-[#16213e] border border-white/10 rounded-2xl p-5 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-300 uppercase tracking-wider">
                      <FaIdCard className="text-[#00d4aa]" /> Live ID Format Preview
                    </div>
                    <span className="text-[10px] bg-[#00d4aa]/10 text-[#00d4aa] px-2 py-0.5 rounded font-mono font-bold">
                      AUTO-FORMATTED
                    </span>
                  </div>

                  <div className="space-y-2.5 font-mono text-xs">
                    <div className="flex items-center justify-between p-2.5 bg-[#1a1a2e] rounded-xl border border-white/5">
                      <span className="text-gray-400 text-[11px]">Student ID:</span>
                      <span className="font-bold text-[#00d4aa]">{sampleStudentId}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-[#1a1a2e] rounded-xl border border-white/5">
                      <span className="text-gray-400 text-[11px]">Staff ID:</span>
                      <span className="font-bold text-purple-300">{sampleStaffId}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-[#1a1a2e] rounded-xl border border-white/5">
                      <span className="text-gray-400 text-[11px]">Admission No:</span>
                      <span className="font-bold text-cyan-300">{sampleAdmissionId}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-400 pt-1 leading-snug">
                    <span className="text-amber-300 font-bold">Tip:</span> All ID prefixes and sequence counters can also be fine-tuned later in your <span className="text-white font-semibold">School Settings</span>.
                  </p>
                </div>
              </div>

              {/* RIGHT COLUMN: 3-Step Setup Form (8 cols) */}
              <div className="lg:col-span-8">
                <div className="relative">
                  <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-br from-[#00d4aa]/40 via-[#7c3aed]/20 to-[#00d4aa]/10 opacity-70 blur-[1px]" />

                  <div className="relative bg-[#16213e] border border-white/[0.08] rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6">
                    {/* Stepper Header */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-5">
                      <StepIndicator current={step} step={1} label="School Identity" />
                      <div className="h-[1px] flex-1 mx-3 bg-white/10" />
                      <StepIndicator current={step} step={2} label="ID Numbering" />
                      <div className="h-[1px] flex-1 mx-3 bg-white/10" />
                      <StepIndicator current={step} step={3} label="Admin Account" />
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                      {/* ── STEP 1: SCHOOL IDENTITY & DETAILS ─────────────────────────────────── */}
                      {step === 1 && (
                        <div className="space-y-5 animate-fade-in">
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                              <FaBuilding className="text-[#00d4aa]" /> Step 1: School Profile & Identity
                            </h2>
                          </div>

                          {/* School Name */}
                          <div>
                            <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                              Official School Name <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="text"
                              {...register('school_name')}
                              placeholder="e.g. Sierra Leone Grammar School"
                              className="w-full bg-[#1a1a2e] border border-white/10 focus:border-[#00d4aa]/50 focus:ring-2 focus:ring-[#00d4aa]/20 rounded-xl px-4 py-3.5 text-sm text-white placeholder-gray-600 outline-none transition-all"
                            />
                            {errors.school_name && (
                              <p className="mt-1.5 text-xs text-red-400">{errors.school_name.message}</p>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* School Type */}
                            <div>
                              <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                                School Level / Category
                              </label>
                              <select
                                {...register('school_type')}
                                className="w-full bg-[#1a1a2e] border border-white/10 focus:border-[#00d4aa]/50 rounded-xl px-4 py-3.5 text-sm text-white outline-none cursor-pointer"
                              >
                                <option value="Secondary">Secondary / High School</option>
                                <option value="Primary">Primary / Elementary</option>
                                <option value="Mixed">Mixed (Primary & Secondary K-12)</option>
                                <option value="College">College / Technical Institute</option>
                              </select>
                            </div>

                            {/* Country */}
                            <div>
                              <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                                Country
                              </label>
                              <input
                                type="text"
                                {...register('country')}
                                placeholder="Sierra Leone"
                                className="w-full bg-[#1a1a2e] border border-white/10 focus:border-[#00d4aa]/50 rounded-xl px-4 py-3.5 text-sm text-white placeholder-gray-600 outline-none transition-all"
                              />
                            </div>
                          </div>

                          {/* Optional Fields Accordion / Box */}
                          <div className="p-4 bg-[#1a1a2e]/60 border border-white/5 rounded-2xl space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-[#00d4aa] uppercase tracking-wider flex items-center gap-1.5">
                                <FaGraduationCap /> Optional Profile Details
                              </span>
                              <span className="text-[10px] text-gray-400 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10">
                                Can also complete later in Settings
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[11px] font-semibold text-gray-400 mb-1">City / Town</label>
                                <input
                                  type="text"
                                  {...register('city')}
                                  placeholder="e.g. Freetown"
                                  className="w-full bg-[#16213e] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-gray-400 mb-1">Contact Phone</label>
                                <input
                                  type="tel"
                                  {...register('contact_phone')}
                                  placeholder="+232 XX XXX XXX"
                                  className="w-full bg-[#16213e] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-gray-400 mb-1">School Motto / Tagline</label>
                              <input
                                type="text"
                                {...register('school_motto')}
                                placeholder="e.g. Disce Aut Discede (Learn or Depart)"
                                className="w-full bg-[#16213e] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 outline-none"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={handleNextStep1}
                            className="w-full mt-4 bg-[#00d4aa] hover:bg-[#00e6b8] text-[#1a1a2e] font-black text-sm tracking-wider py-4 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-[0_0_25px_rgba(0,212,170,0.25)]"
                          >
                            CONTINUE TO ID FORMATTING <FaArrowRight />
                          </button>
                        </div>
                      )}

                      {/* ── STEP 2: ID FORMATTING & NUMBERING ───────────────────────────────── */}
                      {step === 2 && (
                        <div className="space-y-5 animate-fade-in">
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                              <FaIdCard className="text-[#00d4aa]" /> Step 2: Student & Staff ID Numbering Format
                            </h2>
                            <button
                              type="button"
                              onClick={() => setStep(1)}
                              className="text-xs text-gray-400 hover:text-white"
                            >
                              ← Back
                            </button>
                          </div>

                          <p className="text-xs text-gray-300">
                            Configure how your student admission numbers and staff IDs will be automatically formatted when new records are added.
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                                Student ID Prefix
                              </label>
                              <input
                                type="text"
                                {...register('id_student_prefix')}
                                placeholder="e.g. STU or AGA"
                                maxLength={6}
                                className="w-full bg-[#1a1a2e] border border-white/10 focus:border-[#00d4aa]/50 rounded-xl px-4 py-3.5 text-sm text-white font-mono uppercase placeholder-gray-600 outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                                Staff ID Prefix
                              </label>
                              <input
                                type="text"
                                {...register('id_staff_prefix')}
                                placeholder="e.g. TCH"
                                maxLength={6}
                                className="w-full bg-[#1a1a2e] border border-white/10 focus:border-[#00d4aa]/50 rounded-xl px-4 py-3.5 text-sm text-white font-mono uppercase placeholder-gray-600 outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                                Admission Prefix
                              </label>
                              <input
                                type="text"
                                {...register('id_admission_prefix')}
                                placeholder="e.g. ADM"
                                maxLength={6}
                                className="w-full bg-[#1a1a2e] border border-white/10 focus:border-[#00d4aa]/50 rounded-xl px-4 py-3.5 text-sm text-white font-mono uppercase placeholder-gray-600 outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                              Student ID Starting Number (Optional)
                            </label>
                            <input
                              type="number"
                              {...register('id_student_start_from')}
                              placeholder="e.g. 1001 (Leave blank to start from 00001)"
                              className="w-full bg-[#1a1a2e] border border-white/10 focus:border-[#00d4aa]/50 rounded-xl px-4 py-3.5 text-sm text-white font-mono placeholder-gray-600 outline-none"
                            />
                            <p className="text-[11px] text-gray-400 mt-1">
                              If transferring existing student records, enter the last allocated number so WiSkul continues seamlessly from there.
                            </p>
                          </div>

                          <div className="p-3.5 bg-[#00d4aa]/10 border border-[#00d4aa]/20 rounded-xl text-xs text-[#00d4aa] flex items-center gap-2">
                            <FaCheckCircle />
                            <span>You can also change ID formats or add school logos anytime under <strong>Settings → School Info</strong>.</span>
                          </div>

                          <div className="flex items-center gap-3 pt-2">
                            <button
                              type="button"
                              onClick={() => setStep(1)}
                              className="w-1/3 py-4 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-2xl border border-white/10"
                            >
                              Back
                            </button>
                            <button
                              type="button"
                              onClick={handleNextStep2}
                              className="w-2/3 py-4 bg-[#00d4aa] hover:bg-[#00e6b8] text-[#1a1a2e] font-black text-sm tracking-wider rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                            >
                              CONTINUE TO ADMIN ACCOUNT <FaArrowRight />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── STEP 3: ADMINISTRATOR ACCOUNT & SECURITY ─────────────────────────── */}
                      {step === 3 && (
                        <div className="space-y-5 animate-fade-in">
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                              <FaUserCheck className="text-[#00d4aa]" /> Step 3: Administrator Credentials
                            </h2>
                            <button
                              type="button"
                              onClick={() => setStep(2)}
                              className="text-xs text-gray-400 hover:text-white"
                            >
                              ← Back
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                                First Name <span className="text-red-400">*</span>
                              </label>
                              <input
                                type="text"
                                {...register('admin_first_name')}
                                placeholder="e.g. Joseph"
                                className="w-full bg-[#1a1a2e] border border-white/10 focus:border-[#00d4aa]/50 rounded-xl px-4 py-3.5 text-sm text-white placeholder-gray-600 outline-none"
                              />
                              {errors.admin_first_name && <p className="mt-1 text-xs text-red-400">{errors.admin_first_name.message}</p>}
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                                Last Name <span className="text-red-400">*</span>
                              </label>
                              <input
                                type="text"
                                {...register('admin_last_name')}
                                placeholder="e.g. Kamara"
                                className="w-full bg-[#1a1a2e] border border-white/10 focus:border-[#00d4aa]/50 rounded-xl px-4 py-3.5 text-sm text-white placeholder-gray-600 outline-none"
                              />
                              {errors.admin_last_name && <p className="mt-1 text-xs text-red-400">{errors.admin_last_name.message}</p>}
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                              Official Work Email <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="email"
                              {...register('contact_email')}
                              placeholder="principal@school.edu.sl"
                              className="w-full bg-[#1a1a2e] border border-white/10 focus:border-[#00d4aa]/50 rounded-xl px-4 py-3.5 text-sm text-white placeholder-gray-600 outline-none"
                            />
                            {errors.contact_email && <p className="mt-1 text-xs text-red-400">{errors.contact_email.message}</p>}
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                              Password <span className="text-red-400">*</span>
                            </label>
                            <div className="relative">
                              <input
                                type={showPassword ? 'text' : 'password'}
                                {...register('password')}
                                placeholder="At least 8 characters (letters, numbers, symbols)"
                                className="w-full bg-[#1a1a2e] border border-white/10 focus:border-[#00d4aa]/50 rounded-xl px-4 py-3.5 pr-12 text-sm text-white placeholder-gray-600 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-[#00d4aa] transition-colors"
                              >
                                {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                              </button>
                            </div>
                            {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
                          </div>

                          <div className="flex items-center gap-3 pt-2">
                            <button
                              type="button"
                              onClick={() => setStep(2)}
                              className="w-1/3 py-4 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-2xl border border-white/10"
                            >
                              Back
                            </button>
                            <button
                              type="submit"
                              disabled={isSubmitting}
                              className="w-2/3 py-4 bg-[#00d4aa] hover:bg-[#00e6b8] text-[#1a1a2e] font-black text-sm tracking-wider rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_30px_rgba(0,212,170,0.3)] disabled:opacity-50"
                            >
                              {isSubmitting ? <FaSpinner className="animate-spin" /> : <FaRocket />}
                              {isSubmitting ? 'CREATING WORKSPACE...' : 'CREATE FREE SCHOOL ACCOUNT'}
                            </button>
                          </div>
                        </div>
                      )}
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto text-center py-4 border-t border-white/5 mt-8">
        <p className="text-[11px] text-gray-500">
          © {new Date().getFullYear()} WiSkul School Management System · 100% Free Public Launch Edition
        </p>
      </footer>

      {/* Custom Styles */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out both; }
      `}</style>
    </div>
  );
};

// Sub-components
const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; desc: string }> = ({ icon, title, desc }) => (
  <div className="bg-[#16213e]/90 border border-white/10 rounded-2xl p-5 space-y-2 hover:border-[#00d4aa]/40 transition-all duration-300 backdrop-blur-sm group hover:-translate-y-1">
    <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">{icon}</div>
    <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
    <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
  </div>
);

const StepIndicator: React.FC<{ current: number; step: number; label: string }> = ({ current, step, label }) => (
  <div className="flex items-center gap-2">
    <span
      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
        current === step
          ? 'bg-[#00d4aa] text-[#1a1a2e]'
          : current > step
          ? 'bg-[#00d4aa]/20 text-[#00d4aa]'
          : 'bg-white/10 text-gray-400'
      }`}
    >
      {current > step ? <FaCheckCircle size={14} /> : step}
    </span>
    <span className={`text-xs font-bold hidden sm:inline ${current === step ? 'text-white' : 'text-gray-400'}`}>
      {label}
    </span>
  </div>
);

export default RegisterPage;
