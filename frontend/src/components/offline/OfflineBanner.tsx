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
  // Hold a direct reference to the worker that's ready to take over, so the
  // FIRST click can message exactly that worker (re-fetching the registration
  // on click was racy and required a second click).
  const waitingWorkerRef = React.useRef<ServiceWorker | null>(null);
  // The "new version available" badge only makes sense in the installed app
  // (native/PWA) where assets are cached by the service worker. On the plain
  // web the browser always loads the latest bundle, so the badge is noise.
  const showUpdatePrompt = isAppMode();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const markReady = (worker: ServiceWorker | null) => {
      if (!worker) return;
      waitingWorkerRef.current = worker;
      setUpdateReady(true);
    };

    const onUpdate = (reg: ServiceWorkerRegistration) => {
      // Already-waiting worker (update installed before this mounted).
      if (reg.waiting) markReady(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw?.addEventListener('statechange', () => {
          // Once installed with an existing controller, it's the waiting worker.
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            markReady(reg.waiting || nw);
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

  const applyUpdate = async () => {
    // Dismiss the badge immediately and show an "Updating…" state on the FIRST
    // click. Message the captured waiting worker directly; controllerchange then
    // reloads into the new version. A defensive timeout reload covers edge cases.
    setUpdating(true);
    setUpdateReady(false);

    // Prefer the worker we captured; otherwise re-read the registration once.
    let worker = waitingWorkerRef.current;
    if (!worker) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        worker = reg?.waiting || reg?.installing || null;
      } catch { /* ignore */ }
    }

    if (worker) {
      worker.postMessage({ type: 'SKIP_WAITING' });
      // controllerchange handler reloads; fall back to a reload after a beat.
      setTimeout(() => window.location.reload(), 1500);
    } else {
      // No worker to skip — the update already activated; just reload.
      window.location.reload();
    }
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
