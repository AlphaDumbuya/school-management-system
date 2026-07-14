/**
 * AnimatedBackground3D — Liquid + Educational
 * Layer 1: CSS liquid blobs (smooth morphing lava-lamp effect)
 * Layer 2: Canvas floating edu icons (books, caps, pencils, atoms, stars)
 * Layer 3: Canvas particle constellation
 */

import React, { useEffect, useRef } from 'react';

/* ─── Canvas layer ──────────────────────────────────────────────────── */
interface EduIcon {
  x: number; y: number; vx: number; vy: number;
  size: number; rotation: number; rotSpeed: number;
  opacity: number; opacityDir: number;
  type: 'book' | 'cap' | 'pencil' | 'atom' | 'bulb' | 'star5';
  color: string; bobPhase: number;
}
interface Dot {
  x: number; y: number; vx: number; vy: number;
  r: number; opacity: number; oDir: number;
}

const ICON_COLORS = [
  'rgba(147,197,253,0.75)', 'rgba(196,181,253,0.75)',
  'rgba(167,243,208,0.65)', 'rgba(253,230,138,0.65)',
  'rgba(255,255,255,0.55)',
];

const CanvasLayer: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  const icons = useRef<EduIcon[]>([]);
  const dots = useRef<Dot[]>([]);
  const raf = useRef<number>();

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const resize = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const isMob = () => innerWidth < 768;

    /* ── edu icons ── */
    const TYPES: EduIcon['type'][] = ['book','cap','pencil','atom','bulb','star5'];
    const initIcons = () => {
      icons.current = Array.from({ length: isMob() ? 10 : 20 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - .5) * .3,
        vy: (Math.random() - .5) * .3,
        size: isMob() ? Math.random()*16+12 : Math.random()*26+16,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - .5) * .009,
        opacity: Math.random() * .3 + .08,
        opacityDir: Math.random() > .5 ? 1 : -1,
        type: TYPES[Math.floor(Math.random() * TYPES.length)],
        color: ICON_COLORS[Math.floor(Math.random() * ICON_COLORS.length)],
        bobPhase: Math.random() * Math.PI * 2,
      }));
    };

    /* ── particles ── */
    const initDots = () => {
      dots.current = Array.from({ length: isMob() ? 35 : 70 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - .5) * .35,
        vy: (Math.random() - .5) * .35,
        r: Math.random() * 1.8 + .5,
        opacity: Math.random() * .45 + .15,
        oDir: Math.random() > .5 ? 1 : -1,
      }));
    };

    initIcons(); initDots();

    /* ─── Draw helpers ─── */
    const book = (x:number,y:number,s:number,r:number,col:string,a:number) => {
      ctx.save(); ctx.translate(x,y); ctx.rotate(r); ctx.globalAlpha=a;
      ctx.strokeStyle=col; ctx.lineWidth=s*.07; ctx.lineCap='round'; ctx.lineJoin='round';
      const w=s*.68,h=s*.88;
      ctx.strokeRect(-w/2,-h/2,w,h);
      ctx.beginPath(); ctx.moveTo(-w*.08,-h/2); ctx.lineTo(-w*.08,h/2); ctx.stroke();
      for(let i=1;i<=3;i++){
        const ly=-h/2+(h/4)*i;
        ctx.beginPath(); ctx.moveTo(-w*.04,ly); ctx.lineTo(w/2-s*.04,ly); ctx.stroke();
      }
      ctx.restore();
    };
    const cap = (x:number,y:number,s:number,r:number,col:string,a:number) => {
      ctx.save(); ctx.translate(x,y); ctx.rotate(r); ctx.globalAlpha=a;
      ctx.strokeStyle=col; ctx.lineWidth=s*.07; ctx.lineCap='round'; ctx.lineJoin='round';
      const hw=s*.58,hh=s*.17;
      ctx.beginPath(); ctx.moveTo(0,-hh); ctx.lineTo(hw,0); ctx.lineTo(0,hh); ctx.lineTo(-hw,0); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hw*.6,0); ctx.lineTo(hw*.6,s*.34); ctx.stroke();
      ctx.beginPath(); ctx.arc(hw*.6,s*.37,s*.05,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    };
    const pencil = (x:number,y:number,s:number,r:number,col:string,a:number) => {
      ctx.save(); ctx.translate(x,y); ctx.rotate(r); ctx.globalAlpha=a;
      ctx.strokeStyle=col; ctx.lineWidth=s*.07; ctx.lineCap='round'; ctx.lineJoin='round';
      const len=s*.88,w=s*.17;
      ctx.strokeRect(-len/2,-w/2,len*.75,w);
      ctx.beginPath(); ctx.moveTo(-len/2+len*.75,-w/2); ctx.lineTo(-len/2+len*.75,w/2); ctx.lineTo(-len/2+len,0); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(len/2-s*.09,-w/2); ctx.lineTo(len/2-s*.09,w/2); ctx.stroke();
      ctx.restore();
    };
    const atom = (x:number,y:number,s:number,r:number,col:string,a:number) => {
      ctx.save(); ctx.translate(x,y); ctx.globalAlpha=a;
      ctx.strokeStyle=col; ctx.lineWidth=s*.06;
      ctx.beginPath(); ctx.arc(0,0,s*.09,0,Math.PI*2); ctx.stroke();
      for(let i=0;i<3;i++){
        ctx.save(); ctx.rotate(r+(i*Math.PI)/3);
        ctx.beginPath(); ctx.ellipse(0,0,s*.48,s*.17,0,0,Math.PI*2); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    };
    const bulb = (x:number,y:number,s:number,r:number,col:string,a:number) => {
      ctx.save(); ctx.translate(x,y); ctx.rotate(r); ctx.globalAlpha=a;
      ctx.strokeStyle=col; ctx.lineWidth=s*.07; ctx.lineCap='round';
      ctx.beginPath(); ctx.arc(0,-s*.09,s*.3,Math.PI*.15,Math.PI*.85,true); ctx.stroke();
      ctx.beginPath(); ctx.arc(0,-s*.09,s*.3,Math.PI*.15,Math.PI*.85); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s*.16,s*.22); ctx.lineTo(-s*.16,s*.36);
      ctx.moveTo(s*.16,s*.22);  ctx.lineTo(s*.16,s*.36);
      ctx.moveTo(-s*.16,s*.36); ctx.lineTo(s*.16,s*.36);
      ctx.stroke();
      for(let i=0;i<6;i++){
        const ang=(i/6)*Math.PI*2-Math.PI/2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang)*s*.36,-s*.09+Math.sin(ang)*s*.36);
        ctx.lineTo(Math.cos(ang)*s*.5,-s*.09+Math.sin(ang)*s*.5);
        ctx.stroke();
      }
      ctx.restore();
    };
    const star5 = (x:number,y:number,s:number,r:number,col:string,a:number) => {
      ctx.save(); ctx.translate(x,y); ctx.rotate(r); ctx.globalAlpha=a;
      ctx.strokeStyle=col; ctx.lineWidth=s*.07; ctx.lineCap='round'; ctx.lineJoin='round';
      ctx.beginPath();
      for(let i=0;i<5;i++){
        const o=(i/5)*Math.PI*2-Math.PI/2;
        const inn=o+Math.PI/5;
        if(i===0) ctx.moveTo(Math.cos(o)*s*.48,Math.sin(o)*s*.48);
        else ctx.lineTo(Math.cos(o)*s*.48,Math.sin(o)*s*.48);
        ctx.lineTo(Math.cos(inn)*s*.21,Math.sin(inn)*s*.21);
      }
      ctx.closePath(); ctx.stroke(); ctx.restore();
    };

    const drawIcon = (icon: EduIcon) => {
      ctx.shadowBlur = 14; ctx.shadowColor = icon.color;
      if(icon.type==='book')   book(icon.x,icon.y,icon.size,icon.rotation,icon.color,icon.opacity);
      if(icon.type==='cap')    cap(icon.x,icon.y,icon.size,icon.rotation,icon.color,icon.opacity);
      if(icon.type==='pencil') pencil(icon.x,icon.y,icon.size,icon.rotation,icon.color,icon.opacity);
      if(icon.type==='atom')   atom(icon.x,icon.y,icon.size,icon.rotation,icon.color,icon.opacity);
      if(icon.type==='bulb')   bulb(icon.x,icon.y,icon.size,icon.rotation,icon.color,icon.opacity);
      if(icon.type==='star5')  star5(icon.x,icon.y,icon.size,icon.rotation,icon.color,icon.opacity);
      ctx.shadowBlur = 0;
    };

    /* ─── Animation loop ─── */
    const tick = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height);

      /* dots */
      dots.current.forEach(d => {
        d.x += d.vx; d.y += d.vy;
        d.opacity += d.oDir * .003;
        if(d.opacity>.6||d.opacity<.08) d.oDir*=-1;
        if(d.x<0) d.x=canvas.width; if(d.x>canvas.width) d.x=0;
        if(d.y<0) d.y=canvas.height; if(d.y>canvas.height) d.y=0;
        ctx.globalAlpha=d.opacity; ctx.fillStyle='rgba(147,197,253,1)';
        ctx.beginPath(); ctx.arc(d.x,d.y,d.r,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha=1;
      });

      /* connections */
      if(!isMob()) {
        dots.current.forEach((a,i) => {
          for(let j=i+1;j<dots.current.length;j++){
            const b=dots.current[j];
            const dx=a.x-b.x, dy=a.y-b.y, dist=Math.sqrt(dx*dx+dy*dy);
            if(dist<110){
              ctx.globalAlpha=(1-dist/110)*.1;
              ctx.strokeStyle='rgba(147,197,253,1)'; ctx.lineWidth=.5;
              ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
              ctx.globalAlpha=1;
            }
          }
        });
      }

      /* edu icons */
      icons.current.forEach(icon => {
        icon.x += icon.vx;
        icon.y += icon.vy + Math.sin(icon.bobPhase)*.18;
        icon.bobPhase += .011;
        icon.rotation += icon.rotSpeed;
        icon.opacity += icon.opacityDir * .0018;
        if(icon.opacity>.42||icon.opacity<.05) icon.opacityDir*=-1;
        if(icon.x<-80) icon.x=canvas.width+80; if(icon.x>canvas.width+80) icon.x=-80;
        if(icon.y<-80) icon.y=canvas.height+80; if(icon.y>canvas.height+80) icon.y=-80;
        drawIcon(icon);
      });

      raf.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      window.removeEventListener('resize', resize);
      if(raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 2 }}
    />
  );
};

/* ─── Liquid blob layer (pure CSS) ─────────────────────────────────── */
const LiquidLayer: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 1 }}>
    {/* Primary liquid blobs */}
    <div className="liquid-blob blob-1" />
    <div className="liquid-blob blob-2" />
    <div className="liquid-blob blob-3" />
    <div className="liquid-blob blob-4" />
    <div className="liquid-blob blob-5" />
    <div className="liquid-blob blob-6" />
    {/* Extra accent blobs */}
    <div className="liquid-blob blob-7" />
    <div className="liquid-blob blob-8" />
    {/* Ripple rings */}
    <div className="ripple ripple-1" />
    <div className="ripple ripple-2" />
    <div className="ripple ripple-3" />

    <style>{`
      /* ─── Base background ─── */
      .liquid-root {
        background: linear-gradient(135deg,#0a1540 0%,#0f1d6e 40%,#1a2d9a 70%,#0d1550 100%);
      }

      /* ─── Blobs ─── */
      .liquid-blob {
        position: absolute;
        border-radius: 9999px;
        mix-blend-mode: screen;
        filter: blur(70px);
        will-change: transform, border-radius;
      }

      /* blob 1 – large teal-blue, top-left drift */
      .blob-1 {
        width: clamp(320px,45vw,700px);
        height: clamp(320px,45vw,700px);
        background: radial-gradient(circle at 40% 40%, rgba(56,189,248,0.55), rgba(14,165,233,0.18) 70%);
        top: -15%; left: -10%;
        animation: liquidMorph1 14s ease-in-out infinite;
      }
      /* blob 2 – purple, bottom-right pulse */
      .blob-2 {
        width: clamp(280px,40vw,620px);
        height: clamp(280px,40vw,620px);
        background: radial-gradient(circle at 60% 60%, rgba(139,92,246,0.55), rgba(109,40,217,0.15) 70%);
        bottom: -12%; right: -10%;
        animation: liquidMorph2 16s ease-in-out infinite;
      }
      /* blob 3 – indigo center */
      .blob-3 {
        width: clamp(240px,35vw,560px);
        height: clamp(240px,35vw,560px);
        background: radial-gradient(circle at 50% 50%, rgba(99,102,241,0.5), rgba(67,56,202,0.12) 70%);
        top: 30%; left: 35%;
        animation: liquidMorph3 18s ease-in-out infinite;
      }
      /* blob 4 – pink accent top-right */
      .blob-4 {
        width: clamp(200px,28vw,440px);
        height: clamp(200px,28vw,440px);
        background: radial-gradient(circle at 40% 30%, rgba(236,72,153,0.4), rgba(219,39,119,0.08) 70%);
        top: 5%; right: 8%;
        animation: liquidMorph4 12s ease-in-out infinite;
      }
      /* blob 5 – cyan bottom-left */
      .blob-5 {
        width: clamp(180px,25vw,400px);
        height: clamp(180px,25vw,400px);
        background: radial-gradient(circle at 50% 50%, rgba(34,211,238,0.35), rgba(6,182,212,0.08) 70%);
        bottom: 10%; left: 5%;
        animation: liquidMorph5 20s ease-in-out infinite;
      }
      /* blob 6 – violet mid-left */
      .blob-6 {
        width: clamp(200px,26vw,420px);
        height: clamp(200px,26vw,420px);
        background: radial-gradient(circle at 50% 50%, rgba(167,139,250,0.38), rgba(139,92,246,0.08) 70%);
        top: 50%; left: 8%;
        animation: liquidMorph6 22s ease-in-out infinite;
      }
      /* blob 7 – deep blue top-center */
      .blob-7 {
        width: clamp(160px,22vw,360px);
        height: clamp(160px,22vw,360px);
        background: radial-gradient(circle, rgba(59,130,246,0.4), transparent 70%);
        top: 15%; left: 42%;
        animation: liquidMorph2 10s ease-in-out infinite reverse;
      }
      /* blob 8 – emerald accent mid-right */
      .blob-8 {
        width: clamp(140px,18vw,300px);
        height: clamp(140px,18vw,300px);
        background: radial-gradient(circle, rgba(52,211,153,0.28), transparent 70%);
        top: 55%; right: 12%;
        animation: liquidMorph5 15s ease-in-out infinite reverse;
      }

      /* ─── Liquid morph keyframes ─── */
      @keyframes liquidMorph1 {
        0%,100% {
          transform: translate(0,0) scale(1);
          border-radius: 60% 40% 55% 45% / 50% 60% 40% 50%;
        }
        25% {
          transform: translate(6%,8%) scale(1.08);
          border-radius: 40% 60% 45% 55% / 60% 40% 55% 45%;
        }
        50% {
          transform: translate(3%,-5%) scale(0.95);
          border-radius: 55% 45% 60% 40% / 45% 55% 50% 50%;
        }
        75% {
          transform: translate(-4%,6%) scale(1.05);
          border-radius: 50% 50% 40% 60% / 55% 45% 60% 40%;
        }
      }
      @keyframes liquidMorph2 {
        0%,100% {
          transform: translate(0,0) scale(1);
          border-radius: 50% 50% 60% 40% / 55% 45% 50% 50%;
        }
        20% {
          transform: translate(-5%,-7%) scale(1.1);
          border-radius: 65% 35% 50% 50% / 40% 60% 45% 55%;
        }
        55% {
          transform: translate(7%,4%) scale(0.92);
          border-radius: 40% 60% 55% 45% / 60% 40% 55% 45%;
        }
        80% {
          transform: translate(-3%,8%) scale(1.04);
          border-radius: 55% 45% 45% 55% / 50% 50% 60% 40%;
        }
      }
      @keyframes liquidMorph3 {
        0%,100% {
          transform: translate(0,0) scale(1) rotate(0deg);
          border-radius: 45% 55% 60% 40% / 50% 50% 45% 55%;
        }
        33% {
          transform: translate(-8%,5%) scale(1.12) rotate(60deg);
          border-radius: 60% 40% 45% 55% / 45% 55% 60% 40%;
        }
        66% {
          transform: translate(6%,-8%) scale(0.9) rotate(120deg);
          border-radius: 50% 50% 55% 45% / 60% 40% 50% 50%;
        }
      }
      @keyframes liquidMorph4 {
        0%,100% {
          transform: translate(0,0) scale(1);
          border-radius: 70% 30% 55% 45% / 45% 55% 40% 60%;
        }
        30% {
          transform: translate(5%,10%) scale(1.15);
          border-radius: 40% 60% 65% 35% / 55% 45% 50% 50%;
        }
        60% {
          transform: translate(-6%,3%) scale(0.88);
          border-radius: 55% 45% 40% 60% / 65% 35% 55% 45%;
        }
      }
      @keyframes liquidMorph5 {
        0%,100% {
          transform: translate(0,0) scale(1);
          border-radius: 55% 45% 50% 50% / 60% 40% 55% 45%;
        }
        40% {
          transform: translate(8%,-6%) scale(1.08);
          border-radius: 45% 55% 60% 40% / 50% 50% 45% 55%;
        }
        70% {
          transform: translate(-5%,9%) scale(0.95);
          border-radius: 60% 40% 45% 55% / 40% 60% 60% 40%;
        }
      }
      @keyframes liquidMorph6 {
        0%,100% {
          transform: translate(0,0) scale(1) rotate(0deg);
          border-radius: 50% 50% 45% 55% / 55% 45% 60% 40%;
        }
        25% { transform: translate(-7%,-4%) scale(1.1) rotate(-30deg); border-radius: 65% 35% 55% 45% / 45% 55% 40% 60%; }
        50% { transform: translate(5%,7%) scale(0.93) rotate(15deg);  border-radius: 40% 60% 50% 50% / 60% 40% 55% 45%; }
        75% { transform: translate(4%,-8%) scale(1.06) rotate(-10deg); border-radius: 55% 45% 60% 40% / 50% 50% 45% 55%; }
      }

      /* ─── Ripple rings ─── */
      .ripple {
        position: absolute;
        border-radius: 9999px;
        border: 1px solid rgba(147,197,253,0.15);
        animation: rippleExpand 8s ease-out infinite;
      }
      .ripple-1 { width: 200px; height: 200px; top: 20%; left: 20%; animation-delay: 0s; }
      .ripple-2 { width: 180px; height: 180px; top: 60%; right: 25%; animation-delay: 2.5s; }
      .ripple-3 { width: 160px; height: 160px; top: 40%; left: 55%; animation-delay: 5s; }

      @keyframes rippleExpand {
        0%   { transform: scale(1);   opacity: .4; }
        100% { transform: scale(5.5); opacity: 0;  }
      }
    `}</style>
  </div>
);

/* ─── Exported component ────────────────────────────────────────────── */
export const AnimatedBackground3D: React.FC = () => (
  <div
    className="absolute inset-0 w-full h-full"
    style={{
      background: 'linear-gradient(135deg,#0a1540 0%,#0f1d6e 40%,#1a2d9a 70%,#0d1550 100%)',
      zIndex: 0,
    }}
  >
    <LiquidLayer />
    <CanvasLayer />
  </div>
);

export default AnimatedBackground3D;
