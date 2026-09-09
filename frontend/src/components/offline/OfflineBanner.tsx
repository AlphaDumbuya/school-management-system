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
import { isAppMode } from '@lib/appMode';

export const OfflineBanner: React.FC = () => {
  const { online, pending } = useOfflineStatus();
  const [updateReady, setUpdateReady] = useState(false);
  const [updating, setUpdating] = useState(false);
  // The "new version available" badge only makes sense in the installed app
  // (native/PWA) where assets are cached by the service worker. On the plain
  // web the browser always loads the latest bundle, so the badge is noise.
  const showUpdatePrompt = isAppMode();

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
    // Hide the badge on the FIRST click and show an "Updating…" state. The old
    // behaviour left the badge visible until controllerchange fired, so if the
    // waiting worker had already activated (no `reg.waiting`) nothing appeared
    // to happen and the user had to click again. We now dismiss immediately and
    // fall back to a hard reload when there is no waiting worker to skip.
    setUpdating(true);
    setUpdateReady(false);
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          // controllerchange will reload; also reload defensively after a beat.
          setTimeout(() => window.location.reload(), 1500);
        } else {
          // No waiting worker — the update already activated. Just reload to
          // pick up the fresh assets.
          window.location.reload();
        }
      })
      .catch(() => window.location.reload());
  };

  return (
    <>
      {!online && (
        <div className="bg-amber-500 text-white text-xs sm:text-sm font-semibold px-4 py-1.5 flex items-center justify-center gap-2">
          <WifiOff size={15} />
          <span>You're offline — you can keep working and changes will sync automatically.{pending > 0 ? ` (${pending} pending)` : ''}</span>
        </div>
      )}
      {showUpdatePrompt && (updateReady || updating) && (
        <div className="bg-[#1d4ed8] text-white text-xs sm:text-sm font-semibold px-4 py-1.5 flex items-center justify-center gap-3">
          <Download size={15} />
          {updating ? (
            <span>Updating WiSkul…</span>
          ) : (
            <>
              <span>A new version of WiSkul is available.</span>
              <button onClick={applyUpdate} className="rounded-lg bg-white/20 hover:bg-white/30 px-2.5 py-0.5 font-bold">
                Update now
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default OfflineBanner;
