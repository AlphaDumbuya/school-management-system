/**
 * OfflineStorageSettings — lets a teacher see offline storage usage and clear
 * the cached data to reclaim space on low-end phones. Un-synced writes are
 * preserved and their count is shown so nothing is lost by accident (Req 11).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { HardDrive, Loader2, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import useAuthStore from '@store/authStore';
import { estimateUsage, counts, clearReadCache, formatBytes, type StorageEstimate } from '../../offline/storage';
import { showToast } from '@utils/toast';

export const OfflineStorageSettings: React.FC = () => {
  const userId = useAuthStore((s) => s.user?.id) || null;
  const [est, setEst] = useState<StorageEstimate | null>(null);
  const [cnt, setCnt] = useState<{ cached: number; pending: number }>({ cached: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const [e, c] = await Promise.all([estimateUsage(), counts(userId)]);
    setEst(e);
    setCnt(c);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const clear = async () => {
    if (!userId) return;
    setClearing(true);
    try {
      await clearReadCache(userId);
      showToast.success('Offline cache cleared. Your un-synced work was kept.');
      await load();
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return <div className="py-8 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={22} /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-3.5 flex gap-2 text-xs text-blue-800">
        <HardDrive size={16} className="shrink-0 mt-0.5" />
        <div>Manage the data WiSkul stores on this device for offline use. Clearing the cache frees space; your un-synced work is always kept.</div>
      </div>

      {est && (
        <div className="bg-white rounded-2xl ring-1 ring-gray-200/70 p-5">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-semibold text-gray-700">App storage used</span>
            <span className="text-gray-500">{formatBytes(est.usageBytes)}{est.quotaBytes ? ` of ${formatBytes(est.quotaBytes)}` : ''}</span>
          </div>
          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
            <div className="bg-[#1d4ed8] h-full rounded-full" style={{ width: `${Math.min(100, est.percent)}%` }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl ring-1 ring-gray-200/70 p-4">
          <p className="text-xs text-gray-500">Cached records</p>
          <p className="text-2xl font-extrabold text-gray-900">{cnt.cached}</p>
        </div>
        <div className="bg-white rounded-2xl ring-1 ring-gray-200/70 p-4">
          <p className="text-xs text-gray-500">Un-synced writes</p>
          <p className={`text-2xl font-extrabold ${cnt.pending > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{cnt.pending}</p>
        </div>
      </div>

      {cnt.pending > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex gap-2 text-xs text-amber-800">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <div>You have {cnt.pending} change(s) not yet synced. Clearing the cache keeps these — but connect to the internet to sync them safely.</div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={load} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-100">
          <RefreshCw size={15} /> Refresh
        </button>
        <button onClick={clear} disabled={clearing} className="inline-flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-sm px-4 py-2 rounded-lg">
          {clearing ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Clear offline cache
        </button>
      </div>
    </div>
  );
};

export default OfflineStorageSettings;
