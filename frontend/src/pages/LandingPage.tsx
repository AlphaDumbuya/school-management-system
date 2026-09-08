/**
 * WiSkul Landing Page — Light edu-SaaS theme (see docs/THEME_GUIDE.md).
 * Soft off-white page, deep-navy hero + bands, blue brand, orange CTAs.
 * Section rhythm: Hero (navy) → Trust strip → Features (light) → How it works
 * (navy band) → Modules (light) → Benefits (light) → CTA (navy) → Footer.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, BarChart3, Lock, Sparkles, Users, GraduationCap,
  Wallet, CreditCard, CalendarCheck, Megaphone, ArrowRight, Check,
  TrendingUp, Zap, Globe, RefreshCw, UserPlus, ClipboardCheck, Send,
} from 'lucide-react';
import PublicNavbar, { PublicFooter } from '@components/public';
import AppDownloadButtons from '@components/public/AppDownloadButtons';

// Theme tokens — see docs/THEME_GUIDE.md
const NAVY_BAND = 'bg-gradient-to-br from-[#16235c] via-[#1a2b6b] to-[#20308a]';
const DOT_PATTERN: React.CSSProperties = {
  backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)',
  backgroundSize: '26px 26px',
};

/** Shared section heading (eyebrow + title + orange underline). */
const SectionHead: React.FC<{ eyebrow: string; title: string; subtitle?: string; light?: boolean }> = ({
  eyebrow, title, subtitle, light,
}) => (
  <div className="text-center max-w-2xl mx-auto mb-12">
    <p className={`text-xs font-bold tracking-[0.2em] uppercase mb-2 ${light ? 'text-amber-300' : 'text-[#1d4ed8]'}`}>{eyebrow}</p>
    <h2 className={`text-3xl sm:text-4xl font-black tracking-tight ${light ? 'text-white' : 'text-slate-900'}`}>{title}</h2>
    <div className="w-12 h-1 bg-[#f59e0b] rounded-full mx-auto mt-4" />
    {subtitle && <p className={`text-sm sm:text-base mt-4 ${light ? 'text-blue-100/80' : 'text-slate-500'}`}>{subtitle}</p>}
  </div>
);

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-700 overflow-x-hidden font-sans antialiased">
      <PublicNavbar ctaText="Register School Free" />

      {/* ═══ HERO (navy + subtle photo texture) ═══ */}
      <section className="relative pt-28 sm:pt-36 pb-20 sm:pb-28 px-6 sm:px-10 overflow-hidden">
        {/* Background photo */}
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none"
          style={{
            backgroundImage:
              'url(https://plus.unsplash.com/premium_photo-1661878265739-da90bc1af051?w=1200&auto=format&fit=crop&q=60)',
          }}
        />
        {/* Navy gradient overlay so the text stays crisp */}
        <div className={`absolute inset-0 pointer-events-none opacity-[0.93] ${NAVY_BAND}`} />
        <div className="absolute inset-0 opacity-[0.1] pointer-events-none" style={DOT_PATTERN} />
        <div className="absolute top-[-10%] right-[-8%] w-[500px] h-[500px] rounded-full bg-white/5 blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3.5 py-1.5 mb-6">
              <Sparkles size={14} className="text-amber-400" />
              <span className="text-white/90 text-xs font-bold tracking-wide">The complete school platform</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-[3.4rem] font-black leading-[1.12] mb-6 tracking-tight text-white">
              Simplify your entire
              <br />
              <span className="text-amber-400">school management</span>
            </h1>
            <p className="text-blue-100/90 text-base leading-relaxed mb-8 max-w-lg">
              WiSkul brings admissions, attendance, grading, fees, identity and
              communication into one secure platform — built for schools in Sierra
              Leone and beyond.
            </p>
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
              <button
                onClick={() => navigate('/register')}
                className="group w-full sm:w-auto bg-[#f59e0b] hover:bg-[#d97706] text-white font-bold text-sm px-8 py-3.5 rounded-lg transition-all duration-300 shadow-lg shadow-amber-500/30 active:scale-95 flex items-center justify-center gap-2"
              >
                Register School Free
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
              {/* App download (shows once VITE_APK_DOWNLOAD_URL / VITE_PLAY_STORE_URL are set) */}
              <AppDownloadButtons variant="hero" />
            </div>
            <ul className="mt-8 space-y-2.5">
              {['Admissions, attendance & grading', 'Digital ID cards & fee collection', 'Real-time analytics & reporting', 'Bank-grade data security'].map((t) => (
                <li key={t} className="flex items-center gap-2.5 text-sm text-blue-50">
                  <span className="w-5 h-5 rounded-full bg-amber-400 text-[#1a2b6b] flex items-center justify-center flex-shrink-0">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative flex items-center justify-center lg:pl-8">
            {/* Ambient colored halo behind the card */}
            <div className="absolute -inset-8 bg-gradient-to-br from-amber-400/25 via-[#1d4ed8]/20 to-transparent rounded-full blur-[60px] pointer-events-none" />

            {/* Floating card */}
            <div className="hero-float relative w-full max-w-[520px]">
              <div className="relative rounded-2xl overflow-hidden ring-1 ring-white/20 shadow-[0_35px_80px_-15px_rgba(0,0,0,0.6)]">
                <img
                  src="/hero.png"
                  alt="School management platform"
                  className="w-full h-auto object-cover"
                />
                {/* Subtle top gloss so it reads as a screen/panel */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
              </div>
              {/* Soft reflection beneath the card to sell the "lift" */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-[-28px] w-[75%] h-8 bg-black/40 blur-2xl rounded-[50%] pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TRUST STRIP (overlapping white card) ═══ */}
      <section className="px-6 sm:px-10 -mt-12 relative z-20">
        <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-xl border border-[#e5e9f2] grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-[#eef1f7]">
          {[
            { value: '10+', label: 'Modules included' },
            { value: '100%', label: 'Free core plan' },
            { value: '2 min', label: 'To get started' },
            { value: '99.9%', label: 'Uptime target' },
          ].map((s) => (
            <div key={s.label} className="p-6 text-center">
              <p className="text-2xl sm:text-3xl font-black text-[#1d4ed8]">{s.value}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FEATURES (light) ═══ */}
      <section id="why" className="px-6 sm:px-10 py-20 sm:py-24">
        <div className="max-w-6xl mx-auto">
          <SectionHead
            eyebrow="Why WiSkul"
            title="Everything your school needs, done well"
            subtitle="A secure, all-in-one platform that protects records and surfaces insights in real time."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Lock, title: 'Data Isolation', desc: 'Each school gets a fully isolated environment — records, grades and finances stay completely separate.', tint: 'max-md:bg-blue-50 max-md:border-blue-100', chip: 'bg-[#1d4ed8]' },
              { icon: ShieldCheck, title: 'Threat Detection', desc: 'Access patterns are monitored and unauthorised attempts blocked at the source.', tint: 'max-md:bg-emerald-50 max-md:border-emerald-100', chip: 'bg-emerald-600' },
              { icon: Megaphone, title: 'Secure Messaging', desc: 'Notifications, parent messages and reports protected with end-to-end encryption.', tint: 'max-md:bg-amber-50 max-md:border-amber-100', chip: 'bg-amber-500' },
              { icon: BarChart3, title: 'Smart Analytics', desc: 'Real-time academic insights power confident, data-driven decisions.', tint: 'max-md:bg-violet-50 max-md:border-violet-100', chip: 'bg-violet-600' },
              { icon: CalendarCheck, title: 'Attendance & Alerts', desc: 'Daily attendance with automatic pattern analysis and parent alerts.', tint: 'max-md:bg-sky-50 max-md:border-sky-100', chip: 'bg-sky-600' },
              { icon: Wallet, title: 'Fees & Payments', desc: 'Collect fees online via mobile money, card, bank transfer and wallets.', tint: 'max-md:bg-rose-50 max-md:border-rose-100', chip: 'bg-rose-600' },
            ].map((item) => (
              <div key={item.title} className={`group bg-white border border-[#e5e9f2] rounded-2xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 text-center ${item.tint}`}>
                <div className={`w-16 h-16 mx-auto rounded-full text-white flex items-center justify-center shadow-md shadow-blue-900/20 group-hover:scale-110 transition-transform mb-4 bg-[#1a2b6b] ${item.chip} md:!bg-[#1a2b6b]`}>
                  <item.icon size={26} />
                </div>
                <h4 className="font-bold text-base text-slate-900 mb-2">{item.title}</h4>
                <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <button
              onClick={() => navigate('/why')}
              className="inline-flex items-center gap-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold text-sm px-8 py-3.5 rounded-lg transition-all duration-300 shadow-lg shadow-blue-500/20"
            >
              Learn more about WiSkul <ArrowRight size={16} className="text-amber-400" />
            </button>
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS (navy band) ═══ */}
      <section className={`relative px-6 sm:px-10 py-20 sm:py-24 overflow-hidden ${NAVY_BAND}`}>
        <div className="absolute inset-0 opacity-[0.1] pointer-events-none" style={DOT_PATTERN} />
        <div className="relative max-w-6xl mx-auto">
          <SectionHead light eyebrow="How it works" title="Up and running in three steps" />
          <div className="flex justify-center mb-10">
            <img
              src="/illustrations/hero-data.svg"
              alt="Unified school data platform"
              className="w-full max-w-[420px] h-auto drop-shadow-xl opacity-95"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: UserPlus, step: '01', title: 'Register your school', desc: 'Create your isolated workspace and admin account in under two minutes — free.' },
              { icon: ClipboardCheck, step: '02', title: 'Set up & import', desc: 'Add classes, staff and students, then issue digital ID cards in batches.' },
              { icon: Send, step: '03', title: 'Run day to day', desc: 'Mark attendance, grade, collect fees and communicate — all from one place.' },
            ].map((s) => (
              <div key={s.step} className="relative bg-white/[0.06] border border-white/10 rounded-2xl p-7 backdrop-blur-sm">
                <span className="absolute top-5 right-6 text-4xl font-black text-white/10">{s.step}</span>
                <div className="w-14 h-14 rounded-full bg-amber-500 text-white flex items-center justify-center mb-4 shadow-lg shadow-amber-500/30">
                  <s.icon size={24} />
                </div>
                <h4 className="font-bold text-white text-lg mb-1.5">{s.title}</h4>
                <p className="text-blue-100/80 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ MODULES (light) ═══ */}
      <section id="features" className="px-6 sm:px-10 py-20 sm:py-24">
        <div className="max-w-6xl mx-auto">
          <SectionHead
            eyebrow="Platform"
            title="Everything in one place"
            subtitle="A complete digital ecosystem covering academics, finance, communication and identity."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Student Directory', icon: Users, badge: 'v1 Free' },
              { label: 'Daily Attendance', icon: CalendarCheck, badge: 'v1 Free' },
              { label: 'Classes & Timetables', icon: GraduationCap, badge: 'v1 Free' },
              { label: 'ID Cards & Batch PDF', icon: CreditCard, badge: 'v1 Free' },
              { label: 'Staff & Teachers', icon: Users, badge: 'v1 Free' },
              { label: 'Admissions Pipeline', icon: ClipboardCheck, badge: 'v1 Free' },
              { label: 'Gradebook & Report Cards', icon: BarChart3, badge: 'v1 Free' },
              { label: 'Fees & Payments', icon: Wallet, badge: 'v1 Free' },
              { label: 'SMS & WhatsApp Alerts', icon: Megaphone, badge: 'Coming v2' },
            ].map((f) => (
              <div key={f.label} className="bg-white border border-[#e5e9f2] rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
                <span className="w-11 h-11 rounded-xl bg-blue-50 text-[#1d4ed8] flex items-center justify-center shrink-0">
                  <f.icon size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800 font-semibold truncate">{f.label}</p>
                  <span
                    className={`inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      f.badge === 'v1 Free' ? 'bg-blue-100 text-[#1d4ed8]' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {f.badge}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <button
              onClick={() => navigate('/features')}
              className="inline-flex items-center gap-2 text-[#1d4ed8] hover:text-[#1e40af] font-bold text-sm"
            >
              See all features <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* ═══ BENEFITS (light, tinted) ═══ */}
      <section id="benefits" className="px-6 sm:px-10 py-20 sm:py-24 bg-white border-y border-[#e5e9f2]">
        <div className="max-w-6xl mx-auto">
          <SectionHead eyebrow="Typical Benefits" title="A toolkit every school needs" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: ShieldCheck, title: 'Be Protected', desc: 'Strong encryption secures all student and staff data, with full audit trails.', card: 'bg-blue-50 border-blue-100', chip: 'bg-blue-100', ic: 'text-[#1d4ed8]' },
              { icon: Users, title: 'Know Your Students', desc: 'Complete 360° profiles — academics, attendance, behaviour and health.', card: 'bg-amber-50 border-amber-100', chip: 'bg-amber-100', ic: 'text-amber-600' },
              { icon: TrendingUp, title: 'Data-Driven Decisions', desc: 'Analytics surface trends in performance, attendance and finances early.', card: 'bg-emerald-50 border-emerald-100', chip: 'bg-emerald-100', ic: 'text-emerald-600' },
              { icon: Zap, title: 'Instant Communication', desc: 'SMS, email and in-app notifications keep everyone connected in real time.', card: 'bg-purple-50 border-purple-100', chip: 'bg-purple-100', ic: 'text-purple-600' },
              { icon: Globe, title: 'Access Anywhere', desc: 'Cloud-based and mobile-optimised — manage your school from any device.', card: 'bg-sky-50 border-sky-100', chip: 'bg-sky-100', ic: 'text-sky-600' },
              { icon: RefreshCw, title: 'Seamless Integration', desc: 'Connect payment gateways and SMS providers without disrupting workflows.', card: 'bg-rose-50 border-rose-100', chip: 'bg-rose-100', ic: 'text-rose-600' },
            ].map((b) => (
              <div key={b.title} className={`${b.card} border rounded-2xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300`}>
                <div className={`w-12 h-12 rounded-2xl ${b.chip} ${b.ic} flex items-center justify-center mb-4`}>
                  <b.icon size={22} />
                </div>
                <h4 className="font-bold text-base text-slate-900 mb-1.5">{b.title}</h4>
                <p className="text-slate-600 text-sm leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <button
              onClick={() => navigate('/benefits')}
              className="inline-flex items-center gap-2 bg-[#f59e0b] hover:bg-[#d97706] text-white font-bold text-sm px-8 py-3.5 rounded-lg transition-all duration-300 shadow-lg shadow-amber-500/25"
            >
              View all benefits <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ═══ CTA (full-width photo section + navy overlay) ═══ */}
      <section
        className="relative overflow-hidden bg-cover bg-center bg-fixed px-6 sm:px-10 py-20 sm:py-28"
        style={{
          backgroundImage:
            'url(https://media.istockphoto.com/id/1349104991/photo/e-learning-online-education-concept.webp?a=1&b=1&s=612x612&w=0&k=20&c=mG2l86JNDQmEP9t2NkJ4Nvc8rL-OGdXoU55ZrS1LDhA=)',
        }}
      >
        {/* Navy gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#16235c]/95 via-[#1a2b6b]/90 to-[#20308a]/92" />
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={DOT_PATTERN} />
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/15 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-6xl mx-auto text-center">
          <div className="relative z-10 space-y-5">
            <span className="inline-block text-amber-300 text-xs font-bold tracking-[0.2em] uppercase bg-white/10 px-3.5 py-1.5 rounded-full border border-white/20">
              Get Started Today
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight max-w-2xl mx-auto">
              Ready to transform your school management?
            </h2>
            <p className="text-blue-100/80 text-sm leading-relaxed max-w-xl mx-auto">
              Join schools already using WiSkul to streamline admissions, issue digital
              ID cards, track attendance, collect fees and empower educators.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => navigate('/register')}
                className="w-full sm:w-auto bg-[#f59e0b] hover:bg-[#d97706] text-white font-black text-sm px-8 py-4 rounded-xl transition-all duration-300 shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2"
              >
                REGISTER YOUR SCHOOL FREE <ArrowRight size={16} />
              </button>
              <button
                onClick={() => navigate('/contact')}
                className="w-full sm:w-auto border border-white/25 hover:border-white/50 text-white font-bold text-sm px-8 py-4 rounded-xl transition-all duration-300"
              >
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER (shared) ═══ */}
      <PublicFooter />
    </div>
  );
};

export default LandingPage;
