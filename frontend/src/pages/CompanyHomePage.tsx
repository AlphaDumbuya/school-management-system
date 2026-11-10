/**
 * CompanyHomePage: the home page of WiSkul as a software company ("/").
 * The product page (the school platform) lives at /wiskul. See docs/THEME_GUIDE.md for the theme.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Check, Users, ClipboardCheck, CalendarCheck, BarChart3, Wallet, CreditCard, Megaphone,
  Calculator, ShieldCheck, WifiOff, Smartphone, Palette, Rocket, Database, Wrench, GraduationCap,
  Building2, Layers, Code2,
} from 'lucide-react';
import PublicNavbar, { PublicFooter } from '@components/public';
import Reveal from '@components/public/company/Reveal';
import PhoneFrame from '@components/public/company/PhoneFrame';
import SchoolShowcase from '@components/public/company/SchoolShowcase';
import { CtaBand, DOT_PATTERN, GhostButton, NAVY_BAND, PrimaryButton, SectionHead } from '@components/public/company/ui';
import { SERVICES_CATALOG } from '@components/public/company/servicesCatalog';
import { PhotoBackdrop } from '@components/public/company/photos';
import AppDownloadButtons from '@components/public/AppDownloadButtons';
import { openLiveDemo } from '@components/public/LiveDemoModal';
import { EDITION_CLIENTS, TECH_STACK, showcaseAlt, showcaseSrc } from '@config/company.config';
import usePageMeta from '@hooks/usePageMeta';

const OFFERS = [
  {
    icon: Building2,
    tag: 'Subscription',
    title: 'WiSkul Platform',
    text: 'Start today. A complete school system on a free trial, then a plan that fits your school. Admissions, attendance, results, fees and more.',
    to: '/wiskul',
    cta: 'Explore the platform',
    tint: 'from-[#1d4ed8] to-[#1a2b6b]',
  },
  {
    icon: Palette,
    tag: 'One-time purchase',
    title: 'WiSkul School Edition',
    text: 'A system that is entirely yours: your name, logo, colours, address, app and database. Bought once, with no subscription and no WiSkul branding.',
    to: '/editions',
    cta: 'See School Editions',
    tint: 'from-[#f59e0b] to-[#b45309]',
    featured: true,
  },
  {
    icon: GraduationCap,
    tag: 'Training',
    title: 'WiSkul Developer Programme',
    text: 'A 16-week, practice-first programme that takes people from web basics to building and shipping full-stack apps with AI as a tool.',
    to: '/services#training',
    cta: 'About the programme',
    tint: 'from-[#7c3aed] to-[#4c1d95]',
  },
];

const CAPABILITIES = [
  { icon: ClipboardCheck, title: 'Admissions', text: 'Online applications, review and enrolment.' },
  { icon: CalendarCheck, title: 'Attendance', text: 'Daily registers, offline in the teacher app, with alerts to parents.' },
  { icon: BarChart3, title: 'Results & report cards', text: 'Gradebook, class positions and report cards with a verification QR.' },
  { icon: Wallet, title: 'Fees & payments', text: 'Invoices, receipts and online payment by mobile money and card.' },
  { icon: CreditCard, title: 'ID cards', text: 'Batch-printed student and staff cards that can be verified by scan.' },
  { icon: Megaphone, title: 'Announcements', text: 'School, class or role messages with in-app notifications and email.' },
  { icon: Calculator, title: 'Payroll & accounting', text: 'Staff pay, expenses and finance reports in one place.' },
  { icon: Users, title: 'People & portals', text: 'A home screen for principals, teachers, accountants, parents and pupils.' },
];

const WHY = [
  { icon: WifiOff, title: 'Built for real connectivity', text: 'Teachers keep taking attendance and entering results with no internet. It syncs when they are back online.' },
  { icon: ShieldCheck, title: 'Security that matches the data', text: 'Role-based access, two-factor sign-in, passkeys, an audit trail and school data kept apart.' },
  { icon: Wallet, title: 'Made for Sierra Leone', text: 'Leones, the local grading scale, Sierra Leone report cards, and Monime mobile money and card payments.' },
  { icon: Smartphone, title: 'On the phones people already have', text: 'An Android app and an installable web app. Everyone you serve only needs a phone.' },
  { icon: Users, title: 'A professional, dedicated team', text: 'Developers in Sierra Leone who know the ground, working with developers abroad. One team, one standard.' },
  { icon: Wrench, title: 'We stay after launch', text: 'We host, secure, update and support what we build, so it keeps working for you.' },
];

const STEPS = [
  { icon: Users, title: 'We talk', text: 'You tell us about your school, how you work today and what you need.' },
  { icon: Palette, title: 'We brand it', text: 'Your name, logo, colours, classes and subjects are set up as your own.' },
  { icon: Database, title: 'We bring your data', text: 'Students, staff and classes are imported from the records you already keep.' },
  { icon: Rocket, title: 'We launch with you', text: 'Your team is shown how it works, and the system goes live for everyone.' },
  { icon: Wrench, title: 'We stay close', text: 'Questions and fixes go to a team that knows your system.' },
];

export const CompanyHomePage: React.FC = () => {
  const navigate = useNavigate();
  usePageMeta(
    'WiSkul | Technology company in Sierra Leone',
    'WiSkul is a technology company in Sierra Leone. A professional team of developers builds websites, apps and business systems, and runs a school management platform used by schools every day.',
    '/',
  );
  const [a, b] = EDITION_CLIENTS;

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-700 overflow-x-hidden font-sans antialiased">
      <PublicNavbar ctaText="Start Free Trial" />

      {/* ═══ HERO ═══ */}
      <section className={`relative pt-28 sm:pt-36 pb-24 sm:pb-32 px-6 sm:px-10 overflow-hidden ${NAVY_BAND}`}>
        <PhotoBackdrop slot="home-hero" className="opacity-20 mix-blend-luminosity" />
        <div className="absolute inset-0 co-grid pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={DOT_PATTERN} />
        <div className="co-drift absolute top-[-15%] right-[-6%] w-[560px] h-[560px] rounded-full bg-[#1d4ed8]/35 blur-[130px] pointer-events-none" />
        <div className="co-drift absolute bottom-[-25%] left-[-8%] w-[460px] h-[460px] rounded-full bg-amber-400/15 blur-[130px] pointer-events-none" />

        <div className="relative z-10 max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-14 items-center">
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-7">
              <Code2 size={14} className="text-amber-400" aria-hidden="true" />
              <span className="text-white/90 text-xs font-bold tracking-widest uppercase">A technology company in Sierra Leone</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.6rem] font-black leading-[1.08] tracking-tight text-white">
              Software built for
              <br />
              <span className="co-gradient-text">Sierra Leone.</span>
            </h1>
            <p className="text-blue-100/90 text-base sm:text-lg leading-relaxed mt-6 max-w-xl">
              WiSkul is a technology company. Our professional team of developers, in Sierra Leone and abroad, builds
              websites, apps and business systems, and runs a school platform that schools use every day.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3 sm:gap-4">
              <PrimaryButton to="/contact?topic=project">Start a project</PrimaryButton>
              <GhostButton to="/services">Our services</GhostButton>
            </div>
            {/* The school platform: trial, demo and app, one tap away. */}
            <div className="mt-6 max-w-[30rem] rounded-2xl border border-white/15 bg-white/[0.06] p-4 backdrop-blur-sm">
              <p className="text-xs font-bold tracking-widest uppercase text-amber-300 mb-3">Try the WiSkul school platform</p>
              <div className="flex flex-wrap gap-2.5">
                <button type="button" onClick={() => navigate('/register')} className="inline-flex items-center gap-2 bg-[#f59e0b] hover:bg-[#d97706] text-white font-bold text-xs px-4 py-2.5 rounded-lg transition-colors">
                  Start free trial <ArrowRight size={14} />
                </button>
                <button type="button" onClick={openLiveDemo} className="inline-flex items-center gap-2 border border-white/30 hover:border-white/60 hover:bg-white/10 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition-colors">
                  Get a live demo
                </button>
              </div>
              <AppDownloadButtons variant="light" className="mt-3" />
            </div>
            <ul className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 max-w-lg">
              {['Websites, apps and business systems', 'School management platform', 'Mobile money and card payments', 'Works on the phones people have'].map((t) => (
                <li key={t} className="flex items-center gap-2.5 text-sm text-blue-50">
                  <span className="w-5 h-5 rounded-full bg-amber-400 text-[#1a2b6b] flex items-center justify-center flex-shrink-0">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Phones */}
          <div className="lg:col-span-6 relative h-[470px] sm:h-[560px]">
            <div className="absolute -inset-6 bg-gradient-to-br from-amber-400/20 via-[#1d4ed8]/25 to-transparent rounded-full blur-[70px] pointer-events-none" />
            {/* Each phone sits in a positioned wrapper; the animation runs on the inner box so it never fights the positioning. */}
            <div className="absolute left-[2%] top-[12%] w-[210px] hidden lg:block">
              <div className="co-float" style={{ '--co-rot': '-7deg' } as React.CSSProperties}>
                <PhoneFrame src={showcaseSrc('amie', 'teacher')} alt={showcaseAlt(b, 'teacher')} eager className="!w-full" />
              </div>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[230px] sm:w-[270px] z-10">
              <div className="co-float-slow">
                <PhoneFrame src={showcaseSrc('aga', 'staff')} alt={showcaseAlt(a, 'staff')} eager className="!w-full" />
              </div>
            </div>
            <div className="absolute right-[2%] top-[18%] w-[210px] hidden lg:block">
              <div className="co-float" style={{ '--co-rot': '7deg', animationDelay: '-2s' } as React.CSSProperties}>
                <PhoneFrame src={showcaseSrc('aga', 'parent')} alt={showcaseAlt(a, 'parent')} eager className="!w-full" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ BUILT FOR ═══ */}
      <section className="px-6 sm:px-10 -mt-12 relative z-20">
        <Reveal>
          <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-xl border border-[#e5e9f2] px-6 py-6 sm:py-7 flex flex-col md:flex-row md:items-center gap-5 md:gap-10">
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-slate-400 md:max-w-[11rem]">Built and running for</p>
            <div className="flex flex-wrap items-center gap-x-10 gap-y-4 flex-1">
              {EDITION_CLIENTS.map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  <img src={s.logo} alt="" width={44} height={44} className="w-11 h-11 rounded-xl object-contain bg-white border border-slate-100" loading="lazy" />
                  <span className="font-black text-slate-900">{s.name}</span>
                </div>
              ))}
              <div className="flex items-center gap-3 text-slate-500">
                <span className="w-11 h-11 rounded-xl bg-blue-50 text-[#1d4ed8] flex items-center justify-center"><Building2 size={20} aria-hidden="true" /></span>
                <span className="font-bold">and schools on the WiSkul Platform</span>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══ WHAT WE DO ═══ */}
      <section className="px-6 sm:px-10 pt-20 sm:pt-28">
        <div className="max-w-[1400px] mx-auto">
          <SectionHead
            eyebrow="What we do"
            title="Software for the things people need most"
            subtitle="Whatever your organisation does, we can build, launch and look after the software it runs on."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SERVICES_CATALOG.map((c, i) => (
              <Reveal key={c.id} delay={(i % 4) * 80}>
                <div className="co-lift h-full bg-white border border-[#e5e9f2] rounded-2xl p-6 shadow-sm">
                  <span className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.tint} text-white flex items-center justify-center shadow-md mb-4`}>
                    <c.icon size={22} aria-hidden="true" />
                  </span>
                  <h3 className="font-bold text-slate-900 mb-1.5">{c.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{c.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="text-center mt-10">
            <button type="button" onClick={() => navigate('/services')} className="inline-flex items-center gap-2 text-[#1d4ed8] hover:text-[#1e40af] font-bold text-sm">
              All services <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* ═══ OUR PRODUCTS ═══ */}
      <section className="px-6 sm:px-10 py-20 sm:py-28">
        <div className="max-w-[1400px] mx-auto">
          <SectionHead
            eyebrow="Our products"
            title="Ready-made for schools"
            subtitle="Our school software is in daily use. Start on the platform, or own a system built in your school's name."
          />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {OFFERS.map((o, i) => (
              <Reveal key={o.title} delay={i * 110}>
                <div className={`co-lift h-full relative flex flex-col bg-white rounded-3xl border p-7 ${o.featured ? 'border-amber-300 shadow-xl' : 'border-[#e5e9f2] shadow-sm'}`}>
                  {o.featured && (
                    <span className="absolute -top-3 left-7 bg-[#f59e0b] text-white text-[11px] font-black tracking-wider uppercase px-3 py-1 rounded-full shadow">Most personal</span>
                  )}
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${o.tint} text-white flex items-center justify-center shadow-lg mb-5`}>
                    <o.icon size={26} aria-hidden="true" />
                  </div>
                  <span className="text-[11px] font-bold tracking-widest uppercase text-slate-400">{o.tag}</span>
                  <h3 className="text-xl font-black text-slate-900 mt-1 mb-3">{o.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed flex-1">{o.text}</p>
                  <button
                    type="button"
                    onClick={() => navigate(o.to)}
                    className="mt-6 inline-flex items-center gap-2 text-[#1d4ed8] hover:text-[#1e40af] font-bold text-sm"
                  >
                    {o.cta} <ArrowRight size={15} />
                  </button>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SHOWCASE ═══ */}
      <section className="px-6 sm:px-10 py-20 sm:py-28 bg-white border-y border-[#e5e9f2] overflow-hidden">
        <div className="max-w-[1400px] mx-auto">
          <Reveal><SchoolShowcase /></Reveal>
        </div>
      </section>

      {/* ═══ CAPABILITIES ═══ */}
      <section className="px-6 sm:px-10 py-20 sm:py-28">
        <div className="max-w-[1400px] mx-auto">
          <SectionHead
            eyebrow="Inside our school software"
            title="Everything a school does, in one place"
            subtitle="Eight areas that cover the school day, from the first application to the last receipt."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {CAPABILITIES.map((c, i) => (
              <Reveal key={c.title} delay={(i % 4) * 80}>
                <div className="co-lift h-full bg-white border border-[#e5e9f2] rounded-2xl p-6 shadow-sm">
                  <span className="w-12 h-12 rounded-xl bg-blue-50 text-[#1d4ed8] flex items-center justify-center mb-4">
                    <c.icon size={22} aria-hidden="true" />
                  </span>
                  <h4 className="font-bold text-slate-900 mb-1.5">{c.title}</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">{c.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="text-center mt-10">
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              <button type="button" onClick={() => navigate('/features')} className="inline-flex items-center gap-2 text-[#1d4ed8] hover:text-[#1e40af] font-bold text-sm">
                See every feature <ArrowRight size={15} />
              </button>
              <button type="button" onClick={() => navigate('/pricing')} className="inline-flex items-center gap-2 text-[#1d4ed8] hover:text-[#1e40af] font-bold text-sm">
                View pricing <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ WHY WISKUL (navy) ═══ */}
      <section className={`relative px-6 sm:px-10 py-20 sm:py-28 overflow-hidden ${NAVY_BAND}`}>
        <div className="absolute inset-0 opacity-[0.1] pointer-events-none" style={DOT_PATTERN} />
        <div className="relative max-w-[1400px] mx-auto">
          <SectionHead light eyebrow="Why WiSkul" title="Engineered for the way things really work here" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHY.map((w, i) => (
              <Reveal key={w.title} delay={(i % 2) * 100}>
                <div className="flex gap-4 bg-white/[0.06] border border-white/10 rounded-2xl p-6 backdrop-blur-sm h-full">
                  <span className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/30">
                    <w.icon size={22} aria-hidden="true" />
                  </span>
                  <div>
                    <h4 className="font-bold text-white text-base mb-1.5">{w.title}</h4>
                    <p className="text-blue-100/80 text-sm leading-relaxed">{w.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-2.5">
            <span className="text-xs font-bold tracking-widest uppercase text-blue-200/70 mr-2 flex items-center gap-1.5"><Layers size={14} aria-hidden="true" /> Built with</span>
            {TECH_STACK.map((t) => (
              <span key={t} className="text-xs font-semibold text-white/90 bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5">{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW WE DELIVER ═══ */}
      <section className="px-6 sm:px-10 py-20 sm:py-28">
        <div className="max-w-[1400px] mx-auto">
          <SectionHead
            eyebrow="How a School Edition happens"
            title="From first call to first login"
            subtitle="We handle the work. You stay in charge of your school."
          />
          <div className="grid grid-cols-1 md:grid-cols-5 gap-5 relative">
            <div className="hidden md:block absolute top-9 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-[#1d4ed8]/30 to-transparent" aria-hidden="true" />
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 90}>
                <div className="relative text-center md:px-2">
                  <span className="relative z-10 mx-auto w-[4.5rem] h-[4.5rem] rounded-full bg-white border-2 border-[#1d4ed8]/20 text-[#1d4ed8] flex items-center justify-center shadow-md mb-4">
                    <s.icon size={26} aria-hidden="true" />
                    <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#f59e0b] text-white text-[11px] font-black flex items-center justify-center">{i + 1}</span>
                  </span>
                  <h4 className="font-bold text-slate-900 mb-1">{s.title}</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">{s.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="text-center mt-12">
            <PrimaryButton to="/editions">See how School Editions work</PrimaryButton>
          </div>
        </div>
      </section>

      <CtaBand
        title="Let's build what you need"
        text="Tell us about your project, your school or your organisation. We will come back with how we can help."
        primary={{ label: 'Start a project', to: '/contact?topic=project' }}
        secondary={{ label: 'Try the school platform', onClick: openLiveDemo }}
        footnote={<>Looking for a school system of your own? <button type="button" onClick={() => navigate('/contact?topic=edition')} className="font-bold text-amber-300 hover:text-amber-200 underline underline-offset-4">Request a quote</button></>}
      />

      <PublicFooter />
    </div>
  );
};

export default CompanyHomePage;
