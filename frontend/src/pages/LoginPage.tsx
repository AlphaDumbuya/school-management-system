/**
 * Login Page - Premium 3D Experience
 * User authentication page with stunning 3D animated background
 * Features: Glassmorphism, 3D particles, floating geometric shapes
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSpinner, FaGoogle, FaEye, FaEyeSlash, FaGraduationCap } from 'react-icons/fa';
import useAuth from '@hooks/useAuth';
import type { LoginFormData } from '@types';
import AnimatedBackground3D from '@components/auth/AnimatedBackground3D';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
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

    // Basic validation
    if (!formData.email || !formData.password) {
      setValidationError('Email and password are required');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setValidationError('Please enter a valid email address');
      return;
    }

    const success = await login(formData.email, formData.password);
    // Navigation is handled by the useAuth hook after successful login
  };

  const handleGoogleAuth = () => {
    // TODO: Implement Google OAuth flow
    alert('Google authentication coming soon!');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 relative overflow-hidden">
      {/* 3D Animated Background */}
      <AnimatedBackground3D />

      {/* Enhanced Ambient light effects with animated gradients - responsive sizes */}
      <div className="absolute top-5 left-5 sm:top-10 sm:left-10 w-48 h-48 sm:w-80 sm:h-80 md:w-96 md:h-96 lg:w-[32rem] lg:h-[32rem] bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-600 rounded-full mix-blend-screen filter blur-[60px] sm:blur-[80px] md:blur-[100px] opacity-30 animate-blob"></div>
      <div className="absolute bottom-10 right-5 sm:bottom-20 sm:right-10 w-40 h-40 sm:w-72 sm:h-72 md:w-80 md:h-80 lg:w-[28rem] lg:h-[28rem] bg-gradient-to-br from-purple-400 via-purple-500 to-pink-500 rounded-full mix-blend-screen filter blur-[60px] sm:blur-[80px] md:blur-[100px] opacity-30 animate-blob animation-delay-2000"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 sm:w-96 sm:h-96 md:w-[28rem] md:h-[28rem] lg:w-[36rem] lg:h-[36rem] bg-gradient-to-br from-indigo-400 via-purple-400 to-pink-400 rounded-full mix-blend-screen filter blur-[80px] sm:blur-[100px] md:blur-[120px] opacity-20 animate-blob animation-delay-4000"></div>
      <div className="absolute top-1/3 right-1/4 w-36 h-36 sm:w-64 sm:h-64 md:w-80 md:h-80 lg:w-[24rem] lg:h-[24rem] bg-gradient-to-br from-cyan-400 via-blue-400 to-indigo-400 rounded-full mix-blend-screen filter blur-[50px] sm:blur-[70px] md:blur-[90px] opacity-25 animate-blob animation-delay-3000"></div>

      <div className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl relative z-10">
        {/* Logo Section with enhanced animations - responsive sizing */}
        <div className="text-center mb-6 sm:mb-8 md:mb-10 animate-fade-in-down">
          <div className="relative inline-block mb-4 sm:mb-6">
            {/* Glow effect behind logo */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 rounded-2xl sm:rounded-3xl blur-xl sm:blur-2xl opacity-60 animate-pulse-glow"></div>
            <div className="relative inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border-2 border-white border-opacity-30 shadow-2xl transform hover:scale-110 hover:rotate-3 transition-all duration-500 cursor-pointer group">
              <FaGraduationCap className="text-4xl sm:text-5xl md:text-6xl text-white drop-shadow-2xl group-hover:scale-110 transition-transform duration-300" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white mb-2 sm:mb-3 md:mb-4 drop-shadow-2xl tracking-tight animate-gradient px-2">
            School <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 animate-gradient-x">Management</span>
          </h1>
          <p className="text-blue-100 text-sm sm:text-base md:text-lg lg:text-xl font-light tracking-wide drop-shadow-lg opacity-90 px-4">Welcome back to your learning hub</p>
        </div>

        {/* Main Card - Enhanced Glassmorphism - responsive padding and border radius */}
        <div className="relative group">
          {/* Animated border gradient */}
          <div className="absolute -inset-0.5 sm:-inset-1 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 rounded-2xl sm:rounded-3xl blur opacity-30 group-hover:opacity-50 transition duration-500 animate-tilt"></div>
          <div className="relative bg-white bg-opacity-[0.08] backdrop-blur-3xl rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 md:p-8 border border-white border-opacity-20 hover:bg-opacity-[0.12] transition-all duration-500 hover:border-opacity-40 animate-fade-in">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 md:space-y-6">
            {/* Error Messages */}
            {(validationError || error) && (
              <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-3 sm:p-4 text-xs sm:text-sm text-red-700 animate-shake">
                <p className="font-semibold">Error</p>
                <p className="mt-1">
                  {validationError ||
                    (typeof error === 'string'
                      ? error
                      : 'Login failed. Please try again.')}
                </p>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5 sm:space-y-2">
              <label htmlFor="email" className="block text-xs sm:text-sm font-semibold text-white drop-shadow-lg">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="w-full px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-3.5 text-sm sm:text-base bg-white bg-opacity-95 backdrop-blur-xl border-2 border-white border-opacity-30 rounded-lg sm:rounded-xl focus:border-blue-400 focus:ring-4 focus:ring-blue-400 focus:ring-opacity-30 outline-none transition-all duration-300 placeholder:text-gray-400 hover:bg-opacity-100 hover:shadow-lg text-gray-800 font-medium"
                disabled={isLoading}
              />
            </div>

            {/* Password Field */}
            <div className="space-y-1.5 sm:space-y-2">
              <label htmlFor="password" className="block text-xs sm:text-sm font-semibold text-white drop-shadow-lg">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-3.5 pr-11 sm:pr-12 md:pr-14 text-sm sm:text-base bg-white bg-opacity-95 backdrop-blur-xl border-2 border-white border-opacity-30 rounded-lg sm:rounded-xl focus:border-blue-400 focus:ring-4 focus:ring-blue-400 focus:ring-opacity-30 outline-none transition-all duration-300 placeholder:text-gray-400 hover:bg-opacity-100 hover:shadow-lg text-gray-800 font-medium"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-600 transition-all duration-200 hover:scale-110 disabled:opacity-50"
                  disabled={isLoading}
                  tabIndex={-1}
                >
                  {showPassword ? <FaEyeSlash className="w-4 h-4 sm:w-5 sm:h-5" /> : <FaEye className="w-4 h-4 sm:w-5 sm:h-5" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 text-xs sm:text-sm">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                  className="w-4 h-4 sm:w-5 sm:h-5 rounded-md border-2 border-white border-opacity-50 bg-white bg-opacity-20 text-blue-500 focus:ring-2 focus:ring-blue-400 cursor-pointer transition-all duration-200"
                  disabled={isLoading}
                />
                <span className="text-white drop-shadow-md group-hover:text-blue-200 transition-colors duration-200">Remember me</span>
              </label>
              <a href="#" className="text-blue-200 hover:text-white font-semibold transition-all duration-200 hover:underline drop-shadow-md ml-6 sm:ml-0">
                Forgot password?
              </a>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="relative w-full group/btn overflow-hidden rounded-lg sm:rounded-xl"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-gradient-x"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
              <span className="relative flex items-center justify-center gap-2 sm:gap-3 py-3 sm:py-3.5 md:py-4 text-white font-bold text-sm sm:text-base md:text-lg tracking-wide drop-shadow-lg group-hover/btn:scale-105 transition-transform duration-300">
                {isLoading && <FaSpinner className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />}
                {isLoading ? 'Signing in...' : 'Sign In'}
              </span>
              <div className="absolute inset-0 rounded-lg sm:rounded-xl border-2 border-white border-opacity-20 group-hover/btn:border-opacity-40 transition-all duration-300"></div>
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6 sm:my-7 md:my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white border-opacity-20" />
            </div>
            <div className="relative flex justify-center text-xs sm:text-sm">
              <span className="px-3 sm:px-4 bg-gradient-to-r from-transparent via-slate-900 via-opacity-50 to-transparent text-white font-semibold drop-shadow-md">Or continue with</span>
            </div>
          </div>

          {/* Google Auth Button */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={isLoading}
            className="w-full bg-white bg-opacity-95 backdrop-blur-xl border-2 border-white border-opacity-40 text-gray-800 font-bold py-2.5 sm:py-3 md:py-3.5 rounded-lg sm:rounded-xl hover:bg-opacity-100 hover:border-opacity-60 hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3 shadow-lg hover:scale-[1.02] transform text-sm sm:text-base"
          >
            <FaGoogle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
            <span>Sign in with Google</span>
          </button>
          </div>
        </div>

        {/* Demo Info Card - responsive with scrollable content on mobile */}
        <div className="mt-4 sm:mt-6 md:mt-8 bg-white bg-opacity-[0.08] backdrop-blur-2xl rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 border border-white border-opacity-20 hover:bg-opacity-[0.12] hover:border-opacity-30 transition-all duration-500 animate-fade-in-up shadow-2xl">
          <p className="text-white font-bold mb-3 sm:mb-4 flex items-center gap-2 sm:gap-3 text-sm sm:text-base md:text-lg">
            <span className="flex items-center justify-center">
              <span className="absolute w-2 h-2 sm:w-3 sm:h-3 bg-green-400 rounded-full animate-ping"></span>
              <span className="relative w-2 h-2 sm:w-3 sm:h-3 bg-green-400 rounded-full"></span>
            </span>
            Demo Accounts - All Roles
          </p>
          <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-white max-h-[55vh] sm:max-h-[60vh] overflow-y-auto sm:overflow-y-auto pr-2">
            {/* Administrative Roles */}
            <div className="mb-2 pb-2 border-b border-white border-opacity-20">
              <p className="text-blue-200 font-semibold text-xs mb-1.5">👑 Administrative</p>
              <div className="space-y-1.5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-2 hover:bg-white hover:bg-opacity-10 px-2 sm:px-3 py-1.5 rounded-lg transition-all duration-200">
                  <span className="font-semibold min-w-[90px] text-[11px] sm:text-xs">Principal #1:</span>
                  <code className="bg-white bg-opacity-20 backdrop-blur-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg font-mono text-[10px] sm:text-xs border border-white border-opacity-20 break-all">admin@school.com</code>
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-2 hover:bg-white hover:bg-opacity-10 px-2 sm:px-3 py-1.5 rounded-lg transition-all duration-200">
                  <span className="font-semibold min-w-[90px] text-[11px] sm:text-xs">Principal #2:</span>
                  <code className="bg-white bg-opacity-20 backdrop-blur-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg font-mono text-[10px] sm:text-xs border border-white border-opacity-20 break-all">principal@school.com</code>
                </div>
              </div>
            </div>

            {/* Academic Roles */}
            <div className="mb-2 pb-2 border-b border-white border-opacity-20">
              <p className="text-green-200 font-semibold text-xs mb-1.5">📚 Academic Staff</p>
              <div className="space-y-1.5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-2 hover:bg-white hover:bg-opacity-10 px-2 sm:px-3 py-1.5 rounded-lg transition-all duration-200">
                  <span className="font-semibold min-w-[90px] text-[11px] sm:text-xs">Teacher #1:</span>
                  <code className="bg-white bg-opacity-20 backdrop-blur-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg font-mono text-[10px] sm:text-xs border border-white border-opacity-20 break-all">teacher1@school.com</code>
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-2 hover:bg-white hover:bg-opacity-10 px-2 sm:px-3 py-1.5 rounded-lg transition-all duration-200">
                  <span className="font-semibold min-w-[90px] text-[11px] sm:text-xs">Teacher #2:</span>
                  <code className="bg-white bg-opacity-20 backdrop-blur-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg font-mono text-[10px] sm:text-xs border border-white border-opacity-20 break-all">teacher2@school.com</code>
                </div>
              </div>
            </div>

            {/* Students */}
            <div className="mb-2 pb-2 border-b border-white border-opacity-20">
              <p className="text-yellow-200 font-semibold text-xs mb-1.5">🎓 Students</p>
              <div className="space-y-1.5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-2 hover:bg-white hover:bg-opacity-10 px-2 sm:px-3 py-1.5 rounded-lg transition-all duration-200">
                  <span className="font-semibold min-w-[90px] text-[11px] sm:text-xs">Student #1:</span>
                  <code className="bg-white bg-opacity-20 backdrop-blur-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg font-mono text-[10px] sm:text-xs border border-white border-opacity-20 break-all">student1@school.com</code>
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-2 hover:bg-white hover:bg-opacity-10 px-2 sm:px-3 py-1.5 rounded-lg transition-all duration-200">
                  <span className="font-semibold min-w-[90px] text-[11px] sm:text-xs">Student #2:</span>
                  <code className="bg-white bg-opacity-20 backdrop-blur-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg font-mono text-[10px] sm:text-xs border border-white border-opacity-20 break-all">student2@school.com</code>
                </div>
              </div>
            </div>

            {/* Support Staff */}
            <div className="mb-2 pb-2 border-b border-white border-opacity-20">
              <p className="text-purple-200 font-semibold text-xs mb-1.5">💼 Support Staff</p>
              <div className="space-y-1.5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-2 hover:bg-white hover:bg-opacity-10 px-2 sm:px-3 py-1.5 rounded-lg transition-all duration-200">
                  <span className="font-semibold min-w-[90px] text-[11px] sm:text-xs">Accountant:</span>
                  <code className="bg-white bg-opacity-20 backdrop-blur-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg font-mono text-[10px] sm:text-xs border border-white border-opacity-20 break-all">accountant@school.com</code>
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-2 hover:bg-white hover:bg-opacity-10 px-2 sm:px-3 py-1.5 rounded-lg transition-all duration-200">
                  <span className="font-semibold min-w-[90px] text-[11px] sm:text-xs">Admissions:</span>
                  <code className="bg-white bg-opacity-20 backdrop-blur-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg font-mono text-[10px] sm:text-xs border border-white border-opacity-20 break-all">admissions@school.com</code>
                </div>
              </div>
            </div>

            {/* Parents/Guardians */}
            <div className="mb-2">
              <p className="text-pink-200 font-semibold text-xs mb-1.5">👨‍👩‍👧‍👦 Parents/Guardians</p>
              <div className="space-y-1.5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-2 hover:bg-white hover:bg-opacity-10 px-2 sm:px-3 py-1.5 rounded-lg transition-all duration-200">
                  <span className="font-semibold min-w-[90px] text-[11px] sm:text-xs">Parent:</span>
                  <code className="bg-white bg-opacity-20 backdrop-blur-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg font-mono text-[10px] sm:text-xs border border-white border-opacity-20 break-all">parent@school.com</code>
                </div>
              </div>
            </div>

            {/* Password Section */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-center gap-1 sm:gap-2 pt-2 sm:pt-3 mt-2 sm:mt-3 border-t border-white border-opacity-20 bg-white bg-opacity-5 rounded-lg p-2">
              <span className="text-xs sm:text-sm font-bold text-white">🔑 Password for all accounts:</span>
              <code className="bg-gradient-to-r from-blue-500 to-purple-500 backdrop-blur-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg font-mono text-xs sm:text-sm font-bold border-2 border-white border-opacity-40 shadow-lg">password123</code>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% { 
            transform: translate(0, 0) scale(1) rotate(0deg); 
          }
          33% { 
            transform: translate(40px, -60px) scale(1.15) rotate(120deg); 
          }
          66% { 
            transform: translate(-30px, 40px) scale(0.95) rotate(240deg); 
          }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
          20%, 40%, 60%, 80% { transform: translateX(8px); }
        }
        
        @keyframes fadeInDown {
          from { 
            opacity: 0; 
            transform: translateY(-30px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes fadeInUp {
          from { 
            opacity: 0; 
            transform: translateY(30px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }
        
        @keyframes gradientX {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        @keyframes tilt {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(1deg); }
          75% { transform: rotate(-1deg); }
        }
        
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        
        .animate-blob {
          animation: blob 8s infinite ease-in-out;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-3000 {
          animation-delay: 3s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        
        .animate-shake {
          animation: shake 0.6s ease-in-out;
        }
        
        .animate-fade-in-down {
          animation: fadeInDown 0.8s ease-out;
        }
        
        .animate-fade-in {
          animation: fadeIn 1s ease-out;
        }
        
        .animate-fade-in-up {
          animation: fadeInUp 0.8s ease-out 0.2s backwards;
        }
        
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradientX 3s ease infinite;
        }
        
        .animate-tilt {
          animation: tilt 10s infinite ease-in-out;
        }
        
        .animate-pulse-glow {
          animation: pulseGlow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
