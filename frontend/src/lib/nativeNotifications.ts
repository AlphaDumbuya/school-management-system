/**
 * nativeNotifications — shows new in-app notifications as Android system
 * notifications (status bar + sound) while the WiSkul app is running, in the
 * foreground or recently backgrounded.
 *
 * How it works: the notification bell already polls /api/v1/notifications every
 * 60s. Each time it does, `announceNew()` compares the unread items against the
 * ones already announced on this device and posts a local notification for each
 * new one. Tapping it opens the app on the notification's page.
 *
 * Limits (by design, no server push yet): when Android has fully stopped the
 * app, nothing polls, so nothing is shown until the app is opened again. True
 * closed-app delivery needs Firebase Cloud Messaging (see docs).
 *
 * Safe everywhere: on the web, or on an older APK without the plugin, every
 * function is a no-op.
 */
import type { AppNotification } from '@services/notificationService';

const SEEN_KEY = 'wiskul.native.notified.v1';
const MAX_SEEN = 300;
let listenerAdded = false;
let permission: 'unknown' | 'granted' | 'denied' = 'unknown';

function capacitor(): any {
  return typeof window !== 'undefined' ? (window as any).Capacitor : null;
}

/** Native shell AND an APK that includes the plugin. */
export function nativeNotificationsAvailable(): boolean {
  const cap = capacitor();
  if (!cap || !(typeof cap.isNativePlatform === 'function' ? cap.isNativePlatform() : cap.isNative)) return false;
  return typeof cap.isPluginAvailable === 'function' ? cap.isPluginAvailable('LocalNotifications') : false;
}

function loadSeen(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set(); }
}
function saveSeen(seen: Set<string>) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen).slice(-MAX_SEEN))); } catch { /* ignore */ }
}

/** Numeric id Android needs (stable per notification id). */
function numericId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_000_000_000 || 1;
}

async function plugin() {
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  return LocalNotifications;
}

/** Ask once (Android 13+ shows the system prompt). Remembers the answer. */
async function ensurePermission(): Promise<boolean> {
  if (permission !== 'unknown') return permission === 'granted';
  try {
    const LN = await plugin();
    let st = await LN.checkPermissions();
    if (st.display === 'prompt' || st.display === 'prompt-with-rationale') st = await LN.requestPermissions();
    permission = st.display === 'granted' ? 'granted' : 'denied';
  } catch {
    permission = 'denied';
  }
  return permission === 'granted';
}

/** Tapping a notification opens its page inside the app. */
async function ensureTapListener(navigate: (url: string) => void) {
  if (listenerAdded) return;
  listenerAdded = true;
  try {
    const LN = await plugin();
    await LN.addListener('localNotificationActionPerformed', (ev: any) => {
      const url = ev?.notification?.extra?.url;
      if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) navigate(url);
    });
  } catch { listenerAdded = false; }
}

/**
 * Post a system notification for each unread item not announced before on
 * this device. The first run after sign-in only records what's there (so an
 * old backlog doesn't fire dozens of notifications at once).
 */
export async function announceNew(items: AppNotification[], navigate: (url: string) => void): Promise<void> {
  if (!nativeNotificationsAvailable() || !Array.isArray(items)) return;
  const seen = loadSeen();
  const firstRun = seen.size === 0;
  const fresh = items.filter((n) => n && n.id && !n.readAt && !seen.has(n.id));
  if (!fresh.length) return;
  fresh.forEach((n) => seen.add(n.id));
  saveSeen(seen);
  if (firstRun) return;
  if (!(await ensurePermission())) return;
  await ensureTapListener(navigate);
  try {
    const LN = await plugin();
    await LN.schedule({
      notifications: fresh.slice(0, 5).map((n) => ({
        id: numericId(n.id),
        title: String(n.subject || 'WiSkul').slice(0, 80),
        body: String(n.message || '').slice(0, 240),
        largeBody: String(n.message || '').slice(0, 1000),
        smallIcon: 'ic_stat_notify',
        iconColor: '#1d4ed8',
        extra: { url: (n.data as any)?.url || (n.data as any)?.actionUrl || '/dashboard' },
      })),
    });
  } catch { /* never break the bell */ }
}

/** Forget what was announced (call on logout so the next user starts clean). */
export function resetNativeNotifications() {
  try { localStorage.removeItem(SEEN_KEY); } catch { /* ignore */ }
}
