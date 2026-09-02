/**
 * Reset Password — set a new password from the emailed link.
 * The link is /reset-password?token=<resetToken>. On success we redirect to login.
 */
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FaSpinner, FaEye, FaEyeSlash } from 'react-icons/fa';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import authService from '@services/authService';

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });
type FormValues = z.infer<typeof schema>;

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } });

  const onSubmit = async (data: FormValues) => {
    if (!token) {
      setError('This reset link is invalid or has expired. Please request a new one.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authService.resetPassword(token, data.password);
      if (res.success === false) {
        setError(res.error || 'Could not reset your password. The link may have expired.');
      } else {
        setDone(true);
        setTimeout(() => navigate('/login', { replace: true }), 2500);
      }
    } catch (e: any) {
      setError('Could not reset your password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = (bad?: boolean) =>
    `w-full bg-[#1a1a2e] border rounded-xl px-4 py-3.5 pr-12 text-sm text-white placeholder-gray-600 outline-none transition-all disabled:opacity-50 ${
      bad ? 'border-red-500/50 focus:border-red-500' : 'border-white/[0.08] focus:border-[#00d4aa]/50 focus:ring-1 focus:ring-[#00d4aa]/20'
    }`;

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#00d4aa]/8 blur-[120px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[400px] h-[400px] rounded-full bg-purple-600/8 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="relative w-14 h-14 mx-auto mb-3">
            <div className="absolute inset-0 bg-[#00d4aa]/30 blur-xl rounded-2xl" />
            <img src="/logo.png" alt="WiSkul" className="relative w-14 h-14 rounded-2xl object-contain bg-white/95 p-1.5" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Wi<span className="text-[#00d4aa]">Skul</span>
          </h1>
        </div>

        <div className="relative">
          <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-br from-[#00d4aa]/40 via-[#7c3aed]/20 to-transparent opacity-70 blur-[2px]" />
          <div className="relative bg-[#16213e]/95 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-7 sm:p-9 shadow-2xl">
            {done ? (
              <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 flex items-center justify-center mb-4">
                  <CheckCircle2 className="text-emerald-400" size={26} />
                </div>
                <h2 className="text-xl font-black text-white mb-2">Password updated</h2>
                <p className="text-gray-400 text-sm">Redirecting you to sign in…</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="text-[#00d4aa]" size={20} />
                  <h2 className="text-2xl font-black text-white">Set a new password</h2>
                </div>
                <p className="text-gray-500 text-sm mb-6">Choose a strong password you haven't used before.</p>

                {error && (
                  <div className="mb-5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-300">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">New Password</label>
                    <div className="relative">
                      <input
                        type={show ? 'text' : 'password'}
                        {...register('password')}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        disabled={loading}
                        className={inputCls(!!errors.password)}
                      />
                      <button
                        type="button"
                        onClick={() => setShow(!show)}
                        tabIndex={-1}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-[#00d4aa]"
                        aria-label={show ? 'Hide password' : 'Show password'}
                      >
                        {show ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                      </button>
                    </div>
                    {errors.password && <p className="mt-1.5 text-xs text-red-400">{errors.password.message}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Confirm Password</label>
                    <input
                      type={show ? 'text' : 'password'}
                      {...register('confirm')}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      disabled={loading}
                      className={inputCls(!!errors.confirm).replace(' pr-12', '')}
                    />
                    {errors.confirm && <p className="mt-1.5 text-xs text-red-400">{errors.confirm.message}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#00d4aa] hover:bg-[#00e6b8] text-[#1a1a2e] font-black text-sm tracking-[0.1em] py-3.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading && <FaSpinner className="animate-spin w-4 h-4" />}
                    {loading ? 'UPDATING...' : 'UPDATE PASSWORD'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
