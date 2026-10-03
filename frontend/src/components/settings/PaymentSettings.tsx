/**
 * PaymentSettings — tenant self-service Monime configuration for collecting
 * FEE payments into the SCHOOL's OWN Monime account.
 *
 * MONEY ROUTING (critical): student/parent fee payments settle into the account
 * configured here — never the platform's. Until a school saves usable Monime
 * credentials, online fee payment is disabled for that school (the backend
 * refuses to route fee money to the platform account).
 *
 * The access token is encrypted at rest and never returned in plaintext — only
 * a masked hint is shown.
 */
import React, { useEffect, useState } from 'react';
import { CreditCard, Loader2, ShieldCheck, Info, CheckCircle2, XCircle } from 'lucide-react';
import schoolConfigService from '../../services/schoolConfigService';
import { showToast } from '@utils/toast';

interface MonimeConfig {
  configured: boolean;
  spaceId: string | null;
  tokenMasked: string | null;
}

export const PaymentSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<MonimeConfig | null>(null);
  const [accessToken, setAccessToken] = useState('');
  const [spaceId, setSpaceId] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await schoolConfigService.getMonimeConfig();
      if (res.success && res.data) {
        setConfig(res.data);
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

  const save = async () => {
    // Client validation — space id always required; token required first time.
    if (!spaceId.trim()) {
      showToast.error('Your Monime Space ID is required.');
      return;
    }
    if (!config?.tokenMasked && !accessToken.trim()) {
      showToast.error('Your Monime access token is required.');
      return;
    }
    setSaving(true);
    try {
      const res = await schoolConfigService.saveMonimeConfig({
        accessToken: accessToken.trim() || undefined,
        spaceId: spaceId.trim(),
        enabled: true,
      });
      if (res.success) {
        showToast.success(res.message || 'Payment settings saved');
        setAccessToken('');
        setConfig(res.data);
      } else {
        showToast.error((res as any).error || 'Failed to save');
      }
    } catch (e: any) {
      showToast.error(e?.response?.data?.error || 'Failed to save payment settings');
    } finally {
      setSaving(false);
    }
  };

  const disable = async () => {
    setSaving(true);
    try {
      const res = await schoolConfigService.saveMonimeConfig({ enabled: false });
      if (res.success) {
        showToast.success(res.message || 'Online payments turned off');
        setConfig(res.data);
      } else {
        showToast.error((res as any).error || 'Failed to turn off online payments');
      }
    } catch (e: any) {
      showToast.error(e?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
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
      <div className="text-sm flex items-center gap-2">
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
        {config?.configured && config?.tokenMasked && (
          <span className="ml-2 text-gray-400 font-mono">{config.tokenMasked}</span>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 p-4">
        <p className="font-semibold text-sm flex items-center gap-1.5 mb-3">
          <ShieldCheck size={15} /> School's Monime account
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
              Monime Access Token <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-800"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder={config?.tokenMasked ? `Saved (${config.tokenMasked}) — leave blank to keep` : 'mon_...'}
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
              Monime Space ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-800"
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
              placeholder="spc_..."
            />
          </div>
        </div>
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
