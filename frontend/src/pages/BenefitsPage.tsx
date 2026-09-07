/**
 * BenefitsPage — /benefits
 * Light edu-SaaS theme (see docs/THEME_GUIDE.md). Shared navbar + footer.
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Users, TrendingUp, Zap, Globe, RefreshCw, Wallet, Clock,
  Target, Smartphone, GraduationCap, BarChart3, ArrowRight, Check, X,
} from 'lucide-react';
import PublicNavbar, { PublicFooter } from '@components/public';

const NAVY_BAND = 'bg-gradient-to-br from-[#16235c] via-[#1a2b6b] to-[#20308a]';
const DOT_PATTERN: React.CSSProperties = {
  backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)',
  backgroundSize: '26px 26px',
};

const TINTS = [
  { card: 'bg-blue-50 border-blue-100', chip: 'bg-blue-100 text-[#1d4ed8]', dot: 'bg-[#1d4ed8]' },
  { card: 'bg-emerald-50 border-emerald-100', chip: 'bg-emerald-100 text-emerald-600', dot: 'bg-emerald-600' },
  { card: 'bg-amber-50 border-amber-100', chip: 'bg-amber-100 text-amber-600', dot: 'bg-amber-600' },
  { card: 'bg-purple-50 border-purple-100', chip: 'bg-purple-100 text-purple-600', dot: 'bg-purple-600' },
  { card: 'bg-sky-50 border-sky-100', chip: 'bg-sky-100 text-sky-600', dot: 'bg-sky-600' },
  { card: 'bg-rose-50 border-rose-100', chip: 'bg-rose-100 text-rose-600', dot: 'bg-rose-600' },
];

export const BenefitsPage: React.FC = () => {
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const benefits = [
    { icon: ShieldCheck, title: 'Be Protected', desc: '256-bit encryption secures all student and staff data, with full audit trails and a zero-trust approach.', features: ['256-bit AES encryption', 'Compliance-ready', 'Full audit trails', 'Zero-trust security'] },
    { icon: Users, title: 'Know Your Students', desc: 'Complete 360° profiles — academic history, attendance, behaviour and health — in one unified view.', features: ['360° profiles', 'Academic history', 'Behaviour tracking', 'Health records'] },
    { icon: TrendingUp, title: 'Data-Driven Decisions', desc: 'Analytics surface trends in performance, attendance and finances before they become problems.', features: ['Trend detection', 'Real-time dashboards', 'Resource optimisation', 'Actionable insight'] },
    { icon: Zap, title: 'Instant Communication', desc: 'SMS, email and in-app notifications keep parents, teachers and students connected in real time.', features: ['SMS notifications', 'Email alerts', 'In-app messaging', 'Real-time updates'] },
    { icon: Globe, title: 'Access Anywhere', desc: 'Cloud-based and mobile-optimised — manage your school from any device, anywhere.', features: ['Cloud-based', 'Mobile optimised', 'Cross-platform', 'Works offline (PWA)'] },
    { icon: RefreshCw, title: 'Seamless Integration', desc: 'Connect payment gateways and SMS providers without disrupting workflows.', features: ['Payment gateways', 'SMS providers', 'RESTful APIs', 'Custom integrations'] },
    { icon: Wallet, title: 'Reduce Costs', desc: 'Eliminate paper, reduce admin overhead and automate repetitive tasks to save on printing and storage.', features: ['Paperless operations', 'Task automation', 'Lower overhead', 'Cost savings'] },
    { icon: Clock, title: 'Save Time', desc: 'Automate attendance, grading, report cards and fee reminders — reclaim hours every week.', features: ['Auto attendance', 'Auto grading', 'Report generation', 'Smart reminders'] },
    { icon: Target, title: 'Increase Efficiency', desc: 'Streamlined workflows reduce errors and speed up every process — admissions to graduation.', features: ['Streamlined workflows', 'Fewer errors', 'Process automation', 'Higher productivity'] },
    { icon: Smartphone, title: 'Empower Parents', desc: "Parents track their child's journey from anywhere — grades, attendance, fees and events.", features: ['Parent portal', 'Real-time updates', 'Mobile access', 'Transparent reporting'] },
    { icon: GraduationCap, title: 'Engage Students', desc: 'Students access timetables, assignments, results and announcements instantly.', features: ['Student portal', 'Assignment tracking', 'Result access', 'Digital engagement'] },
    { icon: BarChart3, title: 'Powerful Reporting', desc: 'Generate detailed reports on academics, finances and attendance, and export to PDF in one click.', features: ['Custom reports', 'PDF export', 'Financial reports', 'Academic analytics'] },
  ];

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-700 overflow-x-hidden font-sans antialiased">
      <PublicNavbar ctaText="Register School Free" />

      {/* ═══ HERO (navy) ═══ */}
      <section className={`relative pt-28 sm:pt-36 pb-20 px-6 sm:px-10 overflow-hidden ${NAVY_BAND}`}>
        <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={DOT_PATTERN} />
        <div className="absolute top-[-10%] right-[-8%] w-[500px] h-[500px] rounded-full bg-white/5 blur-[120px] pointer-events-none" />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-5 py-2 mb-8">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-white/90 text-xs font-bold tracking-widest uppercase">Transform your school</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-[1.1] mb-6 text-white">
            The WiSkul <span className="text-amber-400">benefits</span>
          </h1>
          <p className="text-blue-100/90 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            More than software — a complete digital transformation toolkit that saves time,
            reduces costs and unlocks new possibilities for your institution.
          </p>
        </div>
      </section>

      {/* ═══ BENEFITS GRID (light) ═══ */}
      <section className="px-6 sm:px-10 py-20 bg-white border-b border-[#e5e9f2]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((b, i) => {
              const t = TINTS[i % TINTS.length];
              return (
                <div key={b.title} className={`${t.card} border rounded-2xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300`}>
                  <div className={`w-14 h-14 rounded-xl ${t.chip} flex items-center justify-center mb-4`}>
                    <b.icon size={26} />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mb-2">{b.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4">{b.desc}</p>
                  <div className="grid grid-cols-2 gap-2 pt-4 border-t border-white/70">
                    {b.features.map((f) => (
                      <div key={f} className="flex items-start gap-2">
                        <span className={`w-3.5 h-3.5 rounded-full ${t.chip} flex items-center justify-center mt-0.5 flex-shrink-0`}><Check size={8} strokeWidth={3} /></span>
                        <span className="text-[11px] text-slate-600 leading-tight">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ IMPACT (navy band) ═══ */}
      <section className={`relative px-6 sm:px-10 py-20 overflow-hidden ${NAVY_BAND}`}>
        <div className="absolute inset-0 opacity-[0.1] pointer-events-none" style={DOT_PATTERN} />
        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-amber-300 text-xs font-bold tracking-[0.2em] uppercase mb-2">The impact</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">What schools typically gain</h2>
            <div className="w-12 h-1 bg-[#f59e0b] rounded-full mx-auto mt-4" />
            <p className="text-blue-100/80 text-sm mt-3">Illustrative outcomes as manual work is replaced with automation.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { metric: 'Hours saved weekly', label: 'Time', desc: 'Automation removes manual data entry, report generation and repetitive admin tasks.', icon: Clock },
              { metric: 'Lower running costs', label: 'Cost', desc: 'Go paperless, reduce admin overhead and optimise how resources are allocated.', icon: Wallet },
              { metric: 'Faster processes', label: 'Speed', desc: 'Streamlined workflows accelerate everything from admissions to graduation.', icon: Zap },
            ].map((roi) => (
              <div key={roi.label} className="bg-white/[0.06] border border-white/10 rounded-2xl p-8 text-center backdrop-blur-sm">
                <div className="w-12 h-12 mx-auto rounded-xl bg-amber-500 text-white flex items-center justify-center mb-4"><roi.icon size={22} /></div>
                <p className="text-xl font-black text-white mb-1">{roi.metric}</p>
                <p className="text-sm font-bold text-amber-300 mb-3 uppercase tracking-wider">{roi.label}</p>
                <p className="text-xs text-blue-100/70 leading-relaxed">{roi.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ BEFORE / AFTER (light) ═══ */}
      <section className="px-6 sm:px-10 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[#1d4ed8] text-xs font-bold tracking-[0.2em] uppercase mb-2">The transformation</p>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Before &amp; after WiSkul</h2>
            <div className="w-12 h-1 bg-[#f59e0b] rounded-full mx-auto mt-4" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center"><X size={22} /></div>
                <h3 className="text-2xl font-black text-rose-600">Before</h3>
              </div>
              <ul className="space-y-3.5">
                {[
                  'Manual attendance registers lost or damaged',
                  'Paper report cards taking weeks to prepare',
                  'Parents calling constantly for updates',
                  'No visibility into school-wide performance',
                  'Fee collection chaos and missing records',
                  'Hours wasted on data entry and filing',
                ].map((issue) => (
                  <li key={issue} className="flex items-start gap-3 text-slate-600">
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center flex-shrink-0 mt-0.5"><X size={11} strokeWidth={3} /></span>
                    <span className="text-sm">{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center"><Check size={22} /></div>
                <h3 className="text-2xl font-black text-emerald-600">After</h3>
              </div>
              <ul className="space-y-3.5">
                {[
                  'Digital attendance with automatic parent notifications',
                  'Auto-generated report cards in seconds',
                  'Parents access everything via a mobile portal',
                  'Real-time analytics and clear insights',
                  'Automated fee tracking and payment reminders',
                  'Zero manual data entry — everything is digital',
                ].map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3 text-slate-700">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5"><Check size={11} strokeWidth={3} /></span>
                    <span className="text-sm font-medium">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CTA (navy card) ═══ */}
      <section className="px-6 sm:px-10 py-16">
        <div className={`max-w-4xl mx-auto relative overflow-hidden rounded-[2rem] px-8 sm:px-14 py-14 text-center ${NAVY_BAND}`}>
          <div className="absolute inset-0 opacity-[0.1] pointer-events-none" style={DOT_PATTERN} />
          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Start your digital transformation</h2>
            <p className="text-blue-100/80 text-sm mb-8 max-w-lg mx-auto">Set up your school in minutes — the core plan is free, no card required.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={() => navigate('/register')}
                className="w-full sm:w-auto bg-[#f59e0b] hover:bg-[#d97706] text-white font-bold text-sm px-10 py-4 rounded-xl transition-all duration-300 shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2">
                Register School Free <ArrowRight size={16} />
              </button>
              <button onClick={() => navigate('/pricing')}
                className="w-full sm:w-auto border border-white/25 hover:border-white/50 text-white font-bold text-sm px-10 py-4 rounded-xl transition-all duration-300">
                View Pricing
              </button>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};

export default BenefitsPage;
