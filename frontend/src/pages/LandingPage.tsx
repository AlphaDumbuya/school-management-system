/**
 * WiSkul Landing Page — Light, professional edu-SaaS theme.
 * White base, royal-blue (#1d4ed8) brand + orange (#f59e0b) CTA accent.
 * Alternating white / deep-blue bands for a bright, trustworthy rhythm.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, BarChart3, Lock, Sparkles, Users, GraduationCap,
  Wallet, CreditCard, CalendarCheck, Megaphone, ArrowRight, Check,
  TrendingUp, Zap, Globe, RefreshCw,
} from 'lucide-react';
import PublicNavbar from '@components/public';

// Palette inspired by the reference: royal blue primary + orange CTA on white.
const BLUE = '#1d4ed8';
const ORANGE = '#f59e0b';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-slate-800 overflow-x-hidden font-sans antialiased">
      <PublicNavbar ctaText="Register School Free" />

      {/* ── Hero ── */}
      <section className="relative pt-28 sm:pt-36 pb-20 sm:pb-28 px-6 sm:px-10 overflow-hidden">
        {/* Deep-blue hero band with a subtle dotted pattern (reference style) */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-[#1e3a8a] via-[#1d4ed8] to-[#2563eb]" />
        <div
          className="absolute inset-0 opacity-[0.15] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)',
            backgroundSize: '26px 26px',
          }}
        />
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
                className="group w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-white font-bold text-sm px-8 py-3.5 rounded-lg transition-all duration-300 shadow-lg shadow-amber-500/30 active:scale-95 flex items-center justify-center gap-2"
              >
                Register School Free
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => navigate('/pricing')}
                className="w-full sm:w-auto border border-white/30 hover:border-white/50 bg-white/5 text-white font-bold text-sm px-6 py-3.5 rounded-lg transition-all duration-300"
              >
                View Plans
              </button>
            </div>

            {/* Trust row (checkmark bullets, reference style) */}
            <ul className="mt-8 space-y-2.5">
              {['Distribution and grading of exams', 'Automates scheduling and planning', 'Improves data tracking & results analysis', 'Enhances security and accessibility'].map((t) => (
                <li key={t} className="flex items-center gap-2.5 text-sm text-blue-50">
                  <span className="w-5 h-5 rounded-full bg-amber-400 text-[#1e3a8a] flex items-center justify-center flex-shrink-0">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Illustration */}
          <div className="relative flex items-center justify-center lg:pl-8">
            <div className="absolute inset-0 bg-white/5 rounded-full blur-3xl" />
            <img
              src="/illustrations/hero-data.svg"
              alt="School management platform"
              className="relative w-full max-w-[480px] h-auto drop-shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* ── Stats band ── */}
      <section className="px-6 sm:px-10 pb-8">
        <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { value: '10+', label: 'Modules included' },
            { value: '100%', label: 'Free core plan' },
            { value: '2 min', label: 'To get started' },
            { value: '99.9%', label: 'Uptime target' },
          ].map((s) => (
            <div key={s.label} className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-center">
              <p className="text-2xl sm:text-3xl font-black text-[#1d4ed8]">{s.value}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why WiSkul ── */}
      <section id="why" className="px-6 sm:px-10 py-20 sm:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#1d4ed8] text-xs font-bold tracking-[0.2em] uppercase mb-2">Why WiSkul</p>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Built to keep schools running smoothly</h2>
            <p className="text-slate-500 text-sm sm:text-base max-w-xl mx-auto mt-3">
              Advanced data architecture that protects school records and surfaces
              insights in real time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { icon: Lock, title: 'Multi-Tenant Data Isolation', desc: 'Each school gets a fully isolated environment — records, grades and finances stay completely separate with zero cross-contamination.' },
              { icon: ShieldCheck, title: 'Real-Time Threat Detection', desc: 'Access patterns are monitored and unauthorised attempts blocked at the source, before they reach sensitive records.' },
              { icon: Megaphone, title: 'Secure Communication', desc: 'Notifications, parent messages and grade reports are protected with enterprise-grade encryption end to end.' },
              { icon: BarChart3, title: 'Intelligent Analytics', desc: 'Real-time academic insights and detailed analytics power confident, data-driven decisions about student performance.' },
            ].map((item) => (
              <div key={item.title} className="group bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1d4ed8] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <item.icon size={22} />
                </div>
                <div>
                  <h4 className="font-bold text-base text-slate-900 mb-1.5">{item.title}</h4>
                  <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <button
              onClick={() => navigate('/why')}
              className="inline-flex items-center gap-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold text-sm px-8 py-3.5 rounded-lg transition-all duration-300 shadow-lg shadow-blue-500/20"
            >
              Learn more about WiSkul <ArrowRight size={16} className="text-amber-400" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Analytics + Features (tinted section) ── */}
      <section id="features" className="px-6 sm:px-10 py-20 sm:py-28 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="relative order-2 lg:order-1">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-amber-500/5 rounded-3xl blur-xl" />
            <img src="/illustrations/analytics.svg" alt="School analytics dashboard" className="relative w-full max-w-[500px] h-auto mx-auto drop-shadow-xl" />
          </div>

          <div className="order-1 lg:order-2 bg-white border border-slate-100 rounded-3xl p-8 shadow-sm">
            <h3 className="text-2xl font-black text-slate-900 mb-2">School data analysis</h3>
            <p className="text-slate-500 text-sm mb-6">
              Stop guessing and start making data-driven decisions. WiSkul provides
              real-time reports on every aspect of your institution.
            </p>
            <ul className="space-y-3">
              {[
                'Student performance tracking across all terms',
                'Attendance pattern analysis & alerts',
                'Financial health monitoring & forecasting',
                'Teacher workload & scheduling optimisation',
                'Enrollment trends & capacity planning',
                'Parent engagement metrics',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-slate-700">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-[#1d4ed8] flex items-center justify-center flex-shrink-0">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Modules grid */}
        <div className="max-w-4xl mx-auto mt-20 bg-white border border-slate-100 rounded-3xl p-8 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-2xl font-black text-slate-900">Everything in one place</h3>
            <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-[#1d4ed8] bg-blue-50 px-2.5 py-1 rounded-full">
              <TrendingUp size={13} /> +24% efficiency
            </span>
          </div>
          <p className="text-slate-500 text-sm mb-6">
            A complete digital ecosystem covering academics, finance, communication and identity.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              { label: 'Student Directory', icon: Users, badge: 'v1 Free' },
              { label: 'Daily Attendance', icon: CalendarCheck, badge: 'v1 Free' },
              { label: 'Classes & Timetables', icon: GraduationCap, badge: 'v1 Free' },
              { label: 'ID Cards & Batch PDF', icon: CreditCard, badge: 'v1 Free' },
              { label: 'Staff & Teachers', icon: Users, badge: 'v1 Free' },
              { label: 'Admissions Pipeline', icon: GraduationCap, badge: 'v1 Free' },
              { label: 'Gradebook & Report Cards', icon: BarChart3, badge: 'v1 Free' },
              { label: 'Fees & Payments', icon: Wallet, badge: 'v1 Free' },
              { label: 'SMS & WhatsApp Alerts', icon: Megaphone, badge: 'Coming v2' },
              { label: 'Staff HR & Leave', icon: Lock, badge: 'Coming v2' },
            ].map((f) => (
              <div key={f.label} className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center justify-between gap-2 min-w-0 hover:border-blue-300 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-[#1d4ed8] shrink-0">
                    <f.icon size={15} />
                  </span>
                  <span className="text-sm text-slate-700 font-medium truncate">{f.label}</span>
                </div>
                <span
                  className={`shrink-0 whitespace-nowrap text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    f.badge === 'v1 Free'
                      ? 'bg-blue-100 text-[#1d4ed8]'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {f.badge}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/features')}
            className="mt-6 inline-flex items-center gap-2 text-[#1d4ed8] hover:text-[#1e40af] font-bold text-sm"
          >
            See all features <ArrowRight size={15} />
          </button>
        </div>
      </section>

      {/* ── Benefits ── */}
      <section id="benefits" className="px-6 sm:px-10 py-20 sm:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[#1d4ed8] text-xs font-bold tracking-[0.2em] uppercase mb-2">Typical Benefits</p>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">A toolkit every school needs</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: ShieldCheck, title: 'Be Protected', desc: 'Strong encryption secures all student and staff data, with full audit trails.', tint: 'from-blue-500/10 to-blue-500/5', ic: 'text-[#1d4ed8]' },
              { icon: Users, title: 'Know Your Students', desc: 'Complete 360° profiles — academics, attendance, behaviour and health in one view.', tint: 'from-amber-500/10 to-amber-500/5', ic: 'text-amber-600' },
              { icon: TrendingUp, title: 'Data-Driven Decisions', desc: 'Analytics surface trends in performance, attendance and finances early.', tint: 'from-amber-500/10 to-amber-500/5', ic: 'text-amber-600' },
              { icon: Zap, title: 'Instant Communication', desc: 'SMS, email and in-app notifications keep everyone connected in real time.', tint: 'from-purple-500/10 to-purple-500/5', ic: 'text-purple-600' },
              { icon: Globe, title: 'Access Anywhere', desc: 'Cloud-based and mobile-optimised — manage your school from any device.', tint: 'from-sky-500/10 to-sky-500/5', ic: 'text-sky-600' },
              { icon: RefreshCw, title: 'Seamless Integration', desc: 'Connect payment gateways and SMS providers without disrupting workflows.', tint: 'from-rose-500/10 to-rose-500/5', ic: 'text-rose-600' },
            ].map((b) => (
              <div key={b.title} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${b.tint} ${b.ic} flex items-center justify-center mb-4`}>
                  <b.icon size={22} />
                </div>
                <h4 className="font-bold text-base text-slate-900 mb-1.5">{b.title}</h4>
                <p className="text-slate-500 text-sm leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <button
              onClick={() => navigate('/benefits')}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-bold text-sm px-8 py-3.5 rounded-lg transition-all duration-300 shadow-lg shadow-amber-500/25"
            >
              View all benefits <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="px-6 sm:px-10 py-8">
        <div className="max-w-6xl mx-auto relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#1e3a8a] via-[#1d4ed8] to-[#2563eb] px-8 sm:px-14 py-14 sm:py-16 text-center">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 space-y-5">
            <span className="inline-block text-amber-300 text-xs font-bold tracking-[0.2em] uppercase bg-white/10 px-3.5 py-1.5 rounded-full border border-white/20">
              Get Started Today
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight max-w-2xl mx-auto">
              Ready to transform your school management?
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed max-w-xl mx-auto">
              Join schools already using WiSkul to streamline admissions, issue digital
              ID cards, track attendance, collect fees and empower educators.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => navigate('/register')}
                className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-white font-black text-sm px-8 py-4 rounded-xl transition-all duration-300 shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2"
              >
                REGISTER YOUR SCHOOL FREE <ArrowRight size={16} />
              </button>
              <button
                onClick={() => navigate('/contact')}
                className="w-full sm:w-auto border border-white/20 hover:border-white/40 text-white font-bold text-sm px-8 py-4 rounded-2xl transition-all duration-300"
              >
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-12 border-t border-slate-100 px-6 sm:px-10 py-12 bg-slate-50">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <img src="/logo.png" alt="WiSkul" className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 border border-slate-100" />
              <span className="font-black text-base text-slate-900">Wi<span className="text-[#1d4ed8]">Skul</span></span>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed">
              Next-generation school management protecting student data while empowering educators.
            </p>
            <a href="mailto:info@wiskulsl.com" className="inline-block mt-3 text-slate-600 text-xs hover:text-[#1d4ed8] transition-colors font-medium">
              info@wiskulsl.com
            </a>
          </div>

          <div>
            <h5 className="text-slate-900 font-bold text-xs mb-4 uppercase tracking-wider">Product</h5>
            <ul className="space-y-2">
              {[['Features', '/features'], ['Pricing', '/pricing'], ['Why WiSkul', '/why'], ['Benefits', '/benefits']].map(([label, to]) => (
                <li key={label}><span onClick={() => navigate(to)} className="text-slate-500 text-xs hover:text-[#1d4ed8] cursor-pointer transition-colors">{label}</span></li>
              ))}
            </ul>
          </div>

          <div>
            <h5 className="text-slate-900 font-bold text-xs mb-4 uppercase tracking-wider">Company</h5>
            <ul className="space-y-2">
              {[['Contact', '/contact'], ['Register', '/register'], ['Sign In', '/login']].map(([label, to]) => (
                <li key={label}><span onClick={() => navigate(to)} className="text-slate-500 text-xs hover:text-[#1d4ed8] cursor-pointer transition-colors">{label}</span></li>
              ))}
            </ul>
          </div>

          <div>
            <h5 className="text-slate-900 font-bold text-xs mb-4 uppercase tracking-wider">Get in touch</h5>
            <p className="text-slate-500 text-xs leading-relaxed mb-4">Advanced cloud infrastructure with a 99.9% uptime target.</p>
            <div className="flex items-center gap-3">
              {['𝕏', 'f', 'in'].map((s) => (
                <div key={s} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-[#1d4ed8] hover:border-[#1d4ed8]/30 cursor-pointer transition-colors text-xs">{s}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-slate-100 text-center">
          <p className="text-slate-400 text-[11px]">© {new Date().getFullYear()} WiSkul. All rights reserved. Built with care for education.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
