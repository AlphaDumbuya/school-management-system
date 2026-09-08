/**
 * AppDownloadButtons — marketing-site download CTAs for the WiSkul mobile app.
 *
 * Two URLs, both env-driven so they only appear once configured:
 *   VITE_APK_DOWNLOAD_URL  → direct APK download (available before Play Store)
 *   VITE_PLAY_STORE_URL    → Google Play listing (add after publishing, $25)
 *
 * Renders nothing if neither is set, so the site never shows a broken button.
 */
import React from 'react';
import { Download, Smartphone } from 'lucide-react';

const APK_URL = import.meta.env.VITE_APK_DOWNLOAD_URL as string | undefined;
const PLAY_URL = import.meta.env.VITE_PLAY_STORE_URL as string | undefined;
const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) || '1.0';

interface Props {
  /** 'light' for dark backgrounds (hero/CTA), 'dark' for light backgrounds. */
  variant?: 'light' | 'dark';
  className?: string;
}

export const AppDownloadButtons: React.FC<Props> = ({ variant = 'light', className = '' }) => {
  if (!APK_URL && !PLAY_URL) return null;

  const onDark = variant === 'light';

  return (
    <div className={`flex flex-col items-center sm:items-start gap-2 ${className}`}>
      <div className="flex flex-col sm:flex-row gap-3">
        {PLAY_URL && (
          <a
            href={PLAY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-black hover:bg-gray-900 text-white font-bold text-sm px-6 py-3.5 rounded-lg transition-colors"
          >
            <Smartphone size={18} />
            <span className="text-left leading-tight">
              <span className="block text-[10px] font-normal opacity-80">GET IT ON</span>
              Google Play
            </span>
          </a>
        )}
        {APK_URL && (
          <a
            href={APK_URL}
            download
            className={`inline-flex items-center gap-2 font-bold text-sm px-6 py-3.5 rounded-lg transition-colors ${
              onDark
                ? 'bg-white/10 hover:bg-white/20 text-white border border-white/25'
                : 'bg-[#1d4ed8] hover:bg-[#1e40af] text-white'
            }`}
          >
            <Download size={18} />
            <span className="text-left leading-tight">
              <span className="block text-[10px] font-normal opacity-80">ANDROID · v{APP_VERSION}</span>
              Download App
            </span>
          </a>
        )}
      </div>
      {APK_URL && !PLAY_URL && (
        <p className={`text-[11px] ${onDark ? 'text-white/50' : 'text-slate-400'}`}>
          Android only. You may need to allow installs from your browser.
        </p>
      )}
    </div>
  );
};

export default AppDownloadButtons;
