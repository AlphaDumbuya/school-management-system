/**
 * PricingPage — /pricing
 * WiSkul subscription plans with Sierra Leonean-inspired tier names.
 * Dark cyber design matching the landing page.
 */

import React, { useState, useEffect } from 'react';
import PublicNavbar from '@components/public';

// ── Plan Data ─────────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'freetong',
    name: 'Freetong',
    meaning: 'Start free, grow strong',
    price: { monthly: 400, yearly: 4000 },
    highlight: false,
    color: '#00d4aa',
    students: 'Up to 200',
    staff: 'Up to 15',
    features: [
      'Student directory & profiles',
      'Basic attendance tracking',
      'Class & subject management',
      'Fee collection & receipts',
      'SMS notifications (50/mo)',
      'Single admin account',
      'Basic reports (PDF)',
      'Email support',
    ],
    notIncluded: [
      'ID card generation',
      'Event management',
      'Advanced analytics',
      'WhatsApp integration',
      'Bulk operations',
      'API access',
    ],
  },
  {
    id: 'combra',
    name: 'Combra',
    meaning: 'A mother managing her children — complete care',
    price: { monthly: 900, yearly: 9000 },
    highlight: true,
    color: '#7c3aed',
    badge: 'Most Popular',
    students: 'Up to 500',
    staff: 'Up to 40',
    features: [
      'Everything in Freetong, plus:',
      'Full academic management (exams, results, report cards)',
      'Student ID card generation (PVC & badge)',
      'Event management & calendar',
      'Advanced attendance with parent alerts',
      'Discipline & conduct tracking',
      'Financial reports & analytics',
      'SMS notifications (200/mo)',
      'WhatsApp integration',
      'Up to 5 admin accounts',
      'Excel & PDF exports',
      'Priority email support',
    ],
    notIncluded: [
      'Unlimited students',
      'Custom branding',
      'API access',
      'Dedicated support',
    ],
  },
  {
    id: 'bintumani',
    name: 'Bintumani',
    meaning: 'The highest peak — unlimited power',
    price: { monthly: 1750, yearly: 17500 },
    highlight: false,
    color: '#f59e0b',
    badge: 'Enterprise',
    students: 'Unlimited',
    staff: 'Unlimited',
    features: [
      'Everything in Combra, plus:',
      'Unlimited students & staff',
      'Bulk ID card generation',
      'Advanced analytics & AI insights',
      'Custom report builder',
      'Payroll management',
      'Scholarship management',
      'Unlimited SMS & WhatsApp',
      'Multi-branch support',
      'Unlimited admin accounts',
      'Custom branding & white-label',
      'API access & integrations',
      'Dedicated account manager',
      'Phone & WhatsApp support',
      '99.9% uptime SLA',
    ],
    notIncluded: [],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export const PricingPage: React.FC = () => {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleSubscribe = () => {
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white overflow-x-hidden font-sans">

      {/* ── Coming Soon Alert ── */}
      {showAlert && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100]" style={{ animation: 'fadeInDown 0.4s ease-out' }}>
          <div className="bg-[#16213e] border border-[#00d4aa]/30 rounded-xl px-6 py-4 shadow-2xl shadow-[#00d4aa]/10 flex items-center gap-3 backdrop-blur-xl">
            <span className="text-xl">🚀</span>
            <div>
              <p className="text-white font-bold text-sm">Coming Soon!</p>
              <p className="text-gray-400 text-xs">Online payments will be available soon. Contact us to subscribe.</p>
            </div>
          </div>
        </div>
      )}


      {/* ── Navigation ── */}
      <PublicNavbar ctaText="Sign In" ctaAction="login" />

      {/* ── Hero ── */}
      <section className="pt-32 pb-12 px-6 sm:px-10 text-center relative overflow-hidden">
        <div className="absolute top-[10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-purple-600/8 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[350px] h-[350px] rounded-full bg-cyan-500/5 blur-[80px]" />

        <div className="relative z-10 max-w-3xl mx-auto">
          <span className="text-[#00d4aa] text-xs font-bold tracking-[0.3em] uppercase">Simple Pricing</span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mt-3 mb-5">
            Choose Your <span className="text-[#00d4aa]">Plan</span>
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto mb-8">
            Affordable plans designed for Sierra Leonean schools. Start small, scale as you grow.
            All prices in New Leones (NLe).
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center bg-[#16213e] border border-white/[0.06] rounded-full p-1">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-5 py-2 rounded-full text-sm font-bold transition-all duration-300 ${billing === 'monthly' ? 'bg-[#00d4aa] text-[#1a1a2e]' : 'text-gray-400 hover:text-white'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('yearly')}
              className={`px-5 py-2 rounded-full text-sm font-bold transition-all duration-300 ${billing === 'yearly' ? 'bg-[#00d4aa] text-[#1a1a2e]' : 'text-gray-400 hover:text-white'}`}
            >
              Yearly <span className="text-[10px] ml-1 opacity-80">Save 17%</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Pricing Cards ── */}
      <section className="px-6 sm:px-10 pb-20">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-[1px] transition-all duration-300 hover:-translate-y-1 ${
                plan.highlight
                  ? 'bg-gradient-to-br from-[#7c3aed] via-[#00d4aa] to-[#7c3aed]'
                  : 'bg-white/[0.06]'
              }`}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="bg-gradient-to-r from-[#7c3aed] to-[#00d4aa] text-white text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-wider shadow-lg">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className={`h-full bg-[#16213e] rounded-2xl p-7 sm:p-8 flex flex-col ${plan.highlight ? '' : 'border border-white/[0.04]'}`}>
                {/* Plan header */}
                <div className="mb-6">
                  <h3 className="text-xl font-black text-white mb-1">{plan.name}</h3>
                  <p className="text-gray-500 text-[11px] italic">{plan.meaning}</p>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-gray-500 text-sm">NLe</span>
                    <span className="text-4xl font-black" style={{ color: plan.color }}>
                      {billing === 'monthly' ? plan.price.monthly : plan.price.yearly}
                    </span>
                    <span className="text-gray-500 text-sm">/{billing === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                  {billing === 'yearly' && (
                    <p className="text-[#00d4aa] text-[10px] font-bold mt-1">
                      Save NLe {plan.price.monthly * 12 - plan.price.yearly} per year
                    </p>
                  )}
                </div>

                {/* Capacity */}
                <div className="flex gap-4 mb-6 pb-6 border-b border-white/[0.06]">
                  <div>
                    <p className="text-xs text-gray-500">Students</p>
                    <p className="text-sm font-bold text-white">{plan.students}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Staff</p>
                    <p className="text-sm font-bold text-white">{plan.staff}</p>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-xs">
                      <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${plan.color}20` }}>
                        <span style={{ color: plan.color }} className="text-[10px] font-bold">✓</span>
                      </span>
                      <span className="text-gray-300">{f}</span>
                    </li>
                  ))}
                  {plan.notIncluded.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-xs">
                      <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-white/[0.03]">
                        <span className="text-gray-600 text-[10px]">✕</span>
                      </span>
                      <span className="text-gray-600 line-through">{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={handleSubscribe}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-300 active:scale-[0.98] ${
                    plan.highlight
                      ? 'bg-gradient-to-r from-[#7c3aed] to-[#00d4aa] text-white hover:shadow-[0_0_30px_rgba(124,58,237,0.3)]'
                      : `border-2 hover:bg-white/[0.03]`
                  }`}
                  style={!plan.highlight ? { borderColor: `${plan.color}40`, color: plan.color } : {}}
                >
                  {plan.id === 'freetong' ? 'Start with Freetong' : plan.id === 'combra' ? 'Choose Combra' : 'Go Bintumani'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Comparison Table ── */}
      <section className="px-6 sm:px-10 py-16 bg-[#16213e]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-black text-center mb-10">Plan Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-3 px-4 text-gray-500 font-bold text-xs uppercase tracking-wider">Feature</th>
                  <th className="text-center py-3 px-4 text-[#00d4aa] font-bold text-xs">Freetong</th>
                  <th className="text-center py-3 px-4 text-[#7c3aed] font-bold text-xs">Combra</th>
                  <th className="text-center py-3 px-4 text-[#f59e0b] font-bold text-xs">Bintumani</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {[
                  { feature: 'Students', freetong: '200', combra: '500', bintumani: 'Unlimited' },
                  { feature: 'Staff accounts', freetong: '15', combra: '40', bintumani: 'Unlimited' },
                  { feature: 'Admin accounts', freetong: '1', combra: '5', bintumani: 'Unlimited' },
                  { feature: 'Student directory', freetong: '✓', combra: '✓', bintumani: '✓' },
                  { feature: 'Attendance tracking', freetong: 'Basic', combra: 'Advanced + alerts', bintumani: 'Advanced + AI' },
                  { feature: 'Grades & results', freetong: 'Basic', combra: '✓', bintumani: '✓' },
                  { feature: 'Report cards', freetong: '—', combra: '✓', bintumani: '✓ + Custom' },
                  { feature: 'Examinations', freetong: '—', combra: '✓', bintumani: '✓' },
                  { feature: 'Fee management', freetong: 'Basic', combra: '✓', bintumani: '✓ + Payroll' },
                  { feature: 'SMS notifications', freetong: '50/mo', combra: '200/mo', bintumani: 'Unlimited' },
                  { feature: 'WhatsApp', freetong: '—', combra: '✓', bintumani: '✓' },
                  { feature: 'ID cards', freetong: '—', combra: '✓', bintumani: '✓ + Bulk' },
                  { feature: 'Events & calendar', freetong: '—', combra: '✓', bintumani: '✓' },
                  { feature: 'Analytics', freetong: 'Basic', combra: 'Standard', bintumani: 'Advanced + AI' },
                  { feature: 'Discipline tracking', freetong: '—', combra: '✓', bintumani: '✓' },
                  { feature: 'Scholarships', freetong: '—', combra: '—', bintumani: '✓' },
                  { feature: 'Multi-branch', freetong: '—', combra: '—', bintumani: '✓' },
                  { feature: 'API access', freetong: '—', combra: '—', bintumani: '✓' },
                  { feature: 'Custom branding', freetong: '—', combra: '—', bintumani: '✓' },
                  { feature: 'Support', freetong: 'Email', combra: 'Priority email', bintumani: 'Dedicated + Phone' },
                ].map((row) => (
                  <tr key={row.feature} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 text-gray-300 font-medium">{row.feature}</td>
                    <td className="py-3 px-4 text-center text-gray-400">{row.freetong}</td>
                    <td className="py-3 px-4 text-center text-gray-300">{row.combra}</td>
                    <td className="py-3 px-4 text-center text-white font-medium">{row.bintumani}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-6 sm:px-10 py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-black text-center mb-10">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              { q: 'Can I upgrade my plan at any time?', a: 'Yes! You can upgrade from Freetong to Combra or Bintumani at any time. Your data and settings carry over seamlessly.' },
              { q: 'Is there a free trial?', a: 'Every plan comes with a 14-day free trial. No payment required to start. You can explore all features before committing.' },
              { q: 'How do I pay?', a: 'We accept mobile money (Orange Money, Africell Money), bank transfers, and cash payments at our office in Freetown.' },
              { q: 'What happens when I exceed my student limit?', a: 'You\'ll get a notification to upgrade. We won\'t lock you out — you can continue for a grace period while you decide.' },
              { q: 'Can I get a custom plan for my school?', a: 'Absolutely! Contact us for schools with special needs — we\'ll create a tailored package that fits your budget and requirements.' },
              { q: 'Is my data safe?', a: 'Yes. All data is encrypted with 256-bit encryption, stored on secure cloud servers with daily backups, and isolated per school (multi-tenant).' },
            ].map((faq) => (
              <div key={faq.q} className="bg-[#16213e] border border-white/[0.06] rounded-xl p-5">
                <h4 className="text-sm font-bold text-white mb-2">{faq.q}</h4>
                <p className="text-xs text-gray-400 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 sm:px-10 py-16 bg-[#16213e]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-black mb-3">Still Have Questions?</h2>
          <p className="text-gray-400 text-sm mb-6">Our team is ready to help you choose the right plan for your school.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={handleSubscribe} className="w-full sm:w-auto bg-[#00d4aa] hover:bg-[#00e6b8] text-[#1a1a2e] font-bold text-sm px-8 py-3.5 rounded-full transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,212,170,0.3)]">
              Contact Sales
            </button>
            <button onClick={() => navigate('/login')} className="w-full sm:w-auto border border-white/10 hover:border-white/25 text-white font-bold text-sm px-8 py-3.5 rounded-full transition-all duration-300">
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#0f0f1a] border-t border-white/[0.04] px-6 sm:px-10 py-8 text-center">
        <p className="text-gray-600 text-[11px]">© {new Date().getFullYear()} WiSkul. All rights reserved. Prices in New Leones (NLe).</p>
      </footer>

      <style>{`
        @keyframes fadeInDown { from { opacity:0; transform:translateY(-20px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
};

export default PricingPage;
