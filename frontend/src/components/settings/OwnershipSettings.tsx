/**
 * OwnershipSettings: who owns the school.
 *
 * The school owner sits above the principal. Only an owner can see billing,
 * the school's payment settings, file storage and this page, and only an owner
 * can create or remove principals. A school always keeps at least one owner.
 *
 * Naming or removing an owner is a sensitive change, so it asks for the
 * owner's password again (and the 6-digit code when two-factor sign-in is on).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Crown, Loader2, Info, Lock } from 'lucide-react';
import { apiClient } from '@lib/apiClient';
import useAuthStore from '@store/authStore';
import { showToast } from '@utils/toast';

interface PrincipalRow {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  status?: string;
  is_owner?: boolean;
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-800';
const labelCls = 'block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1';

export const OwnershipSettings: React.FC = () => {
  const me = useAuthStore((s) => s.user);
  const [rows, setRows] = useState<PrincipalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<{ row: PrincipalRow; grant: boolean } | null>(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.get('/api/v1/users?role=principal&limit=100');
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch {
      showToast.error('Could not load your principals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const hasOwner = rows.some((r) => r.is_owner);
  const open = (row: PrincipalRow, grant: boolean) => {
    setTarget({ row, grant });
    setPassword('');
    setCode('');
    setProblem(null);
    setNeedsConfirm(false);
  };
  const close = () => { setTarget(null); setPassword(''); setCode(''); setProblem(null); setNeedsConfirm(false); };

  const submit = async (confirm = false) => {
    if (!target) return;
    if (!password) { setProblem('Enter your password to confirm.'); return; }
    setBusy(true);
    setProblem(null);
    try {
      const res: any = await apiClient.post(`/api/v1/users/${target.row.id}/ownership`, {
        grant: target.grant,
        currentPassword: password,
        twoFactorCode: needsCode ? code.trim() : undefined,
        confirm: confirm || undefined,
      });
      if (res?.success) {
        showToast.success(res.message || 'Done');
        close();
        await load();
        return;
      }
      if (res?.code === 'TWO_FACTOR_REQUIRED') setNeedsCode(true);
      if (res?.code === 'OWNER_HANDOVER_CONFIRM') setNeedsConfirm(true);
      setProblem(res?.error || 'Could not save this change');
    } catch (e: any) {
      setProblem(e?.message || 'Could not save this change');
    } finally {
      setPassword('');
      setCode('');
      setBusy(false);
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
          The school owner runs the account: plan and billing, the school's payment settings, file storage and
          principals. Principals run the school day to day but cannot change these. A school always keeps at least one owner.
          {!hasOwner && (
            <> Your school has no named owner yet, so every principal can currently manage these. Name an owner below to lock them to the owner.</>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
        {rows.length === 0 && <p className="p-4 text-sm text-gray-500">No principal accounts found.</p>}
        {rows.map((r) => {
          const name = `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.email;
          const isMe = String(r.id) === String((me as any)?.id);
          const active = String(r.status || 'active').toLowerCase() === 'active';
          return (
            <div key={r.id} className="p-3.5 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {name} {isMe && <span className="text-xs font-normal text-gray-400">(you)</span>}
                </p>
                <p className="text-xs text-gray-500 truncate">{r.email}{!active ? ` · ${r.status}` : ''}</p>
              </div>
              {r.is_owner && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                  <Crown size={12} /> Owner
                </span>
              )}
              {r.is_owner ? (
                <button
                  onClick={() => open(r, false)}
                  className="text-sm font-semibold text-red-600 hover:text-red-700"
                >
                  Remove ownership
                </button>
              ) : active ? (
                <button
                  onClick={() => open(r, true)}
                  className="text-sm font-semibold text-[#1d4ed8] hover:text-[#1e40af]"
                >
                  Make owner
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500">
        To add a principal, go to Staff and add a person with a Principal or Head Teacher title. Then come back here to make them an owner if needed.
      </p>

      {target && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="own-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 id="own-title" className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Crown size={18} className="text-amber-500" />
              {target.grant ? 'Make this person a school owner?' : 'Remove ownership?'}
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              {target.grant
                ? `${target.row.first_name || target.row.email} will be able to manage billing, payment settings, file storage and principal accounts.`
                : `${target.row.first_name || target.row.email} will stay a principal but lose billing, payment settings, file storage and principal management.`}
            </p>

            {needsConfirm && (
              <p role="alert" className="mt-3 text-sm font-semibold text-amber-700">
                You are not a named owner yet. Making someone else the owner moves these items away from you.
              </p>
            )}

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-3">
              <p className="text-xs font-semibold text-amber-900 flex items-center gap-1.5"><Lock size={13} /> Confirm it's you</p>
              <div>
                <label htmlFor="own-password" className={labelCls}>Your password</label>
                <input
                  id="own-password"
                  type="password"
                  className={inputCls}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              {needsCode && (
                <div>
                  <label htmlFor="own-code" className={labelCls}>Authenticator code</label>
                  <input
                    id="own-code"
                    type="text"
                    inputMode="numeric"
                    className={inputCls}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456"
                    autoComplete="one-time-code"
                    maxLength={20}
                  />
                </div>
              )}
              {problem && <p role="alert" className="text-sm font-semibold text-red-600">{problem}</p>}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={close} disabled={busy} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800">
                Cancel
              </button>
              <button
                onClick={() => submit(needsConfirm)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-50 text-white font-bold text-sm px-4 py-2 rounded-lg"
              >
                {busy && <Loader2 className="animate-spin" size={14} />}
                {needsConfirm ? 'Yes, hand over' : target.grant ? 'Make owner' : 'Remove ownership'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnershipSettings;
