/**
 * SchoolBannerControl: the school's dashboard banner photo (Settings -> School Info).
 * Principal / super admin only. Preview at the welcome hero's shape + Upload /
 * Change / Remove. The picked photo is cover-cropped and shrunk on the device
 * (max 1600x600 JPEG) before it is sent, and the cached user is updated so every
 * dashboard shows the new banner straight away, without a reload.
 *
 * Uses a plain <input type="file" accept="image/*">, which also works in the
 * Android app (the system picker offers the camera and the gallery). Its buttons
 * are type="button" because it sits inside the School Info form.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, Trash2 } from 'lucide-react';
import useAuthStore from '@store/authStore';
import { Button } from '@components/ui/button';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import schoolBannerService from '@services/schoolBannerService';
import { resolveBannerUrl } from '@lib/schoolBanner';
import { showToast } from '@utils/toast';

/** Saved size: cover-cropped to this shape (the hero's), never larger. */
const OUT_W = 1600;
const OUT_H = 600;
const RATIO = OUT_W / OUT_H;
/** Too small to look sharp across a wide banner. */
const MIN_W = 800;
/** The server accepts about 1.2 MB; the shrunk JPEG is usually 150 to 400 KB. */
const MAX_SAVED_BYTES = Math.round(1.2 * 1024 * 1024);
/** Phone photos are often 5 to 10 MB before shrinking. */
const MAX_PICK_MB = 20;
const QUALITIES = [0.8, 0.7, 0.6, 0.5];

const approxBytes = (dataUrl: string) => Math.floor(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);

/** Cover-crop to the hero's shape, shrink to at most 1600x600 and re-encode as JPEG on white. */
function coverCropToJpeg(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(src);
      const sw = img.naturalWidth || 0;
      const sh = img.naturalHeight || 0;
      if (!sw || !sh) { reject(new Error('This photo could not be opened. Choose a JPG, PNG or WebP photo.')); return; }
      if (sw < MIN_W) { reject(new Error(`This photo is too small. Choose one at least ${MIN_W} pixels wide.`)); return; }
      // The largest centred area of the photo with the banner's shape.
      let cw = sw;
      let ch = sw / RATIO;
      if (ch > sh) { ch = sh; cw = sh * RATIO; }
      const sx = (sw - cw) / 2;
      const sy = (sh - ch) / 2;
      const w = Math.min(OUT_W, Math.round(cw));
      const h = Math.round(w / RATIO);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('This device could not prepare the photo.')); return; }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, sx, sy, cw, ch, 0, 0, w, h);
      for (const q of QUALITIES) {
        const url = canvas.toDataURL('image/jpeg', q);
        if (approxBytes(url) <= MAX_SAVED_BYTES) { resolve(url); return; }
      }
      reject(new Error('This photo is still too large after shrinking. Try a simpler photo.'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(src);
      reject(new Error('This photo could not be opened. Choose a JPG, PNG or WebP photo.'));
    };
    img.src = src;
  });
}

/** Keep the saved session copy in step, so a reload shows the same banner. */
function persistUser(user: unknown) {
  try { localStorage.setItem('user', JSON.stringify(user)); } catch { /* storage full or blocked */ }
}

interface SchoolBannerControlProps {
  className?: string;
}

export const SchoolBannerControl: React.FC<SchoolBannerControlProps> = ({ className = '' }) => {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const banner = user?.schoolBannerUrl || null;
  useEffect(() => { setImgFailed(false); }, [banner]);

  const allowed = user?.role === 'principal' || user?.role === 'super_admin';
  if (!allowed) return null;

  const hasBanner = !!banner;

  const applyBanner = (bannerUrl: string | null) => {
    const current = useAuthStore.getState().user;
    if (!current) return;
    const next = { ...current, schoolBannerUrl: resolveBannerUrl(bannerUrl) };
    setUser(next);
    persistUser(next);
  };

  const handleFile = async (file: File) => {
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Choose a photo (JPG, PNG or WebP).');
      return;
    }
    if (file.size > MAX_PICK_MB * 1024 * 1024) {
      setError(`This photo is too large. Choose one under ${MAX_PICK_MB} MB.`);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setError("You're offline. Connect to the internet to change the banner.");
      return;
    }
    setBusy('upload');
    try {
      const dataUrl = await coverCropToJpeg(file);
      const res = await schoolBannerService.set(dataUrl);
      if (!res.success) throw new Error(res.error || 'Could not save the banner. Please try again.');
      applyBanner(res.data?.bannerUrl ?? null);
      showToast.success('Dashboard banner saved');
    } catch (err: any) {
      setError(err?.message || 'Could not save the banner. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires a change.
    e.target.value = '';
    if (file) void handleFile(file);
  };

  const handleRemove = async () => {
    setError(null);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setError("You're offline. Connect to the internet to remove the banner.");
      return;
    }
    setBusy('remove');
    try {
      const res = await schoolBannerService.remove();
      if (!res.success) throw new Error(res.error || 'Could not remove the banner. Please try again.');
      applyBanner(null);
      showToast.success('Dashboard banner removed');
    } catch (err: any) {
      setError(err?.message || 'Could not remove the banner. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={className}>
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-[#315B8C] to-[#1d4ed8] shadow-sm"
        style={{ aspectRatio: `${OUT_W} / ${OUT_H}` }}
      >
        {hasBanner && !imgFailed ? (
          <img
            src={banner as string}
            alt="Your school's dashboard banner"
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-white/90 text-center px-4">
            <ImageIcon size={28} aria-hidden="true" />
            <span className="text-xs">
              {hasBanner ? 'The banner could not be shown here. Try again or choose another photo.' : 'No banner yet. Dashboards use the standard artwork.'}
            </span>
          </div>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40" aria-hidden="true">
            <Loader2 size={28} className="animate-spin text-white" />
          </span>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        Shown behind the welcome banner on every dashboard. Use a bright, uncluttered photo.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={!!busy}
          aria-describedby="school-banner-status"
        >
          {busy === 'upload' ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <ImageIcon size={14} aria-hidden="true" />}
          {busy === 'upload' ? 'Saving…' : hasBanner ? 'Change banner' : 'Upload banner'}
        </Button>
        {hasBanner && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setConfirmOpen(true)}
            disabled={!!busy}
            className="text-red-600 hover:text-red-700"
          >
            {busy === 'remove' ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}
            Remove
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        id="school-banner-input"
        type="file"
        accept="image/*"
        onChange={onPick}
        className="hidden"
        aria-label="Choose a dashboard banner photo"
        tabIndex={-1}
      />

      <p id="school-banner-status" role="status" aria-live="polite" className="mt-2 text-xs">
        {error
          ? <span className="text-red-600 dark:text-red-400">{error}</span>
          : busy === 'upload'
            ? <span className="text-gray-500">Saving the banner…</span>
            : busy === 'remove'
              ? <span className="text-gray-500">Removing the banner…</span>
              : null}
      </p>

      <ConfirmationDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleRemove}
        title="Remove dashboard banner?"
        message="Dashboards will go back to the standard artwork. You can add a new banner at any time."
        confirmLabel="Remove banner"
        isDestructive
      />
    </div>
  );
};

export default SchoolBannerControl;
