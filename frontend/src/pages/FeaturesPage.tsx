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
      <PublicNavbar ctaText="Start Free Trial" />

      {/* ═══ HERO (navy) ═══ */}
      <section className={`relative pt-28 sm:pt-36 pb-20 px-6 sm:px-10 overflow-hidden ${NAVY_BAND}`}>
        <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={DOT_PATTERN} />
        <div className="absolute top-[-10%] right-[-8%] w-[500px] h-[500px] rounded-full bg-white/5 blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-6">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-white/90 text-xs font-bold tracking-widest uppercase">Features</span>
          </span>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-[1.1] mb-6 text-white">
            Your whole school,<br />
            <span className="text-amber-400">in one platform</span>
          </h1>

          <p className="text-blue-100/90 text-sm sm:text-base md:text-lg max-w-3xl mx-auto leading-relaxed mb-10">
            WiSkul puts your school's daily work online. Principals see the whole school,
            teachers manage their classes from any device, bursars run fees and accounts,
            parents follow attendance, results and fees, and students check timetables,
            assignments and results in their own portal.
          </p>

          {/* Digital benefits grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto mb-12">
            {[
              { icon: Globe, label: 'Works in the Browser' },
              { icon: Zap, label: 'In-app Notifications' },
              { icon: Smartphone, label: 'Android App & PWA' },
              { icon: Lock, label: '2FA & Passkeys' },
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
            <h3 className="text-lg font-black text-slate-900 mb-5 text-center">A portal and dashboard for every role</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: Crown, role: 'Principal', desc: 'School-wide dashboard, staff management, approvals such as discounts, and financial statements.' },
                { icon: GraduationCap, role: 'Teacher', desc: 'Mark attendance (also offline), enter grades, set assignments and post announcements to your classes.' },
                { icon: Users, role: 'Student', desc: 'View timetables, submit assignments online, check results and attendance, and see notifications.' },
                { icon: Users, role: 'Parent', desc: "Follow your child's attendance, results, report cards and events, and pay fees online." },
                { icon: Wallet, role: 'Bursar / Accountant', desc: 'Fee structures, invoices, payments, discounts, expenses, payroll and accounting.' },
                { icon: ClipboardCheck, role: 'Admissions Officer', desc: 'Review online applications, move them through the pipeline and generate ID cards.' },
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
              <Check size={13} strokeWidth={3} /> Available now · Free trial for new schools
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Modules available today</h2>
            <div className="w-12 h-1 bg-[#f59e0b] rounded-full mx-auto" />
            <p className="text-slate-500 text-sm max-w-xl mx-auto leading-relaxed">
              Everything below is live in WiSkul today. Some modules depend on your plan; see Pricing for what each plan includes.
            </p>
          </div>

          <div className="space-y-8">
            <ModuleSection tintIndex={0} num="01" version="v1" title="Role Dashboards"
              desc="Each role has its own dashboard with key figures and quick actions."
              features={[
                "Principal Dashboard — school-wide figures: students, teachers, attendance rate, events",
                "Teacher Dashboard — my classes, today's schedule, recent attendance registers",
                "Bursar Dashboard — fees, payments and outstanding balances",
                "Student Dashboard — my timetable, upcoming assignments, calendar events",
                "Parent Dashboard — child's attendance, class placement, fees and events",
                "Admissions Dashboard — application pipeline, enrolment figures, approvals",
              ]} />
            <ModuleSection tintIndex={1} num="02" version="v1" title="Student Management & Profiles"
              desc="From admission to promotion, with each student's records in one place."
              features={[
                'Student Directory — searchable list with photos, guardians and class placement',
                'Student Profiles — bio, class, guardian contacts and attendance history',
                'Multi-Guardian Linking — link several parents or guardians with contact details and relationships',
                'Discipline & Conduct — infractions, detentions, conduct reports and appeals',
                'Promotions & Archive — promote classes at year end and keep past years on record',
              ]} />
            <ModuleSection tintIndex={2} num="03" version="v1" title="Admissions & Online Applications"
              desc="A public application form for your school and a staged review pipeline."
              features={[
                'Online Application Form — a public link for your school where parents apply online',
                'Admissions Pipeline — pending → review → interview → approved, waitlisted or rejected → enrolled',
                'Enrolment on Approval — approved applicants become student records',
                'Decision Emails — applicants are emailed when a decision is made',
              ]} />
            <ModuleSection tintIndex={3} num="04" version="v1" title="Daily Attendance Registers"
              desc="Class registers, staff sign-in and attendance history."
              features={[
                'Daily Class Marking — present / absent / late / excused by class',
                'Offline Marking — teachers can mark attendance without a connection in the app; it syncs later',
                'Absence Alerts — guardians are emailed when a student is marked absent',
                'Staff Sign-in & Sign-out — daily attendance for teaching and admin staff',
                'Attendance Rates & History — per-student attendance rate and logs per class and student',
              ]} />
            <ModuleSection tintIndex={4} num="05" version="v1" title="Classes, Streams & Subjects"
              desc="Structure your school from Nursery and Primary to JSS and SSS, across academic years."
              features={[
                'Classes & Streams — levels, streams (A/B/C), capacity and class teachers',
                'Subject Mapping — codes, credits and departments, mapped to classes and teachers',
              ]} />
            <ModuleSection tintIndex={5} num="06" version="v1" title="Timetable Builder & Exam Schedules"
              desc="Schedule weekly class timetables and examination dates."
              features={[
                'Timetable Builder — weekly period slots with teacher and room',
                'Exam Timetable — schedule by exam type, date, session and venue',
              ]} />
            <ModuleSection tintIndex={0} num="07" version="v1" title="ID Cards & Batch Printing"
              desc="Student and staff ID cards with QR verification."
              features={[
                'ID Card Generator — cards and badges with your school branding',
                'Template Designer — your own designs with logo, colours and photo',
                'QR Verification — each card carries a QR code that can be checked on the public verification page',
                'Batch Printing — generate cards for whole classes and export to PDF',
              ]} />
            <ModuleSection tintIndex={1} num="08" version="v1" title="Staff & Teacher Directory"
              desc="Manage teaching, admin and support staff."
              features={[
                'Teacher Profiles — qualifications, specialisations, experience, assigned classes',
                'Support Staff Records — non-teaching staff records that do not need a login',
                'Staff Duties — a teacher can also act as Bursar or Admissions Officer',
              ]} />
            <ModuleSection tintIndex={2} num="09" version="v1" title="Assignments & Homework"
              desc="Set homework and collect student submissions online."
              features={[
                'Assignment Creation — descriptions, instructions, due dates and marks',
                'Online Submissions — students view and submit work through their portal',
              ]} />
            <ModuleSection tintIndex={3} num="10" version="v1" title="School Calendar & Events"
              desc="Plan and publish school activities."
              features={[
                'School Events — single or multi-day events with location and audience',
                'Calendar — monthly view, colour-coded by category',
                'Registrations & RSVP — collect sign-ups, with event analytics for the principal',
              ]} />
            <ModuleSection tintIndex={4} num="11" version="v1" title="Gradebook, Results & Report Cards"
              desc="Enter marks, compute positions and generate Sierra Leone report cards."
              features={[
                'Gradebook — Test 1 / Test 2 or CA + Exam per subject, with automatic means, grades and subject ranks',
                'Terminal Reports — Sierra Leone A4 report cards with cognitive, affective & psychomotor domains',
                'Class Positions & PDF — automatic ranking; PDF for one student, as a booklet, or a whole class in one batch',
                'QR Verification — each report card has a QR code that can be scanned to confirm it is genuine',
              ]} />
            <ModuleSection tintIndex={5} num="12" version="v1" title="Fees & Online Payments"
              desc="Configure fee structures and collect payments online."
              features={[
                'Fee Structures & Invoices — per class, term and category',
                'Online Payments — mobile money and card through Monime; parents and students pay from My Fees',
                'Receipts & Reminders — PDF receipts for payments and fee reminder emails',
                'Discounts & Scholarships — sibling, staff-child and scholarship/bursary discounts (percent or fixed, principal approval), plus waivers',
                'Arrears & Payment Plans — arrears and ageing, late fees, instalment plans and account credit',
              ]} />
            <ModuleSection tintIndex={0} num="13" version="v1" title="Expenses, Payroll & Accounting"
              desc="The bursar's toolkit, from petty cash to financial statements."
              features={[
                'Expenses, Petty Cash & Budgets — record spending and track it against budget',
                'Payroll — salary runs with PDF payslips emailed to staff, plus a My Payslips page',
                'Accounting — journal, chart of accounts, financial statements and bank reconciliation',
                'Finance Audit Log — a record of changes to financial data',
              ]} />
            <ModuleSection tintIndex={1} num="14" version="v1" title="Announcements & In-app Notifications"
              desc="Keep staff, parents and students informed inside the portal."
              features={[
                'Announcements — to the whole school, a role or a single class, with an optional email copy',
                'Notification Bell — results, fees, admissions and discipline updates in one place',
                'Email Alerts — receipts, invoices, report cards, absences, admissions decisions and payslips, branded with your school logo',
                'Help Centre & Support Tickets — guides inside the app and a way to raise a ticket with the WiSkul team',
              ]} />
            <ModuleSection tintIndex={2} num="15" version="v1" title="Security, Mobile & Exports"
              desc="Protected sign-in, access on the go and your data in standard formats."
              features={[
                'Two-Factor & Passkeys — authenticator-app codes, and fingerprint or face sign-in on supported devices',
                "Role-Based Access — each role sees only what it needs; each school's data is kept separate",
                'Android App & PWA — download the Android app or install WiSkul from the browser',
                'Exports — Excel, PDF and CSV from module lists such as students, staff, attendance, invoices, payments and payroll',
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
              HR, reporting and messaging modules planned for future releases. These are not available yet.
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
            <ModuleSection dark num="03" version="v2" title="In-app Messaging (v2)"
              desc="Direct messages between staff, parents and students inside WiSkul."
              features={[
                'Direct Messages — private conversations inside the portal',
                'Parent–Teacher Conversations — follow up on a student without leaving WiSkul',
              ]} />
            <ModuleSection dark num="04" version="v3" title="Automated SMS Broadcasts (v3)"
              desc="Bulk SMS for fee reminders and emergency alerts."
              features={[
                'Bulk SMS — broadcasts to parents for reminders, alerts and notices',
                'Automated Triggers — SMS on absence or urgent announcements',
              ]} />
            <ModuleSection dark num="05" version="v3" title="WhatsApp Notifications (v3)"
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
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">At a glance</h2>
            <div className="w-12 h-1 bg-[#f59e0b] rounded-full mx-auto mt-3" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { val: '6', label: 'Role portals' },
              { val: '15', label: 'Modules live' },
              { val: 'HTTPS', label: 'Encrypted in transit' },
              { val: '2FA', label: 'And passkeys' },
              { val: 'Offline', label: 'Teacher attendance' },
              { val: 'PDF', label: 'Excel & CSV exports' },
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
            <p className="text-blue-100/80 text-sm mb-8 max-w-lg mx-auto">Start a free trial and set up your school in WiSkul. No card needed to start.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={() => navigate('/register')}
                className="w-full sm:w-auto bg-[#f59e0b] hover:bg-[#d97706] text-white font-bold text-sm px-10 py-4 rounded-xl transition-all duration-300 shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2">
                Start Free Trial <ArrowRight size={16} />
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
