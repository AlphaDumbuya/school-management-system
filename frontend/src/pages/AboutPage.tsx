/**
 * AboutPage: /about. Who WiSkul is, what it believes, and where to find it.
 */
import React from 'react';
import { Mail, Phone, MapPin, HeartHandshake, Eye, Lock, WifiOff, Wallet, GraduationCap, Smartphone, Users, Globe, Layers } from 'lucide-react';
import PublicNavbar, { PublicFooter } from '@components/public';
import Reveal from '@components/public/company/Reveal';
import { CtaBand, DOT_PATTERN, NAVY_BAND, PageHero, PrimaryButton, SectionHead, GhostButton } from '@components/public/company/ui';
import { PLATFORM_SUPPORT, platformSupportTel } from '@config/platform.config';
import { COMPANY, TECH_STACK } from '@config/company.config';
import { Photo } from '@components/public/company/photos';
import usePageMeta from '@hooks/usePageMeta';

const VALUES = [
  { icon: HeartHandshake, title: 'Practical first', text: 'We build what a school office, a classroom and a parent actually need, and leave out what looks clever but does not help.' },
  { icon: Eye, title: 'Honest about the product', text: 'The screens we show are real, with invented data. We do not promise what the software cannot do today.' },
  { icon: Lock, title: 'Respect for school data', text: 'Children\u2019s records are handled with care: separate by school, protected by role, and logged when they change.' },
  { icon: WifiOff, title: 'Built for real conditions', text: 'Connections drop and phones are shared. The software is designed to keep working and to be light enough to use.' },
];

const LOCAL = [
  { icon: Wallet, text: 'Fees in leones, collected by mobile money and card through Monime' },
  { icon: GraduationCap, text: 'Sierra Leone report cards and the local A to F grading scale' },
  { icon: WifiOff, text: 'Offline attendance and results for teachers, synced when they reconnect' },
  { icon: Smartphone, text: 'An Android app and a web app for the phones families already have' },
];

export const AboutPage: React.FC = () => {
  usePageMeta(
    'About | WiSkul',
    'WiSkul is a technology company in Sierra Leone. A professional, dedicated team of developers in Sierra Leone and abroad builds websites, apps and business systems, and school software.',
    '/about',
  );

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-700 overflow-x-hidden font-sans antialiased">
      <PublicNavbar ctaText="Start Free Trial" />

      <PageHero
        eyebrow="About WiSkul"
        title={<>A Sierra Leone company, <span className="co-gradient-text">with a team that reaches further.</span></>}
        text="WiSkul is built by a professional, dedicated team of developers working in Sierra Leone and abroad, making software that works for the people who use it."
      >
        <PrimaryButton to="/products">Our products</PrimaryButton>
        <GhostButton to="/contact">Contact us</GhostButton>
      </PageHero>

      {/* Mission */}
      <section className="px-6 sm:px-10 py-20 sm:py-24">
        <Reveal>
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#1d4ed8] mb-4">Our mission</p>
            <p className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 leading-snug">
              To give businesses, schools and organisations in Sierra Leone software that is as good as any in the world, and simple enough for everyone to use.
            </p>
          </div>
        </Reveal>
      </section>

      {/* Story */}
      <section className="px-6 sm:px-10 pb-20 sm:pb-24">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <Reveal>
            <div>
              <SectionHead align="left" eyebrow="Our story" title="From registers and spreadsheets to one system" />
              <div className="space-y-4 text-slate-600 leading-relaxed">
                <p>
                  WiSkul started with a simple aim: replace paper registers, scattered spreadsheets and phone calls with software
                  that a whole organisation can share. Our first product, a school management system, is now in daily use.
                </p>
                <p>
                  Schools asked for more. They wanted their own name, logo and app, and a system that was theirs. So we offer that
                  software two ways: on the WiSkul Platform, or as a School Edition made for one school and owned by it.
                </p>
                <p>
                  The same team now builds websites, online stores, mobile apps and custom business systems for other organisations
                  that need software built for how things work here.
                </p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="bg-white border border-[#e5e9f2] rounded-3xl p-8 shadow-sm">
              <h3 className="font-black text-slate-900 text-lg mb-5">Made for how schools here work</h3>
              <ul className="space-y-4">
                {LOCAL.map((l) => (
                  <li key={l.text} className="flex items-start gap-4">
                    <span className="w-11 h-11 rounded-xl bg-blue-50 text-[#1d4ed8] flex items-center justify-center flex-shrink-0"><l.icon size={20} aria-hidden="true" /></span>
                    <span className="text-sm text-slate-600 leading-relaxed pt-1.5">{l.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Team */}
      <section className="px-6 sm:px-10 pb-20 sm:pb-24">
        <div className="max-w-[1400px] mx-auto">
          <SectionHead
            eyebrow="Our team"
            title="Professional, dedicated, and spread across borders"
            subtitle="WiSkul is built by developers who work from Sierra Leone and from abroad, as one team."
          />
          <Photo slot="about-team" alt="The WiSkul team at work" className="w-full rounded-3xl shadow-xl mb-10 object-cover aspect-[2/1]" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: MapPin, photo: 'about-local' as const, title: 'In Sierra Leone', text: 'Developers on the ground who know how schools and businesses here work, from patchy connections to mobile money, and who can meet you in person.' },
              { icon: Globe, photo: 'about-abroad' as const, title: 'Beyond Sierra Leone', text: 'Developers abroad who add engineering depth and capacity, so we can take on more and build to a high standard.' },
              { icon: Layers, photo: undefined, title: 'One team, one standard', text: 'The same tools, the same way of working and the same care for the details, wherever each person sits.' },
            ].map((t, i) => (
              <Reveal key={t.title} delay={i * 100}>
                <div className="co-lift h-full bg-white border border-[#e5e9f2] rounded-3xl p-8 shadow-sm">
                  {t.photo && <Photo slot={t.photo} alt={t.title} className="w-full rounded-2xl mb-6 object-cover aspect-[16/10]" />}
                  <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1d4ed8] to-[#1a2b6b] text-white flex items-center justify-center shadow-lg mb-5">
                    <t.icon size={26} aria-hidden="true" />
                  </span>
                  <h3 className="text-lg font-black text-slate-900 mb-2">{t.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{t.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-slate-400 flex items-center justify-center gap-2"><Users size={14} aria-hidden="true" /> The people behind WiSkul work for clients large and small, with the same commitment.</p>
        </div>
      </section>

      {/* Values */}
      <section className={`relative px-6 sm:px-10 py-20 sm:py-28 overflow-hidden ${NAVY_BAND}`}>
        <div className="absolute inset-0 opacity-[0.1] pointer-events-none" style={DOT_PATTERN} />
        <div className="relative max-w-[1400px] mx-auto">
          <SectionHead light eyebrow="What we stand for" title="How we work" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={(i % 2) * 100}>
                <div className="flex gap-5 bg-white/[0.06] border border-white/10 rounded-2xl p-7 backdrop-blur-sm h-full">
                  <span className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/30"><v.icon size={24} aria-hidden="true" /></span>
                  <div>
                    <h3 className="font-bold text-white text-lg mb-1.5">{v.title}</h3>
                    <p className="text-blue-100/80 text-sm leading-relaxed">{v.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Technology + contact */}
      <section className="px-6 sm:px-10 py-20 sm:py-28">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Reveal>
            <div className="h-full bg-white border border-[#e5e9f2] rounded-3xl p-8 shadow-sm">
              <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#1d4ed8] mb-2">Technology</p>
              <h3 className="text-2xl font-black text-slate-900">Modern, proven tools</h3>
              <p className="text-sm text-slate-500 leading-relaxed mt-3">
                Our products are built with widely used, proven technology, and the data they hold is backed up.
              </p>
              <div className="flex flex-wrap gap-2.5 mt-6">
                {TECH_STACK.map((t) => (
                  <span key={t} className="text-xs font-semibold text-[#1a2b6b] bg-blue-50 border border-blue-100 rounded-full px-3.5 py-1.5">{t}</span>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="h-full bg-white border border-[#e5e9f2] rounded-3xl p-8 shadow-sm">
              <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#1d4ed8] mb-2">Find us</p>
              <h3 className="text-2xl font-black text-slate-900">{COMPANY.name}</h3>
              <ul className="mt-5 space-y-4 text-sm">
                <li className="flex items-start gap-3"><MapPin size={18} className="text-emerald-600 mt-0.5 flex-shrink-0" aria-hidden="true" /><span className="text-slate-600">{PLATFORM_SUPPORT.address}</span></li>
                <li className="flex items-start gap-3"><Phone size={18} className="text-amber-600 mt-0.5 flex-shrink-0" aria-hidden="true" /><a href={platformSupportTel()} className="text-slate-600 hover:text-[#1d4ed8]">{PLATFORM_SUPPORT.phone}</a></li>
                <li className="flex items-start gap-3"><Mail size={18} className="text-[#1d4ed8] mt-0.5 flex-shrink-0" aria-hidden="true" /><a href={`mailto:${PLATFORM_SUPPORT.email}`} className="text-slate-600 hover:text-[#1d4ed8]">{PLATFORM_SUPPORT.email}</a></li>
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      <CtaBand
        title="Work with us"
        text="Whether you are a school, a partner or a future developer, we would like to hear from you."
        primary={{ label: 'Contact us', to: '/contact' }}
        secondary={{ label: 'Our services', to: '/services' }}
      />
      <PublicFooter />
    </div>
  );
};

export default AboutPage;
