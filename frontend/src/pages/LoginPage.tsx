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
import { ArrowRight, Fingerprint } from 'lucide-react';
import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import useAuth, { getDashboardPath } from '@hooks/useAuth';
import useAuthStore from '@store/authStore';
import authService from '@services/authService';
import { isAppMode } from '@lib/appMode';
import { PLATFORM_SUPPORT, platformSupportTel } from '@config/platform.config';
import CyberBackground from '@components/auth/CyberBackground';

const loginSchema = z.object({
  // Accepts an email (parents/staff) OR a student ID username (students).
  email: z.string().min(1, 'Username or email is required'),
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
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const user = useAuthStore((s) => s.user);
  const mfaToken = useAuthStore((s) => s.mfaToken);
  const loginErrorCode = useAuthStore((s) => s.loginErrorCode);
  const loginErrorContact = useAuthStore((s) => s.loginErrorContact);
  // Passkey support detection.
  //
  // Passkeys are a WEB/PWA-only feature here. They are intentionally NOT offered
  // in the native Android app: native passkeys require the app to be
  // release-signed and its cert bound to the domain via assetlinks.json, and
  // without that the WebView rejects every ceremony (NotAllowedError). To avoid
  // that broken/confusing experience we hide passkeys entirely in the app and
  // let users sign in with password + 2FA.
  //
  // Plain web: feature-detect WebAuthn and only show the button when supported.
  const [supportsPasskeys, setSupportsPasskeys] = useState(false);

  // Transient suspension banner: only shown right after a suspended session is
  // redirected here with `?suspended=1`. We read it ONCE, then strip the param
  // from the URL so it doesn't stick around and alarm users (or fresh visitors)
  // on subsequent visits / refreshes to the login screen.
  const [suspendedNotice, setSuspendedNotice] = useState(false);
  // Distinct notice for when THIS user's own account (not the whole school) was
  // deactivated / suspended / dismissed mid-session (`?disabled=1`).
  const [disabledNotice, setDisabledNotice] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    let changed = false;
    if (params.get('suspended') === '1') {
      setSuspendedNotice(true);
      params.delete('suspended');
      changed = true;
    }
    if (params.get('disabled') === '1') {
      setDisabledNotice(true);
      params.delete('disabled');
      changed = true;
    }
    if (changed) {
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, []);

  useEffect(() => {
    // Never show passkeys inside the native app shell.
    if (isAppMode()) {
      setSupportsPasskeys(false);
      return;
    }
    const detect = () =>
      typeof window !== 'undefined' &&
      (browserSupportsWebAuthn() || typeof (window as any).PublicKeyCredential !== 'undefined');
    if (detect()) {
      setSupportsPasskeys(true);
      return;
    }
    // Poll a few times in case the browser injects the API late.
    let tries = 0;
    const iv = setInterval(() => {
      tries += 1;
      if (detect()) {
        setSupportsPasskeys(true);
        clearInterval(iv);
      } else if (tries >= 6) {
        clearInterval(iv);
      }
    }, 500);
    return () => clearInterval(iv);
  }, []);

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

  /** Complete the second factor with a passkey instead of a typed code. */
  const onUsePasskey = async () => {
    if (!mfaToken) {
      setPasskeyError('Your session expired. Please sign in again.');
      return;
    }
    setPasskeyError(null);
    setPasskeyBusy(true);
    try {
      const optRes = await authService.getPasskeyAuthOptions(mfaToken);
      if (!optRes.success || !optRes.data) {
        setPasskeyError(optRes.error || 'No passkey available for this account.');
        return;
      }
      let assertion;
      try {
        assertion = await startAuthentication({ optionsJSON: optRes.data as any });
      } catch (err: any) {
        // Cancelled — silent, let them type a code. In the app, a NotAllowedError
        // can also mean no usable passkey here; guide them to the code instead.
        if (err?.name === 'AbortError') return;
        if (err?.name === 'NotAllowedError') {
          if (isAppMode()) setPasskeyError('No passkey available on this device. Enter your 6-digit code instead.');
          return;
        }
        setPasskeyError('Passkey sign-in was not completed. Enter your 6-digit code instead.');
        return;
      }
      const verifyRes = await authService.verifyPasskeyAuth(mfaToken, assertion);
      const verifiedUser = (verifyRes as any)?.data?.user || (verifyRes as any)?.user;
      if (verifyRes.success && verifiedUser) {
        useAuthStore.setState({ user: verifiedUser, isAuthenticated: true, mfaToken: null });
        navigate(getDashboardPath(verifiedUser.role), { replace: true });
      } else {
        setPasskeyError(verifyRes.error || 'Passkey sign-in failed.');
      }
    } catch {
      setPasskeyError('Passkey sign-in failed. Please try a code instead.');
    } finally {
      setPasskeyBusy(false);
    }
  };

  /** Passwordless: sign in with a passkey directly (no email/password). */
  const onPasswordlessPasskey = async () => {
    setPasskeyError(null);
    setPasskeyBusy(true);
    try {
      const optRes = await authService.getPasskeyLoginOptions();
      if (!optRes.success || !optRes.data) {
        setPasskeyError(optRes.error || 'Passkey sign-in is unavailable right now.');
        return;
      }
      let assertion;
      try {
        assertion = await startAuthentication({ optionsJSON: optRes.data as any });
      } catch (err: any) {
        // On the web a NotAllowedError almost always means the user dismissed
        // the prompt — stay silent. In the app it can ALSO mean the device has
        // no passkey for this account yet, or the app build isn't bound to the
        // domain (Digital Asset Links) — so give an actionable message instead
        // of failing silently.
        if (err?.name === 'AbortError') return;
        if (err?.name === 'NotAllowedError') {
          if (isAppMode()) {
            setPasskeyError('No passkey available on this device. Sign in with your password — you can add a passkey later in Settings → Security.');
          }
          return;
        }
        setPasskeyError('Passkey sign-in was not completed. Please sign in with your password.');
        return;
      }
      const verifyRes = await authService.verifyPasskeyLogin(assertion);
      const verifiedUser = (verifyRes as any)?.data?.user || (verifyRes as any)?.user;
      if (verifyRes.success && verifiedUser) {
        useAuthStore.setState({ user: verifiedUser, isAuthenticated: true, mfaToken: null });
        navigate(getDashboardPath(verifiedUser.role), { replace: true });
      } else {
        setPasskeyError(verifyRes.error || 'No passkey found for this device. Sign in with your password.');
      }
    } catch {
      setPasskeyError('Passkey sign-in failed. Please use your password.');
    } finally {
      setPasskeyBusy(false);
    }
  };

  const displayError =
    typeof error === 'string' ? error : error ? 'Login failed. Please try again.' : null;

  // Distinguish the two access-denied cases using the backend error code:
  //  - ACCOUNT_INACTIVE  → THIS user's own account (suspend/dismiss/deactivate).
  //    They must contact their SCHOOL (tenant) — we show the school's contact.
  //  - TENANT_SUSPENDED* → the whole school is suspended (a platform action).
  //    The owner is pointed to WiSkul; other users to their school admin.
  const isAccountDisabledError = loginErrorCode === 'ACCOUNT_INACTIVE';
  const isTenantSuspensionError =
    loginErrorCode === 'TENANT_SUSPENDED' || loginErrorCode === 'TENANT_SUSPENDED_USER' || loginErrorCode === 'TENANT_UNAVAILABLE' ||
    (!loginErrorCode && !!displayError && /suspend|inactive|not active|restore access|school administrator/i.test(displayError));
  const isSuspensionError = isTenantSuspensionError; // school-level banner trigger
  const isOwnerSuspension =
    loginErrorCode === 'TENANT_SUSPENDED' ||
    (!loginErrorCode && !!displayError && /wiskul support|restore access/i.test(displayError));

  const inputBase =
    'w-full bg-white border rounded-xl px-4 py-3.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all disabled:opacity-50';
  const inputState = (bad?: boolean) =>
    bad
      ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500/20'
      : 'border-slate-200 focus:border-[#1d4ed8] focus:ring-1 focus:ring-[#1d4ed8]/20';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#16235c] via-[#1a2b6b] to-[#20308a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated aurora background (matches Forgot/Reset password pages) */}
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

              {supportsPasskeys && (
                <>
                  <div className="flex items-center gap-3 text-blue-100/40 text-[11px]">
                    <span className="flex-1 h-px bg-white/15" /> or <span className="flex-1 h-px bg-white/15" />
                  </div>
                  {passkeyError && (
                    <p className="text-[11px] text-red-200 text-center">{passkeyError}</p>
                  )}
                  <button
                    type="button" onClick={onUsePasskey} disabled={passkeyBusy || isLoading}
                    className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm py-3.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.98]"
                  >
                    {passkeyBusy ? <FaSpinner className="animate-spin w-4 h-4" /> : <Fingerprint size={16} />}
                    {passkeyBusy ? 'WAITING FOR PASSKEY…' : 'USE A PASSKEY'}
                  </button>
                </>
              )}

              <button
                type="button" onClick={() => { setMfaStep(false); setMfaCode(''); setPasskeyError(null); }}
                className="w-full text-blue-100/60 text-xs hover:text-white transition-colors"
              >
                ← Back to sign in
              </button>
            </form>
          ) : (
            <>
              {(suspendedNotice || isSuspensionError) && (
                <div className="max-w-3xl mx-auto mb-5 bg-red-500/15 border border-red-400/40 rounded-xl px-4 py-4 text-red-50">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-base">⛔</span>
                    {(suspendedNotice || isOwnerSuspension) ? (
                      // Account OWNER (or generic redirect): show resolution steps + support contacts.
                      <div className="space-y-2">
                        <p className="text-sm font-bold">Your school account is suspended or inactive</p>
                        <p className="text-xs text-red-100/90 leading-relaxed">
                          Access has been paused by WiSkul. This is usually due to an overdue
                          subscription or a pending review. To restore access:
                        </p>
                        <ul className="text-xs text-red-100/90 list-disc pl-4 space-y-1">
                          <li>Check your email — we sent the account owner a secure link to resolve this (pay to restore, or request reactivation).</li>
                          <li>Or contact WiSkul support below with your school name.</li>
                          <li>Once resolved, sign in again — access is restored right away.</li>
                        </ul>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <a
                            href={`mailto:${PLATFORM_SUPPORT.email}?subject=Account%20suspended%20-%20restore%20access`}
                            className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/25 rounded-lg px-3 py-2 text-xs font-semibold transition-colors break-all"
                          >
                            ✉ {PLATFORM_SUPPORT.email}
                          </a>
                          <a
                            href={platformSupportTel()}
                            className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/25 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
                          >
                            📞 {PLATFORM_SUPPORT.phone}
                          </a>
                        </div>
                      </div>
                    ) : (
                      // Regular user: can't resolve it — point them to their school admin.
                      <div className="space-y-2">
                        <p className="text-sm font-bold">Your school account is currently suspended</p>
                        <p className="text-xs text-red-100/90 leading-relaxed">
                          Access to your school portal has been paused. You can't restore this
                          yourself — please contact your school administrator, who received an email
                          with a link to resolve it. Your data is safe and nothing has been lost.
                        </p>
                        <p className="text-xs text-red-100/90 leading-relaxed">
                          Still need help? Reach WiSkul support:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={`mailto:${PLATFORM_SUPPORT.email}?subject=School%20account%20suspended%20-%20help`}
                            className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/25 rounded-lg px-3 py-2 text-xs font-semibold transition-colors break-all"
                          >
                            ✉ {PLATFORM_SUPPORT.email}
                          </a>
                          <a
                            href={platformSupportTel()}
                            className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/25 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
                          >
                            📞 {PLATFORM_SUPPORT.phone}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {(disabledNotice || isAccountDisabledError) && (
                <div className="max-w-3xl mx-auto mb-5 bg-red-500/15 border border-red-400/40 rounded-xl px-4 py-4 text-red-50">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-base">🚫</span>
                    <div className="space-y-2">
                      <p className="text-sm font-bold">Your account has been disabled</p>
                      <p className="text-xs text-red-100/90 leading-relaxed">
                        Your access was deactivated, suspended, or dismissed by your school
                        administrator, so your session was ended. If you believe this is a mistake,
                        please contact your school{loginErrorContact?.schoolName ? ` — ${loginErrorContact.schoolName}` : ''} to review your account.
                      </p>
                      {(loginErrorContact?.email || loginErrorContact?.phone) && (
                        <div className="flex flex-wrap gap-2">
                          {loginErrorContact?.email && (
                            <a
                              href={`mailto:${loginErrorContact.email}?subject=Account%20access%20-%20review%20request`}
                              className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/25 rounded-lg px-3 py-2 text-xs font-semibold transition-colors break-all"
                            >
                              ✉ {loginErrorContact.email}
                            </a>
                          )}
                          {loginErrorContact?.phone && (
                            <a
                              href={`tel:${loginErrorContact.phone.replace(/\s+/g, '')}`}
                              className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/25 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
                            >
                              📞 {loginErrorContact.phone}
                            </a>
                          )}
                        </div>
                      )}
                      {!(loginErrorContact?.email || loginErrorContact?.phone) && (
                        <p className="text-xs text-red-100/90 leading-relaxed">
                          We've also emailed you the reason and your school's support contact.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {!online && (
                <div className="max-w-3xl mx-auto mb-5 bg-amber-500/20 border border-amber-400/40 rounded-xl px-4 py-3 text-xs text-amber-100 flex items-start gap-2">
                  <span className="mt-0.5">📶</span>
                  <span>You may be offline. If sign in fails, check your connection and try again.</span>
                </div>
              )}
              {displayError && !isSuspensionError && !isAccountDisabledError && (
                <div className="max-w-3xl mx-auto mb-5 bg-red-500/20 border border-red-400/40 rounded-xl px-4 py-3 text-xs text-red-100 animate-shake flex items-center gap-2">
                  <span>⚠</span> {displayError}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Email + password stacked (portrait) */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-blue-100/80 mb-2 uppercase tracking-wider">Username or Email</label>
                    <input
                      type="text" {...register('email')} placeholder="Student ID or you@school.com"
                      autoComplete="username" disabled={isLoading}
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
                  type="submit" disabled={isLoading}
                  className="group w-full bg-[#f59e0b] hover:bg-[#d97706] text-white font-black text-sm tracking-[0.1em] py-3.5 rounded-xl transition-all duration-300 shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {isLoading && <FaSpinner className="animate-spin w-4 h-4" />}
                  {isLoading ? 'SIGNING IN...' : 'SIGN IN'}
                  {!isLoading && <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />}
                </button>
              </form>

              {/* Passwordless passkey sign-in (fallback: password above / 2FA after) */}
              {supportsPasskeys && (
                <div className="mt-4">
                  <div className="flex items-center gap-3 text-blue-100/40 text-[11px] mb-3">
                    <span className="flex-1 h-px bg-white/15" /> or <span className="flex-1 h-px bg-white/15" />
                  </div>
                  {passkeyError && (
                    <p className="text-[11px] text-red-200 text-center mb-2">{passkeyError}</p>
                  )}
                  <button
                    type="button" onClick={onPasswordlessPasskey} disabled={passkeyBusy || isLoading}
                    className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm py-3.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.98]"
                  >
                    {passkeyBusy ? <FaSpinner className="animate-spin w-4 h-4" /> : <Fingerprint size={16} />}
                    {passkeyBusy ? 'WAITING FOR PASSKEY…' : 'SIGN IN WITH A PASSKEY'}
                  </button>
                </div>
              )}

              <div className="mt-6 pt-5 border-t border-white/10 text-center space-y-2">
                {/* School registration is a public/web action — hide it inside the app. */}
                {!isAppMode() && (
                  <p className="text-blue-100/70 text-xs">
                    Registering a new school?{' '}
                    <button
                      type="button" onClick={() => navigate('/register')}
                      className="text-amber-400 font-semibold hover:text-amber-300 transition-colors underline underline-offset-2"
                    >
                      Register School Free
                    </button>
                  </p>
                )}
                <p className="text-blue-100/50 text-[11px]">
                  {isAppMode()
                    ? 'No account? Accounts are created by your school administrator — please contact your school admin for login details.'
                    : 'Students & Staff: Contact your school principal for portal access.'}
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

        {/* Brand attribution */}
        <p className="mt-4 text-center text-[11px] text-white/50">
          Powered by <span className="font-bold text-white">Wi<span className="text-amber-400">Skul</span></span>
        </p>
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
