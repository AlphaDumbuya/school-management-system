/**
 * RegisterPage — Interactive Self-Service School Onboarding (v1.0.0 Release)
 * Featuring:
 *  - Value Discovery / Pre-registration Overview Mode
 *  - AI Setup Assistant with dynamic speech & live summary card
 *  - Wide multi-column desktop layout (max-w-6xl)
 *  - International School Configuration & Capacity fields from Settings
 *  - Official Consent Declaration & Terms Acceptance
 *  - Automated Welcome Email dispatch upon registration
 */

import React, { useState, useEffect } from 'react';
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
  FaShieldAlt,
  FaGlobe,
  FaGraduationCap,
  FaRocket,
  FaInfoCircle,
  FaArrowLeft,
  FaFileContract,
  FaCheckSquare,
  FaSquare,
} from 'react-icons/fa';
import { authService } from '@services/authService';
import useAuthStore from '@store/authStore';
import { showToast } from '@utils/toast';
import { toast } from 'react-toastify';

const registerSchema = z.object({
  // Step 1: School Profile & Ownership
  school_name: z.string().min(2, 'Official school name is required'),
  school_type: z.string().default('Secondary (JSS & SSS)'),
  school_ownership: z.string().default('Government-Assisted / Mission'),
  country: z.string().default('Sierra Leone'),

  // Step 2: Configuration & Capacity (Settings Fields)
  estimated_students: z.string().default('250-500'),
  curriculum: z.string().default('WASSCE / National'),
  emis_number: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  contact_phone: z.string().optional(),
  school_motto: z.string().optional(),

  // Step 3: Admin Credentials & Legal Consent
  admin_first_name: z.string().min(1, 'First name is required'),
  admin_last_name: z.string().min(1, 'Last name is required'),
  contact_email: z.string().min(1, 'Work email is required').email('Valid email address required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  consent_accepted: z.boolean().refine((val) => val === true, {
    message: 'You must accept the institutional authorization and Terms of Service to register.',
  }),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);

  // View state: 'overview' (pre-registration value discovery) vs 'wizard' (onboarding form)
  const [viewMode, setViewMode] = useState<'overview' | 'wizard'>('overview');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      school_name: '',
      school_type: 'Secondary (JSS & SSS)',
      school_ownership: 'Government-Assisted / Mission',
      country: 'Sierra Leone',
      estimated_students: '250-500',
      curriculum: 'WASSCE / National',
      emis_number: '',
      city: '',
      address: '',
      contact_phone: '',
      school_motto: '',
      admin_first_name: '',
      admin_last_name: '',
      contact_email: '',
      password: '',
      consent_accepted: false,
    },
  });

  // Watch fields for live AI reactions & Summary Card
  const watchedSchoolName = watch('school_name');
  const watchedSchoolType = watch('school_type');
  const watchedOwnership = watch('school_ownership');
  const watchedFirstName = watch('admin_first_name');
  const watchedLastName = watch('admin_last_name');
  const watchedCurriculum = watch('curriculum');
  const watchedConsent = watch('consent_accepted');

  // Contextual guidance surfaced as a subtle toast on each step change.
  // Longer autoClose (10s) so users have time to read the guidance.
  useEffect(() => {
    if (step === 2) {
      toast.info('Step 2 — Configure your capacity & curriculum. Optional fields (EMIS number, motto) can be updated anytime in School Settings.', {
        autoClose: 10000,
        position: 'top-right',
        toastId: 'register-step-2',
      });
    } else if (step === 3) {
      toast.info('Final step — Set your admin email and password, then accept the consent to finish. A welcome email will be sent to your inbox.', {
        autoClose: 10000,
        position: 'top-right',
        toastId: 'register-step-3',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handleNextStep1 = async () => {
    const valid = await trigger(['school_name']);
    if (valid) setStep(2);
    else showToast.warning('Please enter your official school name.');
  };

  const handleNextStep2 = async () => {
    setStep(3);
  };

  const onSubmit = async (values: RegisterFormValues) => {
    setIsSubmitting(true);
    try {
      const res = await authService.registerSchool({
        school_name: values.school_name,
        contact_email: values.contact_email,
        contact_phone: values.contact_phone,
        country: values.country,
        city: values.city,
        address: values.address,
        school_type: values.school_type,
        school_motto: values.school_motto,
        admin_first_name: values.admin_first_name,
        admin_last_name: values.admin_last_name,
        password: values.password,
      });

      if (res.success && res.data) {
        setUser(res.data.user);
        showToast.success(`Welcome to WiSkul! A confirmation email has been dispatched to ${values.contact_email}.`);
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
    <div className="min-h-screen bg-[#0b1234] text-white flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden font-sans">
      {/* Layered background: artwork image + depth gradients + accent glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Data-cube artwork, fixed for depth — kept fairly clear */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-80"
          style={{ backgroundImage: 'url(/login.jpg)', backgroundAttachment: 'fixed' }}
        />
        {/* Light gradient so content stays readable while the image shows through */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b1234]/55 via-[#141a4a]/45 to-[#0b1234]/70" />
        {/* Warm accent glow behind the hero for contrast */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-amber-400/10 blur-[130px]" />
        <div className="auth-blob-1 absolute bottom-[-15%] right-[-10%] w-[560px] h-[560px] rounded-full bg-[#2563eb]/20 blur-[130px]" />
        {/* Fine dot grid for tech texture */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)', backgroundSize: '26px 26px' }}
        />
      </div>

      {/* Header Bar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto flex items-center justify-between py-2 mb-6">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <img src="/logo.png" alt="WiSkul" className="w-10 h-10 rounded-xl object-contain shadow-lg" />
          <span className="text-xl font-black tracking-tight text-white">
            Wi<span className="text-amber-400">Skul</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-xs text-gray-400">Already registered?</span>
          <Link
            to="/login"
            className="px-4 py-2 text-xs font-bold text-amber-400 border border-amber-400/30 rounded-xl hover:bg-amber-400/10 transition-colors"
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
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400 text-xs font-bold uppercase tracking-widest shadow-inner">
                <FaRocket className="animate-pulse" /> Self-Service School Onboarding · 100% Free Core Release
              </div>
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                Empower Your Institution with Modern Cloud Management
              </h1>
              <p className="text-gray-300 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
                Join schools across Sierra Leone and globally. Provision your private school workspace in under 2 minutes with zero upfront costs. Core v1.0 features remain free to help your school thrive.
              </p>
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setViewMode('wizard')}
                  className="w-full sm:w-auto px-8 py-4 bg-[#f59e0b] hover:bg-[#d97706] text-white font-black text-sm tracking-wider rounded-2xl shadow-[0_0_35px_rgba(245,158,11,0.3)] hover:scale-[1.02] transition-all flex items-center justify-center gap-3 cursor-pointer"
                >
                  BEGIN SCHOOL REGISTRATION <FaArrowRight />
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
                icon={<FaBuilding className="text-amber-400" />}
                title="Instant School Tenant"
                desc="Automated creation of your isolated school database, current academic session, and principal credentials."
              />
              <FeatureCard
                icon={<FaGraduationCap className="text-purple-400" />}
                title="Sierra Leone & Global Curricula"
                desc="Pre-configured support for WASSCE, BECE, IGCSE, and customized Sierra Leone academic grading scales."
              />
              <FeatureCard
                icon={<FaUserCheck className="text-cyan-400" />}
                title="Digital ID Cards & Admissions"
                desc="Automatic enrollment conversion upon application approval and batch digital ID card generation."
              />
              <FeatureCard
                icon={<FaShieldAlt className="text-amber-400" />}
                title="Verified Portal Security"
                desc="Multi-guardian account linking, student portal logins, and role-based permissions for staff."
              />
            </div>

            {/* Info Notice Box */}
            <div className="bg-[#20308a]/80 border border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 max-w-4xl mx-auto backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <FaInfoCircle size={22} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-gray-300 space-y-1">
                  <p className="font-bold text-white text-sm">Free Core Release Policy</p>
                  <p>All core management features in v1.0.0 (Admissions, Attendance, ID Cards, Staff, Portals) are free. Optional settings (motto, EMIS registration number, address) can be completed now or updated anytime in School Settings.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewMode('wizard')}
                className="px-5 py-2.5 bg-[#f59e0b] text-white font-bold text-xs rounded-xl hover:bg-[#1e40af] transition-colors whitespace-nowrap"
              >
                Start Setup →
              </button>
            </div>
          </div>
        ) : (
          /* ── MODE 2: DESKTOP WIDE 2-COLUMN WIZARD FORM (max-w-6xl) ───────────────────────── */
          <div className="w-full animate-fade-in">
            <button
              type="button"
              onClick={() => setViewMode('overview')}
              className="mb-4 text-xs font-semibold text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FaArrowLeft /> Back to Overview & Benefits
            </button>

            {/* Wide desktop grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT COLUMN: Workspace Summary (4 cols) */}
              <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-6">
                {/* WORKSPACE PREVIEW CARD */}
                <div className="bg-[#16235c]/85 backdrop-blur-2xl border border-white/15 rounded-2xl p-5 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-300 uppercase tracking-wider">
                      <FaBuilding className="text-amber-400" /> Workspace Summary
                    </div>
                    <span className="text-[10px] bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded font-mono font-bold">
                      FREE TIER
                    </span>
                  </div>

                  <div className="space-y-2 font-mono text-xs">
                    <div className="flex items-center justify-between p-2 bg-white/10 rounded-lg">
                      <span className="text-gray-400 text-[11px]">School:</span>
                      <span className="font-bold text-white truncate max-w-[170px]">
                        {watchedSchoolName || 'Not Specified'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-white/10 rounded-lg">
                      <span className="text-gray-400 text-[11px]">Category:</span>
                      <span className="font-bold text-purple-300">{watchedOwnership} · {watchedSchoolType}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-white/10 rounded-lg">
                      <span className="text-gray-400 text-[11px]">Curriculum:</span>
                      <span className="font-bold text-cyan-300">{watchedCurriculum}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-400 pt-1 leading-snug">
                    <span className="text-amber-300 font-bold">Note:</span> After registration, an official welcome email containing your portal details will be dispatched to your inbox.
                  </p>
                </div>
              </div>

              {/* RIGHT COLUMN: 3-Step Setup Form (8 cols) */}
              <div className="lg:col-span-8">
                <div className="relative">
                  <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-br from-amber-400/40 via-[#1d4ed8]/20 to-amber-400/10 opacity-70 blur-[1px]" />

                  <div className="relative bg-[#20308a]/40 backdrop-blur-2xl border border-white/[0.12] rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6">
                    {/* Stepper Header */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-5">
                      <StepIndicator current={step} step={1} label="School Identity" />
                      <div className="h-[1px] flex-1 mx-3 bg-white/10" />
                      <StepIndicator current={step} step={2} label="School Profile" />
                      <div className="h-[1px] flex-1 mx-3 bg-white/10" />
                      <StepIndicator current={step} step={3} label="Admin & Consent" />
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                      {/* ── STEP 1: SCHOOL IDENTITY & OWNERSHIP ───────────────────────────── */}
                      {step === 1 && (
                        <div className="space-y-5 animate-fade-in">
                          <div className="border-b border-white/5 pb-2">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                              <FaBuilding className="text-amber-400" /> Step 1: Institutional Identity
                            </h2>
                            <p className="text-xs text-gray-400 mt-1">Enter your school's official designation and location.</p>
                          </div>

                          {/* Official School Name */}
                          <div>
                            <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                              Official School Name <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="text"
                              {...register('school_name')}
                              placeholder="e.g. St. Joseph's Secondary School"
                              className="w-full bg-white/10 border border-white/10 focus:border-amber-400/50 focus:ring-2 focus:ring-[#1d4ed8]/20 rounded-xl px-4 py-3.5 text-sm text-white placeholder-white/70 outline-none transition-all"
                            />
                            {errors.school_name && (
                              <p className="mt-1.5 text-xs text-red-400">{errors.school_name.message}</p>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* School Ownership */}
                            <div>
                              <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                                Ownership / Category
                              </label>
                              <select
                                {...register('school_ownership')}
                                className="w-full bg-[#16235c] border border-white/15 focus:border-amber-400/50 rounded-xl px-4 py-3.5 text-sm text-white outline-none cursor-pointer [&>option]:bg-[#16235c] [&>option]:text-white"
                              >
                                <option value="Government-Assisted / Mission">Government-Assisted / Mission School</option>
                                <option value="Government School">Government School (Public)</option>
                                <option value="Private Independent">Private Independent School</option>
                                <option value="Private International">Private International School</option>
                                <option value="Community School">Community / Chiefdom School</option>
                                <option value="Municipal / Council">Municipal / Local Council School</option>
                              </select>
                            </div>

                            {/* School Type */}
                            <div>
                              <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                                School Level
                              </label>
                              <select
                                {...register('school_type')}
                                className="w-full bg-[#16235c] border border-white/15 focus:border-amber-400/50 rounded-xl px-4 py-3.5 text-sm text-white outline-none cursor-pointer [&>option]:bg-[#16235c] [&>option]:text-white"
                              >
                                <option value="Secondary (JSS & SSS)">Secondary School (JSS & SSS)</option>
                                <option value="Primary">Primary School (Class 1 – Class 6)</option>
                                <option value="Nursery & Primary">Nursery & Primary School (Combined)</option>
                                <option value="Nursery / Early Childhood">Nursery / Early Childhood (Pre-School)</option>
                                <option value="Junior Secondary">Junior Secondary School (JSS 1 – JSS 3)</option>
                                <option value="Senior Secondary">Senior Secondary School (SSS 1 – SSS 3)</option>
                                <option value="Primary & Secondary">Primary & Secondary (Full K-12)</option>
                                <option value="Technical & Vocational">Technical & Vocational Institute / College</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                              Country
                            </label>
                            <input
                              type="text"
                              {...register('country')}
                              placeholder="Sierra Leone"
                              className="w-full bg-white/10 border border-white/10 focus:border-amber-400/50 rounded-xl px-4 py-3.5 text-sm text-white placeholder-white/70 outline-none"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={handleNextStep1}
                            className="w-full mt-4 bg-[#f59e0b] hover:bg-[#d97706] text-white font-black text-sm tracking-wider py-4 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-[0_0_25px_rgba(0,212,170,0.25)]"
                          >
                            CONTINUE TO SCHOOL PROFILE <FaArrowRight />
                          </button>
                        </div>
                      )}

                      {/* ── STEP 2: SCHOOL PROFILE & CAPACITY (SETTINGS FIELDS) ──────────────── */}
                      {step === 2 && (
                        <div className="space-y-5 animate-fade-in">
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <div>
                              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <FaGraduationCap className="text-amber-400" /> Step 2: Configuration & Capacity
                              </h2>
                              <p className="text-xs text-gray-400 mt-1">Specify your curriculum and student enrollment range.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setStep(1)}
                              className="text-xs text-gray-400 hover:text-white"
                            >
                              ← Back
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Estimated Capacity */}
                            <div>
                              <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                                Estimated Student Capacity
                              </label>
                              <select
                                {...register('estimated_students')}
                                className="w-full bg-[#16235c] border border-white/15 focus:border-amber-400/50 rounded-xl px-4 py-3.5 text-sm text-white outline-none cursor-pointer [&>option]:bg-[#16235c] [&>option]:text-white"
                              >
                                <option value="1-250">1 – 250 Students</option>
                                <option value="250-500">250 – 500 Students</option>
                                <option value="500-1000">500 – 1,000 Students</option>
                                <option value="1000+">1,000+ Students</option>
                              </select>
                            </div>

                            {/* Curriculum System */}
                            <div>
                              <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                                Curriculum System
                              </label>
                              <select
                                {...register('curriculum')}
                                className="w-full bg-[#16235c] border border-white/15 focus:border-amber-400/50 rounded-xl px-4 py-3.5 text-sm text-white outline-none cursor-pointer [&>option]:bg-[#16235c] [&>option]:text-white"
                              >
                                <option value="WASSCE / National">WASSCE / National Curriculum</option>
                                <option value="IGCSE / British">IGCSE / British Curriculum</option>
                                <option value="Dual / Combined">Dual / Combined Systems</option>
                                <option value="Other">Other National Standard</option>
                              </select>
                            </div>
                          </div>

                          {/* Optional Profile Section */}
                          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                                <FaBuilding /> Additional Details (Optional)
                              </span>
                              <span className="text-[10px] text-gray-400 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10">
                                Editable in Settings → School Info
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[11px] font-semibold text-gray-400 mb-1">EMIS / Registration Number</label>
                                <input
                                  type="text"
                                  {...register('emis_number')}
                                  placeholder="e.g. MEST/SL/2026/04"
                                  className="w-full bg-white/10 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/70 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-gray-400 mb-1">City / Town</label>
                                <input
                                  type="text"
                                  {...register('city')}
                                  placeholder="e.g. Freetown"
                                  className="w-full bg-white/10 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/70 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-gray-400 mb-1">School Motto / Tagline</label>
                              <input
                                type="text"
                                {...register('school_motto')}
                                placeholder="e.g. Disce Aut Discede (Learn or Depart)"
                                className="w-full bg-white/10 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/70 outline-none"
                              />
                            </div>
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
                              className="w-2/3 py-4 bg-[#f59e0b] hover:bg-[#d97706] text-white font-black text-sm tracking-wider rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                            >
                              CONTINUE TO ADMIN ACCOUNT <FaArrowRight />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── STEP 3: ADMINISTRATOR PROFILE, SECURITY & CONSENT DECLARATION ──── */}
                      {step === 3 && (
                        <div className="space-y-5 animate-fade-in">
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <div>
                              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <FaUserCheck className="text-amber-400" /> Step 3: Admin Credentials & Authorization
                              </h2>
                              <p className="text-xs text-gray-400 mt-1">Set up your principal login details and sign legal declaration.</p>
                            </div>
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
                                className="w-full bg-white/10 border border-white/10 focus:border-amber-400/50 rounded-xl px-4 py-3.5 text-sm text-white placeholder-white/70 outline-none"
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
                                className="w-full bg-white/10 border border-white/10 focus:border-amber-400/50 rounded-xl px-4 py-3.5 text-sm text-white placeholder-white/70 outline-none"
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
                              placeholder="principal@stjoseph.edu.sl"
                              className="w-full bg-white/10 border border-white/10 focus:border-amber-400/50 rounded-xl px-4 py-3.5 text-sm text-white placeholder-white/70 outline-none"
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
                                placeholder="At least 8 characters"
                                className="w-full bg-white/10 border border-white/10 focus:border-amber-400/50 rounded-xl px-4 py-3.5 pr-12 text-sm text-white placeholder-white/70 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-amber-400 transition-colors"
                              >
                                {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                              </button>
                            </div>
                            {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
                          </div>

                          {/* CONSENT & AUTHORIZATION DECLARATION CHECKBOX */}
                          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                            <label className="flex items-start gap-3 cursor-pointer select-none">
                              <button
                                type="button"
                                onClick={() => setValue('consent_accepted', !watchedConsent, { shouldValidate: true })}
                                className="mt-0.5 text-amber-400 hover:scale-110 transition-transform"
                              >
                                {watchedConsent ? <FaCheckSquare size={18} /> : <FaSquare size={18} className="text-gray-500" />}
                              </button>
                              <span className="text-xs text-gray-300 leading-relaxed">
                                <strong className="text-white">Authorization Declaration:</strong> I confirm that I am an authorized principal or legal representative of <strong>{watchedSchoolName || 'this school'}</strong>, and I agree to the <Link to="/terms" className="text-amber-400 underline" target="_blank">WiSkul Terms of Service</Link> and <Link to="/privacy" className="text-amber-400 underline" target="_blank">Privacy Policy</Link>.
                              </span>
                            </label>
                            {errors.consent_accepted && (
                              <p className="text-xs text-red-400 font-semibold">{errors.consent_accepted.message}</p>
                            )}
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
                              className="w-2/3 py-4 bg-[#f59e0b] hover:bg-[#d97706] text-white font-black text-sm tracking-wider rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_30px_rgba(245,158,11,0.3)] disabled:opacity-50"
                            >
                              {isSubmitting ? <FaSpinner className="animate-spin" /> : <FaRocket />}
                              {isSubmitting ? 'PROVISIONING SCHOOL...' : 'CREATE FREE SCHOOL WORKSPACE'}
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
  <div className="bg-[#20308a]/90 border border-white/10 rounded-2xl p-5 space-y-2 hover:border-[#1d4ed8]/40 transition-all duration-300 backdrop-blur-sm group hover:-translate-y-1">
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
          ? 'bg-[#f59e0b] text-white'
          : current > step
          ? 'bg-amber-400/20 text-amber-400'
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
