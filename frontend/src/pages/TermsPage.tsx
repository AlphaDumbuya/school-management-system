/**
 * TermsPage: /terms. Terms of Service for the WiSkul Platform and website.
 * School Editions are supplied under their own agreement. Have this text reviewed by a lawyer
 * before the company is registered.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import PublicNavbar, { PublicFooter } from '@components/public';
import { PageHero } from '@components/public/company/ui';
import { PLATFORM_SUPPORT } from '@config/platform.config';
import usePageMeta from '@hooks/usePageMeta';

const UPDATED = 'November 2026';

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: '1. About these terms',
    body: (
      <p>
        These terms apply when you use the WiSkul website and the WiSkul Platform at www.wiskulsl.com (together, the &ldquo;Service&rdquo;),
        run by WiSkul (&ldquo;we&rdquo;, &ldquo;us&rdquo;), Sierra Leone. By creating an account or using the Service you agree to them. If you
        do not agree, please do not use the Service. A School Edition made for one school is supplied under its own written agreement.
      </p>
    ),
  },
  {
    title: '2. The Service',
    body: (
      <p>
        The Service lets a school manage admissions, attendance, results, fees, communication and related records. Features depend on the
        plan a school has chosen. We may improve, change or retire features, and will try to give notice of changes that matter.
      </p>
    ),
  },
  {
    title: '3. Accounts and responsibilities',
    body: (
      <>
        <p>A school is represented by its owner and principal. They are responsible for:</p>
        <ul>
          <li>giving accurate information when registering and keeping it up to date;</li>
          <li>choosing who in the school gets an account, and what role each person has;</li>
          <li>keeping sign-in details private and using the extra protection we offer, such as two-factor sign-in and passkeys;</li>
          <li>everything done through the school&rsquo;s accounts.</li>
        </ul>
        <p>Tell us straight away if you think an account has been used without permission.</p>
      </>
    ),
  },
  {
    title: '4. Free trial, plans and payment',
    body: (
      <p>
        New schools may start with a free trial for the period shown at registration. After the trial, continued use needs a paid plan.
        Plan prices and what each plan includes are shown on our pricing page. Payments are processed by our payment partner, Monime.
        Unless we agree otherwise in writing, payments already made are not refundable. We may change prices for future periods and will
        tell you before the change applies.
      </p>
    ),
  },
  {
    title: '5. Acceptable use',
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>use the Service for anything unlawful, or to harass, mislead or harm anyone;</li>
          <li>try to access another school&rsquo;s data, or to break, probe or overload the Service;</li>
          <li>upload malicious code, or content you have no right to share;</li>
          <li>resell or copy the Service without our written permission.</li>
        </ul>
      </>
    ),
  },
  {
    title: '6. Your data',
    body: (
      <p>
        The records a school puts into the Service, such as student, staff, attendance, results and fee information, belong to that school.
        We handle them on the school&rsquo;s behalf, to run the Service, and keep each school&rsquo;s data separate. Our{' '}
        <Link to="/privacy-policy" className="text-[#1d4ed8] font-semibold hover:underline">Privacy Policy</Link> explains what we collect and how we protect it.
        A school can ask us to export or delete its data. Schools are responsible for having the right to enter the personal information they add.
      </p>
    ),
  },
  {
    title: '7. Availability',
    body: (
      <p>
        We work to keep the Service available and backed up, but we cannot promise it will always be uninterrupted or error-free. We may
        pause it for maintenance, and will try to do this at quiet times.
      </p>
    ),
  },
  {
    title: '8. Our property',
    body: (
      <p>
        The Service, its software, design, name and logo belong to WiSkul. Using the Service gives you the right to use it as intended while
        your account is active, and nothing more. Your school keeps ownership of its own records and its own logo.
      </p>
    ),
  },
  {
    title: '9. Suspension and ending',
    body: (
      <p>
        A school may stop using the Service at any time. We may suspend or end access if these terms are broken, if a plan is not paid, or
        if the law requires it. When access is suspended for non-payment, the school can restore it by paying, and its data is not deleted
        in the meantime. We will keep a school&rsquo;s data for a reasonable period after it ends so that it can be exported.
      </p>
    ),
  },
  {
    title: '10. Limits of responsibility',
    body: (
      <p>
        The Service is provided &ldquo;as is&rdquo;. To the extent the law allows, we are not responsible for losses that come from using
        or being unable to use the Service, or from information a school enters or relies on. Nothing in these terms limits any
        responsibility that cannot be limited by law.
      </p>
    ),
  },
  {
    title: '11. Law and changes',
    body: (
      <p>
        These terms are governed by the laws of Sierra Leone. We may update them, and will change the date at the top of this page when we do.
        Continuing to use the Service after a change means you accept the new terms.
      </p>
    ),
  },
  {
    title: '12. Contact',
    body: (
      <p>
        Questions about these terms? Email{' '}
        <a href={`mailto:${PLATFORM_SUPPORT.email}`} className="text-[#1d4ed8] font-semibold hover:underline">{PLATFORM_SUPPORT.email}</a> or visit our{' '}
        <Link to="/contact" className="text-[#1d4ed8] font-semibold hover:underline">contact page</Link>.
      </p>
    ),
  },
];

export const TermsPage: React.FC = () => {
  usePageMeta('Terms of Service | WiSkul', 'The terms for using the WiSkul website and platform.', '/terms');

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-700 overflow-x-hidden font-sans antialiased">
      <PublicNavbar ctaText="Start Free Trial" />
      <PageHero eyebrow={`Last updated ${UPDATED}`} title="Terms of Service" text="The simple rules for using WiSkul." />

      <section className="px-6 sm:px-10 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto bg-white border border-[#e5e9f2] rounded-3xl shadow-sm p-7 sm:p-10">
          <div className="space-y-9">
            {SECTIONS.map((s) => (
              <div key={s.title}>
                <h2 className="text-lg font-black text-slate-900 mb-3">{s.title}</h2>
                <div className="text-sm text-slate-600 leading-relaxed space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
                  {s.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <PublicFooter />
    </div>
  );
};

export default TermsPage;
