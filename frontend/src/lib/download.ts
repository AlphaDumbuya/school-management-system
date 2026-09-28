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

/** Show a brief toast (best-effort; never throws). */
async function toast(message: string, kind: 'success' | 'error' = 'success') {
  try {
    const { showToast } = await import('@utils/toast');
    kind === 'error' ? showToast.error(message) : showToast.success(message);
  } catch { /* ignore */ }
}

/**
 * Save a generated Blob as a file.
 *  - Web: triggers a normal browser download.
 *  - Native: writes the file DIRECTLY into the device's Documents folder (a
 *    user-visible location, browsable via Files) and shows a confirmation toast.
 *    No Share sheet — the file is saved straight to the device. If the direct
 *    write fails, it falls back to the Share sheet so the action never dies.
 */
export async function saveBlob(blob: Blob, filename: string): Promise<void> {
  if (!isAppMode()) {
    webSaveBlob(blob, filename);
    return;
  }
  const base64 = await blobToBase64(blob);
  try {
    const { Filesystem, Directory } = await nativePlugins();
    // Documents maps to a user-visible folder on Android; the file lands there
    // directly (no picker, no share sheet).
    await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    });
    await toast(`Saved to Documents: ${filename}`);
  } catch (err) {
    // Fallback 1: write to app storage + open the Share sheet so the user can
    // still get the file (some devices restrict Documents writes).
    // eslint-disable-next-line no-console
    console.warn('Direct save to Documents failed, falling back to Share', err);
    try {
      const { Filesystem, Directory, Share } = await nativePlugins();
      const write = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
        recursive: true,
      });
      await Share.share({ title: filename, url: write.uri, dialogTitle: 'Save file' });
    } catch (err2) {
      // Fallback 2: web-style download.
      // eslint-disable-next-line no-console
      console.warn('Share fallback failed, using web download', err2);
      webSaveBlob(blob, filename);
    }
  }
}

/**
 * Open a URL that points to a page/document you want to VIEW.
 *  - Web: opens a new tab.
 *  - Native: opens in the in-app system browser (@capacitor/browser). Good for
 *    viewing pages/PDFs, but NOT for file downloads like the APK — use
 *    openExternal() for those.
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
 * Open a URL in the EXTERNAL system browser (Chrome), not the in-app webview.
 * This is what you want for a FILE download such as the APK: the system browser
 * downloads the .apk and shows Android's install prompt. The in-app browser
 * would instead offer a "Share" action for the file, which is not what users
 * expect for an app update.
 *
 * Implementation: `window.open(url, '_system')` is intercepted by the Capacitor
 * Android bridge and handed to the OS default browser. Falls back to a normal
 * new-tab open on web or if the bridge isn't present.
 */
export async function openExternal(url: string): Promise<void> {
  if (!isAppMode()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  try {
    // Capacitor routes the special '_system' target to the external browser.
    const opened = window.open(url, '_system');
    if (!opened) {
      // Some webviews return null even on success; also try a location assign
      // as a fallback so the download definitely starts.
      window.location.href = url;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('openExternal failed, falling back', err);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Preview a generated Blob (e.g. a freshly built PDF for Print/Preview).
 *  - Web: opens the Blob in a new tab.
 *  - Native: saves it directly to Documents (no share sheet) and toasts where it
 *    went — the user opens it from their Files app.
 */
export async function previewBlob(blob: Blob, filename: string): Promise<void> {
  if (!isAppMode()) {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return;
  }
  // Native "preview" == save the file directly to Documents (no share sheet).
  // Opening it in a viewer reliably needs a FileProvider/file-opener plugin,
  // which isn't installed; saving + toasting is the robust, predictable result.
  await saveBlob(blob, filename);
}

/** True when running in the native app (re-exported for convenience). */
export { isAppMode };

/** Suppress unused warning for guessMime if a caller doesn't need it. */
void guessMime;
