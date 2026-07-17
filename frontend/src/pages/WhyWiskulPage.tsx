/**
 * WhyWiskulPage - /why
 * Cyber security-themed page explaining why schools should choose WiSkul
 * Dark navy/purple design with neon accents and glassmorphism
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicNavbar from '@components/public';

export const WhyWiskulPage: React.FC = () => {
  const navigate = useNavigate();
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

      {/* Navigation */}
      <PublicNavbar 
        onCtaClick={handleComingSoon}
        ctaText="Get Started"
        ctaAction="custom"
      />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 sm:px-10 overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[5%] right-[10%] w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-[140px] animate-pulse" />
          <div className="absolute bottom-[10%] left-[5%] w-[500px] h-[500px] rounded-full bg-cyan-500/8 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-[50%] left-[50%] w-[400px] h-[400px] rounded-full bg-[#00d4aa]/5 blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20 rounded-full px-6 py-2.5 mb-8">
            <div className="w-2 h-2 rounded-full bg-[#00d4aa] animate-pulse" />
            <span className="text-[#00d4aa] text-xs font-bold tracking-widest uppercase">The WiSkul Advantage</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-tight mb-8">
            <span className="bg-gradient-to-r from-white via-purple-200 to-cyan-200 bg-clip-text text-transparent">
              Why Schools Trust
            </span>
            <br />
            <span className="text-[#00d4aa]">WiSkul</span>
          </h1>

          <p className="text-gray-400 text-base sm:text-lg md:text-xl max-w-3xl mx-auto leading-relaxed mb-12">
            In an age where data breaches cost institutions millions and manual processes waste countless hours, 
            WiSkul delivers military-grade security with zero-effort automation.
          </p>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { value: '256-bit', label: 'Encryption', icon: '🔐' },
              { value: '99.9%', label: 'Uptime', icon: '⚡' },
              { value: '<200ms', label: 'Response', icon: '🚀' },
              { value: '24/7', label: 'Support', icon: '💬' },
            ].map((stat) => (
              <div key={stat.label} className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-cyan-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative bg-[#16213e]/50 border border-white/[0.08] rounded-2xl p-6 backdrop-blur-xl hover:border-[#00d4aa]/50 transition-all duration-300">
                  <span className="text-3xl block mb-2">{stat.icon}</span>
                  <p className="text-2xl sm:text-3xl font-black bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent">{stat.value}</p>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mt-1">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Reasons Section */}
      <section className="px-6 sm:px-10 py-20 relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">
              <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">Four Pillars</span> of Excellence
            </h2>
            <p className="text-gray-500 text-sm sm:text-base">What sets WiSkul apart from traditional school management systems</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {[
              {
                num: '01',
                title: 'Multi-Tenant Data Isolation',
                desc: 'Each school operates in a completely isolated environment. Student records, financial data, and communications are separated at the database level with zero risk of cross-contamination.',
                icon: '🛡️',
                color: 'from-purple-500 to-purple-700',
                features: ['Database-level separation', 'Zero data leakage', 'Compliance-ready architecture', 'Independent backups per school']
              },
              {
                num: '02',
                title: 'Real-Time Threat Detection',
                desc: 'Our AI-powered monitoring system watches every access attempt, detects suspicious patterns, and automatically blocks threats before they can compromise your data.',
                icon: '🔍',
                color: 'from-cyan-500 to-blue-700',
                features: ['Behavioral anomaly detection', 'Automatic IP blocking', 'Failed login tracking', 'Audit trail for compliance']
              },
              {
                num: '03',
                title: 'End-to-End Encryption',
                desc: 'All data in transit and at rest is encrypted with military-grade 256-bit AES encryption. SMS notifications, parent communications, and financial records are fully secure.',
                icon: '🔐',
                color: 'from-[#00d4aa] to-green-700',
                features: ['AES-256 encryption', 'Encrypted backups', 'Secure API endpoints', 'HTTPS everywhere']
              },
              {
                num: '04',
                title: 'Intelligent Analytics Engine',
                desc: 'Transform raw data into actionable insights. Predict student performance, identify at-risk learners, forecast enrollment trends, and optimize resource allocation — all in real time.',
                icon: '📊',
                color: 'from-pink-500 to-red-700',
                features: ['Predictive analytics', 'Real-time dashboards', 'Custom report builder', 'AI-driven insights']
              },
            ].map((pillar) => (
              <div key={pillar.num} className="relative group">
                {/* Glow effect */}
                <div className={`absolute -inset-[1px] bg-gradient-to-br ${pillar.color} rounded-3xl opacity-0 group-hover:opacity-20 blur-xl transition-all duration-500`} />
                
                <div className="relative bg-[#16213e]/80 border border-white/[0.08] rounded-3xl p-8 backdrop-blur-xl hover:border-[#00d4aa]/30 transition-all duration-300">
                  <div className="flex items-start gap-4 mb-6">
                    <div className={`flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br ${pillar.color} flex items-center justify-center text-2xl shadow-lg`}>
                      {pillar.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-black text-gray-600">{pillar.num}</span>
                        <h3 className="text-xl font-black text-white">{pillar.title}</h3>
                      </div>
                      <p className="text-sm text-gray-400 leading-relaxed">{pillar.desc}</p>
                    </div>
                  </div>

                  {/* Features list */}
                  <div className="grid grid-cols-2 gap-2 mt-6 pt-6 border-t border-white/[0.05]">
                    {pillar.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${pillar.color}`} />
                        <span className="text-xs text-gray-500">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technical Architecture Visualization */}
      <section className="px-6 sm:px-10 py-20 bg-[#0f0f1a] relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `linear-gradient(rgba(99,102,241,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.4) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }} />

        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">Built on Enterprise Architecture</h2>
            <p className="text-gray-500 text-sm">Scalable, secure, and lightning-fast infrastructure</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { layer: 'Frontend', tech: ['React + TypeScript', 'TailwindCSS', 'Vite Build'], icon: '🎨', color: 'cyan' },
              { layer: 'Backend', tech: ['Node.js + Express', 'PostgreSQL', 'Redis Cache'], icon: '⚙️', color: 'purple' },
              { layer: 'Infrastructure', tech: ['AWS Cloud', 'Docker', 'CI/CD Pipeline'], icon: '☁️', color: 'green' },
            ].map((stack) => (
              <div key={stack.layer} className="bg-[#16213e]/50 border border-white/[0.08] rounded-2xl p-6 backdrop-blur-xl hover:border-[#00d4aa]/30 transition-all duration-300">
                <div className="text-3xl mb-4">{stack.icon}</div>
                <h3 className="text-lg font-black text-white mb-4">{stack.layer}</h3>
                <div className="space-y-2">
                  {stack.tech.map((t) => (
                    <div key={t} className="flex items-center gap-2">
                      <div className={`w-1 h-1 rounded-full bg-${stack.color}-500`} />
                      <span className="text-xs text-gray-400">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="px-6 sm:px-10 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black mb-12">Trusted by Forward-Thinking Schools</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { metric: '500+', label: 'Schools', icon: '🏫' },
              { metric: '50K+', label: 'Students', icon: '🎓' },
              { metric: '2K+', label: 'Teachers', icon: '👨‍🏫' },
            ].map((stat) => (
              <div key={stat.label} className="bg-gradient-to-br from-[#16213e] to-[#0f0f1a] border border-white/[0.08] rounded-2xl p-8">
                <div className="text-4xl mb-3">{stat.icon}</div>
                <p className="text-4xl font-black bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent mb-2">{stat.metric}</p>
                <p className="text-sm text-gray-500 font-semibold">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 sm:px-10 py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-cyan-900/20" />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black mb-6">Ready to Transform Your School?</h2>
          <p className="text-gray-400 text-sm sm:text-base mb-8">Join hundreds of schools already using WiSkul to protect data and empower education.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleComingSoon}
              className="w-full sm:w-auto bg-gradient-to-r from-[#00d4aa] to-cyan-500 hover:from-cyan-500 hover:to-[#00d4aa] text-[#0a0a14] font-bold text-sm px-10 py-4 rounded-full transition-all duration-300 shadow-[0_0_30px_rgba(0,212,170,0.3)] hover:shadow-[0_0_40px_rgba(0,212,170,0.5)]"
            >
              Start Free Trial
            </button>
            <button
              onClick={() => navigate('/features')}
              className="w-full sm:w-auto border-2 border-white/20 hover:border-[#00d4aa] text-white font-bold text-sm px-10 py-4 rounded-full transition-all duration-300"
            >
              Explore Features →
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0a0a14] border-t border-white/[0.04] px-6 sm:px-10 py-8 text-center">
        <p className="text-gray-600 text-xs">© {new Date().getFullYear()} WiSkul. Securing education, one school at a time.</p>
      </footer>

      <style>{`
        @keyframes fadeInDown { from { opacity:0; transform:translateY(-20px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
};

export default WhyWiskulPage;
