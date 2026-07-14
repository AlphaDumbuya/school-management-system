/**
 * AnimatedBackground3D Component
 * Educational-themed animated background for login page
 * Features: Floating education icons (books, caps, pencils, atoms, stars),
 *           particle connections, deep blue gradient atmosphere
 */

import React, { useEffect, useRef } from 'react';

interface EduParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  opacityDir: number;
  rotation: number;
  rotSpeed: number;
  type: number; // 0=star, 1=circle dot, 2=plus, 3=diamond
  color: string;
}

interface EduIcon {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  rotSpeed: number;
  opacity: number;
  opacityDir: number;
  type: 'book' | 'cap' | 'pencil' | 'atom' | 'bulb' | 'star5';
  color: string;
  bobPhase: number;
}

const COLORS = [
  'rgba(147, 197, 253, 0.7)',  // blue-300
  'rgba(196, 181, 253, 0.7)',  // purple-300
  'rgba(167, 243, 208, 0.6)',  // green-200
  'rgba(253, 230, 138, 0.6)',  // yellow-200
  'rgba(255, 255, 255, 0.5)',  // white
];

export const AnimatedBackground3D: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<EduParticle[]>([]);
  const icons = useRef<EduIcon[]>([]);
  const rafId = useRef<number>();
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const isMobile = () => window.innerWidth < 768;

    // ── Init particles ─────────────────────────────────────────────
    const initParticles = () => {
      particles.current = [];
      const count = isMobile() ? 40 : 80;
      for (let i = 0; i < count; i++) {
        particles.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          size: Math.random() * 2 + 1,
          opacity: Math.random() * 0.5 + 0.2,
          opacityDir: Math.random() > 0.5 ? 1 : -1,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.02,
          type: Math.floor(Math.random() * 4),
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
        });
      }
    };

    // ── Init edu icons ─────────────────────────────────────────────
    const initIcons = () => {
      icons.current = [];
      const types: EduIcon['type'][] = ['book', 'cap', 'pencil', 'atom', 'bulb', 'star5'];
      const count = isMobile() ? 8 : 16;
      for (let i = 0; i < count; i++) {
        icons.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25,
          size: isMobile() ? Math.random() * 18 + 14 : Math.random() * 28 + 18,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.008,
          opacity: Math.random() * 0.35 + 0.1,
          opacityDir: Math.random() > 0.5 ? 1 : -1,
          type: types[Math.floor(Math.random() * types.length)],
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          bobPhase: Math.random() * Math.PI * 2,
        });
      }
    };

    initParticles();
    initIcons();

    window.addEventListener('mousemove', (e) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    });

    // ── Draw helpers ───────────────────────────────────────────────
    const drawBook = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number, color: string, alpha: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = s * 0.08;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Book body
      const w = s * 0.7, h = s * 0.9;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      // Spine
      ctx.beginPath();
      ctx.moveTo(-w * 0.1, -h / 2);
      ctx.lineTo(-w * 0.1, h / 2);
      ctx.stroke();
      // Lines (pages)
      for (let i = 1; i <= 3; i++) {
        const ly = -h / 2 + (h / 4) * i;
        ctx.beginPath();
        ctx.moveTo(-w * 0.05, ly);
        ctx.lineTo(w / 2 - s * 0.05, ly);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawCap = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number, color: string, alpha: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = s * 0.07;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Board (diamond shape)
      const hw = s * 0.6, hh = s * 0.18;
      ctx.beginPath();
      ctx.moveTo(0, -hh);
      ctx.lineTo(hw, 0);
      ctx.lineTo(0, hh);
      ctx.lineTo(-hw, 0);
      ctx.closePath();
      ctx.stroke();
      // Tassel
      ctx.beginPath();
      ctx.moveTo(hw * 0.6, 0);
      ctx.lineTo(hw * 0.6, s * 0.35);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hw * 0.6, s * 0.38, s * 0.06, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    };

    const drawPencil = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number, color: string, alpha: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = s * 0.07;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const len = s * 0.9, w = s * 0.18;
      // Body
      ctx.strokeRect(-len / 2, -w / 2, len * 0.75, w);
      // Tip triangle
      ctx.beginPath();
      ctx.moveTo(-len / 2 + len * 0.75, -w / 2);
      ctx.lineTo(-len / 2 + len * 0.75, w / 2);
      ctx.lineTo(-len / 2 + len, 0);
      ctx.closePath();
      ctx.stroke();
      // Eraser end
      ctx.beginPath();
      ctx.moveTo(len / 2 - s * 0.1, -w / 2);
      ctx.lineTo(len / 2 - s * 0.1, w / 2);
      ctx.stroke();
      ctx.restore();
    };

    const drawAtom = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number, color: string, alpha: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = s * 0.06;
      // Nucleus
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.1, 0, Math.PI * 2);
      ctx.stroke();
      // 3 orbital ellipses at 0°, 60°, 120°
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.rotate(rot + (i * Math.PI) / 3);
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.5, s * 0.18, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    };

    const drawBulb = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number, color: string, alpha: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = s * 0.07;
      ctx.lineCap = 'round';
      // Bulb circle
      ctx.beginPath();
      ctx.arc(0, -s * 0.1, s * 0.32, Math.PI * 0.1, Math.PI * 0.9, true);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -s * 0.1, s * 0.32, Math.PI * 0.1, Math.PI * 0.9);
      // Base lines
      ctx.moveTo(-s * 0.18, s * 0.22);
      ctx.lineTo(-s * 0.18, s * 0.38);
      ctx.moveTo(s * 0.18, s * 0.22);
      ctx.lineTo(s * 0.18, s * 0.38);
      ctx.moveTo(-s * 0.18, s * 0.38);
      ctx.lineTo(s * 0.18, s * 0.38);
      ctx.stroke();
      // Rays
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * s * 0.38, -s * 0.1 + Math.sin(angle) * s * 0.38);
        ctx.lineTo(Math.cos(angle) * s * 0.52, -s * 0.1 + Math.sin(angle) * s * 0.52);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawStar5 = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number, color: string, alpha: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = s * 0.07;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const outerAngle = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const innerAngle = outerAngle + Math.PI / 5;
        if (i === 0) ctx.moveTo(Math.cos(outerAngle) * s * 0.5, Math.sin(outerAngle) * s * 0.5);
        else ctx.lineTo(Math.cos(outerAngle) * s * 0.5, Math.sin(outerAngle) * s * 0.5);
        ctx.lineTo(Math.cos(innerAngle) * s * 0.22, Math.sin(innerAngle) * s * 0.22);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    };

    // ── Animate ─────────────────────────────────────────────────────
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Subtle scanline bg overlay (let CSS gradient show through)
      ctx.fillStyle = 'rgba(15, 23, 60, 0.18)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw particles + connections
      particles.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        p.opacity += p.opacityDir * 0.003;
        if (p.opacity > 0.7 || p.opacity < 0.1) p.opacityDir *= -1;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        if (p.type === 0) {
          // star dot
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 1) {
          // plus
          const half = p.size * 1.5;
          ctx.beginPath();
          ctx.moveTo(-half, 0); ctx.lineTo(half, 0);
          ctx.moveTo(0, -half); ctx.lineTo(0, half);
          ctx.stroke();
        } else if (p.type === 2) {
          // diamond
          ctx.beginPath();
          ctx.moveTo(0, -p.size * 1.4);
          ctx.lineTo(p.size, 0);
          ctx.lineTo(0, p.size * 1.4);
          ctx.lineTo(-p.size, 0);
          ctx.closePath();
          ctx.stroke();
        } else {
          // small circle ring
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 1.2, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();

        // Connections (desktop only)
        if (!isMobile()) {
          particles.current.forEach((other) => {
            const dx = p.x - other.x, dy = p.y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120 && dist > 0) {
              ctx.save();
              ctx.globalAlpha = (1 - dist / 120) * 0.12;
              ctx.strokeStyle = 'rgba(147, 197, 253, 1)';
              ctx.lineWidth = 0.5;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(other.x, other.y);
              ctx.stroke();
              ctx.restore();
            }
          });
        }
      });

      // Draw floating edu icons
      icons.current.forEach((icon) => {
        icon.x += icon.vx;
        icon.y += icon.vy + Math.sin(icon.bobPhase) * 0.15;
        icon.bobPhase += 0.012;
        icon.rotation += icon.rotSpeed;
        icon.opacity += icon.opacityDir * 0.002;
        if (icon.opacity > 0.45 || icon.opacity < 0.05) icon.opacityDir *= -1;
        if (icon.x < -80) icon.x = canvas.width + 80;
        if (icon.x > canvas.width + 80) icon.x = -80;
        if (icon.y < -80) icon.y = canvas.height + 80;
        if (icon.y > canvas.height + 80) icon.y = -80;

        ctx.shadowBlur = 12;
        ctx.shadowColor = icon.color;
        if (icon.type === 'book') drawBook(ctx, icon.x, icon.y, icon.size, icon.rotation, icon.color, icon.opacity);
        else if (icon.type === 'cap') drawCap(ctx, icon.x, icon.y, icon.size, icon.rotation, icon.color, icon.opacity);
        else if (icon.type === 'pencil') drawPencil(ctx, icon.x, icon.y, icon.size, icon.rotation, icon.color, icon.opacity);
        else if (icon.type === 'atom') drawAtom(ctx, icon.x, icon.y, icon.size, icon.rotation, icon.color, icon.opacity);
        else if (icon.type === 'bulb') drawBulb(ctx, icon.x, icon.y, icon.size, icon.rotation, icon.color, icon.opacity);
        else if (icon.type === 'star5') drawStar5(ctx, icon.x, icon.y, icon.size, icon.rotation, icon.color, icon.opacity);
        ctx.shadowBlur = 0;
      });

      rafId.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{
        background: 'linear-gradient(135deg, #0f1b4c 0%, #1a2d8a 35%, #2a3fa8 60%, #1e1b6e 100%)',
      }}
    />
  );
};

export default AnimatedBackground3D;
