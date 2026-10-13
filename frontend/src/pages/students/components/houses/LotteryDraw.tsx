/**
 * The house lottery, built for suspense.
 *
 *  1. SPIN   a stage with sweeping spotlights; a glass drum rattles its coloured
 *            balls (one colour per registered house) while a spotlight races
 *            along the house tiles. It runs at least ~2 s, and for as long as
 *            the server takes to decide.
 *  2. LAND   the spotlight slows down step by step, the last steps taking most
 *            of a second each, and stops on the winning house.
 *  3. FLASH  a thud, a flash of the house colour and the winning ball bursting
 *            out of the drum.
 *  4. REVEAL the student's photo in a spinning ring that glows in the house
 *            colour, the house name, confetti and a short fanfare.
 *
 * The house is decided by the server (random among the smallest houses, which
 * keeps the houses level); this screen only shows it. Sound is optional
 * (button, remembered). With "reduce motion" on, the result shows straight away.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import './lottery.css';
import { textOn } from './houseUi';
import { lotterySound, saveSoundPreference, soundPreference } from './lotterySound';

export interface LotteryHouse { id: string; name: string; color: string; motto?: string | null }

type Phase = 'spin' | 'land' | 'flash' | 'reveal';

const MIN_SPIN_MS = 2000;
const GOLD = '#fbbf24';
const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const initial = (name: string) => (name.trim()[0] || '?').toUpperCase();
const initialsOf = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

/** Blend a #rrggbb colour toward white (t > 0) or black (t < 0). */
function shade(hex: string, t: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const target = t >= 0 ? 255 : 0;
  const k = Math.abs(t);
  const f = (v: number) => Math.round(v + (target - v) * k);
  return `#${[f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** The glass drum with tumbling balls, on its own (also shown while "Draw for all" runs). */
export const LotteryDrum: React.FC<{ houses: LotteryHouse[]; calm?: boolean; shaking?: boolean }> = ({ houses, calm, shaking }) => {
  const balls = useMemo(() => {
    const list = houses.length ? houses : [{ id: 'x', name: '?', color: '#64748b' }];
    const per = Math.max(2, Math.min(4, Math.floor(14 / list.length)));
    const out: { key: string; h: LotteryHouse; style: React.CSSProperties }[] = [];
    list.forEach((h) => {
      for (let k = 0; k < per; k++) {
        const v: Record<string, string> = {
          '--x0': `${rand(36, 158).toFixed(0)}px`, '--y0': `${rand(36, 158).toFixed(0)}px`,
          '--dur': `${rand(0.9, 1.7).toFixed(2)}s`, '--delay': `-${rand(0, 1.5).toFixed(2)}s`,
        };
        for (let i = 1; i <= 4; i++) { v[`--dx${i}`] = `${rand(-70, 70).toFixed(0)}px`; v[`--dy${i}`] = `${rand(-70, 70).toFixed(0)}px`; }
        out.push({ key: `${h.id}-${k}`, h, style: { ...v, backgroundColor: h.color, color: textOn(h.color) } as React.CSSProperties });
      }
    });
    return out.sort(() => Math.random() - 0.5);
  }, [houses]);
  return (
    <div className={`lottery-drum ${calm ? 'is-calm' : ''} ${shaking ? 'is-shaking' : ''}`} aria-hidden="true">
      {balls.map((b) => <span key={b.key} className="lottery-ball" style={b.style}>{initial(b.h.name)}</span>)}
    </div>
  );
};

export const LotteryDraw: React.FC<{
  houses: LotteryHouse[];
  /** null while the server is still drawing. */
  winnerId: string | null;
  studentName: string;
  /** The student's photo, shown in the reveal (initials when there is none). */
  photoUrl?: string | null;
  /** 'sibling' = joined a brother or sister, not a random draw. */
  method?: string;
  onSettled: () => void;
}> = ({ houses, winnerId, studentName, photoUrl, method, onSettled }) => {
  const H = houses.length;
  const [phase, setPhase] = useState<Phase>('spin');
  const [active, setActive] = useState(0);
  const [sound, setSound] = useState<boolean>(() => soundPreference());
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const activeRef = useRef(0);
  const startedAt = useRef(Date.now());
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;
  const winnerIdx = winnerId ? houses.findIndex((h) => h.id === winnerId) : -1;
  const winner = winnerIdx >= 0 ? houses[winnerIdx] : null;

  const play = (fn: () => void) => { if (soundRef.current) fn(); };

  // While waiting for the server: the spotlight races along the houses.
  useEffect(() => {
    if (phase !== 'spin' || H < 2 || prefersReducedMotion()) return;
    const t = setInterval(() => {
      activeRef.current = (activeRef.current + 1) % H;
      setActive(activeRef.current);
      play(() => lotterySound.tick(820));
    }, 85);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, H]);

  // Result known: finish the minimum spin, slow down onto the winner, flash, reveal.
  useEffect(() => {
    if (!winnerId) return;
    const target = Math.max(winnerIdx, 0);
    if (H < 2 || prefersReducedMotion()) {
      activeRef.current = target; setActive(target); setPhase('reveal');
      const t = setTimeout(() => settledRef.current(), 150);
      return () => clearTimeout(t);
    }
    let cancelled = false;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => { timers.push(window.setTimeout(() => { if (!cancelled) fn(); }, ms)); };
    const wait = Math.max(0, MIN_SPIN_MS - (Date.now() - startedAt.current));
    later(() => {
      setPhase('land');
      const from = activeRef.current;
      const extra = (target - from + H) % H;
      const steps = H * Math.max(1, Math.ceil(16 / H)) + extra; // ~16+ steps, ends exactly on the winner
      let i = 0;
      const tick = () => {
        i += 1;
        activeRef.current = (from + i) % H; setActive(activeRef.current);
        const p = i / steps;
        play(() => lotterySound.tick(Math.round(520 + (1 - p) * 360)));
        if (i >= steps) {
          setPhase('flash');
          play(() => lotterySound.thud());
          later(() => {
            setPhase('reveal');
            play(() => lotterySound.fanfare());
            later(() => settledRef.current(), 900);
          }, 900);
          return;
        }
        // Quick at first, then slower and slower: the last step takes most of a second.
        later(tick, 60 + 760 * Math.pow(p, 3));
      };
      later(tick, 80);
    }, wait);
    return () => { cancelled = true; timers.forEach((t) => clearTimeout(t)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winnerId]);

  const stars = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    key: i, left: `${rand(2, 98).toFixed(0)}%`, top: `${rand(2, 98).toFixed(0)}%`, size: `${rand(2, 4.5).toFixed(1)}px`, delay: `${rand(0, 3).toFixed(2)}s`,
  })), []);
  const confetti = useMemo(() => Array.from({ length: 44 }, (_, i) => {
    const angle = rand(0, Math.PI * 2);
    const dist = rand(90, 260);
    return {
      key: i, tx: `${(Math.cos(angle) * dist).toFixed(0)}px`, ty: `${(Math.sin(angle) * dist - 80).toFixed(0)}px`,
      dur: `${rand(1.6, 2.8).toFixed(2)}s`, delay: `${rand(0, 0.25).toFixed(2)}s`,
      w: `${rand(6, 11).toFixed(0)}px`, h: `${rand(9, 16).toFixed(0)}px`,
      color: ['#fbbf24', '#ffffff', '#f472b6', '#34d399', '#60a5fa'][i % 5],
    };
  }), []);

  const flashing = phase === 'flash' && !!winner;
  const revealed = phase === 'reveal' && !!winner;
  const glow = winner && (flashing || revealed) ? winner.color : GOLD;
  const caption = phase === 'spin' ? 'The drum is turning…' : phase === 'land' ? 'Drumroll…' : '';

  return (
    <div className="lottery-stage" style={{ ['--glow' as string]: glow } as React.CSSProperties}>
      <div className="lottery-beams" aria-hidden="true" />
      {stars.map((s) => <span key={s.key} className="lottery-star" aria-hidden="true" style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay }} />)}
      {flashing && <div className="lottery-flash" aria-hidden="true" />}
      {revealed && confetti.map((c) => (
        <span key={c.key} className="lottery-burst" aria-hidden="true"
          style={{ backgroundColor: c.color, width: c.w, height: c.h, ['--tx' as string]: c.tx, ['--ty' as string]: c.ty, ['--dur' as string]: c.dur, ['--cdelay' as string]: c.delay } as React.CSSProperties} />
      ))}

      <div className="lottery-content">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-[0.35em] text-amber-300">House draw</span>
          <button type="button" aria-pressed={sound} onClick={() => { const n = !sound; setSound(n); saveSoundPreference(n); if (n) lotterySound.tick(900); }}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/90 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-amber-300">
            {sound ? <Volume2 size={13} aria-hidden="true" /> : <VolumeX size={13} aria-hidden="true" />} Sound {sound ? 'on' : 'off'}
          </button>
        </div>

        <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-300">{revealed ? 'The house is' : 'Drawing a house for'}</p>
        <p className="mb-3 text-center text-xl font-black drop-shadow">{studentName}</p>

        <div className="lottery-arena">
          {!revealed && <LotteryDrum houses={houses} calm={phase === 'land'} shaking={phase === 'spin' || flashing} />}
          {flashing && winner && (
            <span className="lottery-winball" aria-hidden="true" style={{ backgroundColor: winner.color, color: textOn(winner.color) }}>{initial(winner.name)}</span>
          )}
          {revealed && winner && (
            <div className="lottery-card" style={{
              background: `radial-gradient(circle at 50% 0%, ${shade(winner.color, 0.3)}, ${winner.color} 55%, ${shade(winner.color, -0.35)})`,
              color: textOn(winner.color),
            }}>
              <div className="lottery-ring">
                <span className="lottery-ripple" aria-hidden="true" />
                <span className="lottery-ripple lottery-ripple-2" aria-hidden="true" />
                <div className="lottery-photo">
                  {photoUrl && photoUrl.length > 10
                    ? <img src={photoUrl} alt={`Photo of ${studentName}`} />
                    : <span aria-hidden="true">{initialsOf(studentName)}</span>}
                </div>
              </div>
              <p className="mt-4 text-sm font-semibold uppercase tracking-widest opacity-90">{method === 'sibling' ? 'Joins their brother or sister in' : 'Welcome to'}</p>
              <p className="text-4xl font-black leading-tight drop-shadow-lg">{winner.name}</p>
              {winner.motto && <p className="mt-1 text-sm italic opacity-90">“{winner.motto}”</p>}
              <span className="lottery-sheen" aria-hidden="true" />
            </div>
          )}
        </div>

        <p className={`mt-3 h-5 text-center text-sm font-bold tracking-widest text-amber-200 ${caption ? 'lottery-pulse' : ''}`} aria-hidden="true">{caption}</p>

        {/* The registered houses: the spotlight runs along them */}
        <ul className="mt-2 flex flex-wrap justify-center gap-2.5" aria-label="Registered houses">
          {houses.map((h, i) => {
            const isActive = i === active;
            const isWinner = (flashing || revealed) && i === winnerIdx;
            const dim = (flashing || revealed) && !isWinner;
            const lit = isActive && !(flashing || revealed);
            return (
              <li key={h.id}
                className={`lottery-tile ${lit ? 'is-lit' : ''} ${isWinner ? 'is-winner' : ''} ${dim ? 'is-dim' : ''}`}
                style={{ backgroundColor: h.color, color: textOn(h.color), ['--tile' as string]: h.color } as React.CSSProperties}>
                {h.name}
              </li>
            );
          })}
        </ul>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {revealed && winner ? `${studentName} is in ${winner.name}` : 'Drawing a house'}
      </p>
    </div>
  );
};
