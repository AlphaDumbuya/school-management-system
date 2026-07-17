/**
 * BenefitsPage - /benefits
 * Cyber security-themed benefits showcase
 * Dark design with neon accents, animations, and glassmorphism
 */

import React, { useEffect, useState } from 'react';

export const BenefitsPage: React.FC = () => {
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleComingSoon = () => {
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white overflow-x-hidden font-sans">

      {/* Coming Soon Alert */}
      {showAlert && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100]" style={{ animation: 'fadeInDown 0.4s ease-out' }}>
          <div className="bg-[#16213e] border border-[#00d4aa]/30 rounded-xl px-6 py-4 shadow-2xl shadow-[#00d4aa]/10 flex items-center gap-3 backdrop-blur-xl">
            <span className="text-xl">🚀</span>
            <div>
              <p className="text-white font-bold text-sm">Coming Soon!</p>
              <p className="text-gray-400 text-xs">This feature is under development.</p>
            </div>
          </div>
        </div>
      )}



      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 sm:px-10 overflow-hidden">
        {/* Animated Background Grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(rgba(0,212,170,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,170,0.5) 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }} />

        {/* Floating Orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[20%] left-[10%] w-[400px] h-[400px] rounded-full bg-purple-600/10 blur-[100px] animate-pulse" />
          <div className="absolute top-[60%] right-[15%] w-[350px] h-[350px] rounded-full bg-cyan-500/10 blur-[90px] animate-pulse" style={{ animationDelay: '1.5s' }} />
          <div className="absolute bottom-[10%] left-[40%] w-[300px] h-[300px] rounded-full bg-[#00d4aa]/10 blur-[80px] animate-pulse" style={{ animationDelay: '3s' }} />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-[#16213e]/50 border border-[#00d4aa]/30 rounded-full px-6 py-2.5 mb-8 backdrop-blur-xl">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00d4aa] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#00d4aa]"></span>
            </span>
            <span className="text-[#00d4aa] text-xs font-bold tracking-widest uppercase">Transform Your School</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-tight mb-8">
            <span className="bg-gradient-to-r from-white via-cyan-200 to-purple-200 bg-clip-text text-transparent">
              The WiSkul
            </span>
            <br />
            <span className="text-[#00d4aa]">Benefits</span>
          </h1>

          <p className="text-gray-400 text-base sm:text-lg md:text-xl max-w-3xl mx-auto leading-relaxed">
            More than just software — WiSkul is a complete digital transformation toolkit 
            that saves time, reduces costs, and unlocks new possibilities for your institution.
          </p>
        </div>
      </section>

      {/* Main Benefits Grid */}
      <section className="px-6 sm:px-10 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: '🛡️',
                title: 'Be Protected',
                desc: 'Military-grade 256-bit encryption secures all student and staff data. GDPR-compliant data handling with full audit trails and zero-trust architecture.',
                color: 'from-purple-500 to-purple-700',
                features: ['256-bit AES encryption', 'GDPR compliant', 'Full audit trails', 'Zero-trust security']
              },
              {
                icon: '👥',
                title: 'Know Your Students',
                desc: 'Complete 360° student profiles with academic history, attendance patterns, behavior records, and health information — all in one unified view.',
                color: 'from-cyan-500 to-blue-700',
                features: ['360° student profiles', 'Academic history', 'Behavior tracking', 'Health records']
              },
              {
                icon: '📈',
                title: 'Data-Driven Decisions',
                desc: 'AI-powered analytics surface trends in performance, attendance, and finances before they become problems. Predict outcomes and optimize resources.',
                color: 'from-[#00d4aa] to-green-700',
                features: ['Predictive analytics', 'Trend detection', 'Resource optimization', 'AI insights']
              },
              {
                icon: '⚡',
                title: 'Instant Communication',
                desc: 'SMS, email, and in-app notifications keep parents, teachers, and students connected in real time. No delays, no missed messages.',
                color: 'from-pink-500 to-red-700',
                features: ['SMS notifications', 'Email alerts', 'In-app messaging', 'Real-time updates']
              },
              {
                icon: '🌐',
                title: 'Access Anywhere',
                desc: 'Cloud-based platform accessible from any device. Mobile-optimized dashboards let you manage your school from anywhere in the world.',
                color: 'from-orange-500 to-yellow-600',
                features: ['Cloud-based', 'Mobile optimized', 'Cross-platform', 'Global access']
              },
              {
                icon: '🔄',
                title: 'Seamless Integration',
                desc: 'Connect with payment gateways, SMS providers, and existing school tools without disrupting workflows. RESTful APIs for custom integrations.',
                color: 'from-indigo-500 to-purple-700',
                features: ['Payment gateways', 'SMS providers', 'RESTful APIs', 'Custom integrations']
              },
              {
                icon: '💰',
                title: 'Reduce Costs',
                desc: 'Eliminate paper, reduce administrative overhead, automate repetitive tasks. Save thousands on printing, storage, and manual data entry.',
                color: 'from-green-500 to-emerald-700',
                features: ['Paperless operations', 'Task automation', 'Lower overhead', 'Cost savings']
              },
              {
                icon: '⏱️',
                title: 'Save Time',
                desc: 'Automate attendance, grade calculation, report card generation, and fee reminders. Reclaim hours of manual work every week.',
                color: 'from-blue-500 to-cyan-700',
                features: ['Auto attendance', 'Auto grading', 'Report generation', 'Smart reminders']
              },
              {
                icon: '🎯',
                title: 'Increase Efficiency',
                desc: 'Streamlined workflows reduce errors and speed up every process — from admissions to graduation. Do more with less.',
                color: 'from-red-500 to-pink-700',
                features: ['Streamlined workflows', 'Error reduction', 'Process automation', 'Higher productivity']
              },
              {
                icon: '📱',
                title: 'Empower Parents',
                desc: 'Parents track their child\'s journey from anywhere — grades, attendance, behavior, fees, and events. Complete transparency builds trust.',
                color: 'from-violet-500 to-purple-700',
                features: ['Parent portal', 'Real-time updates', 'Mobile access', 'Transparent reporting']
              },
              {
                icon: '🎓',
                title: 'Engage Students',
                desc: 'Students access timetables, assignments, results, and announcements instantly. Digital engagement increases accountability and motivation.',
                color: 'from-teal-500 to-cyan-700',
                features: ['Student portal', 'Assignment tracking', 'Result access', 'Digital engagement']
              },
              {
                icon: '📊',
                title: 'Powerful Reporting',
                desc: 'Generate detailed reports on academics, finances, attendance, and more. Export to PDF or Excel with one click. Custom report builder included.',
                color: 'from-amber-500 to-orange-700',
                features: ['Custom reports', 'PDF/Excel export', 'Financial reports', 'Academic analytics']
              },
            ].map((benefit, index) => (
              <div key={benefit.title} className="relative group" style={{ animationDelay: `${index * 0.1}s` }}>
                {/* Glow effect on hover */}
                <div className={`absolute -inset-[1px] bg-gradient-to-br ${benefit.color} rounded-2xl opacity-0 group-hover:opacity-30 blur-xl transition-all duration-500`} />
                
                <div className="relative h-full bg-gradient-to-br from-[#16213e]/80 to-[#0f0f1a]/80 border border-white/[0.08] rounded-2xl p-6 backdrop-blur-xl hover:border-[#00d4aa]/40 transition-all duration-300">
                  {/* Icon with gradient background */}
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${benefit.color} flex items-center justify-center text-3xl mb-4 shadow-lg`}>
                    {benefit.icon}
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-black text-white mb-3">{benefit.title}</h3>

                  {/* Description */}
                  <p className="text-sm text-gray-400 leading-relaxed mb-4">{benefit.desc}</p>

                  {/* Features list */}
                  <div className="grid grid-cols-2 gap-2 pt-4 border-t border-white/[0.05]">
                    {benefit.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-2">
                        <div className={`w-1 h-1 rounded-full bg-gradient-to-r ${benefit.color} mt-1.5 flex-shrink-0`} />
                        <span className="text-[10px] text-gray-500 leading-tight">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI Calculator Section */}
      <section className="px-6 sm:px-10 py-20 bg-[#0f0f1a] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-cyan-900/10" />
        
        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">
              <span className="bg-gradient-to-r from-[#00d4aa] to-cyan-400 bg-clip-text text-transparent">Calculate</span> Your Savings
            </h2>
            <p className="text-gray-500 text-sm">See how much time and money WiSkul can save your school</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { 
                metric: '15 hours/week', 
                label: 'Time Saved', 
                desc: 'Automation eliminates manual data entry, report generation, and repetitive tasks',
                icon: '⏰',
                color: 'purple'
              },
              { 
                metric: 'NLe 2.5M/year', 
                label: 'Cost Reduction', 
                desc: 'Eliminate paper, reduce admin overhead, and optimize resource allocation',
                icon: '💵',
                color: 'cyan'
              },
              { 
                metric: '40% faster', 
                label: 'Process Speed', 
                desc: 'Streamlined workflows accelerate everything from admissions to graduation',
                icon: '🚀',
                color: 'green'
              },
            ].map((roi) => (
              <div key={roi.label} className="relative group">
                <div className="absolute -inset-[1px] bg-gradient-to-br from-purple-500/20 to-cyan-500/20 rounded-2xl opacity-0 group-hover:opacity-100 blur-lg transition-opacity duration-500" />
                <div className="relative bg-[#16213e]/50 border border-white/[0.08] rounded-2xl p-8 backdrop-blur-xl text-center">
                  <div className="text-4xl mb-4">{roi.icon}</div>
                  <p className="text-3xl font-black bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent mb-2">{roi.metric}</p>
                  <p className="text-sm font-bold text-[#00d4aa] mb-3">{roi.label}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{roi.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Before vs After Comparison */}
      <section className="px-6 sm:px-10 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">Before & After WiSkul</h2>
            <p className="text-gray-500 text-sm">See the transformation in action</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Before */}
            <div className="bg-gradient-to-br from-red-900/20 to-orange-900/20 border border-red-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center text-2xl">😓</div>
                <h3 className="text-2xl font-black text-red-400">Before</h3>
              </div>
              <ul className="space-y-4">
                {[
                  'Manual attendance registers lost or damaged',
                  'Paper-based report cards taking weeks to generate',
                  'Parents calling constantly for updates',
                  'No visibility into school-wide performance',
                  'Fee collection chaos and missing records',
                  'Hours wasted on data entry and filing',
                  'Security breaches from physical document theft',
                ].map((issue) => (
                  <li key={issue} className="flex items-start gap-3 text-gray-400">
                    <span className="text-red-500 text-lg flex-shrink-0">✗</span>
                    <span className="text-sm">{issue}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* After */}
            <div className="bg-gradient-to-br from-[#00d4aa]/20 to-cyan-900/20 border border-[#00d4aa]/30 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#00d4aa]/20 flex items-center justify-center text-2xl">🎉</div>
                <h3 className="text-2xl font-black text-[#00d4aa]">After</h3>
              </div>
              <ul className="space-y-4">
                {[
                  'Digital attendance with automatic parent notifications',
                  'Auto-generated report cards in seconds',
                  'Parents access everything via mobile portal',
                  'Real-time analytics and predictive insights',
                  'Automated fee tracking and payment reminders',
                  'Zero manual data entry — everything is digital',
                  'Military-grade encryption protects all data',
                ].map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3 text-gray-300">
                    <span className="text-[#00d4aa] text-lg flex-shrink-0">✓</span>
                    <span className="text-sm font-medium">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 sm:px-10 py-20 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-transparent to-cyan-600/20" />
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00d4aa] to-transparent" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-6">
            <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Start Your</span>
            <br />
            <span className="text-[#00d4aa]">Digital Transformation</span>
          </h2>
          <p className="text-gray-400 text-base mb-10 max-w-2xl mx-auto">
            Join hundreds of schools already experiencing the WiSkul advantage. 
            No credit card required. Full access to all features for 14 days.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleComingSoon}
              className="w-full sm:w-auto bg-gradient-to-r from-[#00d4aa] to-cyan-500 hover:from-cyan-500 hover:to-[#00d4aa] text-[#0a0a14] font-bold text-sm px-10 py-4 rounded-full transition-all duration-300 shadow-[0_0_30px_rgba(0,212,170,0.4)] hover:shadow-[0_0_50px_rgba(0,212,170,0.6)] active:scale-95"
            >
              Start Free Trial
            </button>
            <button
              onClick={() => navigate('/pricing')}
              className="w-full sm:w-auto border-2 border-white/20 hover:border-[#00d4aa] text-white font-bold text-sm px-10 py-4 rounded-full transition-all duration-300 hover:bg-[#00d4aa]/10"
            >
              View Pricing →
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0a0a14] border-t border-white/[0.04] px-6 sm:px-10 py-8 text-center">
        <p className="text-gray-600 text-xs">© {new Date().getFullYear()} WiSkul. Empowering education through technology.</p>
      </footer>

      <style>{`
        @keyframes fadeInDown { from { opacity:0; transform:translateY(-20px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
};

export default BenefitsPage;
