/**
 * Login Page — WiSkul
 * Dark cyber design matching the landing page style.
 * Navy background, glassmorphism card, neon accents.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FaSpinner, FaEye, FaEyeSlash } from 'react-icons/fa';
import useAuth from '@hooks/useAuth';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    await login(data.email, data.password);
  };

  const displayError = typeof error === 'string' ? error : error ? 'Login failed. Please try again.' : null;

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600/8 blur-[120px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[400px] h-[400px] rounded-full bg-cyan-500/5 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `linear-gradient(rgba(99,102,241,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.4) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }} />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        {/* Logo + Brand */}
        <div className="text-center mb-8 animate-fade-in-down cursor-pointer" onClick={() => navigate('/')}>
          <img src="/logo.png" alt="WiSkul" className="w-14 h-14 mx-auto mb-3 rounded-xl object-contain" />
          <h1 className="text-2xl font-black text-white tracking-tight">
            Wi<span className="text-[#00d4aa]">Skul</span>
          </h1>
          <p className="text-gray-500 text-xs mt-1">Sign in to your school portal</p>
        </div>

        {/* Login Card */}
        <div className="w-full relative animate-fade-in">
          {/* Glow border */}
          <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-[#00d4aa]/30 via-[#7c3aed]/20 to-[#00d4aa]/10 opacity-60 blur-[1px]" />

          {/* Card body */}
          <div className="relative bg-[#16213e] border border-white/[0.08] rounded-2xl p-7 sm:p-9 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-6 text-center">Welcome Back</h2>

            {/* Error */}
            {displayError && (
              <div className="mb-5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-300 animate-shake flex items-center gap-2">
                <span className="text-red-400">⚠</span>
                {displayError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Email Address</label>
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
                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Password</label>
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
                <a href="#" className="text-[#00d4aa] text-xs font-semibold hover:text-[#00e6b8] transition-colors">
                  Forgot Password?
                </a>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#00d4aa] hover:bg-[#00e6b8] text-[#1a1a2e] font-black text-sm tracking-[0.1em] py-3.5 rounded-xl transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,212,170,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                {isLoading && <FaSpinner className="animate-spin w-4 h-4" />}
                {isLoading ? 'SIGNING IN...' : 'SIGN IN'}
              </button>
            </form>

            {/* Divider */}
            <div className="mt-6 pt-5 border-t border-white/[0.06] text-center">
              <p className="text-gray-500 text-xs">
                Don't have access?{' '}
                <span className="text-[#00d4aa] font-semibold cursor-pointer hover:text-[#00e6b8] transition-colors">Contact your admin</span>
              </p>
            </div>
          </div>
        </div>



        {/* Back to home */}
        <button onClick={() => navigate('/')} className="mt-6 text-gray-600 text-xs hover:text-gray-400 transition-colors">
          ← Back to home
        </button>
      </div>

      <style>{`
        @keyframes fadeInDown { from { opacity:0; transform:translateY(-20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes fadeInUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shake { 0%,100%{transform:translateX(0)} 15%,45%,75%{transform:translateX(-4px)} 30%,60%,90%{transform:translateX(4px)} }
        .animate-fade-in-down { animation: fadeInDown 0.7s ease-out both; }
        .animate-fade-in { animation: fadeIn 0.8s ease-out 0.1s both; }
        .animate-fade-in-up { animation: fadeInUp 0.7s ease-out 0.3s both; }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
};

export default LoginPage;
