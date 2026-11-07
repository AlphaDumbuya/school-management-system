/**
 * A parent filling in the form on a weak connection can lose their typing if the page reloads. The form keeps what
 * was typed on this phone only (never sent anywhere) and clears it once the form is sent.
 */
const PREFIX = 'record-draft:';

export function loadDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}
export function saveDraft(key: string, data: unknown): void {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(data)); } catch { /* storage full or blocked: carry on */ }
}
export function clearDraft(key: string): void {
  try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
}
