/**
 * SchoolEditionPage: /editions. A school buys its own branded system once.
 */
import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Palette, Globe, Smartphone, Database, Wallet, Infinity as InfinityIcon, Users, Rocket, Wrench, ChevronDown, ShieldCheck, Check,
} from 'lucide-react';
import PublicNavbar, { PublicFooter } from '@components/public';
import Reveal from '@components/public/company/Reveal';
import PhoneFrame from '@components/public/company/PhoneFrame';
import SchoolShowcase from '@components/public/company/SchoolShowcase';
import { CtaBand, GhostButton, NAVY_BAND, PageHero, PrimaryButton, SectionHead } from '@components/public/company/ui';
import { EDITION_CLIENTS, EDITION_INCLUDES, showcaseAlt, showcaseSrc } from '@config/company.config';
import { openLiveDemo } from '@components/public/LiveDemoModal';
import usePageMeta from '@hooks/usePageMeta';

const INCLUDE_ICONS = [Palette, Globe, Smartphone, Database, Wallet, InfinityIcon];

const TIMELINE = [
  { icon: Users, title: 'Discovery', text: 'We learn how your school runs: your classes, subjects, fees, houses and the reports you give parents.' },
  { icon: Palette, title: 'Branding and setup', text: 'Your name, logo, colours, address and app icon go in. Your classes and subjects are set up as you teach them.' },
  { icon: Database, title: 'Your data comes across', text: 'Students, staff and classes are imported from the lists you already keep, and checked with you.' },
  { icon: Rocket, title: 'Launch and training', text: 'We show your principal, teachers and office staff how it works, then go live for parents and pupils.' },
  { icon: Wrench, title: 'Support afterwards', text: 'You have a team who knows your system when you have a question or need a change.' },
];

const FAQ = [
  { q: 'Is it really a one-time purchase?', a: 'Yes. A School Edition is bought once. You are not on a WiSkul plan and there is no trial that ends. Your quote explains what is included and what running costs, such as hosting and messaging services, look like.' },
  { q: 'Will WiSkul\u2019s name appear anywhere?', a: 'No. Your school\u2019s name and logo appear on every screen, email, receipt, report card and ID card. Your parents and staff see your school, not us.' },
  { q: 'Can you use the records we already have?', a: 'Yes. We import your students, staff and classes from the lists you keep, such as spreadsheets, and check the result with you before you go live.' },
  { q: 'Will it work on our phones?', a: 'Yes. It is an Android app with your icon and name, and a web app that installs on iPhones and computers. Teachers can take attendance and enter results without internet and it syncs later.' },
  { q: 'Who receives the school fees?', a: 'You do. Online payments by mobile money and card settle into your school\u2019s own Monime account.' },
  { q: 'What if we want a change later?', a: 'Tell us. We look at what you need, explain what it involves and agree it with you before we start.' },
];

export const SchoolEditionPage: React.FC = () => {
  const showcaseRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  usePageMeta(
    'School Edition: your own school system | WiSkul',
    'A School Edition is school management software made entirely in your school\u2019s name: your logo, colours, address, app and database. Bought once, no subscription.',
    '/editions',
  );
  const [aga, amie] = EDITION_CLIENTS;

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-700 overflow-x-hidden font-sans antialiased">
      <PublicNavbar ctaText="Request a quote" ctaAction="custom" onCtaClick={() => navigate('/contact?topic=edition')} />

      <PageHero
        eyebrow="WiSkul School Edition"
        title={<>Your school. Your name. <span className="co-gradient-text">Your system.</span></>}
        text="School management software made entirely for one school: your logo, colours, web address, app and database. You buy it once. It is yours."
        aside={
          <div className="relative h-[430px] sm:h-[500px] w-full max-w-[460px]">
            <div className="absolute -inset-6 bg-gradient-to-br from-amber-400/25 via-[#1d4ed8]/25 to-transparent rounded-full blur-[70px] pointer-events-none" />
            <div className="absolute left-[2%] top-[8%] w-[48%] max-w-[220px]">
              <div className="co-float" style={{ '--co-rot': '-5deg' } as React.CSSProperties}>
                <PhoneFrame src={showcaseSrc('aga', 'staff')} alt={showcaseAlt(aga, 'staff')} eager className="!w-full" />
              </div>
            </div>
            <div className="absolute right-[2%] top-[22%] w-[48%] max-w-[220px] z-10">
              <div className="co-float-slow" style={{ '--co-rot': '5deg' } as React.CSSProperties}>
                <PhoneFrame src={showcaseSrc('amie', 'teacher')} alt={showcaseAlt(amie, 'teacher')} eager className="!w-full" />
              </div>
            </div>
          </div>
        }
      >
        <PrimaryButton to="/contact?topic=edition">Request a quote</PrimaryButton>
        <GhostButton onClick={() => showcaseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          See it in action
        </GhostButton>
        <GhostButton onClick={openLiveDemo}>Try the live demo</GhostButton>
      </PageHero>

      {/* What is yours */}
      <section className="px-6 sm:px-10 py-20 sm:py-28">
        <div className="max-w-[1400px] mx-auto">
          <SectionHead eyebrow="What you get" title="Everything in it is yours" subtitle="Not a login on someone else's platform. A system made in your school's identity." />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {EDITION_INCLUDES.map((item, i) => {
              const Icon = INCLUDE_ICONS[i % INCLUDE_ICONS.length];
              return (
                <Reveal key={item.title} delay={(i % 3) * 90}>
                  <div className="co-lift h-full bg-white border border-[#e5e9f2] rounded-2xl p-7 shadow-sm">
                    <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#f59e0b] to-[#b45309] text-white flex items-center justify-center shadow-lg shadow-amber-500/25 mb-5">
                      <Icon size={24} aria-hidden="true" />
                    </span>
                    <h3 className="font-bold text-lg text-slate-900 mb-2">{item.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{item.text}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Showcase */}
      <section ref={showcaseRef} className="px-6 sm:px-10 py-20 sm:py-28 bg-white border-y border-[#e5e9f2] overflow-hidden scroll-mt-16">
        <div className="max-w-[1400px] mx-auto">
          <Reveal><SchoolShowcase /></Reveal>
        </div>
      </section>

      {/* Delivered for */}
      <section className="px-6 sm:px-10 py-20 sm:py-28">
        <div className="max-w-5xl mx-auto">
          <SectionHead eyebrow="Delivered" title="Schools already running their own edition" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {EDITION_CLIENTS.map((s, i) => (
              <Reveal key={s.id} delay={i * 120}>
                <div className="co-lift bg-white border border-[#e5e9f2] rounded-3xl overflow-hidden shadow-sm">
                  <div className="h-2" style={{ background: s.colour }} />
                  <div className="p-7 flex items-center gap-5">
                    <img src={s.logo} alt={`${s.name} logo`} width={72} height={72} className="w-[4.5rem] h-[4.5rem] rounded-2xl object-contain border border-slate-100 bg-white p-1" loading="lazy" />
                    <div>
                      <h3 className="text-xl font-black text-slate-900">{s.name}</h3>
                      <p className="text-sm text-slate-500 mt-1 leading-relaxed">A full School Edition in daily use by its staff, parents and pupils.</p>
                    </div>
                  </div>
                  <ul className="px-7 pb-7 space-y-2">
                    {['Its own name, logo and colours', 'Its own database and address', 'Its own Android app'].map((t) => (
                      <li key={t} className="flex items-center gap-2.5 text-sm text-slate-600">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: s.colour }}><Check size={12} strokeWidth={3} /></span>
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className={`relative px-6 sm:px-10 py-20 sm:py-28 overflow-hidden ${NAVY_BAND}`}>
        <div className="relative max-w-3xl mx-auto">
          <SectionHead light eyebrow="How it works" title="From first call to first login" />
          <ol className="relative border-l-2 border-white/15 ml-5 space-y-9">
            {TIMELINE.map((t, i) => (
              <li key={t.title} className="pl-10 relative">
                <Reveal delay={i * 70}>
                  <span className="absolute -left-[1.45rem] top-0 w-11 h-11 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30">
                    <t.icon size={20} aria-hidden="true" />
                  </span>
                  <h3 className="text-white font-bold text-lg">{i + 1}. {t.title}</h3>
                  <p className="text-blue-100/80 text-sm leading-relaxed mt-1.5">{t.text}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 sm:px-10 py-20 sm:py-28">
        <div className="max-w-3xl mx-auto">
          <SectionHead eyebrow="Questions" title="Good to know" />
          <div className="space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group bg-white border border-[#e5e9f2] rounded-2xl px-6 py-4 shadow-sm open:shadow-md">
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none font-bold text-slate-900">
                  {f.q}
                  <ChevronDown size={18} className="text-[#1d4ed8] transition-transform group-open:rotate-180 flex-shrink-0" aria-hidden="true" />
                </summary>
                <p className="text-sm text-slate-500 leading-relaxed mt-3">{f.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-6 text-xs text-slate-400 flex items-center gap-2"><ShieldCheck size={14} aria-hidden="true" /> The screens on this site are real, with invented names and figures.</p>
        </div>
      </section>

      <CtaBand
        title="Ready for a system with your name on it?"
        text="Tell us about your school and we will come back with how a School Edition would work for you, and a quote."
        primary={{ label: 'Request a quote', to: '/contact?topic=edition' }}
        secondary={{ label: 'Compare with the platform', to: '/products' }}
        photo="editions-cta"
      />
      <PublicFooter />
    </div>
  );
};

export default SchoolEditionPage;
