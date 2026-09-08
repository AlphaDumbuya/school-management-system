/**
 * PrivacyPolicyPage — public, self-hosted privacy policy.
 *
 * Google Play REQUIRES a hosted privacy policy URL, and because WiSkul handles
 * students' (minors') personal data, this must clearly describe what is
 * collected, how it's used, retention, and contact. Route: /privacy-policy.
 */
import React from 'react';

const UPDATED = 'September 2026';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="mb-7">
    <h2 className="text-lg font-bold text-slate-900 mb-2">{title}</h2>
    <div className="text-sm text-slate-600 leading-relaxed space-y-2">{children}</div>
  </section>
);

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-1 w-full bg-gradient-to-r from-[#1d4ed8] via-[#f59e0b] to-[#1d4ed8]" />
      <div className="max-w-3xl mx-auto px-5 py-10">
        <div className="flex items-center gap-2 mb-6">
          <img src="/logo.png" alt="WiSkul" className="w-9 h-9 rounded-xl object-contain bg-white p-1 shadow" />
          <span className="text-lg font-black text-slate-900">Wi<span className="text-amber-500">Skul</span></span>
        </div>

        <h1 className="text-2xl font-black text-slate-900 mb-1">Privacy Policy</h1>
        <p className="text-xs text-slate-400 mb-8">Last updated: {UPDATED}</p>

        <Section title="Who we are">
          <p>
            WiSkul is a school management platform used by schools ("your school") to manage
            academics, attendance, students, staff, communications, and related administration.
            Each school is a separate tenant and controls its own data. WiSkul acts as a data
            processor on behalf of the school (the data controller).
          </p>
        </Section>

        <Section title="Information we collect">
          <p>Depending on your role, we may process:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Account data:</strong> name, email, role, and authentication details.</li>
            <li><strong>Student & academic data</strong> (managed by your school): profiles, classes, attendance, grades, assignments, and related records.</li>
            <li><strong>Usage & device data:</strong> log data needed to operate and secure the service.</li>
            <li><strong>Files</strong> your school uploads (e.g. photos, documents).</li>
          </ul>
          <p>Student data is entered and controlled by the school. WiSkul does not sell personal data.</p>
        </Section>

        <Section title="How we use information">
          <ul className="list-disc pl-5 space-y-1">
            <li>To provide and operate the school management features you use.</li>
            <li>To authenticate users and keep accounts secure.</li>
            <li>To send transactional and school communications you have opted into.</li>
            <li>To maintain, troubleshoot, and improve the service.</li>
          </ul>
        </Section>

        <Section title="Children's data">
          <p>
            Because schools manage student records, WiSkul may process personal data of minors on
            the school's instructions. Access is restricted by role, scoped to each school, and used
            only to deliver the school's services. Parents/guardians should contact their school
            regarding a student's records.
          </p>
        </Section>

        <Section title="Offline data on your device">
          <p>
            To work without a reliable internet connection, the app may store a limited, role-scoped
            copy of data (for example, a teacher's classes and attendance) on your device. This local
            data is removed when you sign out, and un-synced changes are uploaded when you reconnect.
          </p>
        </Section>

        <Section title="Data sharing">
          <p>
            We share data only with service providers that help us operate WiSkul (for example, email
            and file-storage providers) under appropriate safeguards, and where required by law. We do
            not sell personal data.
          </p>
        </Section>

        <Section title="Data retention">
          <p>
            We retain data for as long as your school maintains its account or as required to provide
            the service and meet legal obligations. Schools may request export or deletion of their data.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            Depending on your location, you may have rights to access, correct, or delete personal data.
            For student and school records, please contact your school (the data controller). For account
            or platform matters, contact us below.
          </p>
        </Section>

        <Section title="Security">
          <p>
            We use industry-standard measures to protect data in transit and at rest. No method of
            transmission or storage is completely secure, but we work to protect your information.
          </p>
        </Section>

        <Section title="Contact us">
          <p>
            Questions about this policy or your data? Email{' '}
            <a href="mailto:support@wiskulsl.com" className="text-[#1d4ed8] font-semibold">support@wiskulsl.com</a>{' '}
            or call +232 78 261 892.
          </p>
        </Section>

        <p className="text-xs text-slate-400 border-t border-slate-200 pt-5">
          © {new Date().getFullYear()} WiSkul. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
