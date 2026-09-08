/**
 * PasskeySettings — register and manage passkeys (WebAuthn).
 *
 * A passkey is a phishing-resistant, password-free sign-in bound to this device
 * (Face ID / fingerprint / device PIN) or a synced credential provider. Passkeys
 * still require internet to sign in — they are not an offline unlock.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Fingerprint, Loader2, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import {
  startRegistration,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';
import authService from '@services/authService';
import { showToast } from '@utils/toast';

interface Passkey {
  id: string;
  deviceLabel: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const fmt = (iso: string | null): string => {
  if (!iso) return 'never';
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
};

export const PasskeySettings: React.FC = () => {
  const supported = typeof window !== 'undefined' && browserSupportsWebAuthn();
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authService.listPasskeys();
      if (res.success && (res.data as any)?.passkeys) setPasskeys((res.data as any).passkeys);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (supported) refresh();
  }, [supported, refresh]);

  const addPasskey = async () => {
    setRegistering(true);
    try {
      const optRes = await authService.getPasskeyRegistrationOptions();
      if (!optRes.success || !optRes.data) {
        showToast.error(optRes.error || 'Could not start passkey setup');
        return;
      }
      let attResp;
      try {
        attResp = await startRegistration({ optionsJSON: optRes.data as any });
      } catch (err: any) {
        // User cancelled or no authenticator — treat cancel as a silent no-op.
        if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') return;
        showToast.error('Passkey setup was not completed');
        return;
      }
      const label = window.prompt('Name this passkey (e.g. "My phone")', 'This device') || undefined;
      const verifyRes = await authService.verifyPasskeyRegistration(attResp, label);
      if (verifyRes.success) {
        showToast.success('Passkey added');
        await refresh();
      } else {
        showToast.error(verifyRes.error || 'Could not save passkey');
      }
    } catch {
      showToast.error('Could not add passkey');
    } finally {
      setRegistering(false);
    }
  };

  const saveRename = async (id: string) => {
    const label = editLabel.trim();
    if (!label) return;
    const res = await authService.renamePasskey(id, label);
    if (res.success) {
      setEditingId(null);
      await refresh();
    } else {
      showToast.error(res.error || 'Could not rename');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Remove this passkey? You will no longer be able to sign in with it.')) return;
    const res = await authService.removePasskey(id);
    if (res.success) {
      showToast.success('Passkey removed');
      await refresh();
    } else {
      showToast.error(res.error || 'Could not remove passkey');
    }
  };

  if (!supported) {
    return (
      <p className="text-sm text-gray-500">
        This device or browser doesn't support passkeys. Use an authenticator app instead.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-[#1d4ed8] flex items-center justify-center">
            <Fingerprint size={22} />
          </div>
          <div>
            <h4 className="text-base font-bold text-gray-900">Passkeys</h4>
            <p className="text-sm text-gray-500 max-w-md">
              Sign in with your fingerprint, face, or device PIN — no code to type. Passkeys
              still need an internet connection to sign in.
            </p>
          </div>
        </div>
        <button
          onClick={addPasskey}
          disabled={registering}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold text-sm disabled:opacity-50"
        >
          {registering ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Add passkey
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 size={15} className="animate-spin" /> Loading…</div>
      ) : passkeys.length === 0 ? (
        <p className="text-sm text-gray-400">No passkeys yet. Add one to enable password-free sign-in.</p>
      ) : (
        <ul className="space-y-2">
          {passkeys.map((pk) => (
            <li key={pk.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
              <Fingerprint size={18} className="text-gray-400 shrink-0" />
              <div className="min-w-0 flex-1">
                {editingId === pk.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      maxLength={64}
                      autoFocus
                      className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm outline-none focus:border-[#1d4ed8]"
                    />
                    <button onClick={() => saveRename(pk.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Check size={16} /></button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-gray-800 truncate">{pk.deviceLabel}</p>
                    <p className="text-[11px] text-gray-400">
                      Added {fmt(pk.createdAt)} · Last used {fmt(pk.lastUsedAt)}
                    </p>
                  </>
                )}
              </div>
              {editingId !== pk.id && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => { setEditingId(pk.id); setEditLabel(pk.deviceLabel); }}
                    className="p-1.5 text-gray-400 hover:text-[#1d4ed8] hover:bg-blue-50 rounded-lg"
                    aria-label="Rename passkey"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => remove(pk.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    aria-label="Remove passkey"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PasskeySettings;
