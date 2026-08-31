/**
 * InstallBanner — subtle bottom banner that appears when the app is installable
 * (or on iOS, offers add-to-home instructions). Shares install state via
 * usePwaInstall so it never competes with the dedicated InstallAppButton.
 * Dismissed state is persisted so it doesn't nag.
 */
import React, { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';
import usePwaInstall from '@hooks/usePwaInstall';

const DISMISSED_KEY = 'pwa_install_dismissed';

export const InstallBanner: React.FC = () => {
  const { canInstall, isInstalled, platform, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState<boolean>(
    () => !!localStorage.getItem(DISMISSED_KEY)
  );
  const [iosReady, setIosReady] = useState(false);

  const isIos = platform === 'ios';

  // On iOS there's no install event, so reveal the tip after a short delay.
  useEffect(() => {
    if (isIos && !isInstalled && !dismissed) {
      const t = setTimeout(() => setIosReady(true), 3000);
      return () => clearTimeout(t);
    }
  }, [isIos, isInstalled, dismissed]);

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, '1');
  };

  const install = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') dismiss();
  };

  if (isInstalled || dismissed) return null;
  // Show if directly installable, or on iOS once the tip is ready.
  const visible = canInstall || (isIos && iosReady);
  if (!visible) return null;

  return (
    <div
      role="banner"
      className="fixed bottom-0 left-0 right-0 z-[9999] p-3 sm:p-4 flex items-center justify-between gap-3
        bg-[#1a1a2e]/95 backdrop-blur-sm border-t border-[#00d4aa]/20
        text-white animate-in slide-in-from-bottom duration-300"
    >
      <div className="flex items-center gap-3 min-w-0">
        <img
          src="/logo.png"
          alt="WiSkul"
          className="w-10 h-10 rounded-xl object-contain flex-shrink-0 bg-white/95 p-1"
        />
        <div className="min-w-0">
          <p className="text-sm font-bold truncate">Install WiSkul</p>
          {isIos ? (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              Tap <Share size={12} className="inline text-blue-400" /> then{' '}
              <strong>Add to Home Screen</strong>
            </p>
          ) : (
            <p className="text-xs text-gray-400">Add to home screen for quick access</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {!isIos && (
          <button
            onClick={install}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00d4aa] hover:bg-[#00e6b8] text-[#1a1a2e] font-bold text-xs rounded-lg transition-colors"
          >
            <Download size={14} /> Install
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default InstallBanner;
