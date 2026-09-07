/**
 * InstallAppButton — a dedicated "Get the App" button that triggers the native
 * PWA install dialog directly (no passive banner needed).
 *
 * Behaviour by state:
 *  - Installable (Android/Chrome/Edge): fires the native install prompt on click.
 *  - iOS Safari: opens a small sheet with "Share → Add to Home Screen" steps.
 *  - Already installed / no prompt available: the button hides itself unless
 *    `alwaysShow` is set, in which case it shows iOS-style manual instructions.
 */
import React, { useState } from 'react';
import { Download, Share, Plus, X, Smartphone } from 'lucide-react';
import usePwaInstall from '@hooks/usePwaInstall';

interface InstallAppButtonProps {
  className?: string;
  label?: string;
  /** Render even when not directly installable (falls back to instructions). */
  alwaysShow?: boolean;
  variant?: 'solid' | 'ghost';
}

export const InstallAppButton: React.FC<InstallAppButtonProps> = ({
  className = '',
  label = 'Get the App',
  alwaysShow = false,
  variant = 'solid',
}) => {
  const { canInstall, isInstalled, platform, promptInstall } = usePwaInstall();
  const [showIosSheet, setShowIosSheet] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  // 'ios' shows Safari steps; 'manual' shows generic browser-menu steps.
  const [sheetMode, setSheetMode] = useState<'ios' | 'manual'>('ios');

  // Nothing to do if already installed.
  if (isInstalled) return null;

  // If not directly installable: iOS always needs manual steps; other browsers
  // only show the button when explicitly asked (alwaysShow).
  const directlyInstallable = canInstall;
  if (!directlyInstallable && platform !== 'ios' && !alwaysShow) return null;

  const handleClick = async () => {
    if (directlyInstallable) {
      const outcome = await promptInstall();
      if (outcome === 'unavailable') {
        // The prompt wasn't ready — fall back to instructions.
        setSheetMode(platform === 'ios' ? 'ios' : 'manual');
        setShowIosSheet(true);
      } else if (outcome === 'dismissed') {
        setFeedback('You can install anytime from this button.');
        setTimeout(() => setFeedback(null), 3000);
      }
      return;
    }
    // Not directly installable → show the right manual instructions.
    setSheetMode(platform === 'ios' ? 'ios' : 'manual');
    setShowIosSheet(true);
  };

  const base =
    'inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all duration-300 active:scale-[0.98]';
  const styles =
    variant === 'solid'
      ? 'bg-[#1d4ed8] hover:bg-[#1e40af] text-white px-5 py-3 hover:shadow-[0_0_30px_rgba(29,78,216,0.3)]'
      : 'bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.12] px-5 py-3';

  return (
    <>
      <button onClick={handleClick} className={`${base} ${styles} ${className}`}>
        <Download size={18} />
        {label}
      </button>

      {feedback && (
        <p className="text-xs text-gray-400 mt-2 text-center">{feedback}</p>
      )}

      {/* iOS / fallback instruction sheet */}
      {showIosSheet && (
        <div
          className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowIosSheet(false)}
        >
          <div
            className="w-full max-w-sm bg-[#16213e] border border-white/[0.1] rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-[#1d4ed8]/15 flex items-center justify-center">
                  <Smartphone size={18} className="text-[#1d4ed8]" />
                </div>
                <h3 className="text-white font-black text-lg">Install WiSkul</h3>
              </div>
              <button
                onClick={() => setShowIosSheet(false)}
                aria-label="Close"
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            {sheetMode === 'ios' ? (
              <ol className="space-y-4">
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#1d4ed8] text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                    1
                  </span>
                  <span className="text-sm text-gray-300 flex items-center gap-1.5">
                    Tap the <Share size={15} className="text-blue-400" /> Share button
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#1d4ed8] text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                    2
                  </span>
                  <span className="text-sm text-gray-300 flex items-center gap-1.5">
                    Choose <Plus size={15} className="text-gray-200" />{' '}
                    <strong className="text-white">Add to Home Screen</strong>
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#1d4ed8] text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                    3
                  </span>
                  <span className="text-sm text-gray-300">
                    Tap <strong className="text-white">Add</strong> — done!
                  </span>
                </li>
              </ol>
            ) : (
              <div className="text-sm text-gray-300 space-y-3">
                <p>
                  Open your browser menu and choose{' '}
                  <strong className="text-white">Install app</strong> or{' '}
                  <strong className="text-white">Add to Home Screen</strong>.
                </p>
                <p className="text-gray-500 text-xs">
                  If you don't see it, your browser may not support installing web
                  apps. Try Chrome or Edge.
                </p>
              </div>
            )}

            <button
              onClick={() => setShowIosSheet(false)}
              className="mt-6 w-full bg-white/[0.06] hover:bg-white/[0.1] text-white font-bold text-sm py-3 rounded-xl transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default InstallAppButton;
