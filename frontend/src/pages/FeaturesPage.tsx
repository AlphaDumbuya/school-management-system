/**
 * FeaturesPage — /features
 * Light edu-SaaS theme (see docs/THEME_GUIDE.md): soft off-white page,
 * navy hero + bands, blue brand, orange CTA, white module cards.
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Globe, Zap, Smartphone, Lock, Crown, GraduationCap, Users, Wallet,
  ClipboardCheck, ArrowRight, Check,
} from 'lucide-react';
import PublicNavbar, { PublicFooter } from '@components/public';

const NAVY_BAND = 'bg-gradient-to-br from-[#16235c] via-[#1a2b6b] to-[#20308a]';
const DOT_PATTERN: React.CSSProperties = {
  backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)',
  backgroundSize: '26px 26px',
};

export const FeaturesPage: React.FC = () => {
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-700 overflow-x-hidden font-sans antialiased">
      <PublicNavbar ctaText="Register School Free" />

      {/* ═══ HERO (navy) ═══ */}
      <section className={`relative pt-28 sm:pt-36 pb-20 px-6 sm:px-10 overflow-hidden ${NAVY_BAND}`}>
        <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={DOT_PATTERN} />
        <div className="absolute top-[-10%] right-[-8%] w-[500px] h-[500px] rounded-full bg-white/5 blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-6">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-white/90 text-xs font-bold tracking-widest uppercase">100% Digital Platform</span>
          </span>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-[1.1] mb-6 text-white">
            Your entire school,<br />
            <span className="text-amber-400">completely digital</span>
          </h1>

          <p className="text-blue-100/90 text-sm sm:text-base md:text-lg max-w-3xl mx-auto leading-relaxed mb-10">
            WiSkul transforms every aspect of school operations into a seamless digital experience.
            Parents monitor progress from anywhere, teachers manage classes from any device,
            principals get real-time oversight, and students access everything instantly.
            <span className="text-white font-semibold"> No paperwork. No delays. No boundaries.</span>
          </p>

          {/* Digital benefits grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto mb-12">
            {[
              { icon: Globe, label: 'Access from Anywhere' },
              { icon: Zap, label: 'Real-Time Updates' },
              { icon: Smartphone, label: 'Mobile Friendly' },
              { icon: Lock, label: 'Secure & Private' },
            ].map((b) => (
              <div key={b.label} className="bg-white/[0.07] border border-white/10 rounded-xl p-4 text-center backdrop-blur-sm">
                <span className="inline-flex w-9 h-9 rounded-lg bg-amber-400/20 text-amber-300 items-center justify-center mb-2">
                  <b.icon size={18} />
                </span>
                <span className="text-xs font-bold text-white block">{b.label}</span>
              </div>
            ))}
          </div>

          {/* Role-based access */}
          <div className="bg-white rounded-2xl p-8 max-w-4xl mx-auto text-left shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 mb-5 text-center">Every role, connected in real time</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: Crown, role: 'Principal', desc: 'Full school oversight with analytics, approvals, staff management and financial reports.' },
                { icon: GraduationCap, role: 'Teacher', desc: 'Manage classes, mark attendance, enter grades, create assignments and message parents.' },
                { icon: Users, role: 'Student', desc: 'View timetables, submit assignments, check results, track attendance and get alerts.' },
                { icon: Users, role: 'Parent', desc: 'Follow your child from anywhere — grades, attendance, behaviour, fees and events.' },
                { icon: Wallet, role: 'Accountant', desc: 'Manage fee structures, process payments, generate invoices and run financial reports.' },
                { icon: ClipboardCheck, role: 'Admissions Officer', desc: 'Process applications, manage the pipeline, generate ID cards and track statistics.' },
              ].map((r) => (
                <div key={r.role} className="bg-[#f8fafc] border border-[#e5e9f2] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-8 h-8 rounded-lg bg-blue-50 text-[#1d4ed8] flex items-center justify-center"><r.icon size={16} /></span>
                    <span className="text-sm font-bold text-slate-900">{r.role}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{r.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ v1.0 CORE MODULES (white) ═══ */}
      <section className="px-6 sm:px-10 py-20 bg-white border-b border-[#e5e9f2]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14 space-y-3">
            <span className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 text-[#1d4ed8] text-xs font-bold uppercase tracking-widest">
              <Check size={13} strokeWidth={3} /> v1.0 Operational Core · Free trial for new schools
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Operational v1.0 core modules</h2>
            <div className="w-12 h-1 bg-[#f59e0b] rounded-full mx-auto" />
            <p className="text-slate-500 text-sm max-w-xl mx-auto leading-relaxed">
              Fully operational and available today. See Pricing for what each plan includes.
            </p>
          </div>

          <div className="space-y-8">
            <ModuleSection tintIndex={0} num="01" version="v1" title="Dashboard & Command Centers"
              desc="Role-specific command centers with real-time KPIs, quick actions and visualisations."
              features={[
                "Principal Dashboard — school-wide KPIs: students, teachers, attendance rate, events",
                "Teacher Dashboard — my classes, today's schedule, recent attendance registers",
                "Student Dashboard — my timetable, upcoming assignments, calendar events",
                "Parent Dashboard — child's attendance logs, class placements, events",
                "Admissions Dashboard — application pipeline, enrollment stats, approvals",
              ]} />
            <ModuleSection tintIndex={1} num="02" version="v1" title="Student Management & Profiles"
              desc="Complete student lifecycle from enrollment to graduation — every record digitised."
              features={[
                'Student Directory — searchable database with photos, info, guardians and class placement',
                'Student Profiles — 360° view: bio, class, guardian contacts and attendance history',
                'Multi-Guardian Linking — link parents/guardians with contact info and relationships',
              ]} />
            <ModuleSection tintIndex={2} num="03" version="v1" title="Admissions Workflow & Onboarding"
              desc="Self-service registration and multi-stage application processing."
              features={[
                'Admissions Pipeline — applied → reviewed → accepted → enrolled',
                'Application Review — approval dashboard with student conversion on approval',
                'Application History — full audit trail of details, dates and status changes',
              ]} />
            <ModuleSection tintIndex={3} num="04" version="v1" title="Daily Attendance Registers"
              desc="Classroom attendance tracking with automatic statistics and history."
              features={[
                'Daily Class Marking — present / absent / late / excused by class and section',
                'Attendance Analytics — automatic class and individual attendance percentages',
                'Attendance History — searchable logs per class and per student profile',
              ]} />
            <ModuleSection tintIndex={4} num="05" version="v1" title="Classes, Streams & Subjects"
              desc="Structure your academic framework — Nursery to SSS / K-12 levels."
              features={[
                'Classes & Streams — levels, streams (A/B/C), capacity and class teachers',
                'Subject Mapping — codes, credit hours, departments, mapped to classes and teachers',
              ]} />
            <ModuleSection tintIndex={5} num="06" version="v1" title="Timetable Builder & Exam Schedules"
              desc="Schedule weekly class timetables and examination dates."
              features={[
                'Visual Timetable Builder — period slots, room assignment, printable output',
                'Exam Timetable — schedule by type (CA, Mid-term, Final), dates, venues, supervisors',
              ]} />
            <ModuleSection tintIndex={0} num="07" version="v1" title="Digital ID Cards & Batch Printing"
              desc="Professional identity management with QR verification."
              features={[
                'ID Card Generator — professional cards & badges with school branding',
                'Template Customizer — custom designs with logo, colours and photo positions',
                'QR Verification — unique QR on cards for instant identity verification',
                'Batch Printing — generate cards for whole classes and export to PDF',
              ]} />
            <ModuleSection tintIndex={1} num="08" version="v1" title="Staff & Teacher Directory"
              desc="Manage your teaching team and staff profiles across departments."
              features={[
                'Teacher Profiles — qualifications, specialisations, experience, assigned classes',
                'Support Staff Directory — roles, departments and contact info',
              ]} />
            <ModuleSection tintIndex={2} num="09" version="v1" title="Assignments & Homework"
              desc="Digital homework distribution and student submissions."
              features={[
                'Assignment Creation — descriptions, instructions, due dates and attachments',
                'Online Submissions — students view and submit work through their portal',
              ]} />
            <ModuleSection tintIndex={3} num="10" version="v1" title="School Calendar & Events"
              desc="Plan, publish and notify parents of school activities."
              features={[
                'School Events — single or multi-day events with location and audience',
                'Interactive Calendar — monthly view, colour-coded by category',
                'Portal Announcements — publish events directly to student & parent portals',
              ]} />
            <ModuleSection tintIndex={4} num="11" version="v1" title="Gradebook, Results & Report Cards"
              desc="Enter marks, compute positions and generate terminal report booklets."
              features={[
                'Gradebook — Test 1/2 per subject with auto means, grades and subject ranks',
                'Terminal Reports — SL A4-landscape cards with cognitive, affective & psychomotor domains',
                'Class Positions & Export — auto ranking plus one-click PDF for a student or whole class',
              ]} />
            <ModuleSection tintIndex={5} num="12" version="v1" title="Fees & Online Payments"
              desc="Configure fee structures and collect payments online."
              features={[
                'Fee Structures — per class, term and category with itemised year expenses',
                'Online Payments — mobile money, card, bank transfer and wallets via Monime',
                'Receipts & Reminders — automatic PDF receipts and fee reminders',
                'Discounts & Scholarships — sibling, staff-child and scholarship/bursary discounts, waivers and payment plans',
              ]} />
            <ModuleSection tintIndex={0} num="13" version="v1" title="Expenses, Payroll & Accounting"
              desc="The bursar's full toolkit, from petty cash to financial statements."
              features={[
                'Expenses, Petty Cash & Budgets — record spending and track it against budget',
                'Payroll — salary runs with payslips emailed to staff',
                'Accounting — journal, chart of accounts, financial statements and bank reconciliation',
              ]} />
            <ModuleSection tintIndex={1} num="14" version="v1" title="Announcements & In-app Notifications"
              desc="Keep staff, parents and students informed inside the portal."
              features={[
                'Announcements — to the whole school, a role or a single class, with an optional email copy',
                'Notification Bell — results, fees, admissions and discipline updates in one place',
                'Email Alerts — receipts, report cards, absences and reminders, branded with your school logo',
              ]} />
          </div>
        </div>
      </section>

      {/* ═══ ROADMAP (navy band) ═══ */}
      <section className={`relative px-6 sm:px-10 py-20 overflow-hidden ${NAVY_BAND}`}>
        <div className="absolute inset-0 opacity-[0.1] pointer-events-none" style={DOT_PATTERN} />
        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-14 space-y-3">
            <span className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-amber-300 text-xs font-bold uppercase tracking-widest">
              Version Roadmap
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Coming in v2.0 &amp; v3.0</h2>
            <div className="w-12 h-1 bg-[#f59e0b] rounded-full mx-auto" />
            <p className="text-blue-100/80 text-sm max-w-xl mx-auto leading-relaxed">
              HR, reporting and messaging modules planned for future releases. Not available yet.
            </p>
          </div>

          <div className="space-y-8">
            <ModuleSection dark num="01" version="v2" title="Staff HR: Leave & Performance (v2)"
              desc="Teacher leave requests and performance appraisals."
              features={[
                'Digital Leave Approvals — staff submit requests for principal review',
                'Performance Appraisals — annual goals, criteria and review records',
              ]} />
            <ModuleSection dark num="02" version="v2" title="Reports & Analytics (v2)"
              desc="Cross-module reports for attendance, enrolment, finance and discipline."
              features={[
                'Attendance & Enrolment Reports — trends across classes and terms',
                'Finance & Discipline Reports — school-wide summaries for leadership',
              ]} />
            <ModuleSection dark num="03" version="v3" title="Automated SMS Broadcasts (v3)"
              desc="Bulk SMS for fee reminders and emergency alerts."
              features={[
                'Bulk SMS — broadcasts to parents for reminders, alerts and notices',
                'Automated Triggers — SMS on absence or urgent announcements',
              ]} />
            <ModuleSection dark num="04" version="v3" title="WhatsApp Business API (v3)"
              desc="Direct WhatsApp notifications and report card delivery."
              features={[
                'WhatsApp Alerts — report card releases, receipts and alerts',
                'Interactive Bot — automated fee balance and attendance replies',
              ]} />
          </div>
        </div>
      </section>

      {/* ═══ STATS (light) ═══ */}
      <section className="px-6 sm:px-10 py-16">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Built for scale &amp; security</h2>
            <div className="w-12 h-1 bg-[#f59e0b] rounded-full mx-auto mt-3" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { val: '99.9%', label: 'Uptime' },
              { val: '256-bit', label: 'Encryption' },
              { val: '<200ms', label: 'Response' },
              { val: '6', label: 'User Roles' },
              { val: '12+', label: 'Modules' },
              { val: '∞', label: 'Scalable' },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-[#e5e9f2] rounded-xl p-4 text-center shadow-sm">
                <p className="text-lg sm:text-xl font-black text-[#1d4ed8]">{s.val}</p>
                <p className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA (navy) ═══ */}
      <section className="px-6 sm:px-10 py-16">
        <div className={`max-w-4xl mx-auto relative overflow-hidden rounded-[2rem] px-8 sm:px-14 py-14 text-center ${NAVY_BAND}`}>
          <div className="absolute inset-0 opacity-[0.1] pointer-events-none" style={DOT_PATTERN} />
          <div className="relative z-10">
            <img src="/logo.png" alt="WiSkul" className="w-12 h-12 mx-auto mb-5 rounded-xl object-contain bg-white p-1" />
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">Ready to go digital?</h2>
            <p className="text-blue-100/80 text-sm mb-8 max-w-lg mx-auto">Transform your school into a modern, paperless institution with WiSkul.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={() => navigate('/register')}
                className="w-full sm:w-auto bg-[#f59e0b] hover:bg-[#d97706] text-white font-bold text-sm px-10 py-4 rounded-xl transition-all duration-300 shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2">
                Register School Free <ArrowRight size={16} />
              </button>
              <button onClick={() => navigate('/')}
                className="w-full sm:w-auto border border-white/25 hover:border-white/50 text-white font-bold text-sm px-10 py-4 rounded-xl transition-all duration-300">
                ← Back to Home
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER (shared) ═══ */}
      <PublicFooter />
    </div>
  );
};

// ── Module card ──────────────────────────────────────────────────────────────
// Rotating light tints so each v1 card is visually separated on the white section.
const CARD_TINTS = [
  { card: 'bg-blue-50 border-blue-100', chip: 'bg-blue-100 text-[#1d4ed8]', num: 'bg-[#1d4ed8]' },
  { card: 'bg-emerald-50 border-emerald-100', chip: 'bg-emerald-100 text-emerald-600', num: 'bg-emerald-600' },
  { card: 'bg-amber-50 border-amber-100', chip: 'bg-amber-100 text-amber-600', num: 'bg-amber-500' },
  { card: 'bg-purple-50 border-purple-100', chip: 'bg-purple-100 text-purple-600', num: 'bg-purple-600' },
  { card: 'bg-sky-50 border-sky-100', chip: 'bg-sky-100 text-sky-600', num: 'bg-sky-600' },
  { card: 'bg-rose-50 border-rose-100', chip: 'bg-rose-100 text-rose-600', num: 'bg-rose-600' },
];

interface ModuleSectionProps {
  num: string;
  title: string;
  desc: string;
  features: string[];
  version: 'v1' | 'v2' | 'v3';
  dark?: boolean;
  tintIndex?: number;
}

const ModuleSection: React.FC<ModuleSectionProps> = ({ num, title, desc, features, version, dark, tintIndex = 0 }) => {
  const badge =
    version === 'v1'
      ? { cls: 'bg-blue-100 text-[#1d4ed8]', label: 'Available now' }
      : version === 'v2'
      ? { cls: 'bg-amber-100 text-amber-700', label: 'Coming in v2' }
      : { cls: 'bg-purple-100 text-purple-700', label: 'Coming in v3' };

  const tint = CARD_TINTS[tintIndex % CARD_TINTS.length];

  return (
    <div className={`rounded-2xl p-7 sm:p-8 transition-all hover:shadow-lg hover:-translate-y-0.5 ${dark ? 'bg-white/[0.06] border border-white/10 backdrop-blur-sm' : `${tint.card} border shadow-sm`}`}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-4">
          <span className={`inline-flex items-center justify-center w-11 h-11 rounded-full text-sm font-black text-white flex-shrink-0 ${dark ? 'bg-amber-500' : tint.num}`}>
            {num}
          </span>
          <div>
            <h3 className={`text-xl sm:text-2xl font-black ${dark ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
            <p className={`text-xs sm:text-sm mt-0.5 ${dark ? 'text-blue-100/70' : 'text-slate-600'}`}>{desc}</p>
          </div>
        </div>
        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${badge.cls}`}>{badge.label}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {features.map((f) => {
          const parts = f.split(' — ');
          return (
            <div key={f} className={`flex items-start gap-3 rounded-xl px-4 py-3 ${dark ? 'bg-white/[0.04] border border-white/[0.06]' : 'bg-white/70 border border-white'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0 ${dark ? 'bg-amber-400/20 text-amber-300' : tint.chip}`}>
                <Check size={11} strokeWidth={3} />
              </span>
              <div className="flex-1 min-w-0">
                {parts.length > 1 ? (
                  <>
                    <span className={`text-sm font-bold block ${dark ? 'text-white' : 'text-slate-900'}`}>{parts[0]}</span>
                    <span className={`text-xs block mt-0.5 leading-relaxed ${dark ? 'text-blue-100/60' : 'text-slate-600'}`}>{parts[1]}</span>
                  </>
                ) : (
                  <span className={`text-xs leading-relaxed ${dark ? 'text-blue-100/70' : 'text-slate-700'}`}>{f}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FeaturesPage;
