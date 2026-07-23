/**
 * FeaturesPage — /features
 * Comprehensive features showcase for WiSkul.
 * Covers every module in the platform with the digital-first philosophy.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicNavbar from '@components/public';

export const FeaturesPage: React.FC = () => {
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

      {/* ── Coming Soon Alert ── */}
      {showAlert && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100]" style={{ animation: 'fadeInDown 0.4s ease-out' }}>
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

      {/* ── Hero ── */}
      <section className="pt-32 pb-20 px-6 sm:px-10 relative overflow-hidden">
        <div className="absolute top-[10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600/8 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-cyan-500/5 blur-[100px]" />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 bg-[#00d4aa]/10 border border-[#00d4aa]/20 rounded-full px-5 py-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-[#00d4aa] animate-pulse" />
            <span className="text-[#00d4aa] text-xs font-bold tracking-widest uppercase">100% Digital Platform</span>
          </span>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-6">
            Your Entire School,<br />
            <span className="text-[#00d4aa]">Completely Digital</span>
          </h1>

          <p className="text-gray-400 text-sm sm:text-base md:text-lg max-w-3xl mx-auto leading-relaxed mb-10">
            WiSkul transforms every aspect of school operations into a seamless digital experience.
            Parents can monitor their child's progress from anywhere in the world. Teachers manage
            classes, grades, and communication from any device. Principals have full oversight with
            real-time dashboards. Students access assignments, results, and schedules instantly.
            <span className="text-white font-semibold"> No paperwork. No delays. No boundaries.</span>
          </p>

          {/* Digital benefits grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto mb-12">
            {[
              { icon: '🌍', label: 'Access from Anywhere' },
              { icon: '⚡', label: 'Real-Time Updates' },
              { icon: '📱', label: 'Mobile Friendly' },
              { icon: '🔒', label: 'Secure & Private' },
            ].map((b) => (
              <div key={b.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
                <span className="text-2xl block mb-2">{b.icon}</span>
                <span className="text-xs font-bold text-gray-300">{b.label}</span>
              </div>
            ))}
          </div>

          {/* Role-based access explanation */}
          <div className="bg-[#16213e] border border-white/[0.06] rounded-2xl p-8 max-w-4xl mx-auto text-left">
            <h3 className="text-lg font-black text-white mb-4 text-center">Every Role, Connected in Real-Time</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { emoji: '👑', role: 'Principal', desc: 'Full school oversight with analytics, approvals, staff management, and financial reports — all from one dashboard.' },
                { emoji: '👨‍🏫', role: 'Teacher', desc: 'Manage classes, mark attendance, enter grades, create assignments, and communicate with parents digitally.' },
                { emoji: '🎓', role: 'Student', desc: 'View timetables, submit assignments, check results, track attendance, and receive notifications instantly.' },
                { emoji: '👨‍👩‍👧', role: 'Parent', desc: 'Follow your child\'s academic journey from anywhere — grades, attendance, behavior, fees, and school events.' },
                { emoji: '💰', role: 'Accountant', desc: 'Manage fee structures, process payments, generate invoices, track expenses, and run financial reports.' },
                { emoji: '📋', role: 'Admissions Officer', desc: 'Process applications, manage enrollment pipeline, generate ID cards, and track admission statistics.' },
              ].map((r) => (
                <div key={r.role} className="bg-[#1a1a2e] border border-white/[0.05] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{r.emoji}</span>
                    <span className="text-sm font-bold text-white">{r.role}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">{r.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── All Modules ── */}
      <section className="px-6 sm:px-10 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#7c3aed] text-xs font-bold tracking-[0.3em] uppercase">Complete Toolkit</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mt-3 mb-3">Every Module, Explained</h2>
            <p className="text-gray-500 text-sm max-w-lg mx-auto">
              Explore the full capabilities of every section in the WiSkul platform.
            </p>
          </div>

          <div className="space-y-20">
            {/* ═══ DASHBOARD ═══ */}
            <ModuleSection
              num="01"
              title="Dashboard & Command Centers"
              color="#00d4aa"
              versionBadge="v1"
              desc="Role-specific command centers with real-time KPIs, quick actions, and data visualizations tailored to each user's responsibilities."
              features={[
                'Principal Dashboard — school-wide KPIs: total students, teachers, attendance rate, upcoming events',
                'Teacher Dashboard — my classes, today\'s schedule, recent class attendance registers',
                'Student Dashboard — my timetable, upcoming assignments, school calendar events',
                'Parent Dashboard — child\'s attendance logs, class placements, school events',
                'Admissions Dashboard — application pipeline, enrollment stats, pending approvals',
              ]}
            />

            {/* ═══ ACADEMIC ═══ */}
            <ModuleSection
              num="02"
              title="Academic Management"
              color="#7c3aed"
              versionBadge="v1"
              desc="The complete operational academic backbone — class structures, timetables, and assignments."
              features={[
                'Classes & Streams — create classes by level (Nursery to SSS), assign streams (A, B, C), set capacity, assign class teachers',
                'Subject Allocation — configure subjects with codes, departments, and map to classes and teachers',
                'Timetable Builder — visual timetable builder with period slots, room assignment, and printable schedule output',
                'Assignments & Homework — create assignments with descriptions, due dates, attachments; students submit online',
                'Exam Timetable Scheduling — schedule exams by type (CA, Mid-term, Final), dates, venues, and supervisors',
                'Gradebook & Report Cards — term mark sheets, grading scales, PDF report card generation (v2.0 Roadmap)',
                'Promotions Engine — bulk student class advancement & retention criteria (v2.0 Roadmap)',
              ]}
            />

            {/* ═══ STUDENTS ═══ */}
            <ModuleSection
              num="03"
              title="Student Management"
              color="#00d4aa"
              versionBadge="v1"
              desc="Complete student lifecycle from first application to active student status."
              features={[
                'Student Directory — searchable database of all students with photos, personal info, guardian details, and class placement',
                'Admissions Pipeline — multi-stage admission workflow (applied → reviewed → accepted → enrolled)',
                'Student Profiles — 360° view: bio, class placement, guardian contact details, and attendance history',
                'Daily Attendance — daily marking (present/absent/late/excused) by class with automatic percentage calculation',
              ]}
            />

            {/* ═══ STAFF ═══ */}
            <ModuleSection
              num="04"
              title="Staff Directory & HR"
              color="#7c3aed"
              versionBadge="v1"
              desc="Manage your teaching team and staff profiles across departments."
              features={[
                'Teacher Profiles — qualifications, specializations, experience, assigned classes and subjects',
                'Support Staff Directory — staff profiles with roles, departments, and contact info',
                'Digital Leave Management — staff leave applications and principal approval workflows (v2.0 Roadmap)',
                'Performance Appraisals — annual goals, appraisals, and evaluation tracking (v2.0 Roadmap)',
              ]}
            />

            {/* ═══ FINANCE ═══ */}
            <ModuleSection
              num="05"
              title="Financial & Fee Management"
              color="#00d4aa"
              versionBadge="v2"
              desc="Automated school billing, receipts, mobile payments, and expense tracking (v2.0 Release)."
              features={[
                'Fee Structures — configure fees by class, term, and category (tuition, exam, library, transport)',
                'Automated Invoicing — auto-generate digital fee invoices per student and track paid/unpaid status',
                'Mobile Money & Bank Receipts — record payments by Orange Money / Bank transfer, auto-generate official receipts',
                'School Expenses & Payroll — track school operational expenditures, purchase approvals, and staff payslips',
              ]}
            />

            {/* ═══ COMMUNICATION ═══ */}
            <ModuleSection
              num="06"
              title="Communication Hub"
              color="#7c3aed"
              versionBadge="v2"
              desc="Automated SMS broadcasts, WhatsApp parent alerts, and email notifications (v2.0 / v3.0 Release)."
              features={[
                'School Announcements — school-wide or role-targeted announcements with rich text and attachments',
                'SMS Parent Broadcasts — bulk SMS to parents for fee reminders, attendance alerts, and emergency updates',
                'WhatsApp Business API — automated WhatsApp notifications for report cards, payment receipts, and alerts',
                'Internal In-App Messaging — direct messaging between teachers, parents, and administrative staff',
              ]}
            />

            {/* ═══ IDENTITY ═══ */}
            <ModuleSection
              num="07"
              title="Identity & ID Card Generator"
              color="#00d4aa"
              versionBadge="v1"
              desc="Professional identity management with digital card generation and QR verification."
              features={[
                'ID Cards — generate professional PVC cards and lanyard badges for students and staff with school branding',
                'Card Templates — customizable card designs with logo placement, color schemes, and photo positions',
                'QR Verification — unique QR code on cards for identity verification and status validation',
                'Batch Card Printing — generate cards for entire classes or departments in one click and export to PDF',
              ]}
            />

            {/* ═══ EVENTS ═══ */}
            <ModuleSection
              num="08"
              title="Events & School Calendar"
              color="#7c3aed"
              versionBadge="v1"
              desc="Plan, manage, and publish every school activity — sports day, parent meetings, and holidays."
              features={[
                'School Events — create single-day or multi-day events with location, description, and target audience',
                'Interactive Calendar — monthly calendar showing school events color-coded by category',
                'Event Notices — publish upcoming events directly to student and parent portals',
              ]}
            />

            {/* ═══ REPORTS ═══ */}
            <ModuleSection
              num="09"
              title="Reports & Analytics"
              color="#00d4aa"
              desc="Data-driven insights across every dimension of school operations."
              features={[
                'Academic Reports — student performance by term, subject-wise analysis, class rankings, grade distribution charts, comparison across terms',
                'Financial Reports — revenue collected vs target, outstanding balances by class, payment method breakdown, expense summaries, budget utilization',
                'Attendance Reports — daily/weekly/monthly attendance by class, chronic absentee identification, attendance trends over time, teacher attendance',
                'Enrollment Reports — admission pipeline statistics, enrollment by class and gender, year-over-year growth, retention and dropout rates',
                'Discipline Reports — incident frequency by type and severity, repeat offenders, resolution timelines, behavioral trend analysis',
                'Custom Exports — all reports exportable to PDF and Excel with date range filters and role-based data scoping',
              ]}
            />
          </div>
        </div>
      </section>

      {/* ── Platform Highlights ── */}
      <section className="px-6 sm:px-10 py-20 bg-[#16213e]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-black">Built for Scale & Security</h2>
            <p className="text-gray-500 text-sm mt-2">Enterprise-grade infrastructure trusted by schools</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { val: '99.9%', label: 'Uptime' },
              { val: '256-bit', label: 'Encryption' },
              { val: '<200ms', label: 'Response' },
              { val: '6', label: 'User Roles' },
              { val: '50+', label: 'Modules' },
              { val: '∞', label: 'Scalable' },
            ].map((s) => (
              <div key={s.label} className="bg-[#1a1a2e] border border-white/[0.06] rounded-xl p-4 text-center">
                <p className="text-lg sm:text-xl font-black bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">{s.val}</p>
                <p className="text-[10px] text-gray-500 font-medium mt-1 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 sm:px-10 py-20">
        <div className="max-w-2xl mx-auto text-center">
          <img src="/logo.png" alt="WiSkul" className="w-12 h-12 mx-auto mb-5 rounded-xl object-contain" />
          <h2 className="text-2xl sm:text-3xl font-black mb-3">Ready to Go Digital?</h2>
          <p className="text-gray-400 text-sm mb-8">Transform your school into a modern, paperless institution with WiSkul.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto bg-[#00d4aa] hover:bg-[#00e6b8] text-[#1a1a2e] font-bold text-sm px-10 py-4 rounded-full transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,212,170,0.3)]"
            >
              SIGN IN NOW
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full sm:w-auto border border-white/10 hover:border-white/25 text-white font-bold text-sm px-10 py-4 rounded-full transition-all duration-300"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#0f0f1a] border-t border-white/[0.04] px-6 sm:px-10 py-8 text-center">
        <p className="text-gray-600 text-[11px]">© {new Date().getFullYear()} WiSkul. All rights reserved. Built with ❤️ for education.</p>
      </footer>
    </div>
  );
};

// ── Module Section Component ──────────────────────────────────────────────────

interface ModuleSectionProps {
  num: string;
  title: string;
  color: string;
  desc: string;
  features: string[];
  versionBadge?: 'v1' | 'v2';
}

const ModuleSection: React.FC<ModuleSectionProps> = ({ num, title, color, desc, features, versionBadge = 'v1' }) => (
  <div className="bg-[#16213e]/50 border border-white/[0.04] rounded-2xl p-7 sm:p-9 relative overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
      <div className="flex items-center gap-4">
        <span
          className="inline-flex items-center justify-center w-11 h-11 rounded-full text-sm font-black flex-shrink-0"
          style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}
        >
          {num}
        </span>
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-white">{title}</h3>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">{desc}</p>
        </div>
      </div>

      <span
        className={`text-[10px] font-black px-3.5 py-1 rounded-full uppercase tracking-wider ${
          versionBadge === 'v1'
            ? 'bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/30'
            : 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
        }`}
      >
        {versionBadge === 'v1' ? '✓ v1.0 FREE CORE RELEASE' : '🚀 UPCOMING v2.0 ROADMAP'}
      </span>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
      {features.map((f) => {
        const parts = f.split(' — ');
        return (
          <div key={f} className="flex items-start gap-3 bg-[#1a1a2e]/70 border border-white/[0.03] rounded-xl px-4 py-3">
            <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: color }} />
            <div>
              {parts.length > 1 ? (
                <>
                  <span className="text-sm font-bold text-white">{parts[0]}</span>
                  <span className="text-xs text-gray-400 block mt-0.5 leading-relaxed">{parts[1]}</span>
                </>
              ) : (
                <span className="text-xs text-gray-300 leading-relaxed">{f}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export default FeaturesPage;
