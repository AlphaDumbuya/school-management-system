/**
 * download — one cross-platform helper for saving/opening files from the app.
 *
 * WHY THIS EXISTS
 * On the web, downloads use the classic pattern: create a Blob URL and click a
 * hidden `<a download>` (or `window.open` for a preview). Inside the native
 * Capacitor Android WebView there is NO download manager, so that pattern
 * silently does nothing — every "Download / Export" button appeared broken.
 *
 * On native we instead:
 *   1. write the file into the app's Cache directory via @capacitor/filesystem, then
 *   2. open the native Share sheet via @capacitor/share so the user can Save to
 *      Files, open in another app, or send it.
 *
 * All export/download code should call `saveBlob()` (for generated Blobs) or
 * `openUrl()` (for a server file URL) instead of hand-rolling anchor clicks, so
 * behaviour is correct on both web and mobile.
 */
import { isAppMode } from './appMode';

/** Lazy-load Capacitor plugins so the web bundle never hard-depends on them. */
async function nativePlugins() {
  const [{ Filesystem, Directory }, { Share }, { Capacitor }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
    import('@capacitor/core'),
  ]);
  return { Filesystem, Directory, Share, Capacitor };
}

/** Convert a Blob to a base64 string (no data: prefix) for Filesystem.write. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = String(reader.result || '');
      const comma = res.indexOf(',');
      resolve(comma >= 0 ? res.slice(comma + 1) : res);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Best-effort MIME → file behaviour. */
function guessMime(filename: string, fallback = 'application/octet-stream'): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'csv': return 'text/csv';
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'xls': return 'application/vnd.ms-excel';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'apk': return 'application/vnd.android.package-archive';
    default: return fallback;
  }
}

/** The classic web download: Blob URL + hidden anchor click. */
function webSaveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Save a generated Blob as a file.
 *  - Web: triggers a normal browser download.
 *  - Native: writes to the app cache and opens the Share sheet so the user can
 *    save it to Files / open it / send it.
 */
export async function saveBlob(blob: Blob, filename: string): Promise<void> {
  if (!isAppMode()) {
    webSaveBlob(blob, filename);
    return;
  }
  try {
    const { Filesystem, Directory, Share, Capacitor } = await nativePlugins();
    const base64 = await blobToBase64(blob);
    const write = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });
    const fileUri = write.uri || Capacitor.convertFileSrc?.(write.uri);
    await Share.share({
      title: filename,
      // A short prompt shown on the share sheet on some targets.
      text: filename,
      url: fileUri,
      dialogTitle: 'Save or share file',
    });
  } catch (err) {
    // If the native path fails for any reason, fall back to the web download so
    // the user is never left with a dead button.
    // eslint-disable-next-line no-console
    console.warn('Native saveBlob failed, falling back to web download', err);
    webSaveBlob(blob, filename);
  }
}

/**
 * Open a URL that points to a file or page.
 *  - Web: opens a new tab.
 *  - Native: opens in the in-app system browser (@capacitor/browser), which can
 *    render PDFs/images and offers the OS "download/share" affordances. A
 *    server file URL (PDF/APK/xlsx) opened this way is handled by the OS.
 */
export async function openUrl(url: string): Promise<void> {
  if (!isAppMode()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Native openUrl failed, falling back to window.open', err);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Preview a generated Blob (e.g. a freshly built PDF).
 *  - Web: opens the Blob in a new tab.
 *  - Native: Blob URLs are not viewable in the WebView, so we save + share
 *    instead (identical to saveBlob) — the OS viewer opens it.
 */
export async function previewBlob(blob: Blob, filename: string): Promise<void> {
  if (!isAppMode()) {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return;
  }
  // On native, sharing the saved file lets the user open it in a PDF viewer.
  await saveBlob(blob, filename);
}

/** True when running in the native app (re-exported for convenience). */
export { isAppMode };

/** Suppress unused warning for guessMime if a caller doesn't need it. */
void guessMime;
