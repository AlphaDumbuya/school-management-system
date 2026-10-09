/**
 * AppDownloadButtons — marketing-site download CTAs for the WiSkul mobile app.
 *
 * The Android download button is ALWAYS shown: it goes to the backend's
 * /api/v1/app/download, which counts the download and serves the latest APK
 * (Blob URL from the build workflow, or the GitHub Release). It no longer
 * depends on a build-time variable, so preview and production builds match.
 *   VITE_APK_DOWNLOAD_URL=off → hide the APK button (e.g. once only on Play)
 *   VITE_PLAY_STORE_URL       → also show a Google Play badge (after publishing)
 */
import React from 'react';
import { Download, Smartphone } from 'lucide-react';

const APK_SETTING = String(import.meta.env.VITE_APK_DOWNLOAD_URL || '').trim();
const APK_URL = APK_SETTING.toLowerCase() === 'off' ? undefined : '/api/v1/app/download';
const PLAY_URL = (import.meta.env.VITE_PLAY_STORE_URL as string | undefined) || undefined;

// Always routed through the backend so downloads are counted.
const APK_DOWNLOAD_HREF = APK_URL;

interface Props {
  /**
   * 'hero'  → full-size CTA matching the primary hero button (dark background).
   * 'light' → compact secondary CTA for dark backgrounds.
   * 'dark'  → compact secondary CTA for light backgrounds.
   */
  variant?: 'hero' | 'light' | 'dark';
  className?: string;
}

export const AppDownloadButtons: React.FC<Props> = ({ variant = 'light', className = '' }) => {
  if (!APK_URL && !PLAY_URL) return null;

  const isHero = variant === 'hero';
  const onDark = variant === 'hero' || variant === 'light';

  // Hero matches the primary button footprint; light/dark are compact secondary.
  const sizing = isHero ? 'px-6 py-3.5 text-sm font-bold' : 'px-4 py-2.5 text-xs font-semibold';
  const iconSize = isHero ? 18 : 16;
  const subSize = isHero ? 'text-[10px]' : 'text-[9px]';

  return (
    <div className={`flex flex-col items-center sm:items-start gap-1.5 ${className}`}>
      <div
        className={`flex ${
          isHero ? 'flex-col sm:flex-row w-full sm:w-auto' : 'flex-wrap justify-center sm:justify-start'
        } items-stretch sm:items-center gap-2.5`}
      >
        {PLAY_URL && (
          <a
            href={PLAY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center justify-center gap-2 bg-black hover:bg-gray-900 text-white rounded-lg transition-colors ${sizing} ${
              isHero ? 'w-full sm:w-auto' : ''
            }`}
          >
            <Smartphone size={iconSize} />
            <span className="text-left leading-tight">
              <span className={`block ${subSize} font-normal opacity-80`}>GET IT ON</span>
              Google Play
            </span>
          </a>
        )}
        {APK_URL && (
          <a
            href={APK_DOWNLOAD_HREF || APK_URL}
            className={`inline-flex items-center justify-center gap-2 rounded-lg transition-colors ${sizing} ${
              isHero ? 'w-full sm:w-auto' : ''
            } ${
              onDark
                ? 'bg-white/10 hover:bg-white/20 text-white border border-white/25'
                : 'bg-[#1d4ed8] hover:bg-[#1e40af] text-white'
            }`}
          >
            <Download size={iconSize} />
            <span>Download App</span>
          </a>
        )}
      </div>
      {APK_URL && !PLAY_URL && (
        <p className={`text-[11px] ${onDark ? 'text-white/50' : 'text-slate-400'}`}>
          Android only. Enable installs from your browser if prompted.
        </p>
      )}
    </div>
  );
};

export default AppDownloadButtons;
