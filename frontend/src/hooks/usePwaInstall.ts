/**
 * usePwaInstall — one shared source of truth for PWA install state.
 *
 * The browser fires `beforeinstallprompt` once, early, and only if the app is
 * installable. We capture it at module load (before React mounts) so no button
 * misses it, stash the event, and expose a `promptInstall()` that triggers the
 * native install dialog directly — no passive banner required.
 *
 * Platform reality:
 *  - Android/Chrome/Edge: `promptInstall()` opens the native install dialog.
 *  - iOS Safari: no install API exists → `platform === 'ios'`, show manual
 *    "Share → Add to Home Screen" instructions instead.
 *  - Already installed (standalone): `isInstalled === true`.
 */
import { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// ── Module-level capture (runs on import, before React mounts) ──────────────
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}

function detectPlatform(): 'ios' | 'android' | 'desktop' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  if (/windows|macintosh|linux/i.test(ua)) return 'desktop';
  return 'other';
}

export interface PwaInstallState {
  /** True once the browser has offered an installable prompt (Android/desktop). */
  canInstall: boolean;
  /** Already running as an installed app. */
  isInstalled: boolean;
  /** Best-effort device platform. iOS needs manual instructions. */
  platform: 'ios' | 'android' | 'desktop' | 'other';
  /** Fire the native install dialog. Returns the user's choice, or null if no prompt is available. */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export function usePwaInstall(): PwaInstallState {
  const [, setTick] = useState(0);
  const [isInstalled, setIsInstalled] = useState<boolean>(detectStandalone());
  const platform = detectPlatform();

  useEffect(() => {
    const rerender = () => setTick((t) => t + 1);
    listeners.add(rerender);

    // Track transition into standalone (installed) mode.
    const mql = window.matchMedia('(display-mode: standalone)');
    const onDisplayChange = () => setIsInstalled(detectStandalone());
    mql.addEventListener?.('change', onDisplayChange);
    window.addEventListener('appinstalled', onDisplayChange);

    return () => {
      listeners.delete(rerender);
      mql.removeEventListener?.('change', onDisplayChange);
      window.removeEventListener('appinstalled', onDisplayChange);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    // A prompt can only be used once.
    deferredPrompt = null;
    notify();
    if (choice.outcome === 'accepted') setIsInstalled(true);
    return choice.outcome;
  }, []);

  return {
    canInstall: !!deferredPrompt && !isInstalled,
    isInstalled,
    platform,
    promptInstall,
  };
}

export default usePwaInstall;
