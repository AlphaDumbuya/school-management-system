/**
 * Login Page — WiSkul
 * Enterprise two-panel design. A branded showcase panel (features, live stats,
 * animated aurora) sits beside a focused glassmorphism sign-in card.
 * This is the PWA launch screen (manifest start_url = /login), so already
 * authenticated users are redirected straight to their dashboard.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FaSpinner, FaEye, FaEyeSlash } from 'react-icons/fa';
import {
  GraduationCap,
  ShieldCheck,
  Wallet,
  CalendarCheck,
  CreditCard,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import useAuth, { getDashboardPath } from '@hooks/useAuth';
import useAuthStore from '@store/authStore';
import { InstallAppButton } from '@components/pwa/InstallAppButton';
import { WelcomeModal } from '@components/pwa/WelcomeModal';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const FEATURES = [
  { icon: GraduationCap, label: 'Academics & Results', desc: 'Grades, report cards, promotions' },
  { icon: CalendarCheck, label: 'Smart Attendance', desc: 'Daily tracking, trends & alerts' },
  { icon: Wallet, label: 'Fees & Payments', desc: 'Mobile money, card, bank & wallet' },
  { icon: CreditCard, label: 'Identity & ID Cards', desc: 'Verified QR student IDs' },
];

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const user = useAuthStore((s) => s.user);

  // Track connectivity so we can guide the user before they even try to sign in.
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

  // PWA launch: if the user is already signed in, skip the form and go
  // straight to their dashboard.
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
    await login(data.email, data.password);
  };

  const displayError =
    typeof error === 'string' ? error : error ? 'Login failed. Please try again.' : null;

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex relative overflow-hidden">
      {/* First-launch welcome popup (only when not already signed in) */}
      {!(isAuthenticated && user) && <WelcomeModal onRegister={() => navigate('/register')} />}

      {/* ── Ambient background (whole screen) ───────────────────────── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#00d4aa]/10 blur-[130px] animate-aurora" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[120px] animate-aurora-slow" />
        <div className="absolute top-1/3 left-1/2 w-[400px] h-[400px] rounded-full bg-cyan-500/5 blur-[110px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `linear-gradient(rgba(99,102,241,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.4) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* ══════════════ LEFT: Brand showcase (desktop only) ══════════════ */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative z-10 flex-col justify-between p-12 xl:p-16">
        {/* Brand */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-3 group w-fit"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-[#00d4aa]/30 blur-lg rounded-2xl group-hover:bg-[#00d4aa]/50 transition-all" />
            <img
              src="/logo.png"
              alt="WiSkul"
              className="relative w-12 h-12 rounded-2xl object-contain bg-white/95 p-1.5 shadow-lg"
            />
          </div>
          <span className="text-2xl font-black text-white tracking-tight">
            Wi<span className="text-[#00d4aa]">Skul</span>
          </span>
        </button>

        {/* Hero copy */}
        <div className="max-w-lg">
          <div className="inline-flex items-center gap-2 bg-[#00d4aa]/10 border border-[#00d4aa]/20 rounded-full px-3 py-1 mb-6 animate-fade-in-down">
            <Sparkles size={13} className="text-[#00d4aa]" />
            <span className="text-[#00d4aa] text-xs font-semibold tracking-wide">
              The complete school platform
            </span>
          </div>
          <h1 className="text-4xl xl:text-5xl font-black text-white leading-[1.1] mb-5 animate-fade-in-up">
            Run your entire school
            <br />
            from <span className="text-[#00d4aa]">one place.</span>
          </h1>
          <p className="text-gray-400 text-base leading-relaxed mb-10 animate-fade-in-up animation-delay-100">
            Academics, attendance, fees, identity and more — built for schools in
            Sierra Leone and beyond. Fast, secure and works even offline.
          </p>

          {/* Install app CTA (only renders when installable / iOS) */}
          <div className="mb-8 animate-fade-in-up animation-delay-100">
            <InstallAppButton label="Get the WiSkul App" alwaysShow />
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-3 animate-fade-in-up animation-delay-200">
            {FEATURES.map((f) => (
              <div
                key={f.label}
                className="flex items-start gap-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 hover:border-[#00d4aa]/30 hover:bg-white/[0.05] transition-all group"
              >
                <div className="w-9 h-9 rounded-xl bg-[#00d4aa]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#00d4aa]/20 transition-colors">
                  <f.icon size={17} className="text-[#00d4aa]" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-bold truncate">{f.label}</p>
                  <p className="text-gray-500 text-xs leading-snug">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trust footer */}
        <div className="flex items-center gap-6 text-gray-500 text-xs animate-fade-in animation-delay-300">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-[#00d4aa]" /> Bank-grade security
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00d4aa] animate-pulse" /> Works offline
          </span>
          <span>© {new Date().getFullYear()} WiSkul</span>
        </div>
      </div>

      {/* ══════════════ RIGHT: Sign-in form ══════════════ */}
      <div className="flex-1 relative z-10 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md flex flex-col items-center">
          {/* Mobile brand (hidden on desktop where the left panel shows it) */}
          <div
            className="lg:hidden text-center mb-8 animate-fade-in-down cursor-pointer"
            onClick={() => navigate('/')}
          >
            <div className="relative w-16 h-16 mx-auto mb-3">
              <div className="absolute inset-0 bg-[#00d4aa]/30 blur-xl rounded-2xl" />
              <img
                src="/logo.png"
                alt="WiSkul"
                className="relative w-16 h-16 rounded-2xl object-contain bg-white/95 p-2 shadow-lg"
              />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Wi<span className="text-[#00d4aa]">Skul</span>
            </h1>
          </div>

          {/* Card */}
          <div className="w-full relative animate-fade-in">
            <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-br from-[#00d4aa]/40 via-[#7c3aed]/20 to-transparent opacity-70 blur-[2px]" />

            <div className="relative bg-[#16213e]/95 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-7 sm:p-9 shadow-2xl">
              <div className="mb-7">
                <h2 className="text-2xl font-black text-white">Welcome back</h2>
                <p className="text-gray-500 text-sm mt-1">Sign in to your school portal</p>
              </div>

              {!online && (
                <div className="mb-5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-200 flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">📴</span>
                  <span>
                    You're offline. Connect to the internet to sign in. Once you're
                    signed in, WiSkul keeps working offline.
                  </span>
                </div>
              )}

              {online && displayError && (
                <div className="mb-5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-300 animate-shake flex items-center gap-2">
                  <span className="text-red-400">⚠</span>
                  {displayError}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
                    Email Address
                  </label>
                  <input
                    type="email"
                    {...register('email')}
                    placeholder="you@school.com"
                    autoComplete="email"
                    disabled={isLoading}
                    className={`w-full bg-[#1a1a2e] border rounded-xl px-4 py-3.5 text-sm text-white placeholder-gray-600 outline-none transition-all disabled:opacity-50 ${
                      errors.email
                        ? 'border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/20'
                        : 'border-white/[0.08] focus:border-[#00d4aa]/50 focus:ring-1 focus:ring-[#00d4aa]/20'
                    }`}
                  />
                  {errors.email && (
                    <p className="mt-1.5 text-xs text-red-400">{errors.email.message}</p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      {...register('password')}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      disabled={isLoading}
                      className={`w-full bg-[#1a1a2e] border rounded-xl px-4 py-3.5 pr-12 text-sm text-white placeholder-gray-600 outline-none transition-all disabled:opacity-50 ${
                        errors.password
                          ? 'border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/20'
                          : 'border-white/[0.08] focus:border-[#00d4aa]/50 focus:ring-1 focus:ring-[#00d4aa]/20'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      disabled={isLoading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-[#00d4aa] transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1.5 text-xs text-red-400">{errors.password.message}</p>
                  )}
                </div>

                {/* Remember + Forgot */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-gray-400 text-xs hover:text-gray-300 transition-colors select-none">
                    <input
                      type="checkbox"
                      {...register('rememberMe')}
                      disabled={isLoading}
                      className="w-3.5 h-3.5 rounded border-gray-600 bg-[#1a1a2e] text-[#00d4aa] focus:ring-[#00d4aa]/30 cursor-pointer"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="text-[#00d4aa] text-xs font-semibold hover:text-[#00e6b8] transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading || !online}
                  title={!online ? 'You need an internet connection to sign in' : undefined}
                  className="group w-full bg-[#00d4aa] hover:bg-[#00e6b8] text-[#1a1a2e] font-black text-sm tracking-[0.1em] py-3.5 rounded-xl transition-all duration-300 hover:shadow-[0_0_40px_rgba(0,212,170,0.35)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {isLoading && <FaSpinner className="animate-spin w-4 h-4" />}
                  {isLoading ? 'SIGNING IN...' : !online ? 'OFFLINE' : 'SIGN IN'}
                  {!isLoading && online && (
                    <ArrowRight
                      size={16}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  )}
                </button>
              </form>

              {/* Footer */}
              <div className="mt-6 pt-5 border-t border-white/[0.06] text-center space-y-2">
                <p className="text-gray-400 text-xs">
                  Registering a new school?{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/register')}
                    className="text-[#00d4aa] font-semibold hover:text-[#00e6b8] transition-colors underline underline-offset-2"
                  >
                    Register School Free
                  </button>
                </p>
                <p className="text-gray-500 text-[11px]">
                  Students &amp; Staff: Contact your school principal for portal access.
                </p>
              </div>
            </div>
          </div>

          {/* Install app CTA — mobile only (desktop shows it in the left panel) */}
          <div className="lg:hidden mt-6 w-full flex justify-center">
            <InstallAppButton label="Get the WiSkul App" variant="ghost" alwaysShow className="w-full" />
          </div>

          <button
            onClick={() => navigate('/')}
            className="mt-6 text-gray-600 text-xs hover:text-gray-400 transition-colors"
          >
            ← Back to home
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeInDown { from { opacity:0; transform:translateY(-20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes fadeInUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shake { 0%,100%{transform:translateX(0)} 15%,45%,75%{transform:translateX(-4px)} 30%,60%,90%{transform:translateX(4px)} }
        @keyframes aurora { 0%,100%{ transform: translate(0,0) scale(1); } 50%{ transform: translate(40px,30px) scale(1.1); } }
        @keyframes auroraSlow { 0%,100%{ transform: translate(0,0) scale(1); } 50%{ transform: translate(-40px,-30px) scale(1.15); } }
        .animate-fade-in-down { animation: fadeInDown 0.7s ease-out both; }
        .animate-fade-in { animation: fadeIn 0.8s ease-out 0.1s both; }
        .animate-fade-in-up { animation: fadeInUp 0.7s ease-out both; }
        .animate-shake { animation: shake 0.4s ease-in-out; }
        .animate-aurora { animation: aurora 14s ease-in-out infinite; }
        .animate-aurora-slow { animation: auroraSlow 18s ease-in-out infinite; }
        .animation-delay-100 { animation-delay: 0.1s; }
        .animation-delay-200 { animation-delay: 0.2s; }
        .animation-delay-300 { animation-delay: 0.3s; }
      `}</style>
    </div>
  );
};

export default LoginPage;
