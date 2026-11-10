/**
 * SchoolShowcase: "same software, their brand". Switch between the schools we have delivered an
 * edition to, and between the four people who use it. Shows real app screens (invented data).
 */
import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import PhoneFrame from './PhoneFrame';
import {
  EDITION_CLIENTS, SHOWCASE_ROLES, showcaseAlt, showcaseSrc,
  type ShowcaseRole, type ShowcaseSchool,
} from '@config/company.config';

export const SchoolShowcase: React.FC = () => {
  const [school, setSchool] = useState<ShowcaseSchool>(EDITION_CLIENTS[0]);
  const [role, setRole] = useState<ShowcaseRole>('staff');
  const [auto, setAuto] = useState(true);

  // Gently cycle through the roles until the visitor takes over.
  useEffect(() => {
    if (!auto) return undefined;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = window.setInterval(() => {
      setRole((r) => SHOWCASE_ROLES[(SHOWCASE_ROLES.findIndex((x) => x.id === r) + 1) % SHOWCASE_ROLES.length].id);
    }, 4800);
    return () => window.clearInterval(id);
  }, [auto]);

  const current = SHOWCASE_ROLES.find((r) => r.id === role) ?? SHOWCASE_ROLES[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
      {/* Phone */}
      <div className="relative flex justify-center order-1 lg:order-2">
        <div
          className="absolute -inset-10 rounded-full blur-[70px] opacity-40 pointer-events-none transition-colors duration-700"
          style={{ background: `radial-gradient(circle, ${school.colour}, transparent 65%)` }}
        />
        <div className="relative">
          <PhoneFrame
            src={showcaseSrc(school.id, role)}
            alt={showcaseAlt(school, role)}
            animateKey={`${school.id}-${role}`}
            className="co-float-slow"
          />
          <div className="absolute -left-4 sm:-left-36 top-10 flex items-center gap-2 bg-white rounded-xl shadow-xl border border-slate-100 px-3 py-2">
            <img src={school.logo} alt="" width={32} height={32} className="w-8 h-8 rounded-lg object-contain" loading="lazy" />
            <div className="leading-tight">
              <p className="text-[11px] font-bold text-slate-900">{school.name}</p>
              <p className="text-[10px] text-slate-400">Their name, logo and colours</p>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-slate-400">Real screens, sample data</p>
        </div>
      </div>

      {/* Controls */}
      <div className="order-2 lg:order-1">
        <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#1d4ed8] mb-2">Same software, their brand</p>
        <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">One system. Every person in the school.</h3>
        <div className="w-12 h-1 bg-[#f59e0b] rounded-full mt-4 mb-6" />

        <div role="tablist" aria-label="School" className="flex flex-wrap gap-3 mb-6">
          {EDITION_CLIENTS.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={school.id === s.id}
              type="button"
              onClick={() => { setSchool(s); setAuto(false); }}
              className={`flex items-center gap-2.5 pl-2 pr-4 py-2 rounded-full border text-sm font-bold transition-all ${
                school.id === s.id ? 'bg-white border-[#1d4ed8] text-slate-900 shadow-md' : 'bg-white/60 border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <img src={s.logo} alt="" width={28} height={28} className="w-7 h-7 rounded-full object-contain bg-white" loading="lazy" />
              {s.name}
            </button>
          ))}
        </div>

        <div role="tablist" aria-label="Who is using it" className="space-y-2.5">
          {SHOWCASE_ROLES.map((r) => {
            const active = r.id === role;
            return (
              <button
                key={r.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => { setRole(r.id); setAuto(false); }}
                className={`w-full flex flex-col items-stretch text-left rounded-2xl border px-5 py-4 transition-all duration-300 ${
                  active ? 'bg-white border-[#1d4ed8]/40 shadow-lg' : 'bg-transparent border-transparent hover:bg-white/70'
                }`}
              >
                <span className="flex w-full items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${active ? 'bg-[#1d4ed8] text-white' : 'bg-slate-200 text-transparent'}`}>
                    <Check size={13} strokeWidth={3} />
                  </span>
                  <span className={`font-bold ${active ? 'text-slate-900' : 'text-slate-500'}`}>{r.label}</span>
                </span>
                {active && <p className="text-sm text-slate-500 leading-relaxed mt-2 pl-9">{current.text}</p>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SchoolShowcase;
