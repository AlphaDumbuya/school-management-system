/**
 * OfflineGate — wraps online-only modules (admin, admissions, finance, reports,
 * communications, platform). When the device is offline these features can't
 * function (no local data / server-authoritative), so instead of a broken page
 * we show a clear "requires internet" state. When online, children render.
 *
 * It never queues or fakes writes for these modules (Req 6.2).
 */
import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import useOfflineStatus from '@hooks/useOfflineStatus';

export const OfflineGate: React.FC<{ children: React.ReactNode; feature?: string }> = ({ children, feature }) => {
  const { online } = useOfflineStatus();

  if (online) return <>{children}</>;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center bg-white rounded-2xl ring-1 ring-gray-200/70 shadow-sm p-8">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <WifiOff size={26} />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1.5">Internet required</h2>
        <p className="text-sm text-gray-500 mb-5">
          {feature ? `${feature} ` : 'This section '}needs a connection and isn't available offline.
          Your offline work (like attendance) is saved and will sync automatically.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold text-sm px-4 py-2 rounded-lg"
        >
          <RefreshCw size={15} /> Try again
        </button>
      </div>
    </div>
  );
};

export default OfflineGate;
