/**
 * OfflineBanner — a slim, non-intrusive top strip shown only while the device
 * is offline, plus an "update available" prompt when a new app build is ready.
 *
 * The offline state reassures teachers their work is saved locally; the update
 * prompt lets them reload into the newest version when convenient.
 */
import React, { useEffect, useState } from 'react';
import { WifiOff, Download } from 'lucide-react';
import useOfflineStatus from '@hooks/useOfflineStatus';

export const OfflineBanner: React.FC = () => {
  const { online, pending } = useOfflineStatus();
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const onUpdate = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) setUpdateReady(true);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateReady(true);
          }
        });
      });
    };

    navigator.serviceWorker.getRegistration().then((reg) => reg && onUpdate(reg)).catch(() => undefined);

    // When the new SW takes control, reload once to get fresh assets.
    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyUpdate = () => {
    navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    });
  };

  return (
    <>
      {!online && (
        <div className="bg-amber-500 text-white text-xs sm:text-sm font-semibold px-4 py-1.5 flex items-center justify-center gap-2">
          <WifiOff size={15} />
          <span>You're offline — you can keep working and changes will sync automatically.{pending > 0 ? ` (${pending} pending)` : ''}</span>
        </div>
      )}
      {updateReady && (
        <div className="bg-[#1d4ed8] text-white text-xs sm:text-sm font-semibold px-4 py-1.5 flex items-center justify-center gap-3">
          <Download size={15} />
          <span>A new version of WiSkul is available.</span>
          <button onClick={applyUpdate} className="rounded-lg bg-white/20 hover:bg-white/30 px-2.5 py-0.5 font-bold">
            Update now
          </button>
        </div>
      )}
    </>
  );
};

export default OfflineBanner;
