/**
 * PricingPage — /pricing
 * Light edu-SaaS theme (see docs/THEME_GUIDE.md). Shared navbar + footer.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, ArrowRight, Loader2 } from 'lucide-react';
import PublicNavbar, { PublicFooter } from '@components/public';
import { usePublicPlans, isUnlimited, planAdds, PlanCatalogPayload, PlanFeatureDef } from '@services/planService';

const NAVY_BAND = 'bg-gradient-to-br from-[#16235c] via-[#1a2b6b] to-[#20308a]';
const DOT_PATTERN: React.CSSProperties = {
  backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)',
  backgroundSize: '26px 26px',
};

const ACCENTS: Record<string, string> = { freetong: '#1d4ed8', combra: '#f59e0b', bintumani: '#7c3aed' };
const ACCENT_FALLBACK = ['#1d4ed8', '#f59e0b', '#7c3aed'];

interface PlanCard {
  id: string; name: string; meaning: string; highlight: boolean; badge: string; accent: string;
  price: { monthly: number; yearly: number }; students: string; staff: string;
  features: string[]; notIncluded: string[];
}

const limitText = (n: number, unlimited: number) => (isUnlimited(n, unlimited) ? 'Unlimited' : `Up to ${Number(n).toLocaleString('en-US')}`);
const withSoon = (f: PlanFeatureDef) => (f.soon ? `${f.label} (coming soon)` : f.label);

/** Pricing cards from the live plan catalog (the same data billing uses). */
function buildCards(catalog: PlanCatalogPayload): PlanCard[] {
  const plans = catalog.plans;
  const top = plans[plans.length - 1];
  return plans.map((p, i) => {
    const prev = plans[i - 1];
    const core = catalog.features.filter((f) => f.core).map((f) => f.label);
    const features = i === 0
      ? [...core, ...catalog.features.filter((f) => !f.core && p.features[f.key]).map(withSoon)]
      : [`Everything in ${prev.name}, plus:`, ...planAdds(p, prev, catalog).map(withSoon)];
    const notIncluded = top && top.id !== p.id
      ? catalog.features.filter((f) => !f.core && !f.soon && !p.features[f.key] && top.features[f.key]).map((f) => f.label).slice(0, 4)
      : [];
    return {
      id: p.id, name: p.name, meaning: p.tagline, highlight: p.featured, badge: p.badge,
      accent: ACCENTS[p.id] || ACCENT_FALLBACK[i % ACCENT_FALLBACK.length],
      price: { monthly: p.monthly_price, yearly: p.yearly_price },
      students: limitText(p.max_students, catalog.unlimited), staff: limitText(p.max_staff, catalog.unlimited),
      features: [...features, ...(p.highlights || [])], notIncluded,
    };
  });
}

export const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const { data: catalog, isLoading, isError } = usePublicPlans();
  const PLANS = useMemo(() => (catalog ? buildCards(catalog) : []), [catalog]);
  // Best yearly saving across plans, for the toggle label.
  const yearlySave = useMemo(() => Math.max(0, ...PLANS.filter((p) => p.price.monthly > 0)
    .map((p) => Math.round((1 - p.price.yearly / (p.price.monthly * 12)) * 100))), [PLANS]);

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
                {b === 'monthly' ? 'Monthly' : <>Yearly {yearlySave > 0 && <span className="text-[10px] ml-1 opacity-80">Save up to {yearlySave}%</span>}</>}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING CARDS (light, overlapping) ═══ */}
      <section className="px-6 sm:px-10 -mt-8 relative z-20 pb-16">
        {isLoading && (
          <div className="max-w-6xl mx-auto rounded-2xl bg-white border border-[#e5e9f2] p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2" role="status">
            <Loader2 className="animate-spin" size={16} aria-hidden="true" /> Loading plans…
          </div>
        )}
        {!isLoading && (isError || !PLANS.length) && (
          <div className="max-w-6xl mx-auto rounded-2xl bg-white border border-[#e5e9f2] p-10 text-center text-sm text-slate-600">
            Plans couldn’t be loaded right now. <button className="font-semibold text-[#1d4ed8] underline" onClick={() => navigate('/contact')}>Contact us</button> for pricing.
          </div>
        )}
        <div className={`max-w-6xl mx-auto grid grid-cols-1 gap-6 lg:gap-8 ${PLANS.length >= 3 ? 'md:grid-cols-3' : PLANS.length === 2 ? 'md:grid-cols-2' : ''}`}>
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
                    <span className="text-4xl font-black" style={{ color: plan.accent }}>{(billing === 'monthly' ? plan.price.monthly : plan.price.yearly).toLocaleString('en-US')}</span>
                    <span className="text-slate-400 text-sm">/{billing === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                  {billing === 'yearly' && plan.price.monthly * 12 - plan.price.yearly > 0 && (
                    <p className="text-emerald-600 text-[10px] font-bold mt-1">Save NLe {(plan.price.monthly * 12 - plan.price.yearly).toLocaleString('en-US')} per year</p>
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
                  onClick={() => (plan.id === PLANS[0]?.id ? navigate('/register') : navigate('/contact'))}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] ${
                    plan.highlight ? 'bg-[#f59e0b] hover:bg-[#d97706] text-white shadow-lg shadow-amber-500/25' : 'border-2 hover:bg-slate-50'
                  }`}
                  style={!plan.highlight ? { borderColor: `${plan.accent}55`, color: plan.accent } : {}}
                >
                  {plan.id === PLANS[0]?.id ? 'Start your free trial' : 'Contact Sales'}
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
                  <th scope="col" className="text-left py-3 px-4 text-slate-500 font-bold text-xs uppercase tracking-wider whitespace-nowrap">Feature</th>
                  {PLANS.map((p) => (
                    <th key={p.id} scope="col" className="text-center py-3 px-4 font-bold text-xs" style={{ color: p.accent }}>{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef1f7]">
                {catalog && [
                  { feature: 'Students', cells: catalog.plans.map((p) => (isUnlimited(p.max_students, catalog.unlimited) ? 'Unlimited' : p.max_students.toLocaleString('en-US'))) },
                  { feature: 'Staff accounts', cells: catalog.plans.map((p) => (isUnlimited(p.max_staff, catalog.unlimited) ? 'Unlimited' : p.max_staff.toLocaleString('en-US'))) },
                  ...catalog.features.filter((f) => f.core).map((f) => ({ feature: f.label, cells: catalog.plans.map(() => '✓') })),
                  ...catalog.features.filter((f) => !f.core && catalog.plans.some((p) => p.features[f.key])).map((f) => ({
                    feature: f.soon ? `${f.label} (coming soon)` : f.label,
                    cells: catalog.plans.map((p) => (p.features[f.key] ? '✓' : '—')),
                  })),
                ].map((row) => (
                  <tr key={row.feature} className="hover:bg-[#f8fafc] transition-colors">
                    <th scope="row" className="py-3 px-4 text-left text-slate-700 font-medium whitespace-nowrap">{row.feature}</th>
                    {row.cells.map((c, i) => (
                      <td key={i} className={`py-3 px-4 text-center ${c === '—' ? 'text-slate-400' : 'text-slate-900 font-medium'}`}>
                        {c === '✓' ? <><span aria-hidden="true">✓</span><span className="sr-only">Included</span></> : c === '—' ? <><span aria-hidden="true">—</span><span className="sr-only">Not included</span></> : c}
                      </td>
                    ))}
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
              { q: 'Is there a free trial?', a: 'Yes. Every new school starts with a free trial of the full platform, no card required. When it ends you pick a plan. Nothing is deleted: anything outside your plan stays viewable in read-only mode until you upgrade.' },
              { q: 'Can I upgrade later?', a: 'Absolutely. You can change plans at any time from Settings → Plan & Billing, and your data and settings carry over.' },
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
