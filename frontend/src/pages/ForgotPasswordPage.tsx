/**
 * Forgot Password — request a reset link.
 * Matches the LoginPage dark aesthetic. On submit we always show a neutral
 * success message (we never reveal whether an account exists).
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FaSpinner } from 'react-icons/fa';
import { MailCheck, ArrowLeft } from 'lucide-react';
import authService from '@services/authService';
import CyberBackground from '@components/auth/CyberBackground';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
});
type FormValues = z.infer<typeof schema>;

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authService.forgotPassword(data.email);
      // statusCode 0 = offline sentinel; treat anything else as "we tried".
      if (res.success === false && (res as any).statusCode === 0) {
        setError("You're offline. Connect to the internet to request a reset link.");
      } else {
        setSent(true);
      }
    } catch {
      // Still show neutral success — don't leak account existence.
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#16235c] via-[#1a2b6b] to-[#20308a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated aurora background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="auth-blob-1 absolute top-[-20%] left-[-12%] w-[520px] h-[520px] rounded-full bg-[#2563eb]/25 blur-[120px]" />
        <div className="auth-blob-2 absolute bottom-[-20%] right-[-12%] w-[460px] h-[460px] rounded-full bg-amber-400/15 blur-[130px]" />
        <div className="auth-blob-3 absolute top-1/4 left-1/2 w-[420px] h-[420px] rounded-full bg-fuchsia-500/15 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)', backgroundSize: '26px 26px' }}
        />
      </div>

      {/* Animated 3D cyber scene */}
      <CyberBackground />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8 cursor-pointer" onClick={() => navigate('/')}>
          <div className="relative w-14 h-14 mx-auto mb-3">
            <div className="absolute inset-0 bg-amber-400/30 blur-xl rounded-2xl" />
            <img src="/logo.png" alt="WiSkul" className="relative w-14 h-14 rounded-2xl object-contain bg-white/95 p-1.5" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Wi<span className="text-amber-400">Skul</span>
          </h1>
        </div>

        <div className="relative">
          <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-br from-amber-400/40 via-[#1d4ed8]/20 to-transparent opacity-70 blur-[2px]" />
          <div className="relative bg-[#20308a]/95 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-7 sm:p-9 shadow-2xl">
            {sent ? (
              <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#1d4ed8]/15 flex items-center justify-center mb-4">
                  <MailCheck className="text-amber-400" size={26} />
                </div>
                <h2 className="text-xl font-black text-white mb-2">Check your email</h2>
                <p className="text-gray-400 text-sm leading-relaxed">
                  If an account exists for <strong className="text-gray-200">{getValues('email')}</strong>,
                  we've sent a link to reset your password. The link expires in 1 hour.
                </p>
                <button
                  onClick={() => navigate('/login')}
                  className="mt-6 w-full bg-[#f59e0b] hover:bg-[#d97706] text-white font-black text-sm py-3.5 rounded-xl transition-all"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-black text-white">Forgot your password?</h2>
                <p className="text-gray-500 text-sm mt-1 mb-6">
                  Enter your account email and we'll send you a reset link.
                </p>

                {error && (
                  <div className="mb-5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-200">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
                      Email Address
                    </label>
                    <input
                      type="email"
                      {...register('email')}
                      placeholder="you@school.com"
                      autoComplete="email"
                      disabled={loading}
                      className={`w-full bg-[#16235c] border rounded-xl px-4 py-3.5 text-sm text-white placeholder-gray-600 outline-none transition-all disabled:opacity-50 ${
                        errors.email
                          ? 'border-red-500/50 focus:border-red-500'
                          : 'border-white/[0.08] focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20'
                      }`}
                    />
                    {errors.email && <p className="mt-1.5 text-xs text-red-400">{errors.email.message}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#f59e0b] hover:bg-[#d97706] text-white font-black text-sm tracking-[0.1em] py-3.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading && <FaSpinner className="animate-spin w-4 h-4" />}
                    {loading ? 'SENDING...' : 'SEND RESET LINK'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        <button
          onClick={() => navigate('/login')}
          className="mt-6 mx-auto flex items-center gap-1.5 text-gray-500 text-xs hover:text-gray-300 transition-colors"
        >
          <ArrowLeft size={13} /> Back to Sign In
        </button>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
