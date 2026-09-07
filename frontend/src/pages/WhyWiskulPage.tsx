/**
 * WhyWiskulPage — /why
 * Light edu-SaaS theme (see docs/THEME_GUIDE.md): navy hero + bands, blue brand,
 * orange CTA, white pillar cards. Shared navbar + footer.
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Search, Lock, BarChart3, ArrowRight, Check, Zap, Server, Cloud,
} from 'lucide-react';
import PublicNavbar, { PublicFooter } from '@components/public';

const NAVY_BAND = 'bg-gradient-to-br from-[#16235c] via-[#1a2b6b] to-[#20308a]';
const DOT_PATTERN: React.CSSProperties = {
  backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)',
  backgroundSize: '26px 26px',
};

export const WhyWiskulPage: React.FC = () => {
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-700 overflow-x-hidden font-sans antialiased">
      <PublicNavbar ctaText="Register School Free" />

      {/* ═══ HERO (navy) ═══ */}
      <section className={`relative pt-28 sm:pt-36 pb-20 px-6 sm:px-10 overflow-hidden ${NAVY_BAND}`}>
        <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={DOT_PATTERN} />
        <div className="absolute top-[-10%] right-[-8%] w-[500px] h-[500px] rounded-full bg-white/5 blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-5 py-2 mb-8">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-white/90 text-xs font-bold tracking-widest uppercase">The WiSkul Advantage</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-[1.1] mb-6 text-white">
            Why schools trust <span className="text-amber-400">WiSkul</span>
          </h1>

          <p className="text-blue-100/90 text-base sm:text-lg max-w-3xl mx-auto leading-relaxed mb-12">
            In an age where data breaches are costly and manual processes waste countless hours,
            WiSkul delivers strong security with zero-effort automation — so you can focus on
            teaching, not paperwork.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { value: '256-bit', label: 'Encryption', icon: Lock },
              { value: '99.9%', label: 'Uptime target', icon: Zap },
              { value: '<200ms', label: 'Response', icon: Server },
              { value: 'Free', label: 'Core plan', icon: Check },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/[0.07] border border-white/10 rounded-2xl p-6 backdrop-blur-sm text-center">
                <span className="inline-flex w-10 h-10 rounded-xl bg-amber-400/20 text-amber-300 items-center justify-center mb-3"><stat.icon size={18} /></span>
                <p className="text-2xl sm:text-3xl font-black text-white">{stat.value}</p>
                <p className="text-xs text-blue-100/70 font-semibold uppercase tracking-wider mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FOUR PILLARS (white) ═══ */}
      <section className="px-6 sm:px-10 py-20 bg-white border-b border-[#e5e9f2]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[#1d4ed8] text-xs font-bold tracking-[0.2em] uppercase mb-2">What sets us apart</p>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Four pillars of excellence</h2>
            <div className="w-12 h-1 bg-[#f59e0b] rounded-full mx-auto mt-4" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[
              { num: '01', icon: ShieldCheck, title: 'Multi-Tenant Data Isolation', desc: 'Each school operates in a completely isolated environment. Records, financials and communications are separated at the database level with zero cross-contamination.', tint: 'bg-blue-50 border-blue-100', chip: 'bg-blue-100 text-[#1d4ed8]', features: ['Database-level separation', 'Zero data leakage', 'Compliance-ready', 'Independent backups'] },
              { num: '02', icon: Search, title: 'Real-Time Threat Detection', desc: 'Access attempts are monitored for suspicious patterns and threats blocked automatically before they can compromise your data.', tint: 'bg-emerald-50 border-emerald-100', chip: 'bg-emerald-100 text-emerald-600', features: ['Anomaly detection', 'Automatic IP blocking', 'Failed-login tracking', 'Audit trails'] },
              { num: '03', icon: Lock, title: 'End-to-End Encryption', desc: 'Data in transit and at rest is encrypted with 256-bit AES. Notifications, communications and financial records are fully secure.', tint: 'bg-amber-50 border-amber-100', chip: 'bg-amber-100 text-amber-600', features: ['AES-256 encryption', 'Encrypted backups', 'Secure API', 'HTTPS everywhere'] },
              { num: '04', icon: BarChart3, title: 'Intelligent Analytics', desc: 'Turn raw data into insight — track performance, spot at-risk learners, forecast enrollment and optimise resources in real time.', tint: 'bg-purple-50 border-purple-100', chip: 'bg-purple-100 text-purple-600', features: ['Performance trends', 'Real-time dashboards', 'Report builder', 'Actionable insights'] },
            ].map((p) => (
              <div key={p.num} className={`${p.tint} border rounded-3xl p-8 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300`}>
                <div className="flex items-start gap-4 mb-6">
                  <div className={`flex-shrink-0 w-14 h-14 rounded-2xl ${p.chip} flex items-center justify-center`}>
                    <p.icon size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="text-xs font-black text-slate-400">{p.num}</span>
                      <h3 className="text-xl font-black text-slate-900">{p.title}</h3>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{p.desc}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-5 border-t border-white/70">
                  {p.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-full ${p.chip} flex items-center justify-center flex-shrink-0`}><Check size={9} strokeWidth={3} /></span>
                      <span className="text-xs text-slate-600">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ ARCHITECTURE (navy band) ═══ */}
      <section className={`relative px-6 sm:px-10 py-20 overflow-hidden ${NAVY_BAND}`}>
        <div className="absolute inset-0 opacity-[0.1] pointer-events-none" style={DOT_PATTERN} />
        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-amber-300 text-xs font-bold tracking-[0.2em] uppercase mb-2">Under the hood</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Built on enterprise architecture</h2>
            <div className="w-12 h-1 bg-[#f59e0b] rounded-full mx-auto mt-4" />
            <p className="text-blue-100/80 text-sm mt-3">Scalable, secure and lightning-fast infrastructure</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { layer: 'Frontend', icon: Zap, tech: ['React + TypeScript', 'TailwindCSS', 'Vite build'] },
              { layer: 'Backend', icon: Server, tech: ['Node.js + Express', 'PostgreSQL', 'Redis cache'] },
              { layer: 'Infrastructure', icon: Cloud, tech: ['Cloud hosting', 'Docker', 'CI/CD pipeline'] },
            ].map((stack) => (
              <div key={stack.layer} className="bg-white/[0.06] border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center mb-4"><stack.icon size={22} /></div>
                <h3 className="text-lg font-black text-white mb-4">{stack.layer}</h3>
                <div className="space-y-2">
                  {stack.tech.map((t) => (
                    <div key={t} className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center flex-shrink-0"><Check size={9} strokeWidth={3} /></span>
                      <span className="text-sm text-blue-100/80">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA (navy card on light) ═══ */}
      <section className="px-6 sm:px-10 py-16">
        <div className={`max-w-4xl mx-auto relative overflow-hidden rounded-[2rem] px-8 sm:px-14 py-14 text-center ${NAVY_BAND}`}>
          <div className="absolute inset-0 opacity-[0.1] pointer-events-none" style={DOT_PATTERN} />
          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Ready to transform your school?</h2>
            <p className="text-blue-100/80 text-sm mb-8 max-w-lg mx-auto">Set up your secure workspace in minutes — the core plan is free.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={() => navigate('/register')}
                className="w-full sm:w-auto bg-[#f59e0b] hover:bg-[#d97706] text-white font-bold text-sm px-10 py-4 rounded-xl transition-all duration-300 shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2">
                Register School Free <ArrowRight size={16} />
              </button>
              <button onClick={() => navigate('/features')}
                className="w-full sm:w-auto border border-white/25 hover:border-white/50 text-white font-bold text-sm px-10 py-4 rounded-xl transition-all duration-300">
                Explore Features
              </button>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};

export default WhyWiskulPage;
