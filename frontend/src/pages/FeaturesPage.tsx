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

      {/* ── SECTION 1: v1.0 OPERATIONAL MODULES (100% FREE CORE) ── */}
      <section className="px-6 sm:px-10 py-16 bg-[#0a0a14]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <span className="inline-flex items-center gap-2 bg-[#00d4aa]/10 border border-[#00d4aa]/30 rounded-full px-4 py-1.5 text-[#00d4aa] text-xs font-bold uppercase tracking-widest">
              ✓ v1.0 Operational Core · 100% Free for All Schools
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Operational v1.0 Core Modules
            </h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto leading-relaxed">
              These features are fully operational, tested, and included free of charge in your school workspace today.
            </p>
          </div>

          <div className="space-y-12">
            {/* 01: DASHBOARD */}
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

            {/* 02: STUDENT DIRECTORY & PROFILES */}
            <ModuleSection
              num="02"
              title="Student Management & Profiles"
              color="#00d4aa"
              versionBadge="v1"
              desc="Complete student lifecycle from enrollment to graduation — every record digitized."
              features={[
                'Student Directory — searchable database of all students with photos, personal info, guardian details, and class placement',
                'Student Profiles — 360° view: bio, class placement, guardian contact details, and attendance history',
                'Multi-Guardian Linking — link parents/guardians to student records with contact info and relationship designations',
              ]}
            />

            {/* 03: ADMISSIONS PIPELINE */}
            <ModuleSection
              num="03"
              title="Admissions Workflow & Onboarding"
              color="#00d4aa"
              versionBadge="v1"
              desc="Self-service student registration and multi-stage application processing."
              features={[
                'Admissions Pipeline — multi-stage application processing (applied → reviewed → accepted → enrolled)',
                'Application Review — admissions officer approval dashboard with student conversion upon approval',
                'Application History — full audit trail of applicant details, submission dates, and status changes',
              ]}
            />

            {/* 04: DAILY ATTENDANCE */}
            <ModuleSection
              num="04"
              title="Daily Attendance Registers"
              color="#00d4aa"
              versionBadge="v1"
              desc="Classroom attendance tracking with automatic statistics and history."
              features={[
                'Daily Class Marking — mark attendance (present/absent/late/excused) by class and section',
                'Attendance Analytics — automatic class and individual student attendance percentage calculation',
                'Attendance History — searchable historical attendance logs per class and per student profile',
              ]}
            />

            {/* 05: ACADEMIC OPERATIONAL CORE */}
            <ModuleSection
              num="05"
              title="Classes, Streams & Subject Allocation"
              color="#00d4aa"
              versionBadge="v1"
              desc="Structure your academic framework — Nursery to SSS / K-12 levels."
              features={[
                'Classes & Streams — create classes by level (Nursery to SSS), assign streams (A, B, C), set capacity, assign class teachers',
                'Subject Mapping — configure subjects with codes, credit hours, departments, and map to classes and teachers',
              ]}
            />

            {/* 06: TIMETABLES & EXAM SCHEDULING */}
            <ModuleSection
              num="06"
              title="Timetable Builder & Exam Schedules"
              color="#00d4aa"
              versionBadge="v1"
              desc="Schedule weekly class timetables and examination dates."
              features={[
                'Visual Timetable Builder — builder with period slots, room assignment, and printable schedule output',
                'Exam Timetable Scheduling — schedule exams by type (CA, Mid-term, Final), dates, venues, and supervisors',
              ]}
            />

            {/* 07: IDENTITY & ID CARD GENERATOR */}
            <ModuleSection
              num="07"
              title="Digital ID Card Design & Batch Printing"
              color="#00d4aa"
              versionBadge="v1"
              desc="Professional identity management with digital card generation and QR verification."
              features={[
                'ID Card Generator — generate professional PVC cards and lanyard badges for students and staff with school branding',
                'Card Template Customizer — custom designs with school logo, color schemes, and photo positions',
                'QR Verification — unique QR code on cards for instant identity verification',
                'Batch Card Printing — generate cards for entire classes or departments in one click and export to PDF',
              ]}
            />

            {/* 08: STAFF & TEACHER DIRECTORY */}
            <ModuleSection
              num="08"
              title="Staff & Teacher Directory"
              color="#00d4aa"
              versionBadge="v1"
              desc="Manage your teaching team and staff profiles across departments."
              features={[
                'Teacher Profiles — qualifications, specializations, experience, assigned classes and subjects',
                'Support Staff Directory — staff profiles with roles, departments, and contact info',
              ]}
            />

            {/* 09: ASSIGNMENTS & HOMEWORK */}
            <ModuleSection
              num="09"
              title="Assignments & Homework Submissions"
              color="#00d4aa"
              versionBadge="v1"
              desc="Digital homework distribution and student submissions."
              features={[
                'Assignment Creation — create assignments with descriptions, instructions, due dates, and file attachments',
                'Online Submissions — students view assignments and submit work digitally through their portal',
              ]}
            />

            {/* 10: EVENTS & CALENDAR */}
            <ModuleSection
              num="10"
              title="School Calendar & Events"
              color="#00d4aa"
              versionBadge="v1"
              desc="Plan, publish, and notify parents of school activities."
              features={[
                'School Events — create single-day or multi-day events with location, description, and target audience',
                'Interactive Calendar — monthly calendar showing school events color-coded by category',
                'Portal Announcements — publish upcoming events directly to student and parent portals',
              ]}
            />

            <ModuleSection
              num="11"
              title="Gradebook, Results & PDF Report Cards"
              color="#00d4aa"
              versionBadge="v1"
              desc="Enter marks, compute positions, and generate terminal report booklets."
              features={[
                'Gradebook & Mark Entry — record Test 1/Test 2 per subject with auto-computed means, grades, and subject ranks',
                'Terminal Report Booklets — Sierra Leone A4-landscape report cards with cognitive, affective & psychomotor domains',
                'Class Positions & Whole-Class Export — auto class ranking plus one-click PDF for a single student or the whole class',
              ]}
            />

            <ModuleSection
              num="12"
              title="End-of-Year Student Promotions"
              color="#00d4aa"
              versionBadge="v1"
              desc="Advance or retain students based on yearly performance."
              features={[
                'Bulk Promotion — advance qualifying students to the next class at year end',
                'Promotion Recommendations — auto pass/repeat guidance from yearly percentages',
                'Session-Aware — promotions respect the active academic session and class structure',
              ]}
            />
          </div>
        </div>
      </section>

      {/* ── SECTION 2: UPCOMING VERSION ROADMAP (v2.0 & v3.0) ── */}
      <section className="px-6 sm:px-10 py-16 bg-[#16213e]/60 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <span className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 rounded-full px-4 py-1.5 text-purple-300 text-xs font-bold uppercase tracking-widest">
              🚀 Version Roadmap · Upcoming v2.0 & v3.0 Releases
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Upcoming Advanced Modules (v2.0 / v3.0)
            </h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto leading-relaxed">
              These advanced financial, HR, and messaging modules are planned for future version releases.
            </p>
          </div>

          <div className="space-y-12">
            {/* V2-01: FINANCIAL MANAGEMENT */}
            <ModuleSection
              num="01"
              title="Automated Fee Billing & Receipts (Coming in v2)"
              color="#7c3aed"
              versionBadge="v2"
              desc="Automated tuition billing, receipts, mobile payments, and expense tracking."
              features={[
                'Fee Structures — configure fees by class, term, and category (tuition, exam, library, transport)',
                'Automated Invoicing — auto-generate digital fee invoices per student and track paid/unpaid status',
                'Mobile Money & Bank Receipts — record payments by Orange Money / Bank transfer, auto-generate official receipts',
                'School Expenses & Payroll — track school operational expenditures, purchase approvals, and staff payslips',
              ]}
            />

            {/* V2-02: STAFF HR LEAVE */}
            <ModuleSection
              num="02"
              title="Staff Digital Leave & Performance (Coming in v2)"
              color="#7c3aed"
              versionBadge="v2"
              desc="Teacher leave requests and performance appraisals."
              features={[
                'Digital Leave Approvals — staff submit leave requests digitally for principal review and approval',
                'Performance Appraisals — annual goals, evaluation criteria, and performance review records',
              ]}
            />

            {/* V3-01: SMS BROADCASTS */}
            <ModuleSection
              num="03"
              title="Automated SMS Parent Broadcasts (Coming in v3)"
              color="#3b82f6"
              versionBadge="v3"
              desc="Bulk SMS notifications for fee reminders and emergency school alerts."
              features={[
                'Bulk SMS Messaging — send bulk SMS broadcasts to parents for fee reminders, attendance alerts, and notices',
                'Automated Triggers — automatic SMS alerts sent upon student absence or urgent school announcement',
              ]}
            />

            {/* V3-02: WHATSAPP BUSINESS API */}
            <ModuleSection
              num="04"
              title="WhatsApp Business API Integration (Coming in v3)"
              color="#3b82f6"
              versionBadge="v3"
              desc="Direct WhatsApp notifications and report card delivery."
              features={[
                'WhatsApp Parent Alerts — automated WhatsApp messages for report card releases, payment receipts, and alerts',
                'Interactive Parent Bot — automated responses for parent fee balance inquiries and attendance checks',
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
  versionBadge?: 'v1' | 'v2' | 'v3';
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
            : versionBadge === 'v2'
            ? 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
            : 'bg-blue-500/10 text-blue-300 border border-blue-500/30'
        }`}
      >
        {versionBadge === 'v1' ? '✓ v1.0 Operational (Free)' : versionBadge === 'v2' ? '🚀 Coming in v2' : '⚡ Coming in v3'}
      </span>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
      {features.map((f) => {
        const parts = f.split(' — ');
        const isV2 = f.includes('(Coming v2)');
        const isV3 = f.includes('(Coming v3)');
        return (
          <div key={f} className="flex items-start gap-3 bg-[#1a1a2e]/70 border border-white/[0.03] rounded-xl px-4 py-3 relative">
            <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: color }} />
            <div className="flex-1">
              {parts.length > 1 ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-white">{parts[0]}</span>
                    {isV2 && <span className="text-[9px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-mono font-bold">Coming in v2</span>}
                    {isV3 && <span className="text-[9px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-mono font-bold">Coming in v3</span>}
                  </div>
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
