/**
 * Photo slots for the company pages.
 *
 * Each slot is a file in /public/photos named <slot>.webp (see docs/WEBSITE_PHOTOS.md for what to put in
 * each one). A slot with no file simply does not show: the page keeps its normal design, so nothing
 * breaks while pictures are still being chosen.
 *
 * Stock pictures from Magnific need a credit line on the free plan. While at least one photo is showing,
 * the footer prints it. After buying Premium, set PHOTO_CREDIT.required to false.
 */
import React, { useEffect, useSyncExternalStore } from 'react';

export const PHOTO_CREDIT = { required: true, text: 'Photos: Designed by Magnific', url: 'https://www.magnific.com' } as const;

export type PhotoSlot =
  | 'home-hero'
  | 'about-team'
  | 'about-local'
  | 'about-abroad'
  | 'services-hero'
  | 'training'
  | 'editions-cta'
  | 'contact-hero';

const BASE = '/photos';
const status = new Map<string, 'loading' | 'ok' | 'missing'>();
const listeners = new Set<() => void>();
let version = 0;
let shown = 0;

function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

/** Looks for the file once. A missing file comes back as the app's HTML page, which is not an image, so onerror fires. */
function check(slot: string) {
  if (status.has(slot)) return;
  status.set(slot, 'loading');
  const img = new Image();
  img.onload = () => { status.set(slot, 'ok'); shown += 1; emit(); };
  img.onerror = () => { status.set(slot, 'missing'); emit(); };
  img.src = `${BASE}/${slot}.webp`;
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => version;

/** The picture's address, or null while it loads or when there is no file for the slot. */
export function usePhoto(slot: PhotoSlot): string | null {
  useSyncExternalStore(subscribe, snapshot);
  useEffect(() => { check(slot); }, [slot]);
  return status.get(slot) === 'ok' ? `${BASE}/${slot}.webp` : null;
}

/** True once any slot has a picture showing (used by the footer credit). */
export function usePhotosShowing(): boolean {
  useSyncExternalStore(subscribe, snapshot);
  return shown > 0;
}

export const Photo: React.FC<{ slot: PhotoSlot; alt: string; className?: string }> = ({ slot, alt, className = '' }) => {
  const src = usePhoto(slot);
  if (!src) return null;
  return <img src={src} alt={alt} loading="lazy" decoding="async" className={`co-pop ${className}`} />;
};

/** A decorative full-bleed picture behind a section's content. */
export const PhotoBackdrop: React.FC<{ slot: PhotoSlot; className?: string }> = ({ slot, className = '' }) => {
  const src = usePhoto(slot);
  if (!src) return null;
  return (
    <div
      aria-hidden="true"
      className={`co-pop absolute inset-0 bg-cover bg-center pointer-events-none ${className}`}
      style={{ backgroundImage: `url(${src})` }}
    />
  );
};
