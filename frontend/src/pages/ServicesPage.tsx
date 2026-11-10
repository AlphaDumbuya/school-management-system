/**
 * ServicesPage: /services. What WiSkul does besides selling the software, plus the Developer Programme.
 */
import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Palette, Database, Users, LifeBuoy, GraduationCap, Check, Code2, Sparkles } from 'lucide-react';
import PublicNavbar, { PublicFooter } from '@components/public';
import Reveal from '@components/public/company/Reveal';
import { CtaBand, DOT_PATTERN, GhostButton, NAVY_BAND, PageHero, PrimaryButton, SectionHead } from '@components/public/company/ui';
import { SERVICES_CATALOG } from '@components/public/company/servicesCatalog';
import { Photo, usePhoto } from '@components/public/company/photos';
import usePageMeta from '@hooks/usePageMeta';

const SERVICES = [
  {
    icon: Palette,
    title: 'School Editions',
    text: 'A complete system made in your school\u2019s name, delivered and set up for you.',
    points: ['Your name, logo, colours, address and app', 'Your classes, subjects and fee structures', 'Your own database and deployment'],
    to: '/editions',
    cta: 'About School Editions',
  },
  {
    icon: Database,
    title: 'Setup and data migration',
    text: 'We bring the records you already keep into the system, so you do not start from zero.',
    points: ['Students, guardians, staff and classes imported from your lists', 'Checked with you before go-live', 'Houses, subjects and fee structures configured'],
  },
  {
    icon: Users,
    title: 'Training and onboarding',
    text: 'We show your people how to use it, in the roles they will actually have.',
    points: ['Principal and office staff', 'Teachers: attendance and results, including offline', 'Accountants, parents and pupils'],
  },
  {
    icon: LifeBuoy,
    title: 'Support',
    text: 'A team that knows the software answers your questions and fixes problems.',
    points: ['Email and phone support', 'Help guides inside the app', 'Changes scoped and agreed with you first'],
  },
];

const PHASES = [
  { tag: 'Weeks 1 to 9', title: 'Core web skills', text: 'HTML, CSS and JavaScript, taught in depth, with a project at the end.' },
  { tag: 'Weeks 10 to 13', title: 'Full-stack basics', text: 'Node and APIs, databases, React, and putting an app online.' },
  { tag: 'Weeks 14 to 16', title: 'AI in web development', text: 'Using AI assistants well, checking what they write, and a final project.' },
];

export const ServicesPage: React.FC = () => {
  const navigate = useNavigate();
  const heroPhoto = usePhoto('services-hero');
  const { hash } = useLocation();
  // The router does not scroll to #sections by itself (the footer links to #training).
  useEffect(() => {
    if (!hash) { window.scrollTo(0, 0); return; }
    const t = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    return () => window.clearTimeout(t);
  }, [hash]);
  usePageMeta(
    'Services | WiSkul',
    'Websites, web apps, online stores, mobile apps, custom business software, payments and support from a professional team in Sierra Leone and abroad, plus School Editions and the Developer Programme.',
    '/services',
  );

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-700 overflow-x-hidden font-sans antialiased">
      <PublicNavbar ctaText="Start Free Trial" />

      <PageHero
        eyebrow="Services"
        title={<>Software is the start. <span className="co-gradient-text">We see it through.</span></>}
        text="A professional team of developers in Sierra Leone and abroad designs, builds, launches and looks after the software your organisation runs on."
        aside={heroPhoto ? (
          <img src={heroPhoto} alt="WiSkul developers at work" width={900} height={700} className="co-pop w-full max-w-[520px] rounded-3xl border border-white/20 shadow-2xl object-cover aspect-[4/3]" />
        ) : undefined}
      >
        <PrimaryButton to="/contact?topic=project">Start a project</PrimaryButton>
        <GhostButton to="/editions">See School Editions</GhostButton>
      </PageHero>

      {/* What we build for any organisation */}
      <section className="px-6 sm:px-10 py-20 sm:py-28">
        <div className="max-w-[1400px] mx-auto">
          <SectionHead
            eyebrow="For every organisation"
            title="What we build"
            subtitle="Businesses, churches, NGOs, clinics, schools and institutions all need software that works here. This is how we help."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SERVICES_CATALOG.map((s, i) => (
              <Reveal key={s.id} delay={(i % 2) * 100}>
                <div className="co-lift h-full bg-white border border-[#e5e9f2] rounded-3xl p-8 shadow-sm flex flex-col">
                  <span className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${s.tint} text-white flex items-center justify-center shadow-lg mb-5`}>
                    <s.icon size={26} aria-hidden="true" />
                  </span>
                  <h3 className="text-xl font-black text-slate-900">{s.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mt-2">{s.text}</p>
                  <ul className="mt-5 space-y-2.5 flex-1">
                    {s.points.map((p) => (
                      <li key={p} className="flex items-start gap-2.5 text-sm text-slate-600">
                        <span className="mt-0.5 w-5 h-5 rounded-full bg-blue-100 text-[#1d4ed8] flex items-center justify-center flex-shrink-0"><Check size={12} strokeWidth={3} /></span>
                        {p}
                      </li>
                    ))}
                  </ul>
                  <button type="button" onClick={() => navigate('/contact?topic=project')} className="mt-6 self-start text-[#1d4ed8] hover:text-[#1e40af] font-bold text-sm">
                    Discuss this &rarr;
                  </button>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 sm:px-10 py-20 sm:py-28 bg-white border-y border-[#e5e9f2]">
        <div className="max-w-[1400px] mx-auto">
          <SectionHead eyebrow="For schools" title="And everything a school needs" subtitle="Our school software comes with the people to set it up, move your data and train your team." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SERVICES.map((s, i) => (
              <Reveal key={s.title} delay={(i % 2) * 100}>
                <div className="co-lift h-full bg-white border border-[#e5e9f2] rounded-3xl p-8 shadow-sm flex flex-col">
                  <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1d4ed8] to-[#1a2b6b] text-white flex items-center justify-center shadow-lg mb-5">
                    <s.icon size={26} aria-hidden="true" />
                  </span>
                  <h3 className="text-xl font-black text-slate-900">{s.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mt-2">{s.text}</p>
                  <ul className="mt-5 space-y-2.5 flex-1">
                    {s.points.map((p) => (
                      <li key={p} className="flex items-start gap-2.5 text-sm text-slate-600">
                        <span className="mt-0.5 w-5 h-5 rounded-full bg-blue-100 text-[#1d4ed8] flex items-center justify-center flex-shrink-0"><Check size={12} strokeWidth={3} /></span>
                        {p}
                      </li>
                    ))}
                  </ul>
                  {s.to && (
                    <button type="button" onClick={() => navigate(s.to!)} className="mt-6 self-start text-[#1d4ed8] hover:text-[#1e40af] font-bold text-sm">
                      {s.cta} &rarr;
                    </button>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Developer Programme */}
      <section id="training" className={`relative px-6 sm:px-10 py-20 sm:py-28 overflow-hidden scroll-mt-16 ${NAVY_BAND}`}>
        <div className="absolute inset-0 opacity-[0.1] pointer-events-none" style={DOT_PATTERN} />
        <div className="co-drift absolute top-[-10%] right-[-6%] w-[480px] h-[480px] rounded-full bg-violet-500/25 blur-[120px] pointer-events-none" />
        <div className="relative max-w-[1400px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-start">
            <div className="lg:col-span-2">
              <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-amber-300 bg-white/10 border border-white/20 rounded-full px-3.5 py-1.5 mb-5">
                <GraduationCap size={14} aria-hidden="true" /> Training
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">WiSkul Developer Programme</h2>
              <div className="w-12 h-1 bg-[#f59e0b] rounded-full mt-4 mb-5" />
              <p className="text-blue-100/85 leading-relaxed">
                A 16-week, practice-first programme for people who want to build software. Every week brings one short pack:
                a few lines of idea, a worked example, and an exercise after every topic. You finish with real projects in your own GitHub.
              </p>
              <ul className="mt-6 space-y-3">
                {['One pack a week, under four months in all', 'An exercise after every topic', 'Git and GitHub from day one', 'AI taught as a tool you check, not a shortcut'].map((t) => (
                  <li key={t} className="flex items-start gap-3 text-sm text-blue-50">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-amber-400 text-[#1a2b6b] flex items-center justify-center flex-shrink-0"><Check size={12} strokeWidth={3} /></span>
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-8"><PrimaryButton to="/contact?topic=training">Register your interest</PrimaryButton></div>
              <Photo slot="training" alt="Learners building software together" className="mt-8 w-full rounded-2xl border border-white/15 shadow-xl object-cover aspect-[4/3]" />
            </div>

            <div className="lg:col-span-3 space-y-4">
              {PHASES.map((p, i) => (
                <Reveal key={p.title} delay={i * 100}>
                  <div className="flex gap-5 bg-white/[0.07] border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                    <span className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 font-black text-lg shadow-lg shadow-amber-500/30">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <div>
                      <p className="text-xs font-bold tracking-widest uppercase text-amber-300">{p.tag}</p>
                      <h3 className="text-white font-bold text-lg mt-0.5">{p.title}</h3>
                      <p className="text-blue-100/80 text-sm leading-relaxed mt-1">{p.text}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
              <div className="flex flex-wrap items-center gap-2.5 pt-2">
                {['HTML', 'CSS', 'JavaScript', 'Node.js', 'SQL', 'React', 'Git'].map((t) => (
                  <span key={t} className="text-xs font-semibold text-white/90 bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5 inline-flex items-center gap-1.5">
                    <Code2 size={12} aria-hidden="true" /> {t}
                  </span>
                ))}
                <span className="text-xs font-semibold text-amber-200 bg-amber-400/10 border border-amber-300/30 rounded-full px-3.5 py-1.5 inline-flex items-center gap-1.5">
                  <Sparkles size={12} aria-hidden="true" /> AI assistants
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CtaBand
        title="Tell us what you need"
        text="A short message is enough. We will reply within one business day with the next step."
        primary={{ label: 'Start a project', to: '/contact?topic=project' }}
        secondary={{ label: 'Request a School Edition quote', to: '/contact?topic=edition' }}
      />
      <PublicFooter />
    </div>
  );
};

export default ServicesPage;
