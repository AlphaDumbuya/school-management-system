/**
 * StorageSettings — tenant self-service file storage (UploadThing) configuration.
 *
 * Mirrors the per-tenant email sender UX: a school can keep the platform storage
 * account (default) or switch to its own UploadThing account by providing an API
 * token (+ optional app id). The stored token is never returned in plaintext —
 * only a masked hint is shown.
 */
import React, { useEffect, useState } from 'react';
import { HardDrive, Loader2, ShieldCheck, Info } from 'lucide-react';
import apiClient from '../../lib/apiClient';
import { showToast } from '@utils/toast';

interface StorageConfig {
  provider: 'platform' | 'own';
  configured: boolean;
  appId: string | null;
  tokenMasked: string | null;
}

export const StorageSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<StorageConfig | null>(null);
  const [mode, setMode] = useState<'platform' | 'own'>('platform');
  const [token, setToken] = useState('');
  const [appId, setAppId] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: StorageConfig }>('/api/v1/school-config/storage');
      if (res.success && res.data) {
        setConfig(res.data);
        setMode(res.data.provider);
        setAppId(res.data.appId || '');
      }
    } catch {
      showToast.error('Could not load storage settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiClient.post<{ success: boolean; message: string; data: StorageConfig }>(
        '/api/v1/school-config/storage',
        { provider: mode, uploadthingToken: mode === 'own' ? token.trim() || undefined : undefined, appId: mode === 'own' ? appId.trim() || undefined : undefined }
      );
      if (res.success) {
        showToast.success(res.message || 'Storage settings saved');
        setToken('');
        setConfig(res.data);
      } else {
        showToast.error((res as any).error || 'Failed to save');
      }
    } catch (e: any) {
      showToast.error(e?.response?.data?.error || 'Failed to save storage settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-10 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={22} /></div>;
  }

  const ownMissingToken = mode === 'own' && !config?.tokenMasked && !token.trim();

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-3.5 flex gap-2 text-xs text-blue-800">
        <Info size={16} className="shrink-0 mt-0.5" />
        <div>
          Configure where your school's uploaded files (logos, ID photos, documents) are stored.
          Use the platform account by default, or connect your own UploadThing account. Our setup
          team can help you obtain your UploadThing token.
        </div>
      </div>

      {config && (
        <div className="text-sm">
          Current:{' '}
          <span className={`font-bold ${config.provider === 'own' ? 'text-emerald-600' : 'text-blue-600'}`}>
            {config.provider === 'own' ? "School's own storage" : 'Platform storage'}
          </span>
          {config.provider === 'own' && config.tokenMasked && (
            <span className="ml-2 text-gray-400 font-mono">{config.tokenMasked}</span>
          )}
        </div>
      )}

      {/* Platform option */}
      <label className={`block rounded-xl border p-4 cursor-pointer ${mode === 'platform' ? 'border-blue-400 ring-2 ring-blue-500/20 bg-blue-50/40' : 'border-gray-200'}`}>
        <div className="flex items-start gap-3">
          <input type="radio" checked={mode === 'platform'} onChange={() => setMode('platform')} className="mt-1" />
          <div>
            <p className="font-semibold text-sm flex items-center gap-1.5"><HardDrive size={15} /> Platform storage (default)</p>
            <p className="text-xs text-gray-500 mt-0.5">Files are stored in the WiSkul platform account. Works immediately, no setup.</p>
          </div>
        </div>
      </label>

      {/* Own option */}
      <label className={`block rounded-xl border p-4 cursor-pointer ${mode === 'own' ? 'border-emerald-400 ring-2 ring-emerald-500/20 bg-emerald-50/40' : 'border-gray-200'}`}>
        <div className="flex items-start gap-3">
          <input type="radio" checked={mode === 'own'} onChange={() => setMode('own')} className="mt-1" />
          <div className="flex-1">
            <p className="font-semibold text-sm flex items-center gap-1.5"><ShieldCheck size={15} /> School's own UploadThing account</p>
            <p className="text-xs text-gray-500 mt-0.5 mb-3">Files are stored in your own UploadThing account. Paste your API token below.</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">UploadThing API Token</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-800"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={config?.tokenMasked ? `Saved (${config.tokenMasked}) — leave blank to keep` : 'sk_live_...'}
                  disabled={mode !== 'own'}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">App ID (optional)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-800"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder="your-app-id"
                  disabled={mode !== 'own'}
                />
              </div>
            </div>
          </div>
        </div>
      </label>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving || ownMissingToken}
          className="inline-flex items-center gap-1.5 bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-50 text-white font-bold text-sm px-4 py-2 rounded-lg"
        >
          {saving && <Loader2 className="animate-spin" size={14} />}
          Save Storage Settings
        </button>
      </div>
    </div>
  );
};

export default StorageSettings;
