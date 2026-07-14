/**
 * AnimatedBackground3D — Visible calm blue animated background
 * - Deep navy base gradient
 * - Slowly drifting semi-transparent blue geometric shapes (circles, hexagons, triangles)
 * - Floating edu icons (book, cap, pencil, atom, star, ruler) — blue tones only
 * - Soft particle dots with connection lines
 * All opacity values tuned to be clearly visible but not flashy
 */

import React, { useEffect, useRef } from 'react';

interface Shape {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  rotation: number; rotSpeed: number;
  alpha: number; alphaDir: number;
  type: 'circle' | 'hexagon' | 'triangle' | 'diamond' | 'ring';
  bobPhase: number;
}

interface EduIcon {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  rotation: number; rotSpeed: number;
  alpha: number; alphaDir: number;
  type: 'book' | 'cap' | 'pencil' | 'atom' | 'star5' | 'ruler';
  bobPhase: number;
}

interface Dot {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  alpha: number; alphaDir: number;
}

export const AnimatedBackground3D: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shapes = useRef<Shape[]>([]);
  const icons = useRef<EduIcon[]>([]);
  const dots = useRef<Dot[]>([]);
  const raf = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      init();
    };

    const mob = () => window.innerWidth < 768;

    const init = () => {
      // ── geometric shapes ──────────────────────────────────────────
      const SHAPE_TYPES: Shape['type'][] = ['circle', 'hexagon', 'triangle', 'diamond', 'ring'];
      const sCount = mob() ? 8 : 15;
      shapes.current = Array.from({ length: sCount }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: mob()
          ? Math.random() * 30 + 20
          : Math.random() * 55 + 25,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.007,
        alpha: Math.random() * 0.18 + 0.1,
        alphaDir: Math.random() > 0.5 ? 1 : -1,
        type: SHAPE_TYPES[Math.floor(Math.random() * SHAPE_TYPES.length)],
        bobPhase: Math.random() * Math.PI * 2,
      }));

      // ── edu icons ─────────────────────────────────────────────────
      const ICON_TYPES: EduIcon['type'][] = ['book', 'cap', 'pencil', 'atom', 'star5', 'ruler'];
      const iCount = mob() ? 8 : 16;
      icons.current = Array.from({ length: iCount }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        size: mob() ? Math.random() * 16 + 14 : Math.random() * 24 + 18,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.007,
        alpha: Math.random() * 0.3 + 0.15,
        alphaDir: Math.random() > 0.5 ? 1 : -1,
        type: ICON_TYPES[Math.floor(Math.random() * ICON_TYPES.length)],
        bobPhase: Math.random() * Math.PI * 2,
      }));

      // ── dots ──────────────────────────────────────────────────────
      const dCount = mob() ? 35 : 65;
      dots.current = Array.from({ length: dCount }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.8 + 0.8,
        alpha: Math.random() * 0.4 + 0.2,
        alphaDir: Math.random() > 0.5 ? 1 : -1,
      }));
    };

    resize();
    window.addEventListener('resize', resize);

    // ── Draw: geometric shapes ─────────────────────────────────────
    const drawShape = (s: Shape) => {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);
      ctx.globalAlpha = s.alpha;
      ctx.strokeStyle = 'rgba(147,197,253,1)'; // blue-300
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (s.type === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, s.size, 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.type === 'ring') {
        ctx.beginPath();
        ctx.arc(0, 0, s.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, s.size * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.type === 'hexagon') {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
          if (i === 0) ctx.moveTo(Math.cos(a) * s.size, Math.sin(a) * s.size);
          else ctx.lineTo(Math.cos(a) * s.size, Math.sin(a) * s.size);
        }
        ctx.closePath();
        ctx.stroke();
      } else if (s.type === 'triangle') {
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
          if (i === 0) ctx.moveTo(Math.cos(a) * s.size, Math.sin(a) * s.size);
          else ctx.lineTo(Math.cos(a) * s.size, Math.sin(a) * s.size);
        }
        ctx.closePath();
        ctx.stroke();
      } else if (s.type === 'diamond') {
        ctx.beginPath();
        ctx.moveTo(0, -s.size);
        ctx.lineTo(s.size * 0.6, 0);
        ctx.lineTo(0, s.size);
        ctx.lineTo(-s.size * 0.6, 0);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    };

    // ── Draw: edu icons ────────────────────────────────────────────
    const COL = 'rgba(186,230,253,1)'; // sky-200 — subtle but visible

    const drawBook = (ic: EduIcon) => {
      ctx.save(); ctx.translate(ic.x, ic.y); ctx.rotate(ic.rotation);
      ctx.globalAlpha = ic.alpha; ctx.strokeStyle = COL;
      ctx.lineWidth = ic.size * 0.07; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const w = ic.size * 0.68, h = ic.size * 0.88;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.beginPath(); ctx.moveTo(-w * 0.08, -h / 2); ctx.lineTo(-w * 0.08, h / 2); ctx.stroke();
      for (let i = 1; i <= 3; i++) {
        const ly = -h / 2 + (h / 4) * i;
        ctx.beginPath(); ctx.moveTo(-w * 0.04, ly); ctx.lineTo(w / 2 - ic.size * 0.04, ly); ctx.stroke();
      }
      ctx.restore();
    };

    const drawCap = (ic: EduIcon) => {
      ctx.save(); ctx.translate(ic.x, ic.y); ctx.rotate(ic.rotation);
      ctx.globalAlpha = ic.alpha; ctx.strokeStyle = COL;
      ctx.lineWidth = ic.size * 0.07; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const hw = ic.size * 0.58, hh = ic.size * 0.17;
      ctx.beginPath(); ctx.moveTo(0, -hh); ctx.lineTo(hw, 0); ctx.lineTo(0, hh); ctx.lineTo(-hw, 0); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hw * 0.6, 0); ctx.lineTo(hw * 0.6, ic.size * 0.34); ctx.stroke();
      ctx.beginPath(); ctx.arc(hw * 0.6, ic.size * 0.37, ic.size * 0.05, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    };

    const drawPencil = (ic: EduIcon) => {
      ctx.save(); ctx.translate(ic.x, ic.y); ctx.rotate(ic.rotation);
      ctx.globalAlpha = ic.alpha; ctx.strokeStyle = COL;
      ctx.lineWidth = ic.size * 0.07; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const len = ic.size * 0.88, w = ic.size * 0.17;
      ctx.strokeRect(-len / 2, -w / 2, len * 0.74, w);
      ctx.beginPath();
      ctx.moveTo(-len / 2 + len * 0.74, -w / 2);
      ctx.lineTo(-len / 2 + len * 0.74, w / 2);
      ctx.lineTo(-len / 2 + len, 0);
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(len / 2 - ic.size * 0.09, -w / 2); ctx.lineTo(len / 2 - ic.size * 0.09, w / 2); ctx.stroke();
      ctx.restore();
    };

    const drawAtom = (ic: EduIcon) => {
      ctx.save(); ctx.translate(ic.x, ic.y);
      ctx.globalAlpha = ic.alpha; ctx.strokeStyle = COL; ctx.lineWidth = ic.size * 0.06;
      ctx.beginPath(); ctx.arc(0, 0, ic.size * 0.1, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 3; i++) {
        ctx.save(); ctx.rotate(ic.rotation + (i * Math.PI) / 3);
        ctx.beginPath(); ctx.ellipse(0, 0, ic.size * 0.48, ic.size * 0.17, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    };

    const drawStar5 = (ic: EduIcon) => {
      ctx.save(); ctx.translate(ic.x, ic.y); ctx.rotate(ic.rotation);
      ctx.globalAlpha = ic.alpha; ctx.strokeStyle = COL;
      ctx.lineWidth = ic.size * 0.07; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const o = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const inn = o + Math.PI / 5;
        if (i === 0) ctx.moveTo(Math.cos(o) * ic.size * 0.48, Math.sin(o) * ic.size * 0.48);
        else ctx.lineTo(Math.cos(o) * ic.size * 0.48, Math.sin(o) * ic.size * 0.48);
        ctx.lineTo(Math.cos(inn) * ic.size * 0.21, Math.sin(inn) * ic.size * 0.21);
      }
      ctx.closePath(); ctx.stroke(); ctx.restore();
    };

    const drawRuler = (ic: EduIcon) => {
      ctx.save(); ctx.translate(ic.x, ic.y); ctx.rotate(ic.rotation);
      ctx.globalAlpha = ic.alpha; ctx.strokeStyle = COL;
      ctx.lineWidth = ic.size * 0.065; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const len = ic.size * 0.9, h = ic.size * 0.22;
      ctx.strokeRect(-len / 2, -h / 2, len, h);
      for (let i = 1; i <= 7; i++) {
        const tx = -len / 2 + (len / 8) * i;
        const th = i % 4 === 0 ? h * 0.7 : h * 0.38;
        ctx.beginPath(); ctx.moveTo(tx, -h / 2); ctx.lineTo(tx, -h / 2 + th); ctx.stroke();
      }
      ctx.restore();
    };

    // ── Animation loop ─────────────────────────────────────────────
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // geometric shapes
      shapes.current.forEach(s => {
        s.x += s.vx; s.y += s.vy;
        s.y += Math.sin(s.bobPhase) * 0.2; s.bobPhase += 0.008;
        s.rotation += s.rotSpeed;
        s.alpha += s.alphaDir * 0.0018;
        if (s.alpha > 0.28 || s.alpha < 0.08) s.alphaDir *= -1;
        if (s.x < -80) s.x = canvas.width + 80; if (s.x > canvas.width + 80) s.x = -80;
        if (s.y < -80) s.y = canvas.height + 80; if (s.y > canvas.height + 80) s.y = -80;
        ctx.shadowBlur = 12; ctx.shadowColor = 'rgba(147,197,253,0.5)';
        drawShape(s);
        ctx.shadowBlur = 0;
      });

      // dots
      dots.current.forEach(d => {
        d.x += d.vx; d.y += d.vy;
        d.alpha += d.alphaDir * 0.002;
        if (d.alpha > 0.55 || d.alpha < 0.12) d.alphaDir *= -1;
        if (d.x < 0) d.x = canvas.width; if (d.x > canvas.width) d.x = 0;
        if (d.y < 0) d.y = canvas.height; if (d.y > canvas.height) d.y = 0;
        ctx.globalAlpha = d.alpha;
        ctx.fillStyle = 'rgba(186,230,253,1)';
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      });

      // dot connections (desktop)
      if (!mob()) {
        for (let i = 0; i < dots.current.length; i++) {
          for (let j = i + 1; j < dots.current.length; j++) {
            const a = dots.current[i], b = dots.current[j];
            const dx = a.x - b.x, dy = a.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 110) {
              ctx.globalAlpha = (1 - dist / 110) * 0.15;
              ctx.strokeStyle = 'rgba(147,197,253,1)'; ctx.lineWidth = 0.6;
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
              ctx.globalAlpha = 1;
            }
          }
        }
      }

      // edu icons
      icons.current.forEach(ic => {
        ic.x += ic.vx;
        ic.y += ic.vy + Math.sin(ic.bobPhase) * 0.18;
        ic.bobPhase += 0.01;
        ic.rotation += ic.rotSpeed;
        ic.alpha += ic.alphaDir * 0.0016;
        if (ic.alpha > 0.45 || ic.alpha < 0.12) ic.alphaDir *= -1;
        if (ic.x < -80) ic.x = canvas.width + 80; if (ic.x > canvas.width + 80) ic.x = -80;
        if (ic.y < -80) ic.y = canvas.height + 80; if (ic.y > canvas.height + 80) ic.y = -80;
        ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(186,230,253,0.6)';
        if (ic.type === 'book')   drawBook(ic);
        if (ic.type === 'cap')    drawCap(ic);
        if (ic.type === 'pencil') drawPencil(ic);
        if (ic.type === 'atom')   drawAtom(ic);
        if (ic.type === 'star5')  drawStar5(ic);
        if (ic.type === 'ruler')  drawRuler(ic);
        ctx.shadowBlur = 0;
      });

      raf.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      window.removeEventListener('resize', resize);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <>
      {/* Deep navy-blue gradient base */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, #0a1540 0%, #0f1d6e 45%, #1a2d9a 75%, #0d1550 100%)',
          zIndex: 0,
        }}
      />

      {/* Slow drifting blue glow orbs — clearly visible soft light */}
      <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 1 }}>
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="orb orb-4" />
      </div>

      {/* Canvas: shapes + dots + edu icons */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 2 }}
      />

      <style>{`
        .orb {
          position: absolute;
          border-radius: 50%;
          will-change: transform;
        }
        /* large teal-blue — top left */
        .orb-1 {
          width: clamp(280px, 38vw, 560px);
          height: clamp(280px, 38vw, 560px);
          background: radial-gradient(circle, rgba(59,130,246,0.38) 0%, rgba(37,99,235,0.12) 55%, transparent 75%);
          top: -8%; left: -6%;
          animation: orbDrift 18s ease-in-out infinite;
        }
        /* indigo — bottom right */
        .orb-2 {
          width: clamp(240px, 32vw, 480px);
          height: clamp(240px, 32vw, 480px);
          background: radial-gradient(circle, rgba(99,102,241,0.35) 0%, rgba(79,70,229,0.1) 55%, transparent 75%);
          bottom: -6%; right: -8%;
          animation: orbDrift 22s ease-in-out infinite reverse;
        }
        /* sky blue — mid right */
        .orb-3 {
          width: clamp(180px, 24vw, 360px);
          height: clamp(180px, 24vw, 360px);
          background: radial-gradient(circle, rgba(56,189,248,0.28) 0%, rgba(14,165,233,0.08) 55%, transparent 75%);
          top: 38%; right: 10%;
          animation: orbDrift 14s ease-in-out infinite 3s;
        }
        /* deep blue — mid left */
        .orb-4 {
          width: clamp(160px, 20vw, 320px);
          height: clamp(160px, 20vw, 320px);
          background: radial-gradient(circle, rgba(96,165,250,0.25) 0%, rgba(59,130,246,0.07) 55%, transparent 75%);
          top: 55%; left: 12%;
          animation: orbDrift 26s ease-in-out infinite 6s reverse;
        }

        @keyframes orbDrift {
          0%,100% { transform: translate(0px, 0px) scale(1); }
          25%      { transform: translate(30px, -40px) scale(1.07); }
          50%      { transform: translate(-20px, 30px) scale(0.95); }
          75%      { transform: translate(25px, 20px) scale(1.04); }
        }
      `}</style>
    </>
  );
};

export default AnimatedBackground3D;
