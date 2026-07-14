/**
 * Login Page
 * Design: 3D-style card with avatar topper, icon-prefixed fields,
 *         educational animated background
 */

import React, { useState } from 'react';
import { FaSpinner, FaEye, FaEyeSlash, FaUserCircle, FaLock, FaUser, FaGraduationCap } from 'react-icons/fa';
import useAuth from '@hooks/useAuth';
import type { LoginFormData } from '@types';
import AnimatedBackground3D from '@components/auth/AnimatedBackground3D';

export const LoginPage: React.FC = () => {
  const { login, isLoading, error } = useAuth();
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidationError(null);

    if (!formData.email || !formData.password) {
      setValidationError('Email and password are required');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setValidationError('Please enter a valid email address');
      return;
    }
    await login(formData.email, formData.password);
  };

  const displayError = validationError || (typeof error === 'string' ? error : error ? 'Login failed. Please try again.' : null);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated educational background */}
      <AnimatedBackground3D />

      {/* Dot-grid decorative accents (like reference image) */}
      <div className="absolute top-12 left-8 sm:top-16 sm:left-16 grid grid-cols-3 gap-2 opacity-40 z-10" aria-hidden>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 bg-blue-200 rounded-full" />
        ))}
      </div>
      <div className="absolute bottom-12 right-8 sm:bottom-16 sm:right-16 grid grid-cols-3 gap-2 opacity-40 z-10" aria-hidden>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 bg-purple-200 rounded-full" />
        ))}
      </div>

      {/* ── Page content ── */}
      <div className="relative z-20 w-full max-w-sm sm:max-w-md lg:max-w-lg xl:max-w-xl flex flex-col items-center">

        {/* School name above card */}
        <div className="text-center mb-6 animate-fade-in-down">
          <div className="flex items-center justify-center gap-2 mb-1">
            <FaGraduationCap className="text-blue-300 text-xl sm:text-2xl" />
            <span className="text-blue-200 text-xs sm:text-sm font-semibold tracking-widest uppercase">School Management System</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white drop-shadow-lg">
            Welcome Back
          </h1>
          <p className="text-blue-300 text-xs sm:text-sm mt-1 pb-4">Sign in to continue to your portal</p>
        </div>

        {/* ── Card ── */}
        <div className="w-full relative animate-fade-in">
          {/* Outer glow border */}
          <div className="absolute -inset-0.5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-500 opacity-60 blur-sm" />

          {/* Card body */}
          <div className="relative bg-gradient-to-br from-[#2a45c2] via-[#2d3fb5] to-[#1e2ea8] rounded-2xl sm:rounded-3xl shadow-2xl overflow-visible">

            {/* ── Avatar topper ── */}
            <div className="flex justify-center -mt-0 pt-0">
              <div className="relative -top-7 sm:-top-8">
                {/* Outer ring */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-300 to-indigo-500 opacity-50 blur-md scale-110" />
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[#3a57d8] to-[#2940b8] border-4 border-[#3a57d8] shadow-xl flex items-center justify-center">
                  <FaUserCircle className="text-blue-100 text-4xl sm:text-5xl" />
                </div>
              </div>
            </div>

            {/* Card content — pulled up to sit tight under avatar */}
            <div className="px-5 sm:px-8 pb-6 sm:pb-8 -mt-2">

              {/* Title inside card */}
              <p className="text-center text-white font-bold text-base sm:text-lg mb-5 sm:mb-6 tracking-wide">
                User Login
              </p>

              {/* Error */}
              {displayError && (
                <div className="mb-4 bg-red-500 bg-opacity-20 border border-red-400 border-opacity-50 rounded-xl px-4 py-3 text-xs sm:text-sm text-red-200 animate-shake flex items-center gap-2">
                  <span className="text-red-300">⚠</span>
                  {displayError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email field */}
                <div className="flex rounded-xl overflow-hidden shadow-inner">
                  <div className="bg-[#3a57d8] bg-opacity-60 flex items-center justify-center px-3.5 sm:px-4 border-r border-blue-400 border-opacity-30 flex-shrink-0">
                    <FaUser className="text-blue-200 text-sm sm:text-base" />
                  </div>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Email address"
                    autoComplete="email"
                    disabled={isLoading}
                    className="flex-1 bg-[#2e4acf] bg-opacity-50 text-white placeholder-blue-300 text-sm sm:text-base px-4 py-3 sm:py-3.5 outline-none focus:bg-opacity-70 transition-all duration-200 disabled:opacity-60"
                  />
                </div>

                {/* Password field */}
                <div className="flex rounded-xl overflow-hidden shadow-inner">
                  <div className="bg-[#3a57d8] bg-opacity-60 flex items-center justify-center px-3.5 sm:px-4 border-r border-blue-400 border-opacity-30 flex-shrink-0">
                    <FaLock className="text-blue-200 text-sm sm:text-base" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Password"
                    autoComplete="current-password"
                    disabled={isLoading}
                    className="flex-1 bg-[#2e4acf] bg-opacity-50 text-white placeholder-blue-300 text-sm sm:text-base px-4 py-3 sm:py-3.5 outline-none focus:bg-opacity-70 transition-all duration-200 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    disabled={isLoading}
                    className="bg-[#3a57d8] bg-opacity-60 flex items-center justify-center px-3.5 sm:px-4 text-blue-300 hover:text-white transition-colors border-l border-blue-400 border-opacity-30"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <FaEyeSlash className="text-sm" /> : <FaEye className="text-sm" />}
                  </button>
                </div>

                {/* Remember me / Forgot password */}
                <div className="flex items-center justify-between text-xs sm:text-sm pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-blue-200 hover:text-white transition-colors select-none">
                    <input
                      type="checkbox"
                      name="rememberMe"
                      checked={formData.rememberMe}
                      onChange={handleChange}
                      disabled={isLoading}
                      className="w-4 h-4 rounded accent-blue-400 cursor-pointer"
                    />
                    Remember me
                  </label>
                  <a
                    href="#"
                    className="text-blue-300 hover:text-white font-semibold transition-colors hover:underline"
                  >
                    Forgot Password?
                  </a>
                </div>

                {/* LOGIN button — matches reference: light / white button at bottom */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-slate-100 to-blue-100 hover:from-white hover:to-blue-50 text-[#1e2ea8] font-black text-sm sm:text-base tracking-[0.15em] py-3 sm:py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    {isLoading && <FaSpinner className="animate-spin w-4 h-4" />}
                    {isLoading ? 'SIGNING IN...' : 'LOGIN'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* ── Demo accounts card ── */}
        <div className="mt-5 w-full bg-white bg-opacity-5 backdrop-blur-sm border border-white border-opacity-10 rounded-2xl p-4 sm:p-5 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400"></span>
            </span>
            <p className="text-white font-bold text-xs sm:text-sm">Demo Accounts — All Roles</p>
          </div>

          <div className="space-y-3 text-xs max-h-64 overflow-y-auto pr-1">
            {[
              { emoji: '👑', label: 'Principal',  email: 'principal@school.com', color: 'text-blue-200' },
              { emoji: '📚', label: 'Teacher',    email: 'teacher1@school.com',  color: 'text-green-200' },
              { emoji: '🎓', label: 'Student',    email: 'student1@school.com',  color: 'text-yellow-200' },
              { emoji: '💰', label: 'Accountant', email: 'accountant@school.com',color: 'text-purple-200' },
              { emoji: '📋', label: 'Admissions', email: 'admissions@school.com',color: 'text-pink-200' },
              { emoji: '👨‍👩‍👧', label: 'Parent',     email: 'parent@school.com',    color: 'text-orange-200' },
            ].map((a) => (
              <div key={a.email} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white hover:bg-opacity-10 transition-colors">
                <span className="text-base">{a.emoji}</span>
                <span className="text-gray-300 w-[76px] flex-shrink-0 text-[11px]">{a.label}:</span>
                <code className={`bg-white bg-opacity-10 px-2 py-0.5 rounded font-mono text-[11px] ${a.color} break-all`}>{a.email}</code>
              </div>
            ))}
            <div className="border-t border-white border-opacity-10 pt-2 flex flex-wrap items-center justify-center gap-2">
              <span className="text-white font-semibold">🔑 Password for all:</span>
              <code className="bg-gradient-to-r from-blue-600 to-purple-600 px-3 py-1 rounded-lg font-mono font-bold text-white border border-white border-opacity-20 shadow">password123</code>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          15%,45%,75% { transform: translateX(-6px); }
          30%,60%,90% { transform: translateX(6px); }
        }
        .animate-fade-in-down { animation: fadeInDown 0.7s ease-out both; }
        .animate-fade-in      { animation: fadeIn 0.8s ease-out 0.1s both; }
        .animate-fade-in-up   { animation: fadeInUp 0.7s ease-out 0.3s both; }
        .animate-shake        { animation: shake 0.5s ease-in-out; }
      `}</style>
    </div>
  );
};

export default LoginPage;
