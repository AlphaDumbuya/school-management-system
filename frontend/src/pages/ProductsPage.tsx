/**
 * ProductsPage: /products. The two ways to get WiSkul software, side by side.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Minus, ArrowRight, Building2, Palette } from 'lucide-react';
import PublicNavbar, { PublicFooter } from '@components/public';
import Reveal from '@components/public/company/Reveal';
import PhoneFrame from '@components/public/company/PhoneFrame';
import { CtaBand, GhostButton, PageHero, PrimaryButton, SectionHead } from '@components/public/company/ui';
import { EDITION_CLIENTS, showcaseAlt, showcaseSrc } from '@config/company.config';
import AppDownloadButtons from '@components/public/AppDownloadButtons';
import { openLiveDemo } from '@components/public/LiveDemoModal';
import usePageMeta from '@hooks/usePageMeta';

const COMPARE: { row: string; platform: string; edition: string }[] = [
  { row: 'How you pay', platform: 'A subscription plan, with a free trial to start', edition: 'A one-time purchase' },
  { row: 'Look and name', platform: 'Your school\u2019s name, logo and colours inside WiSkul', edition: 'Entirely yours: no WiSkul branding anywhere' },
  { row: 'Web address', platform: 'wiskulsl.com', edition: 'Your own address' },
  { row: 'Mobile app', platform: 'The WiSkul Android app and web app', edition: 'Your own Android app, with your icon and name' },
  { row: 'Your data', platform: 'Kept separate from every other school on the platform', edition: 'Your own database and deployment' },
  { row: 'Fee payments', platform: 'Online payment through Monime, after your school is verified', edition: 'Settle straight into your school\u2019s own Monime account' },
  { row: 'Limits', platform: 'Set by your plan', edition: 'No student, staff or storage limits' },
  { row: 'Getting started', platform: 'Register and start the same day', edition: 'We set it up with you' },
];

export const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  usePageMeta(
    'Products | WiSkul',
    'Two ways to run your school on WiSkul: the WiSkul Platform on a subscription, or a School Edition that you buy once and own.',
    '/products',
  );
  const [aga, amie] = EDITION_CLIENTS;

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-700 overflow-x-hidden font-sans antialiased">
      <PublicNavbar ctaText="Start Free Trial" />

      <PageHero
        eyebrow="Products"
        title={<>One engine. <span className="co-gradient-text">Two ways</span> to own it.</>}
        text="The WiSkul Platform gets a school running today. A School Edition is the same software made entirely in your school's name."
      >
        <PrimaryButton to="/wiskul">Explore the platform</PrimaryButton>
        <GhostButton to="/editions">See School Editions</GhostButton>
      </PageHero>

      {/* Platform */}
      <section className="px-6 sm:px-10 py-20 sm:py-24">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#1d4ed8] bg-blue-50 border border-blue-100 rounded-full px-3.5 py-1.5 mb-5">
                <Building2 size={14} aria-hidden="true" /> Subscription
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">WiSkul Platform</h2>
              <div className="w-12 h-1 bg-[#f59e0b] rounded-full mt-4 mb-5" />
              <p className="text-slate-500 leading-relaxed">
                A complete school system you can start in minutes. Register your school, add your classes, staff and students, and
                begin taking attendance, grading and collecting fees. Choose a plan when you are ready.
              </p>
              <ul className="mt-6 space-y-3">
                {['Free trial, no card needed', 'Portals for principals, teachers, accountants, parents and pupils', 'Android app and installable web app', 'Always up to date, with nothing to install or host'].map((t) => (
                  <li key={t} className="flex items-start gap-3 text-sm text-slate-600">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-blue-100 text-[#1d4ed8] flex items-center justify-center flex-shrink-0"><Check size={12} strokeWidth={3} /></span>
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <PrimaryButton to="/register">Start a free trial</PrimaryButton>
                <GhostButton dark onClick={openLiveDemo}>Get a live demo</GhostButton>
                <GhostButton dark to="/features">Features</GhostButton>
                <GhostButton dark to="/pricing">Pricing</GhostButton>
              </div>
              <div className="mt-6 inline-block rounded-xl bg-[#1a2b6b] p-3"><AppDownloadButtons variant="hero" /></div>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="relative flex justify-center">
              <div className="absolute -inset-8 rounded-full bg-gradient-to-br from-[#1d4ed8]/20 to-transparent blur-[60px] pointer-events-none" />
              <img
                src="/hero.png"
                alt="The WiSkul platform: student, teacher, attendance, class, fee and report data in one secure system"
                width={1536}
                height={1024}
                loading="lazy"
                className="relative w-full max-w-[520px] h-auto rounded-3xl border border-white shadow-2xl"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Edition */}
      <section className="px-6 sm:px-10 py-20 sm:py-24 bg-white border-y border-[#e5e9f2] overflow-hidden">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <Reveal className="order-2 lg:order-1">
            <div className="relative flex justify-center items-end gap-4 sm:gap-6">
              <div className="absolute -inset-8 rounded-full bg-gradient-to-br from-amber-400/25 to-transparent blur-[60px] pointer-events-none" />
              <div className="co-float w-[44%] max-w-[210px] relative"><PhoneFrame src={showcaseSrc('aga', 'parent')} alt={showcaseAlt(aga, 'parent')} className="!w-full" /></div>
              <div className="co-float-slow w-[44%] max-w-[210px] relative mb-10"><PhoneFrame src={showcaseSrc('amie', 'staff')} alt={showcaseAlt(amie, 'staff')} className="!w-full" /></div>
            </div>
          </Reveal>
          <Reveal className="order-1 lg:order-2" delay={120}>
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3.5 py-1.5 mb-5">
                <Palette size={14} aria-hidden="true" /> One-time purchase
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">WiSkul School Edition</h2>
              <div className="w-12 h-1 bg-[#f59e0b] rounded-full mt-4 mb-5" />
              <p className="text-slate-500 leading-relaxed">
                A school management system that belongs to your school alone. Your name, your logo, your colours, your web address,
                your app and your database, with no WiSkul branding and no subscription.
              </p>
              <ul className="mt-6 space-y-3">
                {['Made in your school\u2019s identity, end to end', 'Your own database and deployment', 'Fees settle into your school\u2019s own account', 'Already running in two schools in Sierra Leone'].map((t) => (
                  <li key={t} className="flex items-start gap-3 text-sm text-slate-600">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0"><Check size={12} strokeWidth={3} /></span>
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <PrimaryButton to="/contact?topic=edition">Request a quote</PrimaryButton>
                <GhostButton dark to="/editions">Learn more</GhostButton>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Comparison */}
      <section className="px-6 sm:px-10 py-20 sm:py-24">
        <div className="max-w-5xl mx-auto">
          <SectionHead eyebrow="Compare" title="Which one is right for your school?" subtitle="Both run the same software. The difference is who owns it and how it looks." />
          <Reveal>
            <div className="overflow-x-auto rounded-2xl border border-[#e5e9f2] bg-white shadow-sm">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left">
                    <th className="p-4 w-[22%]" />
                    <th className="p-4 w-[39%] bg-blue-50 text-[#1d4ed8] font-black">WiSkul Platform</th>
                    <th className="p-4 w-[39%] bg-amber-50 text-amber-700 font-black">School Edition</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((r) => (
                    <tr key={r.row} className="border-t border-[#eef1f7] align-top">
                      <th scope="row" className="p-4 text-left font-bold text-slate-800">{r.row}</th>
                      <td className="p-4 text-slate-600">{r.platform}</td>
                      <td className="p-4 text-slate-600">{r.edition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
          <p className="mt-4 text-xs text-slate-400 flex items-center gap-1.5"><Minus size={12} aria-hidden="true" /> Not sure? <button type="button" onClick={() => navigate('/contact')} className="text-[#1d4ed8] font-bold hover:underline inline-flex items-center gap-1">Talk to us <ArrowRight size={12} /></button></p>
        </div>
      </section>

      <CtaBand
        title="Start small, or make it your own"
        text="Begin on the platform today, or tell us about the system you want and we will build it with you."
        primary={{ label: 'Start a free trial', to: '/register' }}
        secondary={{ label: 'Get a live demo', onClick: openLiveDemo }}
        footnote={<>Want a School Edition? <button type="button" onClick={() => navigate('/contact?topic=edition')} className="font-bold text-amber-300 hover:text-amber-200 underline underline-offset-4">Request a quote</button></>}
      />
      <PublicFooter />
    </div>
  );
};

export default ProductsPage;
