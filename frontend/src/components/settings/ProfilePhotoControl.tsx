/**
 * ProfilePhotoControl: the signed-in user's own profile photo (every role).
 * Avatar preview + Upload / Change / Remove. The picked image is shrunk on the
 * device (like staff and student photos) before it is sent, and the cached user
 * is updated so the header and sidebar avatars change straight away.
 *
 * Uses a plain <input type="file" accept="image/*">, which also works in the
 * Android app (the system picker offers the camera and the gallery).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import useAuthStore from '@store/authStore';
import { Button } from '@components/ui/button';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import profilePhotoService from '@services/profilePhotoService';
import { showToast } from '@utils/toast';

/** Longest side of the saved photo, and JPEG quality: same as staff/student photos. */
const MAX_SIDE = 480;
const QUALITY = 0.82;
/** Phone photos are often 5 to 10 MB before shrinking. */
const MAX_PICK_MB = 20;

/** Shrink to MAX_SIDE and re-encode as JPEG on a white background (no black transparency). */
function shrinkToJpeg(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(src);
      const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
      const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('This device could not prepare the photo.')); return; }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(src);
      reject(new Error('This photo could not be opened. Choose a JPG, PNG or WebP photo.'));
    };
    img.src = src;
  });
}

/** True when this device can display the image at `url` (a storage link may be blocked). */
function imageLoads(url: string, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => { img.src = ''; resolve(false); }, timeoutMs);
    img.onload = () => { clearTimeout(timer); resolve(img.naturalWidth > 0); };
    img.onerror = () => { clearTimeout(timer); resolve(false); };
    img.src = url;
  });
}

/** Keep the saved session copy in step, so a reload shows the same avatar. */
function persistUser(user: unknown) {
  try { localStorage.setItem('user', JSON.stringify(user)); } catch { /* storage full or blocked */ }
}

interface ProfilePhotoControlProps {
  className?: string;
}

export const ProfilePhotoControl: React.FC<ProfilePhotoControlProps> = ({ className = '' }) => {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const photo = user?.profilePhotoUrl || user?.profileImage || null;
  useEffect(() => { setImgFailed(false); }, [photo]);

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'U';
  const hasPhoto = !!photo && !imgFailed;

  const applyPhoto = (profilePhotoUrl: string | null) => {
    const current = useAuthStore.getState().user;
    if (!current) return;
    const next = { ...current, profilePhotoUrl, profileImage: undefined };
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
      setError("You're offline. Connect to the internet to change your photo.");
      return;
    }
    setBusy('upload');
    try {
      const dataUrl = await shrinkToJpeg(file);
      let res = await profilePhotoService.set(dataUrl);
      if (!res.success) throw new Error(res.error || 'Could not save your photo. Please try again.');
      let url = res.data?.profilePhotoUrl ?? null;
      // A storage link this device can't show would leave a broken avatar:
      // save the photo inline instead (the same fallback the other photo uploads use).
      if (url && !url.startsWith('data:') && !(await imageLoads(url))) {
        res = await profilePhotoService.set(dataUrl, true);
        if (!res.success) throw new Error(res.error || 'Could not save your photo. Please try again.');
        url = res.data?.profilePhotoUrl ?? dataUrl;
      }
      applyPhoto(url);
      showToast.success('Profile photo saved');
    } catch (err: any) {
      setError(err?.message || 'Could not save your photo. Please try again.');
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
    setBusy('remove');
    try {
      const res = await profilePhotoService.remove();
      if (!res.success) throw new Error(res.error || 'Could not remove your photo. Please try again.');
      const fallback = res.data?.profilePhotoUrl ?? null;
      applyPhoto(fallback);
      showToast.success(fallback ? "Photo removed. Your school's photo is shown instead." : 'Profile photo removed');
    } catch (err: any) {
      setError(err?.message || 'Could not remove your photo. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`flex flex-col sm:flex-row items-center sm:items-start gap-4 ${className}`}>
      <div
        className="relative w-24 h-24 flex-shrink-0 rounded-full overflow-hidden ring-4 ring-white dark:ring-gray-800 shadow-md bg-gradient-to-br from-[#315B8C] to-[#1d4ed8] flex items-center justify-center text-white text-2xl font-bold"
      >
        {hasPhoto ? (
          <img
            src={photo as string}
            alt="Your profile photo"
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span aria-hidden="true">{initials}</span>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 size={24} className="animate-spin" aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0 text-center sm:text-left">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Profile photo</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {hasPhoto ? 'Shown next to your name across the portal.' : 'No photo yet. Add one so people can recognise you.'}
          {' '}JPG, PNG or WebP.
        </p>

        <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={!!busy}
            aria-describedby="profile-photo-status"
          >
            {busy === 'upload' ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Camera size={14} aria-hidden="true" />}
            {busy === 'upload' ? 'Saving…' : hasPhoto ? 'Change photo' : 'Upload photo'}
          </Button>
          {!!photo && (
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
          id="profile-photo-input"
          type="file"
          accept="image/*"
          onChange={onPick}
          className="hidden"
          aria-label="Choose a profile photo"
          tabIndex={-1}
        />

        <p id="profile-photo-status" role="status" aria-live="polite" className="mt-2 text-xs">
          {error
            ? <span className="text-red-600 dark:text-red-400">{error}</span>
            : busy === 'upload'
              ? <span className="text-gray-500">Saving your photo…</span>
              : busy === 'remove'
                ? <span className="text-gray-500">Removing your photo…</span>
                : null}
        </p>
      </div>

      <ConfirmationDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleRemove}
        title="Remove profile photo?"
        message="Your initials will be shown instead. You can add a new photo at any time."
        confirmLabel="Remove photo"
        isDestructive
      />
    </div>
  );
};

export default ProfilePhotoControl;
