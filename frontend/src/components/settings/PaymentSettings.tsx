/**
 * PaymentSettings — tenant self-service Monime configuration for collecting
 * FEE payments into the SCHOOL's OWN Monime account.
 *
 * MONEY ROUTING (critical): student/parent fee payments settle into the account
 * configured here — never the platform's. Until a school saves usable Monime
 * credentials, online fee payment is disabled for that school (the backend
 * refuses to route fee money to the platform account).
 *
 * Because this decides where the money goes:
 *  - only a school verified by WiSkul can connect or change the account
 *    (turning online payments off is always allowed, as an emergency stop);
 *  - every change asks for the owner's password again plus a second check:
 *    the 6-digit code from their authenticator app when two-factor sign-in is
 *    on, otherwise a one-time code emailed to them (not needed to turn off).
 * The access token is encrypted on the server and never sent back to the browser.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Loader2, ShieldCheck, Info, CheckCircle2, XCircle, Lock, Mail, BadgeCheck } from 'lucide-react';
import schoolConfigService, { type MonimeConfigView } from '../../services/schoolConfigService';
import { showToast } from '@utils/toast';

type MonimeConfig = MonimeConfigView;

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-800';
const labelCls = 'block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1';

/** Why the account cannot be connected or changed yet (null when verified). */
function verificationNotice(status?: string): string | null {
  if (!status || status === 'verified') return null;
  if (status === 'pending') return 'Your school verification is waiting for review by WiSkul. You can connect or change your payment account once it is approved.';
  if (status === 'rejected') return 'Your school verification was not approved. Open Verify school to see why and submit again.';
  return 'Verify your school before connecting or changing where fee payments go. WiSkul reviews it, usually within one working day.';
}

export const PaymentSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<MonimeConfig | null>(null);
  const [accessToken, setAccessToken] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);

  const applyConfig = (data: MonimeConfig) => {
    setConfig(data);
    setNeedsCode(!!data.twoFactorRequired);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await schoolConfigService.getMonimeConfig();
      if (res.success && res.data) {
        applyConfig(res.data as MonimeConfig);
        setSpaceId(res.data.spaceId || '');
      } else {
        showToast.error((res as any).error || 'Could not load payment settings');
      }
    } catch {
      showToast.error('Could not load payment settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Count down until another code may be asked for.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  const verified = !config?.verificationStatus || config.verificationStatus === 'verified';
  const notice = verificationNotice(config?.verificationStatus);
  // Without an authenticator app, changes are confirmed with an emailed code.
  const needsEmailCode = !needsCode && config?.emailCodeRequired !== false;

  const requestEmailCode = async () => {
    setProblem(null);
    setSendingCode(true);
    try {
      const res: any = await schoolConfigService.sendMonimeEmailCode();
      if (res.success) {
        setCodeSentTo(res.data?.sentTo || config?.ownerEmailMasked || 'your email');
        setResendIn(Number(res.data?.resendInSeconds) || 60);
        showToast.success(res.message || 'Code sent');
      } else {
        setProblem(res.error || 'Could not send the code. Please try again.');
      }
    } catch (e: any) {
      setProblem(e?.response?.data?.error || e?.message || 'Could not send the code. Please try again.');
    } finally {
      setSendingCode(false);
    }
  };

  /**
   * Send a change. The password and codes are always sent fresh and cleared
   * afterwards. Turning payments off needs no emailed code (emergency stop).
   */
  const send = async (payload: { accessToken?: string; spaceId?: string; enabled: boolean }) => {
    setProblem(null);
    const turningOff = payload.enabled === false;
    if (!password) {
      setProblem('Enter your password to change payment settings.');
      return;
    }
    if (needsCode && !twoFactorCode.trim()) {
      setProblem('Enter the 6-digit code from your authenticator app.');
      return;
    }
    if (!turningOff && needsEmailCode && !/^\d{6}$/.test(emailCode.trim())) {
      setProblem(codeSentTo
        ? 'Enter the 6-digit code we emailed you.'
        : 'Choose "Email me a code", then enter the 6-digit code we send you.');
      return;
    }
    setSaving(true);
    try {
      const res: any = await schoolConfigService.saveMonimeConfig({
        ...payload,
        currentPassword: password,
        twoFactorCode: needsCode ? twoFactorCode.trim() : undefined,
        emailCode: !turningOff && needsEmailCode ? emailCode.trim() : undefined,
      });
      if (res.success) {
        showToast.success(res.message || 'Payment settings saved');
        setAccessToken('');
        setCodeSentTo(null);
        applyConfig(res.data as MonimeConfig);
      } else {
        if (res.code === 'TWO_FACTOR_REQUIRED') setNeedsCode(true);
        if (res.code === 'SCHOOL_VERIFICATION_REQUIRED') load();
        setProblem(res.error || 'Failed to save payment settings');
      }
    } catch (e: any) {
      setProblem(e?.response?.data?.error || e?.message || 'Failed to save payment settings');
    } finally {
      setPassword('');
      setTwoFactorCode('');
      setEmailCode('');
      setSaving(false);
    }
  };

  const save = async () => {
    if (!verified) {
      setProblem(notice);
      return;
    }
    if (!spaceId.trim()) {
      setProblem('Your Monime Space ID is required.');
      return;
    }
    if (!config?.tokenMasked && !accessToken.trim()) {
      setProblem('Your Monime access token is required.');
      return;
    }
    await send({ accessToken: accessToken.trim() || undefined, spaceId: spaceId.trim(), enabled: true });
  };

  const disable = async () => {
    if (!window.confirm('Turn off online fee payments for your school? Parents and students will not be able to pay online until you turn it on again.')) return;
    await send({ enabled: false });
  };

  if (loading) {
    return <div className="py-10 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={22} /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-3.5 flex gap-2 text-xs text-blue-800">
        <Info size={16} className="shrink-0 mt-0.5" />
        <div>
          Connect your school's own Monime account so online fee payments from
          students and parents settle directly into <strong>your</strong> account.
          Until this is set up, online fee payment stays turned off for your school.
          Find your access token and Space ID in your Monime dashboard.
        </div>
      </div>

      {notice && (
        <div role="status" className="rounded-xl bg-amber-50 border border-amber-300 p-3.5 flex gap-2 text-xs text-amber-900">
          <BadgeCheck size={16} className="shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p className="font-semibold">Only a verified school can connect or change its payment account.</p>
            <p>{notice}</p>
            {config?.configured && <p>You can still turn online payments off below.</p>}
            {config?.verificationStatus !== 'pending' && (
              <Link to="/verify-school" className="inline-block font-bold text-amber-900 underline underline-offset-2">
                Verify school
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Current status */}
      <div className="text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
        Status:{' '}
        {config?.configured ? (
          <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
            <CheckCircle2 size={15} /> Online fee payments enabled
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-bold text-gray-500">
            <XCircle size={15} /> Not configured — online fee payments off
          </span>
        )}
        {config?.lastChange && (
          <span className="text-xs text-gray-400">
            · Last changed {new Date(config.lastChange.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {config.lastChange.by ? ` by ${config.lastChange.by}` : ''}
          </span>
        )}
      </div>

      <fieldset disabled={!verified} className="rounded-xl border border-gray-200 p-4 disabled:opacity-60">
        <legend className="sr-only">School's Monime account</legend>
        <p className="font-semibold text-sm flex items-center gap-1.5 mb-3">
          <ShieldCheck size={15} /> School's Monime account
        </p>
        <div className="space-y-3">
          <div>
            <label htmlFor="monime-token" className={labelCls}>
              Monime Access Token <span className="text-red-500">*</span>
            </label>
            <input
              id="monime-token"
              type="password"
              className={inputCls}
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder={config?.tokenMasked ? 'A token is saved — leave blank to keep it' : 'mon_...'}
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-1 text-[11px] text-gray-400">For safety the saved token is never shown again.</p>
          </div>
          <div>
            <label htmlFor="monime-space" className={labelCls}>
              Monime Space ID <span className="text-red-500">*</span>
            </label>
            <input
              id="monime-space"
              type="text"
              className={inputCls}
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
              placeholder="spc_..."
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>
      </fieldset>

      {/* Confirm it's the owner */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
        <p className="font-semibold text-sm flex items-center gap-1.5 mb-1 text-amber-900">
          <Lock size={15} /> Confirm it's you
        </p>
        <p className="text-xs text-amber-800 mb-3">
          These settings decide where your school's fee money goes, so every change needs your password
          {needsCode
            ? ' and the code from your authenticator app.'
            : ' and a one-time code we email to you.'}
          {' '}The school owner(s) and the school email are told about every change.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="monime-password" className={labelCls}>Your password</label>
            <input
              id="monime-password"
              type="password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your sign-in password"
              autoComplete="current-password"
            />
          </div>
          {needsCode && (
            <div>
              <label htmlFor="monime-2fa" className={labelCls}>Authenticator code</label>
              <input
                id="monime-2fa"
                type="text"
                inputMode="numeric"
                className={inputCls}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                placeholder="123456"
                autoComplete="one-time-code"
                maxLength={20}
              />
            </div>
          )}
          {needsEmailCode && verified && (
            <div>
              <label htmlFor="monime-email-code" className={labelCls}>Code from your email</label>
              <div className="flex gap-2">
                <input
                  id="monime-email-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={inputCls}
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  autoComplete="one-time-code"
                  maxLength={6}
                  aria-describedby="monime-email-code-help"
                />
                <button
                  type="button"
                  onClick={requestEmailCode}
                  disabled={sendingCode || resendIn > 0}
                  className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-amber-300 bg-white text-xs font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                >
                  {sendingCode ? <Loader2 className="animate-spin" size={13} /> : <Mail size={13} />}
                  {resendIn > 0 ? `Resend in ${resendIn}s` : codeSentTo ? 'Send again' : 'Email me a code'}
                </button>
              </div>
              <p id="monime-email-code-help" className="mt-1 text-[11px] text-amber-800" aria-live="polite">
                {codeSentTo
                  ? `Sent to ${codeSentTo}. It works once and expires in 10 minutes.`
                  : `We send it to ${config?.ownerEmailMasked || 'your email'}. Turn on two-factor sign-in to use your authenticator app instead.`}
              </p>
            </div>
          )}
        </div>
        {problem && <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{problem}</p>}
      </div>

      <div className="flex justify-between items-center gap-3">
        {config?.configured ? (
          <button
            onClick={disable}
            disabled={saving}
            className="text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            Turn off online payments
          </button>
        ) : <span />}
        <button
          onClick={save}
          disabled={saving || !verified}
          title={!verified ? 'Your school must be verified by WiSkul first' : undefined}
          className="inline-flex items-center gap-1.5 bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-50 text-white font-bold text-sm px-4 py-2 rounded-lg"
        >
          {saving && <Loader2 className="animate-spin" size={14} />}
          <CreditCard size={15} /> Save Payment Settings
        </button>
      </div>
    </div>
  );
};

export default PaymentSettings;
