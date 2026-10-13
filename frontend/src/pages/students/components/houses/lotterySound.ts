/**
 * Small synthesised sounds for the house draw (no audio files): a tick as the
 * spotlight moves, a thud when it stops, and a short fanfare for the result.
 * Everything is guarded: no audio support, or a blocked audio context, is silent.
 * The choice (on / off) is remembered on this device.
 */
const KEY = 'wiskul.lottery.sound';
let ctx: AudioContext | null = null;

export function soundPreference(): boolean {
  try { return localStorage.getItem(KEY) !== '0'; } catch { return true; }
}
export function saveSoundPreference(on: boolean): void {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* ignore */ }
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = ctx || new C();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, endFreq?: number): void {
  const a = audio();
  if (!a) return;
  try {
    const t0 = a.currentTime + delay;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  } catch { /* ignore */ }
}

export const lotterySound = {
  /** The spotlight moves one house along. */
  tick(freq = 700) { tone(freq, 0.05, 'square', 0.035); },
  /** It stops. */
  thud() { tone(130, 0.5, 'sine', 0.22, 0, 45); tone(65, 0.6, 'sine', 0.18); },
  /** The result is shown. */
  fanfare() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.28, 'triangle', 0.09, i * 0.11));
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(f, 0.9, 'sine', 0.045, 0.5));
  },
};
