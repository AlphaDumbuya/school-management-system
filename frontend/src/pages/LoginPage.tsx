/**
 * Login Page — WiSkul
 * Simple, professional single-card sign-in centered on a navy photo background.
 * PWA launch screen (manifest start_url = /login) — already authenticated users
 * are redirected straight to their dashboard.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FaSpinner, FaEye, FaEyeSlash } from 'react-icons/fa';
import { ArrowRight } from 'lucide-react';
import useAuth, { getDashboardPath } from '@hooks/useAuth';
import useAuthStore from '@store/authStore';
import { isAppMode } from '@lib/appMode';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, verifyMfa, isLoading, error } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    if (isInitialized && isAuthenticated && user) {
      navigate(getDashboardPath(user.role), { replace: true });
    }
  }, [isInitialized, isAuthenticated, user, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  const onSubmit = async (data: LoginFormValues) => {
    const result = await login(data.email, data.password);
    if (result === 'mfa_required') setMfaStep(true);
  };

  const onVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaCode.trim()) return;
    await verifyMfa(mfaCode.trim());
  };

  const displayError =
    typeof error === 'string' ? error : error ? 'Login failed. Please try again.' : null;

  const inputBase =
    'w-full bg-white border rounded-xl px-4 py-3.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all disabled:opacity-50';
  const inputState = (bad?: boolean) =>
    bad
      ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500/20'
      : 'border-slate-200 focus:border-[#1d4ed8] focus:ring-1 focus:ring-[#1d4ed8]/20';

  return (
    <div
      className="min-h-screen bg-[#1a1147] bg-cover bg-center bg-no-repeat flex items-center justify-center p-4 relative overflow-hidden"
      style={{ backgroundImage: 'url(/login2.jpg)' }}
    >
      {/* Readability overlay so the glass card stays legible over the artwork */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1147]/70 via-[#241a5c]/55 to-[#0b1234]/70" />

      {/* Portrait card */}
      <div className="relative z-10 w-full max-w-md animate-fade-in">
        <div className="relative bg-white/10 backdrop-blur-2xl rounded-2xl shadow-2xl ring-1 ring-white/20 border border-white/10 overflow-hidden p-6 sm:p-8">
          {/* Brand + heading */}
          <div className="text-center mb-5">
            <button onClick={() => navigate('/')} className="inline-flex items-center gap-2 mb-3">
              <img src="/logo.png" alt="WiSkul" className="w-9 h-9 rounded-xl object-contain bg-white p-1 shadow" />
              <span className="text-lg font-black text-white tracking-tight">Wi<span className="text-amber-400">Skul</span></span>
            </button>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              {mfaStep ? 'Two-factor verification' : 'Welcome back'}
            </h2>
            <p className="text-blue-100/70 text-xs mt-1">
              {mfaStep ? 'Enter the 6-digit code from your authenticator app' : 'Sign in to your school portal'}
            </p>
          </div>

          {/* ── 2FA step ── */}
          {mfaStep ? (
            <form onSubmit={onVerifyMfa} className="max-w-md mx-auto space-y-5">
              {displayError && (
                <div className="bg-red-500/20 border border-red-400/40 rounded-xl px-4 py-3 text-xs text-red-100 animate-shake flex items-center gap-2">
                  <span>⚠</span> {displayError}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-blue-100/80 mb-2 uppercase tracking-wider">Verification Code</label>
                <input
                  type="text" inputMode="numeric" autoComplete="one-time-code"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9A-Za-z-]/g, ''))}
                  placeholder="123456" maxLength={9} autoFocus disabled={isLoading}
                  className="w-full bg-white/10 border border-white/20 focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 rounded-xl px-4 py-3.5 text-center text-lg tracking-[0.4em] font-bold text-white placeholder-white/40 outline-none transition-all disabled:opacity-50"
                />
                <p className="mt-2 text-[11px] text-blue-100/50">Lost your device? Enter one of your backup codes instead.</p>
              </div>
              <button
                type="submit" disabled={isLoading || !mfaCode.trim()}
                className="w-full bg-[#f59e0b] hover:bg-[#d97706] text-white font-black text-sm tracking-[0.1em] py-3.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                {isLoading && <FaSpinner className="animate-spin w-4 h-4" />}
                {isLoading ? 'VERIFYING...' : 'VERIFY & SIGN IN'}
              </button>
              <button
                type="button" onClick={() => { setMfaStep(false); setMfaCode(''); }}
                className="w-full text-blue-100/60 text-xs hover:text-white transition-colors"
              >
                ← Back to sign in
              </button>
            </form>
          ) : (
            <>
              {!online && (
                <div className="max-w-3xl mx-auto mb-5 bg-amber-500/20 border border-amber-400/40 rounded-xl px-4 py-3 text-xs text-amber-100 flex items-start gap-2">
                  <span className="mt-0.5">📴</span>
                  <span>You're offline. Connect to the internet to sign in.</span>
                </div>
              )}
              {online && displayError && (
                <div className="max-w-3xl mx-auto mb-5 bg-red-500/20 border border-red-400/40 rounded-xl px-4 py-3 text-xs text-red-100 animate-shake flex items-center gap-2">
                  <span>⚠</span> {displayError}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Email + password stacked (portrait) */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-blue-100/80 mb-2 uppercase tracking-wider">Email Address</label>
                    <input
                      type="email" {...register('email')} placeholder="you@school.com"
                      autoComplete="email" disabled={isLoading}
                      className={`${inputBase} ${inputState(!!errors.email)}`}
                    />
                    {errors.email && <p className="mt-1.5 text-xs text-red-300">{errors.email.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-100/80 mb-2 uppercase tracking-wider">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'} {...register('password')}
                        placeholder="••••••••" autoComplete="current-password" disabled={isLoading}
                        className={`${inputBase} pr-12 ${inputState(!!errors.password)}`}
                      />
                      <button
                        type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1} disabled={isLoading}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-[#1d4ed8] transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                      </button>
                    </div>
                    {errors.password && <p className="mt-1.5 text-xs text-red-300">{errors.password.message}</p>}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-blue-100/80 text-xs hover:text-white transition-colors select-none">
                    <input
                      type="checkbox" {...register('rememberMe')} disabled={isLoading}
                      className="w-3.5 h-3.5 rounded border-white/30 bg-white/10 text-amber-400 focus:ring-amber-400/30 cursor-pointer"
                    />
                    Remember me
                  </label>
                  <button
                    type="button" onClick={() => navigate('/forgot-password')}
                    className="text-amber-400 text-xs font-semibold hover:text-amber-300 transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>

                <button
                  type="submit" disabled={isLoading || !online}
                  title={!online ? 'You need an internet connection to sign in' : undefined}
                  className="group w-full bg-[#f59e0b] hover:bg-[#d97706] text-white font-black text-sm tracking-[0.1em] py-3.5 rounded-xl transition-all duration-300 shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {isLoading && <FaSpinner className="animate-spin w-4 h-4" />}
                  {isLoading ? 'SIGNING IN...' : !online ? 'OFFLINE' : 'SIGN IN'}
                  {!isLoading && online && <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-white/10 text-center space-y-2">
                <p className="text-blue-100/70 text-xs">
                  Registering a new school?{' '}
                  <button
                    type="button" onClick={() => navigate('/register')}
                    className="text-amber-400 font-semibold hover:text-amber-300 transition-colors underline underline-offset-2"
                  >
                    Register School Free
                  </button>
                </p>
                <p className="text-blue-100/50 text-[11px]">
                  Students &amp; Staff: Contact your school principal for portal access.
                </p>
              </div>
            </>
          )}
        </div>

        {!isAppMode() && (
          <button onClick={() => navigate('/')} className="mt-5 mx-auto block text-white/60 text-xs hover:text-white transition-colors">
            ← Back to home
          </button>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shake { 0%,100%{transform:translateX(0)} 15%,45%,75%{transform:translateX(-4px)} 30%,60%,90%{transform:translateX(4px)} }
        @keyframes aurora { 0%,100%{ transform: translate(0,0) scale(1); } 50%{ transform: translate(40px,30px) scale(1.1); } }
        @keyframes auroraSlow { 0%,100%{ transform: translate(0,0) scale(1); } 50%{ transform: translate(-40px,-30px) scale(1.15); } }
        .animate-fade-in { animation: fadeIn 0.6s ease-out both; }
        .animate-shake { animation: shake 0.4s ease-in-out; }
        .animate-aurora { animation: aurora 14s ease-in-out infinite; }
        .animate-aurora-slow { animation: auroraSlow 18s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default LoginPage;
