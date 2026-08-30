/**
 * WiSkul Landing Page
 * Premium cyber-themed design inspired by dark navy/purple cyber security sites.
 * Focused on school data protection, analytics, and management.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicNavbar from '@components/public';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

  const handleComingSoon = () => {
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 3000);
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white overflow-x-hidden font-sans">

      {/* ── Coming Soon Alert ── */}
      {showAlert && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-fade-in-down">
          <div className="bg-[#16213e] border border-[#00d4aa]/30 rounded-xl px-6 py-4 shadow-2xl shadow-[#00d4aa]/10 flex items-center gap-3 backdrop-blur-xl">
            <span className="text-xl">🚀</span>
            <div>
              <p className="text-white font-bold text-sm">Coming Soon!</p>
              <p className="text-gray-400 text-xs">This feature is under development. Stay tuned!</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Navigation ── */}
      <PublicNavbar ctaText="Register School Free" />

      {/* ── Hero Section ── */}
      <section className="relative pt-28 sm:pt-36 pb-20 sm:pb-28 px-6 sm:px-10 overflow-hidden">
        {/* Background gradient shapes */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute top-[10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-purple-600/10 blur-[100px]" />
          <div className="absolute bottom-[10%] left-[-5%] w-[350px] h-[350px] rounded-full bg-indigo-600/10 blur-[80px]" />
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
          {/* Left: Text */}
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black leading-tight mb-6">
              Protecting Your School's<br />
              <span className="text-[#00d4aa]">Data Privacy & Security</span>
            </h1>
            <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-8 max-w-lg">
              WiSkul is a next-generation school management platform that keeps student records,
              financial data, and academic information secure while providing powerful tools for
              enrollment, grading, communication, and analytics — all in one unified system.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={() => navigate('/register')}
                className="bg-[#00d4aa] hover:bg-[#00e6b8] text-[#1a1a2e] font-bold text-sm px-8 py-3.5 rounded-full transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,212,170,0.3)] active:scale-95 cursor-pointer"
              >
                Register School Free →
              </button>
              <button
                onClick={() => navigate('/pricing')}
                className="border border-white/20 hover:border-white/40 text-white font-bold text-sm px-6 py-3.5 rounded-full transition-all duration-300 cursor-pointer"
              >
                View Plans
              </button>
            </div>
          </div>

          {/* Right: Isometric Data Illustration */}
          <div className="relative flex items-center justify-center lg:pl-8">
            <img src="/illustrations/hero-data.svg" alt="Data Security Infrastructure" className="w-full max-w-[480px] h-auto drop-shadow-2xl" />
          </div>
        </div>
      </section>

      {/* ── Why WiSkul (Numbered Steps) ── */}
      <section id="why" className="px-6 sm:px-10 py-20 sm:py-28 bg-white text-[#1a1a2e]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-3">WHY WISKUL</h2>
            <p className="text-gray-500 text-sm sm:text-base max-w-xl mx-auto">
              WiSkul uses advanced data architecture to protect school records and provide
              intelligent insights — all in real time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-10">
            {[
              {
                num: '01',
                title: 'Multi-Tenant Data Isolation',
                desc: 'Each school gets a fully isolated database environment. Student records, grades, and financial data are completely separated with zero cross-contamination between institutions.',
              },
              {
                num: '02',
                title: 'Real-Time Threat Detection',
                desc: 'WiSkul actively monitors access patterns and detects unauthorized attempts at the source — blocking fraudulent access before it can cause damage to sensitive records.',
              },
              {
                num: '03',
                title: 'Encrypted Communication',
                desc: 'All data transmissions use enterprise-grade encryption. SMS notifications, parent communications, and grade reports are protected with end-to-end security protocols.',
              },
              {
                num: '04',
                title: 'Intelligent Analytics Engine',
                desc: 'WiSkul keeps you fully informed with real-time academic insights and detailed analytics, enabling confident, data-driven decisions about student performance.',
              },
            ].map((item) => (
              <div key={item.num} className="flex gap-5">
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#1a1a2e] text-[#00d4aa] font-black text-lg">
                    {item.num}
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-base mb-2">{item.title}</h4>
                  <p className="text-gray-500 text-xs sm:text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Learn More Button */}
          <div className="text-center mt-12">
            <button
              onClick={() => navigate('/why')}
              className="inline-flex items-center gap-2 bg-[#1a1a2e] hover:bg-[#2a2a3e] text-white font-bold text-sm px-8 py-3.5 rounded-full transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,212,170,0.2)]"
            >
              Learn More About WiSkul
              <span className="text-[#00d4aa]">→</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Data Analytics Section (Two Column) ── */}
      <section id="features" className="px-6 sm:px-10 py-20 sm:py-28 bg-[#16213e]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Analytics illustration */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-cyan-500/5 rounded-3xl blur-xl" />
            <img src="/illustrations/analytics.svg" alt="School Analytics Dashboard" className="relative w-full max-w-[500px] h-auto mx-auto drop-shadow-xl" />
          </div>

          {/* Right: Feature list */}
          <div className="bg-[#1a1a2e] border border-white/[0.06] rounded-2xl p-8">
            <h3 className="text-xl sm:text-2xl font-black mb-2">SCHOOL DATA ANALYSIS</h3>
            <p className="text-gray-400 text-sm mb-6">
              Stop guessing and start making data-driven decisions. WiSkul provides real-time reports and analytics on every aspect of your institution.
            </p>
            <ul className="space-y-3">
              {[
                'Student performance tracking across all terms',
                'Attendance pattern analysis & alerts',
                'Financial health monitoring & forecasting',
                'Teacher workload & scheduling optimization',
                'Enrollment trends & capacity planning',
                'Parent engagement metrics',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-gray-300">
                  <span className="w-2 h-2 rounded-full bg-[#00d4aa] flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Second row: Security + Optimize */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mt-20">
          {/* Left: Optimize card with chart */}

          {/* Right: Optimize card with data illustration */}
          <div className="relative">
            {/* SVG Dashboard/Analytics Illustration */}
            <div className="absolute -top-8 -right-4 w-[180px] h-[180px] opacity-20 pointer-events-none">
              <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                <circle cx="100" cy="100" r="90" fill="none" stroke="#7c3aed" strokeWidth="0.5" strokeDasharray="4 4"/>
                <circle cx="100" cy="100" r="60" fill="none" stroke="#00d4aa" strokeWidth="0.5" strokeDasharray="3 5"/>
                <circle cx="100" cy="100" r="30" fill="none" stroke="#7c3aed" strokeWidth="0.5"/>
              </svg>
            </div>
            
            <div className="bg-[#1a1a2e] border border-white/[0.06] rounded-2xl p-8">
              <h3 className="text-xl sm:text-2xl font-black mb-2">OPTIMIZE WITHOUT LIMITS</h3>
              <p className="text-gray-400 text-sm mb-6">
                WiSkul is a complete digital ecosystem with 50+ modules covering every aspect of school management — academics, finance, communication, identity, and more.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                {[
                  { label: 'Student Directory', icon: '🎓', badge: 'v1 Free' },
                  { label: 'Daily Attendance', icon: '📋', badge: 'v1 Free' },
                  { label: 'Classes & Timetables', icon: '📖', badge: 'v1 Free' },
                  { label: 'ID Cards & Batch PDF', icon: '💳', badge: 'v1 Free' },
                  { label: 'Staff & Teachers', icon: '👨‍🏫', badge: 'v1 Free' },
                  { label: 'Admissions Pipeline', icon: '📋', badge: 'v1 Free' },
                  { label: 'Gradebook & Report Cards', icon: '📊', badge: 'v1 Free' },
                  { label: 'Fee & Billing', icon: '💰', badge: 'Coming v2' },
                  { label: 'SMS & WhatsApp Alerts', icon: '📢', badge: 'Coming v2' },
                  { label: 'Staff HR & Leave', icon: '🔐', badge: 'Coming v2' },
                ].map((f) => (
                  <div key={f.label} className="bg-[#16213e] border border-white/[0.04] rounded-lg p-3 flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg shrink-0">{f.icon}</span>
                      <span className="text-xs text-gray-300 font-medium truncate">{f.label}</span>
                    </div>
                    <span
                      className={`shrink-0 whitespace-nowrap text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
                        f.badge === 'v1 Free'
                          ? 'bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/30'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      }`}
                    >
                      {f.badge}
                    </span>
                  </div>
                ))}
              </div>
              
              <p className="text-[11px] text-gray-500 mt-4">...and many more. <span className="text-[#7c3aed] font-semibold cursor-pointer hover:text-[#8b5cf6]" onClick={() => navigate('/features')}>See all features →</span></p>
              
              {/* Mini bar chart SVG */}
              <div className="mt-6 bg-[#16213e] rounded-xl p-4 border border-white/[0.04]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Performance Trend</span>
                  <span className="text-[10px] text-[#00d4aa] font-bold">+24% ↑</span>
                </div>
                <svg viewBox="0 0 260 50" className="w-full h-[50px]">
                  {/* Bar chart */}
                  {[18, 28, 22, 35, 30, 42, 38, 45, 40, 48, 44, 50].map((h, i) => (
                    <rect key={i} x={i * 21 + 4} y={50 - h} width="14" height={h} rx="2" fill={i >= 9 ? '#00d4aa' : '#7c3aed'} opacity={0.6 + i * 0.03}>
                      <animate attributeName="height" from="0" to={String(h)} dur="1s" fill="freeze" begin={`${i * 0.08}s`}/>
                      <animate attributeName="y" from="50" to={String(50 - h)} dur="1s" fill="freeze" begin={`${i * 0.08}s`}/>
                    </rect>
                  ))}
                  {/* Trend line */}
                  <polyline points="11,32 32,22 53,28 74,15 95,20 116,8 137,12 158,5 179,10 200,2 221,6 242,0" fill="none" stroke="#00d4aa" strokeWidth="1.5" opacity="0.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              
              <button
                onClick={() => navigate('/features')}
                className="mt-6 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-bold text-sm px-6 py-3 rounded-full transition-all duration-300 hover:shadow-[0_0_20px_rgba(124,58,237,0.3)]"
              >
                Explore Platform →
              </button>
            </div>
          </div>

          {/* Right: Security illustration */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-purple-500/5 rounded-3xl blur-xl" />
            <img src="/illustrations/security.svg" alt="Data Security & Access Control" className="relative w-full max-w-[420px] h-auto mx-auto drop-shadow-xl" />
          </div>
        </div>
      </section>

      {/* ── Typical Benefits ── */}
      <section id="benefits" className="px-6 sm:px-10 py-20 sm:py-28 bg-white text-[#1a1a2e]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-3">TYPICAL BENEFITS</h2>
            <p className="text-gray-500 text-sm max-w-lg mx-auto">
              A revolutionary all-in-one toolkit every school needs — by WiSkul
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: '🛡️',
                title: 'Be Protected',
                desc: 'Military-grade encryption secures all student and staff data. GDPR-compliant data handling with full audit trails.',
                color: 'from-[#1a1a2e] to-[#2d1b69]',
              },
              {
                icon: '👥',
                title: 'Know Your Students',
                desc: 'Complete 360° student profiles with academic history, attendance, behavior, and health records in one view.',
                color: 'from-[#16213e] to-[#1a3a5c]',
              },
              {
                icon: '📈',
                title: 'Data-Driven Decisions',
                desc: 'AI-powered analytics surface trends in performance, attendance, and finances before they become problems.',
                color: 'from-[#1a1a2e] to-[#0f3443]',
              },
              {
                icon: '⚡',
                title: 'Instant Communication',
                desc: 'SMS, email, and in-app notifications keep parents, teachers, and students connected in real time.',
                color: 'from-[#1a1a2e] to-[#2d1b69]',
              },
              {
                icon: '🌐',
                title: 'Access Anywhere',
                desc: 'Cloud-based platform accessible from any device. Mobile-optimized dashboards for on-the-go management.',
                color: 'from-[#16213e] to-[#1a3a5c]',
              },
              {
                icon: '🔄',
                title: 'Seamless Integration',
                desc: 'Connect with payment gateways, SMS providers, and existing school tools without disrupting workflows.',
                color: 'from-[#1a1a2e] to-[#0f3443]',
              },
            ].map((benefit) => (
              <div
                key={benefit.title}
                className={`bg-gradient-to-br ${benefit.color} rounded-2xl p-6 text-white hover:-translate-y-1 transition-transform duration-300 shadow-lg hover:shadow-xl`}
              >
                <span className="text-3xl block mb-4">{benefit.icon}</span>
                <h4 className="font-bold text-sm mb-2">{benefit.title}</h4>
                <p className="text-gray-300 text-xs leading-relaxed">{benefit.desc}</p>
              </div>
            ))}
          </div>

          {/* View All Benefits Button */}
          <div className="text-center mt-12">
            <button
              onClick={() => navigate('/benefits')}
              className="inline-flex items-center gap-2 bg-[#00d4aa] hover:bg-[#00e6b8] text-[#1a1a2e] font-bold text-sm px-8 py-3.5 rounded-full transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,212,170,0.3)]"
            >
              View All Benefits
              <span>→</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Ready to Start CTA Banner ── */}
      <section className="px-6 sm:px-10 py-20 bg-[#16213e] border-y border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00d4aa]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10">
          <span className="text-[#00d4aa] text-xs font-bold tracking-[0.2em] uppercase bg-[#00d4aa]/10 px-3.5 py-1.5 rounded-full border border-[#00d4aa]/30">
            Get Started Today
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Ready to Transform Your School Management?
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed max-w-xl mx-auto">
            Join educational institutions already using WiSkul to streamline admissions, generate digital ID cards, track attendance, and empower educators.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/register')}
              className="w-full sm:w-auto bg-[#00d4aa] hover:bg-[#00e6b8] text-[#1a1a2e] font-black text-sm px-8 py-4 rounded-2xl transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,212,170,0.3)] cursor-pointer"
            >
              REGISTER YOUR SCHOOL FREE →
            </button>
            <button
              onClick={() => navigate('/contact')}
              className="w-full sm:w-auto border border-white/20 hover:border-white/40 text-white font-bold text-sm px-8 py-4 rounded-2xl transition-all duration-300 cursor-pointer"
            >
              Contact Support Team
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#0f0f1a] border-t border-white/[0.04] px-6 sm:px-10 py-10">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <img src="/logo.png" alt="WiSkul" className="w-8 h-8 rounded object-contain" />
              <span className="font-black text-base">Wi<span className="text-[#00d4aa]">Skul</span></span>
            </div>
            <p className="text-gray-500 text-xs leading-relaxed">
              Next-generation school management platform protecting student data while empowering educators.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h5 className="text-white font-bold text-xs mb-4 uppercase tracking-wider">Quick Links</h5>
            <ul className="space-y-2">
              {['Dashboard', 'Students', 'Teachers', 'Reports'].map((link) => (
                <li key={link}><span className="text-gray-500 text-xs hover:text-[#00d4aa] cursor-pointer transition-colors">{link}</span></li>
              ))}
            </ul>
          </div>

          {/* Others */}
          <div>
            <h5 className="text-white font-bold text-xs mb-4 uppercase tracking-wider">Resources</h5>
            <ul className="space-y-2">
              {['Documentation', 'API Reference', 'Privacy Policy', 'Terms of Service'].map((link) => (
                <li key={link}><span className="text-gray-500 text-xs hover:text-[#00d4aa] cursor-pointer transition-colors">{link}</span></li>
              ))}
            </ul>
          </div>

          {/* Powered by */}
          <div>
            <h5 className="text-white font-bold text-xs mb-4 uppercase tracking-wider">Powered By</h5>
            <p className="text-gray-500 text-xs leading-relaxed mb-4">Advanced cloud infrastructure with 99.9% uptime guarantee.</p>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-gray-400 hover:text-[#00d4aa] cursor-pointer transition-colors text-xs">𝕏</div>
              <div className="w-8 h-8 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-gray-400 hover:text-[#00d4aa] cursor-pointer transition-colors text-xs">f</div>
              <div className="w-8 h-8 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-gray-400 hover:text-[#00d4aa] cursor-pointer transition-colors text-xs">in</div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-white/[0.04] text-center">
          <p className="text-gray-600 text-[11px]">© {new Date().getFullYear()} WiSkul. All rights reserved. Built with ❤️ for education.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
