/**
 * TwoFactorSettings — enable/disable authenticator-app 2FA.
 * Flow: Setup (fetch secret + QR) → scan → enter code → enable → show backup
 * codes once. When enabled, offer disable + regenerate backup codes.
 */
import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff, Copy, Check, Loader2, KeyRound, RefreshCw } from 'lucide-react';
import QRCode from 'qrcode';
import authService from '@services/authService';
import useAuthStore from '@store/authStore';
import { showToast } from '@utils/toast';

export const TwoFactorSettings: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const enabled = !!(user as any)?.two_factor_enabled;

  const [mode, setMode] = useState<'idle' | 'setup' | 'disable' | 'regenerate'>('idle');
  const [loading, setLoading] = useState(false);
  const [secret, setSecret] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (mode === 'setup' && secret) return;
    if (mode !== 'setup') { setSecret(''); setQrDataUrl(''); setCode(''); }
  }, [mode, secret]);

  const beginSetup = async () => {
    setLoading(true);
    try {
      const res = await authService.setupTwoFactor();
      if (res.success && res.data) {
        setSecret(res.data.secret);
        const url = await QRCode.toDataURL(res.data.otpauthUri, { margin: 1, width: 220 });
        setQrDataUrl(url);
        setMode('setup');
      } else {
        showToast.error(res.error || 'Could not start 2FA setup');
      }
    } catch {
      showToast.error('Could not start 2FA setup');
    } finally {
      setLoading(false);
    }
  };

  const confirmEnable = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await authService.enableTwoFactor(code.trim());
      if (res.success && res.data) {
        setBackupCodes(res.data.backupCodes);
        setMode('idle');
        setCode('');
        if (user) setUser({ ...(user as any), two_factor_enabled: true });
        showToast.success('Two-factor authentication enabled');
      } else {
        showToast.error(res.error || 'Invalid code');
      }
    } catch {
      showToast.error('Could not enable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const confirmDisable = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await authService.disableTwoFactor(code.trim());
      if (res.success) {
        setMode('idle');
        setCode('');
        setBackupCodes([]);
        if (user) setUser({ ...(user as any), two_factor_enabled: false });
        showToast.success('Two-factor authentication disabled');
      } else {
        showToast.error(res.error || 'Invalid code');
      }
    } catch {
      showToast.error('Could not disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const confirmRegenerate = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await authService.regenerateBackupCodes(code.trim());
      if (res.success && res.data) {
        setBackupCodes(res.data.backupCodes);
        setMode('idle');
        setCode('');
        showToast.success('New backup codes generated');
      } else {
        showToast.error(res.error || 'Invalid code');
      }
    } catch {
      showToast.error('Could not regenerate backup codes');
    } finally {
      setLoading(false);
    }
  };

  const copyBackup = () => {
    navigator.clipboard.writeText(backupCodes.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
          {enabled ? <ShieldCheck size={22} /> : <ShieldOff size={22} />}
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Two-Factor Authentication</h3>
          <p className="text-sm text-gray-500">
            Add a second layer of security using an authenticator app (Google
            Authenticator, Authy, Microsoft Authenticator).
          </p>
          <span className={`inline-block mt-2 text-xs font-bold px-2.5 py-1 rounded-full ${enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
            {enabled ? 'Enabled' : 'Not enabled'}
          </span>
        </div>
      </div>

      {/* Backup codes just generated */}
      {backupCodes.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound size={16} className="text-amber-600" />
            <p className="font-bold text-amber-900 text-sm">Save your backup codes</p>
          </div>
          <p className="text-xs text-amber-800 mb-3">
            Each code works once if you lose access to your authenticator. Store them
            somewhere safe — they won't be shown again.
          </p>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm text-gray-800">
            {backupCodes.map((c) => (
              <div key={c} className="bg-white rounded-lg px-3 py-2 border border-amber-200 text-center">{c}</div>
            ))}
          </div>
          <button
            onClick={copyBackup}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 hover:text-amber-900"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy all'}
          </button>
        </div>
      )}

      {/* Idle: enabled → offer disable + regen; disabled → offer enable */}
      {mode === 'idle' && (
        enabled ? (
          <div className="flex flex-wrap gap-3">
            <button onClick={() => { setCode(''); setMode('regenerate'); }} disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-sm">
              <RefreshCw size={15} /> Regenerate backup codes
            </button>
            <button onClick={() => setMode('disable')} disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-sm">
              <ShieldOff size={15} /> Disable 2FA
            </button>
          </div>
        ) : (
          <button onClick={beginSetup} disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00d4aa] hover:bg-[#00e6b8] text-[#1a1a2e] font-bold text-sm">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} Enable 2FA
          </button>
        )
      )}

      {/* Setup: show QR + code entry */}
      {mode === 'setup' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4 max-w-md">
          <p className="text-sm text-gray-700 font-semibold">1. Scan this QR code with your authenticator app</p>
          {qrDataUrl && <img src={qrDataUrl} alt="2FA QR code" className="mx-auto rounded-lg border border-gray-200" />}
          <p className="text-xs text-gray-500 text-center">
            Can't scan? Enter this key manually:<br />
            <code className="bg-gray-100 px-2 py-1 rounded text-gray-800 break-all">{secret}</code>
          </p>
          <div>
            <p className="text-sm text-gray-700 font-semibold mb-2">2. Enter the 6-digit code</p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
              inputMode="numeric" maxLength={6} placeholder="123456"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-center text-lg tracking-[0.4em] font-bold outline-none focus:border-[#00d4aa] focus:ring-1 focus:ring-[#00d4aa]/30"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={confirmEnable} disabled={loading || code.length < 6}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00d4aa] hover:bg-[#00e6b8] text-[#1a1a2e] font-bold text-sm disabled:opacity-50">
              {loading && <Loader2 size={16} className="animate-spin" />} Verify & Enable
            </button>
            <button onClick={() => { setMode('idle'); setCode(''); }}
              className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Disable: require a code */}
      {mode === 'disable' && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 space-y-3 max-w-md">
          <p className="text-sm text-red-800 font-semibold">Enter a current 2FA code (or backup code) to turn it off</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9A-Za-z-]/g, ''))}
            maxLength={9} placeholder="123456"
            className="w-full border border-red-300 rounded-xl px-4 py-3 text-center text-lg tracking-[0.3em] font-bold outline-none focus:border-red-500"
          />
          <div className="flex gap-2">
            <button onClick={confirmDisable} disabled={loading || !code.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm disabled:opacity-50">
              {loading && <Loader2 size={16} className="animate-spin" />} Disable 2FA
            </button>
            <button onClick={() => { setMode('idle'); setCode(''); }}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-gray-50 text-gray-700 font-bold text-sm border border-gray-200">Cancel</button>
          </div>
        </div>
      )}

      {/* Regenerate: require a current code */}
      {mode === 'regenerate' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3 max-w-md">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-blue-600" />
            <p className="text-sm text-gray-800 font-semibold">Enter a current 6-digit code from your authenticator app</p>
          </div>
          <p className="text-xs text-gray-500">
            This replaces all existing backup codes with a fresh set. Use the code from your
            authenticator app (backup codes are not accepted here).
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9A-Za-z-]/g, ''))}
            inputMode="numeric" maxLength={9} placeholder="123456"
            autoFocus
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-center text-lg tracking-[0.3em] font-bold outline-none focus:border-[#1d4ed8] focus:ring-1 focus:ring-[#1d4ed8]/30"
          />
          <div className="flex gap-2">
            <button onClick={confirmRegenerate} disabled={loading || !code.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold text-sm disabled:opacity-50">
              {loading && <Loader2 size={16} className="animate-spin" />} Generate new codes
            </button>
            <button onClick={() => { setMode('idle'); setCode(''); }}
              className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TwoFactorSettings;
