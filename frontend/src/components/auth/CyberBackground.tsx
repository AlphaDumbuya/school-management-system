/**
 * CyberBackground — a calm, ambient "data network" backdrop for the auth pages.
 *
 * Rendered on a raw 2D <canvas> (no three.js, so it's immune to the React 18 /
 * fiber v9 incompatibility). Intentionally understated: a sparse field of slowly
 * drifting nodes joined by faint link lines, with subtle data packets gliding
 * between nodes and occasional school-data glyphs (grades, %, ✓, Le) that fade
 * up and out. It hints at a connected data platform without pulling focus from
 * the sign-in card.
 *
 * Fully non-interactive and honours prefers-reduced-motion.
 * Palette: WiSkul blue (#60a5fa) + occasional amber (#f59e0b) on deep navy.
 */
import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  amber: boolean;
}

interface Packet {
  a: number; // source particle index
  b: number; // target particle index
  t: number; // 0..1 progress
  speed: number;
}

interface Glyph {
  x: number;
  y: number;
  text: string;
  vy: number;
  life: number; // 0..1, drives fade in/out
  maxLife: number;
  size: number;
  amber: boolean;
}

// School-data flavoured glyphs — grades, marks, ticks, currency.
const GLYPH_SET = ['A+', 'B', '95%', '✓', 'Le', 'A', '100', '#', 'GPA', '★', '88%', 'ID'];
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const CyberBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const LINK_DIST = 150;

    let particles: Particle[] = [];
    let packets: Packet[] = [];
    const glyphs: Glyph[] = [];

    const spawnPacket = () => {
      if (particles.length < 2) return;
      const a = Math.floor(Math.random() * particles.length);
      let b = Math.floor(Math.random() * particles.length);
      if (b === a) b = (b + 1) % particles.length;
      packets.push({ a, b, t: 0, speed: 0.004 + Math.random() * 0.006 });
    };

    const spawnGlyph = () => {
      glyphs.push({
        x: Math.random() * width,
        y: height * (0.4 + Math.random() * 0.6),
        text: pick(GLYPH_SET),
        vy: 0.15 + Math.random() * 0.25,
        life: 0,
        maxLife: 4000 + Math.random() * 4000,
        size: 12 + Math.random() * 8,
        amber: Math.random() < 0.25,
      });
    };

    const build = () => {
      // Density scales with area but stays sparse so it reads as "ambient".
      const target = Math.min(60, Math.round((width * height) / 26000));
      particles = Array.from({ length: target }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: 1.5 + Math.random() * 2,
        amber: Math.random() < 0.14,
      }));
      packets = [];
      for (let i = 0; i < 5; i++) spawnPacket();
    };

    const resize = () => {
      const parent = canvas.parentElement;
      width = parent ? parent.clientWidth : window.innerWidth;
      height = parent ? parent.clientHeight : window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    };
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    let last = performance.now();
    let glyphTimer = 0;

    const draw = (now: number) => {
      const dt = Math.min(now - last, 60);
      last = now;
      ctx.clearRect(0, 0, width, height);

      // Move
      if (!reduced) {
        for (const p of particles) {
          p.x += p.vx * (dt / 16);
          p.y += p.vy * (dt / 16);
          if (p.x < -20) p.x = width + 20;
          else if (p.x > width + 20) p.x = -20;
          if (p.y < -20) p.y = height + 20;
          else if (p.y > height + 20) p.y = -20;
        }
      }

      // Faint links
      ctx.lineWidth = 1;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < LINK_DIST) {
            const alpha = (1 - dist / LINK_DIST) * 0.35;
            ctx.strokeStyle = `rgba(147,197,253,${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Nodes — clear but calm, with a soft glow so they read on the gradient
      for (const p of particles) {
        if (p.amber) {
          ctx.fillStyle = 'rgba(251,191,36,0.95)';
          ctx.shadowColor = 'rgba(245,158,11,0.9)';
        } else {
          ctx.fillStyle = 'rgba(191,219,254,0.9)';
          ctx.shadowColor = 'rgba(96,165,250,0.85)';
        }
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // Data packets gliding along links (records syncing across the network)
      if (!reduced) {
        for (let i = packets.length - 1; i >= 0; i--) {
          const pk = packets[i];
          const a = particles[pk.a];
          const b = particles[pk.b];
          if (!a || !b) {
            packets.splice(i, 1);
            continue;
          }
          pk.t += pk.speed * (dt / 16);
          if (pk.t >= 1) {
            packets.splice(i, 1);
            spawnPacket();
            continue;
          }
          const px = a.x + (b.x - a.x) * pk.t;
          const py = a.y + (b.y - a.y) * pk.t;
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.shadowColor = 'rgba(96,165,250,0.9)';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(px, py, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      }

      // Slowly rising school-data glyphs that fade in and out
      glyphTimer += dt;
      if (!reduced && glyphTimer > 1400 && glyphs.length < 7) {
        glyphTimer = 0;
        spawnGlyph();
      }
      ctx.textAlign = 'center';
      for (let i = glyphs.length - 1; i >= 0; i--) {
        const g = glyphs[i];
        if (!reduced) {
          g.life += dt;
          g.y -= g.vy * (dt / 16);
        }
        if (g.life >= g.maxLife) {
          glyphs.splice(i, 1);
          continue;
        }
        // Triangular fade: in for first 25%, out for last 25%
        const p = g.life / g.maxLife;
        const fade = p < 0.25 ? p / 0.25 : p > 0.75 ? (1 - p) / 0.25 : 1;
        const alpha = fade * 0.4;
        ctx.font = `600 ${g.size}px "Segoe UI", system-ui, sans-serif`;
        ctx.fillStyle = g.amber
          ? `rgba(251,191,36,${alpha})`
          : `rgba(147,197,253,${alpha})`;
        ctx.fillText(g.text, g.x, g.y);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
};

export default CyberBackground;
