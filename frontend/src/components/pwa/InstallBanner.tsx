/**
 * InstallBanner — PWA install prompt.
 * Shows a subtle bottom banner when the browser fires the `beforeinstallprompt`
 * event (Chrome/Edge/Android). iOS shows a tip to use "Add to Home Screen".
 * Dismisses permanently once accepted or closed.
 */
import React, { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

const DISMISSED_KEY = 'pwa_install_dismissed';

export const InstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Already installed or previously dismissed
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    setIsStandalone(standalone);
    if (standalone) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIos(ios);

    if (ios) {
      // Show iOS tip after a short delay
      setTimeout(() => setShow(true), 3000);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISSED_KEY, '1');
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') localStorage.setItem(DISMISSED_KEY, '1');
    setShow(false);
    setDeferredPrompt(null);
  };

  if (!show || isStandalone) return null;

  return (
    <div
      role="banner"
      className="fixed bottom-0 left-0 right-0 z-[9999] p-3 sm:p-4 flex items-center justify-between gap-3
        bg-[#1a1a2e]/95 backdrop-blur-sm border-t border-[#00d4aa]/20
        text-white animate-in slide-in-from-bottom duration-300"
    >
      <div className="flex items-center gap-3 min-w-0">
        <img src="/logo.png" alt="WiSkul" className="w-10 h-10 rounded-xl object-contain flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-bold truncate">Install WiSkul</p>
          {isIos ? (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              Tap <Share size={12} className="inline text-blue-400" /> then <strong>Add to Home Screen</strong>
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
