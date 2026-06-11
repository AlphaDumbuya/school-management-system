/**
 * Login Page - Enhanced with Google Auth
 * User authentication page with modern design
 * Phase 11: Frontend Dashboard Implementation
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSpinner, FaGoogle, FaEye, FaEyeSlash } from 'react-icons/fa';
import useAuth from '@hooks/useAuth';
import type { LoginFormData } from '@types/index';

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
    if (!success) {
      // Error is handled by the hook and displayed via the 'error' state
    }
  };

  const handleGoogleAuth = () => {
    // TODO: Implement Google OAuth flow
    alert('Google authentication coming soon!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white bg-opacity-20 backdrop-blur-lg rounded-2xl mb-4 border border-white border-opacity-30">
            <span className="text-4xl font-black text-white drop-shadow-lg">SMS</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-2">School Management</h1>
          <p className="text-blue-100 text-lg">Welcome back to your learning hub</p>
        </div>

        {/* Main Card */}
        <div className="bg-white bg-opacity-95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white border-opacity-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Messages */}
            {(validationError || error) && (
              <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 text-sm text-red-700 animate-shake">
                <p className="font-semibold">Error</p>
                <p>{validationError || error}</p>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition duration-200 bg-gray-50 hover:bg-white"
                disabled={isLoading}
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
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
                  className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition duration-200 bg-gray-50 hover:bg-white"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-600 transition disabled:opacity-50"
                  disabled={isLoading}
                  tabIndex={-1}
                >
                  {showPassword ? <FaEyeSlash className="w-5 h-5" /> : <FaEye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  disabled={isLoading}
                />
                <span className="text-gray-600 group-hover:text-gray-700">Remember me</span>
              </label>
              <a href="#" className="text-blue-600 hover:text-blue-700 font-medium transition">
                Forgot password?
              </a>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition duration-200 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              {isLoading && <FaSpinner className="w-5 h-5 animate-spin" />}
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white text-gray-500 font-medium">Or continue with</span>
            </div>
          </div>

          {/* Google Auth Button */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={isLoading}
            className="w-full border-2 border-gray-200 text-gray-700 font-semibold py-3 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-sm hover:shadow-md"
          >
            <FaGoogle className="w-5 h-5 text-red-500" />
            <span>Google</span>
          </button>
        </div>

        {/* Demo Info Card */}
        <div className="mt-6 bg-white bg-opacity-20 backdrop-blur-lg rounded-xl p-6 border border-white border-opacity-30">
          <p className="text-white font-semibold mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            Test Accounts Available
          </p>
          <div className="space-y-2 text-sm text-blue-50">
            <div className="flex justify-between items-center">
              <span className="font-medium">Admin:</span>
              <code className="bg-blue-900 bg-opacity-30 px-2 py-1 rounded">admin@school.com</code>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Teacher:</span>
              <code className="bg-blue-900 bg-opacity-30 px-2 py-1 rounded">teacher@school.com</code>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Student:</span>
              <code className="bg-blue-900 bg-opacity-30 px-2 py-1 rounded">student@school.com</code>
            </div>
            <p className="text-xs text-blue-100 pt-2 border-t border-blue-400 border-opacity-20">
              Password: <code className="bg-blue-900 bg-opacity-30 px-2 py-1 rounded">password123</code>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
