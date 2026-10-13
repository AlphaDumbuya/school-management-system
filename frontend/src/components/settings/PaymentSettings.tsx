/**
 * PaymentSettings — tenant self-service Monime configuration for collecting
 * FEE payments into the SCHOOL's OWN Monime account.
 *
 * MONEY ROUTING (critical): student/parent fee payments settle into the account
 * configured here — never the platform's. Until a school saves usable Monime
 * credentials, online fee payment is disabled for that school (the backend
 * refuses to route fee money to the platform account).
 *
 * Because this decides where the money goes, every change (including turning
 * it off) asks for the principal's password again, and the 6-digit code when
 * two-factor sign-in is on. The access token is encrypted on the server and is
 * never sent back to the browser.
 */
import React, { useEffect, useState } from 'react';
import { CreditCard, Loader2, ShieldCheck, Info, CheckCircle2, XCircle, Lock } from 'lucide-react';
import schoolConfigService from '../../services/schoolConfigService';
import { showToast } from '@utils/toast';

interface MonimeConfig {
  configured: boolean;
  spaceId: string | null;
  tokenMasked: string | null;
  twoFactorRequired?: boolean;
  lastChange?: { at: string; by: string | null } | null;
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-800';
const labelCls = 'block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1';

export const PaymentSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<MonimeConfig | null>(null);
  const [accessToken, setAccessToken] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await schoolConfigService.getMonimeConfig();
      if (res.success && res.data) {
        setConfig(res.data as MonimeConfig);
        setSpaceId(res.data.spaceId || '');
        setNeedsCode(!!(res.data as MonimeConfig).twoFactorRequired);
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

  /** Send a change. The password (and code) are always sent fresh and cleared afterwards. */
  const send = async (payload: { accessToken?: string; spaceId?: string; enabled: boolean }) => {
    setProblem(null);
    if (!password) {
      setProblem('Enter your password to change payment settings.');
      return;
    }
    if (needsCode && !twoFactorCode.trim()) {
      setProblem('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setSaving(true);
    try {
      const res: any = await schoolConfigService.saveMonimeConfig({
        ...payload,
        currentPassword: password,
        twoFactorCode: needsCode ? twoFactorCode.trim() : undefined,
      });
      if (res.success) {
        showToast.success(res.message || 'Payment settings saved');
        setAccessToken('');
        setConfig(res.data as MonimeConfig);
        setNeedsCode(!!res.data?.twoFactorRequired);
      } else {
        if (res.code === 'TWO_FACTOR_REQUIRED') setNeedsCode(true);
        setProblem(res.error || 'Failed to save payment settings');
      }
    } catch (e: any) {
      setProblem(e?.response?.data?.error || e?.message || 'Failed to save payment settings');
    } finally {
      setPassword('');
      setTwoFactorCode('');
      setSaving(false);
    }
  };

  const save = async () => {
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

      <div className="rounded-xl border border-gray-200 p-4">
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
      </div>

      {/* Confirm it's the principal */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
        <p className="font-semibold text-sm flex items-center gap-1.5 mb-1 text-amber-900">
          <Lock size={15} /> Confirm it's you
        </p>
        <p className="text-xs text-amber-800 mb-3">
          These settings decide where your school's fee money goes, so we ask for your password every time you change them.
          Your principals and school email will be told about the change.
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
        </div>
        {problem && <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{problem}</p>}
      </div>

      <div className="flex justify-between items-center">
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
          disabled={saving}
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
