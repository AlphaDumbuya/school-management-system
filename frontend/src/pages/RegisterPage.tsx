/**
 * RegisterPage — Self-Service School Registration
 * Allows school principals/owners to register their institution for free.
 * Dark cyber design matching LoginPage and LandingPage.
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FaSpinner, FaEye, FaEyeSlash, FaBuilding, FaUserCheck, FaArrowRight, FaCheckCircle } from 'react-icons/fa';
import { authService } from '@services/authService';
import useAuthStore from '@store/authStore';
import { showToast } from '@utils/toast';

const registerSchema = z.object({
  school_name: z.string().min(2, 'School name is required'),
  country: z.string().optional(),
  contact_phone: z.string().optional(),
  admin_first_name: z.string().min(1, 'First name is required'),
  admin_last_name: z.string().min(1, 'Last name is required'),
  contact_email: z.string().min(1, 'Email is required').email('Valid email address required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [step, setStep] = useState<1 | 2>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      school_name: '',
      country: 'Sierra Leone',
      contact_phone: '',
      admin_first_name: '',
      admin_last_name: '',
      contact_email: '',
      password: '',
    },
  });

  const handleNextStep = async () => {
    const valid = await trigger(['school_name']);
    if (valid) {
      setStep(2);
    }
  };

  const onSubmit = async (values: RegisterFormValues) => {
    setIsSubmitting(true);
    try {
      const res = await authService.registerSchool(values);
      if (res.success && res.data) {
        setUser(res.data.user);
        showToast.success('School registered successfully! Welcome to your dashboard.');
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
    <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-15%] right-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-600/8 blur-[120px]" />
        <div className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] rounded-full bg-purple-500/8 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(0,212,170,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,170,0.4) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-lg flex flex-col items-center">
        {/* Brand */}
        <div className="text-center mb-6 cursor-pointer" onClick={() => navigate('/')}>
          <img src="/logo.png" alt="WiSkul" className="w-12 h-12 mx-auto mb-2 rounded-xl object-contain" />
          <h1 className="text-2xl font-black text-white tracking-tight">
            Wi<span className="text-[#00d4aa]">Skul</span>
          </h1>
          <p className="text-gray-400 text-xs mt-1">Register Your School — 100% Free for Launch</p>
        </div>

        {/* Wizard Card */}
        <div className="w-full relative">
          <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-[#00d4aa]/40 via-[#7c3aed]/20 to-[#00d4aa]/10 opacity-70 blur-[1px]" />

          <div className="relative bg-[#16213e] border border-white/[0.08] rounded-2xl p-7 sm:p-9 shadow-2xl">
            {/* Step Progress Indicator */}
            <div className="flex items-center justify-between mb-8 border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-2">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    step === 1 ? 'bg-[#00d4aa] text-[#1a1a2e]' : 'bg-[#00d4aa]/20 text-[#00d4aa]'
                  }`}
                >
                  {step > 1 ? <FaCheckCircle size={14} /> : '1'}
                </span>
                <span className={`text-xs font-bold ${step === 1 ? 'text-white' : 'text-gray-400'}`}>School Info</span>
              </div>
              <div className="h-[1px] w-12 bg-white/[0.1]" />
              <div className="flex items-center gap-2">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    step === 2 ? 'bg-[#00d4aa] text-[#1a1a2e]' : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  2
                </span>
                <span className={`text-xs font-bold ${step === 2 ? 'text-white' : 'text-gray-400'}`}>Admin Account</span>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
              {/* STEP 1: School Information */}
              {step === 1 && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-center gap-2 text-[#00d4aa] text-xs font-bold uppercase tracking-wider mb-1">
                    <FaBuilding /> School Details
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                      School Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      {...register('school_name')}
                      placeholder="e.g. St. Joseph's Secondary School"
                      className="w-full bg-[#1a1a2e] border border-white/[0.08] focus:border-[#00d4aa]/50 focus:ring-1 focus:ring-[#00d4aa]/20 rounded-xl px-4 py-3.5 text-sm text-white placeholder-gray-600 outline-none transition-all"
                    />
                    {errors.school_name && <p className="mt-1 text-xs text-red-400">{errors.school_name.message}</p>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">Country</label>
                      <input
                        type="text"
                        {...register('country')}
                        placeholder="Sierra Leone"
                        className="w-full bg-[#1a1a2e] border border-white/[0.08] focus:border-[#00d4aa]/50 focus:ring-1 focus:ring-[#00d4aa]/20 rounded-xl px-4 py-3.5 text-sm text-white placeholder-gray-600 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">Phone (Optional)</label>
                      <input
                        type="tel"
                        {...register('contact_phone')}
                        placeholder="+232 XX XXX XXX"
                        className="w-full bg-[#1a1a2e] border border-white/[0.08] focus:border-[#00d4aa]/50 focus:ring-1 focus:ring-[#00d4aa]/20 rounded-xl px-4 py-3.5 text-sm text-white placeholder-gray-600 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="w-full mt-4 bg-[#00d4aa] hover:bg-[#00e6b8] text-[#1a1a2e] font-black text-sm tracking-[0.1em] py-3.5 rounded-xl transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    CONTINUE TO ADMIN ACCOUNT <FaArrowRight />
                  </button>
                </div>
              )}

              {/* STEP 2: Administrator Profile & Password */}
              {step === 2 && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 text-[#00d4aa] text-xs font-bold uppercase tracking-wider">
                      <FaUserCheck /> Administrator Profile
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-xs text-gray-400 hover:text-white transition-colors"
                    >
                      ← Edit School Info
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                        First Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        {...register('admin_first_name')}
                        placeholder="First name"
                        className="w-full bg-[#1a1a2e] border border-white/[0.08] focus:border-[#00d4aa]/50 focus:ring-1 focus:ring-[#00d4aa]/20 rounded-xl px-4 py-3.5 text-sm text-white placeholder-gray-600 outline-none transition-all"
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
                        placeholder="Last name"
                        className="w-full bg-[#1a1a2e] border border-white/[0.08] focus:border-[#00d4aa]/50 focus:ring-1 focus:ring-[#00d4aa]/20 rounded-xl px-4 py-3.5 text-sm text-white placeholder-gray-600 outline-none transition-all"
                      />
                      {errors.admin_last_name && <p className="mt-1 text-xs text-red-400">{errors.admin_last_name.message}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                      Work Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      {...register('contact_email')}
                      placeholder="principal@school.edu"
                      className="w-full bg-[#1a1a2e] border border-white/[0.08] focus:border-[#00d4aa]/50 focus:ring-1 focus:ring-[#00d4aa]/20 rounded-xl px-4 py-3.5 text-sm text-white placeholder-gray-600 outline-none transition-all"
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
                        className="w-full bg-[#1a1a2e] border border-white/[0.08] focus:border-[#00d4aa]/50 focus:ring-1 focus:ring-[#00d4aa]/20 rounded-xl px-4 py-3.5 pr-12 text-sm text-white placeholder-gray-600 outline-none transition-all"
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

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full mt-4 bg-[#00d4aa] hover:bg-[#00e6b8] text-[#1a1a2e] font-black text-sm tracking-[0.1em] py-3.5 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? <FaSpinner className="animate-spin" /> : null}
                    {isSubmitting ? 'REGISTERING SCHOOL...' : 'CREATE FREE SCHOOL ACCOUNT'}
                  </button>
                </div>
              )}
            </form>

            <div className="mt-6 pt-5 border-t border-white/[0.06] text-center">
              <p className="text-gray-400 text-xs">
                Already registered your school?{' '}
                <Link to="/login" className="text-[#00d4aa] font-semibold hover:text-[#00e6b8] transition-colors">
                  Sign in here
                </Link>
              </p>
            </div>
          </div>
        </div>

        <button onClick={() => navigate('/')} className="mt-6 text-gray-500 text-xs hover:text-gray-400 transition-colors">
          ← Back to home
        </button>
      </div>
    </div>
  );
};

export default RegisterPage;
