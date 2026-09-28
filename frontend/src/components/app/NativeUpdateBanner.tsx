/**
 * NativeUpdateBanner — prompts users of the installed Android app to download a
 * new APK when a newer NATIVE build is available.
 *
 * WHY THIS EXISTS
 * The app loads its web UI from the live site, so ordinary UI/logic changes ship
 * automatically. But NATIVE changes (new Capacitor plugins, permissions, icon)
 * require installing a new APK — and sideloaded apps get no OS "update" prompt.
 * This banner closes that gap: it compares the installed app's versionCode
 * against the latest published versionCode (from GET /api/v1/app/version) and,
 * when older, shows a one-tap "Update" that opens the APK download.
 *
 * It only renders inside the native app shell (not web/PWA), and only when a
 * newer native build actually exists.
 */
import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { isAppMode } from '@lib/appMode';
import { openUrl } from '@lib/download';
import { API_CONFIG } from '@config/api.config';

// Where the counted, always-latest APK lives (same endpoint the download button uses).
const DOWNLOAD_URL = `${API_CONFIG.baseURL || ''}/api/v1/app/download`;
// Remember a dismissal per latest-version so we don't nag within the same version.
const DISMISS_KEY = 'wiskul_apk_update_dismissed_v';

/** Read the installed native app's versionCode via @capacitor/app (native only). */
async function getInstalledVersionCode(): Promise<number | null> {
  try {
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    // Android: build is the versionCode (string). iOS would differ, but this app is Android.
    const code = parseInt(String((info as any).build ?? ''), 10);
    return Number.isFinite(code) ? code : null;
  } catch {
    return null; // plugin unavailable (e.g. plain web) → skip.
  }
}

export const NativeUpdateBanner: React.FC = () => {
  const [latest, setLatest] = useState<number | null>(null);
  const [installed, setInstalled] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isAppMode()) return; // native app only
    let cancelled = false;

    (async () => {
      const [inst] = await Promise.all([getInstalledVersionCode()]);
      if (cancelled) return;
      setInstalled(inst);

      try {
        const res = await fetch(`${API_CONFIG.baseURL || ''}/api/v1/app/version`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) return;
        const data = await res.json();
        const lv = typeof data?.latestVersion === 'number' ? data.latestVersion : null;
        if (cancelled) return;
        setLatest(lv);
        // Honor a prior dismissal for THIS latest version.
        if (lv != null && localStorage.getItem(DISMISS_KEY) === String(lv)) {
          setDismissed(true);
        }
      } catch {
        /* offline or unavailable — no banner */
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Show only when we know both versions and the installed one is older.
  const updateAvailable =
    isAppMode() &&
    !dismissed &&
    latest != null &&
    installed != null &&
    latest > installed;

  if (!updateAvailable) return null;

  const dismiss = () => {
    setDismissed(true);
    if (latest != null) localStorage.setItem(DISMISS_KEY, String(latest));
  };

  return (
    <div className="bg-[#1d4ed8] text-white text-xs sm:text-sm font-semibold px-4 py-1.5 flex items-center justify-center gap-3">
      <Download size={15} />
      <span>A new version of the WiSkul app is available.</span>
      <button
        onClick={() => openUrl(DOWNLOAD_URL)}
        className="rounded-lg bg-white/20 hover:bg-white/30 px-2.5 py-0.5 font-bold"
      >
        Update
      </button>
      <button onClick={dismiss} aria-label="Dismiss" className="opacity-80 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  );
};

export default NativeUpdateBanner;
