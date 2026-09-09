/**
 * PricingPage — /pricing
 * Light edu-SaaS theme (see docs/THEME_GUIDE.md). Shared navbar + footer.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, ArrowRight } from 'lucide-react';
import PublicNavbar, { PublicFooter } from '@components/public';

const NAVY_BAND = 'bg-gradient-to-br from-[#16235c] via-[#1a2b6b] to-[#20308a]';
const DOT_PATTERN: React.CSSProperties = {
  backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)',
  backgroundSize: '26px 26px',
};

const PLANS = [
  {
    id: 'freetong', name: 'Freetong', meaning: 'v1.0 Core — 100% Free', highlight: true, badge: 'FREE CORE',
    price: { monthly: 0, yearly: 0 }, accent: '#1d4ed8', students: 'Up to 250', staff: 'Up to 20',
    features: [
      'Isolated multi-tenant portal', 'Student directory & profiles', 'Admissions & onboarding',
      'Daily attendance & tracking', 'Classes, streams & subjects', 'Timetable builder',
      'Digital ID cards & batch printing', 'Teacher & staff directory', 'Assignments & exams',
      'Gradebook, results & report cards', 'Student promotions', 'Fees & online payments',
      'Student & parent portals',
    ],
    notIncluded: ['SMS & WhatsApp alerts (v2)', 'Staff HR & leave (v2)', 'Payroll (v2)'],
  },
  {
    id: 'combra', name: 'Combra', meaning: 'v2.0 Pro — HR & Payroll', highlight: false, badge: 'COMING v2',
    price: { monthly: 500, yearly: 5000 }, accent: '#f59e0b', students: 'Up to 1,000', staff: 'Up to 75',
    features: [
      'Everything in Freetong, plus:', 'Staff leave requests & HR approvals (v2)',
      'Financial expense & budget reports (v2)', 'Payroll & payslip generation (v2)',
    ],
    notIncluded: ['WhatsApp Business API (v3)', 'Custom API & white-label'],
  },
  {
    id: 'bintumani', name: 'Bintumani', meaning: 'v3.0 Enterprise — Unlimited', highlight: false, badge: 'ENTERPRISE',
    price: { monthly: 1200, yearly: 12000 }, accent: '#7c3aed', students: 'Unlimited', staff: 'Unlimited',
    features: [
      'Everything in Combra, plus:', 'Bulk SMS to parents (v3)', 'WhatsApp broadcasts (v3)',
      'Custom Excel & PDF exports (v3)', 'Dedicated onboarding specialist',
      'Priority WhatsApp & phone support', 'Multi-branch network support',
    ],
    notIncluded: [],
  },
];

export const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-700 overflow-x-hidden font-sans antialiased">
      <PublicNavbar ctaText="Register School Free" />

      {/* ═══ HERO (navy) ═══ */}
      <section className={`relative pt-28 sm:pt-36 pb-16 px-6 sm:px-10 text-center overflow-hidden ${NAVY_BAND}`}>
        <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={DOT_PATTERN} />
        <div className="relative z-10 max-w-3xl mx-auto">
          <span className="text-amber-300 text-xs font-bold tracking-[0.3em] uppercase">Simple Pricing</span>
          <h1 className="text-4xl sm:text-5xl font-black mt-3 mb-5 text-white">Choose your <span className="text-amber-400">plan</span></h1>
          <p className="text-blue-100/90 text-sm sm:text-base max-w-xl mx-auto mb-8">
            Start free and scale as you grow. All prices in New Leones (NLe).
          </p>
          <div className="inline-flex items-center bg-white/10 border border-white/20 rounded-full p-1">
            {(['monthly', 'yearly'] as const).map((b) => (
              <button key={b} onClick={() => setBilling(b)}
                className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${billing === b ? 'bg-[#f59e0b] text-white' : 'text-blue-100/80 hover:text-white'}`}>
                {b === 'monthly' ? 'Monthly' : <>Yearly <span className="text-[10px] ml-1 opacity-80">Save 17%</span></>}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING CARDS (light, overlapping) ═══ */}
      <section className="px-6 sm:px-10 -mt-8 relative z-20 pb-16">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {PLANS.map((plan) => (
            <div key={plan.id}
              className={`relative rounded-2xl bg-white flex flex-col shadow-sm border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                plan.highlight ? 'border-[#1d4ed8] ring-2 ring-[#1d4ed8]/20 shadow-lg' : 'border-[#e5e9f2]'
              }`}>
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="text-white text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-wider shadow" style={{ background: plan.accent }}>
                    {plan.badge}
                  </span>
                </div>
              )}
              <div className="p-7 sm:p-8 flex flex-col h-full">
                <div className="mb-6">
                  <h3 className="text-xl font-black text-slate-900 mb-1">{plan.name}</h3>
                  <p className="text-slate-400 text-[11px] italic">{plan.meaning}</p>
                </div>
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-slate-400 text-sm">NLe</span>
                    <span className="text-4xl font-black" style={{ color: plan.accent }}>{billing === 'monthly' ? plan.price.monthly : plan.price.yearly}</span>
                    <span className="text-slate-400 text-sm">/{billing === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                  {billing === 'yearly' && plan.price.monthly > 0 && (
                    <p className="text-emerald-600 text-[10px] font-bold mt-1">Save NLe {plan.price.monthly * 12 - plan.price.yearly} per year</p>
                  )}
                </div>
                <div className="flex gap-6 mb-6 pb-6 border-b border-[#eef1f7]">
                  <div><p className="text-xs text-slate-400">Students</p><p className="text-sm font-bold text-slate-900">{plan.students}</p></div>
                  <div><p className="text-xs text-slate-400">Staff</p><p className="text-sm font-bold text-slate-900">{plan.staff}</p></div>
                </div>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-xs">
                      <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${plan.accent}1a`, color: plan.accent }}><Check size={9} strokeWidth={3} /></span>
                      <span className="text-slate-700">{f}</span>
                    </li>
                  ))}
                  {plan.notIncluded.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-xs">
                      <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-slate-100 text-slate-400"><X size={9} strokeWidth={3} /></span>
                      <span className="text-slate-400 line-through">{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => (plan.id === 'freetong' ? navigate('/register') : navigate('/contact'))}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] ${
                    plan.highlight ? 'bg-[#f59e0b] hover:bg-[#d97706] text-white shadow-lg shadow-amber-500/25' : 'border-2 hover:bg-slate-50'
                  }`}
                  style={!plan.highlight ? { borderColor: `${plan.accent}55`, color: plan.accent } : {}}
                >
                  {plan.id === 'freetong' ? 'Start with Freetong' : plan.id === 'combra' ? 'Contact Sales' : 'Contact Sales'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ COMPARISON (white) ═══ */}
      <section className="px-6 sm:px-10 py-16 bg-white border-y border-[#e5e9f2]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Plan comparison</h2>
            <div className="w-12 h-1 bg-[#f59e0b] rounded-full mx-auto mt-3" />
          </div>
          <div className="overflow-x-auto rounded-2xl border border-[#e5e9f2]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#e5e9f2]">
                  <th className="text-left py-3 px-4 text-slate-500 font-bold text-xs uppercase tracking-wider whitespace-nowrap">Feature</th>
                  <th className="text-center py-3 px-4 text-[#1d4ed8] font-bold text-xs">Freetong</th>
                  <th className="text-center py-3 px-4 text-[#f59e0b] font-bold text-xs">Combra</th>
                  <th className="text-center py-3 px-4 text-[#7c3aed] font-bold text-xs">Bintumani</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef1f7]">
                {[
                  { feature: 'Students', freetong: '250', combra: '1,000', bintumani: 'Unlimited' },
                  { feature: 'Staff accounts', freetong: '20', combra: '75', bintumani: 'Unlimited' },
                  { feature: 'Student directory', freetong: '✓', combra: '✓', bintumani: '✓' },
                  { feature: 'Attendance tracking', freetong: '✓', combra: '✓ + alerts', bintumani: '✓ + alerts' },
                  { feature: 'Grades & report cards', freetong: '✓', combra: '✓', bintumani: '✓ + custom' },
                  { feature: 'Fees & online payments', freetong: '✓', combra: '✓', bintumani: '✓ + payroll' },
                  { feature: 'ID cards (bulk)', freetong: '✓', combra: '✓', bintumani: '✓' },
                  { feature: 'Events & calendar', freetong: '✓', combra: '✓', bintumani: '✓' },
                  { feature: 'SMS notifications', freetong: '—', combra: '200/mo', bintumani: 'Unlimited' },
                  { feature: 'WhatsApp', freetong: '—', combra: '—', bintumani: '✓' },
                  { feature: 'Staff HR & leave', freetong: '—', combra: '✓', bintumani: '✓' },
                  { feature: 'Multi-branch', freetong: '—', combra: '—', bintumani: '✓' },
                  { feature: 'API access', freetong: '—', combra: '—', bintumani: '✓' },
                  { feature: 'Support', freetong: 'Email', combra: 'Priority', bintumani: 'Dedicated + phone' },
                ].map((row) => (
                  <tr key={row.feature} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="py-3 px-4 text-slate-700 font-medium whitespace-nowrap">{row.feature}</td>
                    <td className="py-3 px-4 text-center text-slate-500">{row.freetong}</td>
                    <td className="py-3 px-4 text-center text-slate-600">{row.combra}</td>
                    <td className="py-3 px-4 text-center text-slate-900 font-medium">{row.bintumani}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═══ FAQ (tinted band) ═══ */}
      <section className="px-6 sm:px-10 py-20 bg-gradient-to-b from-[#eef2fb] to-[#f5f7fb]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[#1d4ed8] text-xs font-bold tracking-[0.2em] uppercase mb-2">Questions</p>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Frequently asked questions</h2>
            <div className="w-12 h-1 bg-[#f59e0b] rounded-full mx-auto mt-3" />
          </div>
          <div className="space-y-4">
            {[
              { q: 'Is the core plan really free?', a: 'Yes — the Freetong (v1.0) core is 100% free for schools, with no card required. Paid tiers add advanced HR, payroll and messaging features.' },
              { q: 'Can I upgrade later?', a: 'Absolutely. You can move from Freetong to Combra or Bintumani at any time — your data and settings carry over seamlessly.' },
              { q: 'How do I pay for paid tiers?', a: 'We accept mobile money, card, and bank transfer via Monime, plus cash at our office. Reach out to sales to get set up.' },
              { q: 'What if I reach my student limit?', a: "Your existing students and data are never removed — you keep full access to everyone already added. To enrol beyond your plan's limit, simply upgrade; we'll prompt you when you're close." },
              { q: 'Can I get a custom plan?', a: 'Yes — contact us for schools with special needs and we\'ll tailor a package to your budget and requirements.' },
              { q: 'Is my data safe?', a: 'Yes. Data is encrypted with 256-bit encryption, backed up regularly, and isolated per school (multi-tenant).' },
            ].map((faq) => (
              <div key={faq.q} className="bg-white border border-[#e5e9f2] rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <h4 className="text-sm font-bold text-slate-900 mb-2">{faq.q}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA (navy card) ═══ */}
      <section className="px-6 sm:px-10 py-16">
        <div className={`max-w-4xl mx-auto relative overflow-hidden rounded-[2rem] px-8 sm:px-14 py-14 text-center ${NAVY_BAND}`}>
          <div className="absolute inset-0 opacity-[0.1] pointer-events-none" style={DOT_PATTERN} />
          <div className="relative z-10">
            <h2 className="text-3xl font-black text-white mb-3">Still have questions?</h2>
            <p className="text-blue-100/80 text-sm mb-8 max-w-lg mx-auto">Our team is ready to help you choose the right plan for your school.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={() => navigate('/contact')} className="w-full sm:w-auto bg-[#f59e0b] hover:bg-[#d97706] text-white font-bold text-sm px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2">
                Contact Sales <ArrowRight size={16} />
              </button>
              <button onClick={() => navigate('/register')} className="w-full sm:w-auto border border-white/25 hover:border-white/50 text-white font-bold text-sm px-8 py-3.5 rounded-xl transition-all">
                Start Free
              </button>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};

export default PricingPage;
