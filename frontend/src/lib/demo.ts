/**
 * The public demo school (backend/scripts/seedDemoTenant.ts). Its logins are
 * published on the marketing site; the school is read-only on the server.
 */
import type { AuthUser } from '@appTypes/index';

/** Same as DEMO_PASSWORD in backend/scripts/seedDemoTenant.ts. */
export const DEMO_PASSWORD = 'WiSkulDemo#2026';
export const DEMO_EMAIL_DOMAIN = 'demo.wiskulsl.com';

export interface DemoAccount {
  key: string;
  portal: string;
  person: string;
  identifier: string;
  blurb: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { key: 'principal', portal: 'Principal', person: 'Mrs Mariama Kamara', identifier: `principal@${DEMO_EMAIL_DOMAIN}`, blurb: 'School dashboard, staff, admissions, results, fees and reports.' },
  { key: 'teacher', portal: 'Teacher', person: 'Mr Ibrahim Sesay, JSS 2', identifier: `teacher@${DEMO_EMAIL_DOMAIN}`, blurb: 'Timetable, class registers, score entry and assignments.' },
  { key: 'student', portal: 'Student', person: 'Mohamed Bangura, JSS 2', identifier: 'DEMO-0001', blurb: 'Report card, attendance, homework, timetable and fees.' },
  { key: 'parent', portal: 'Parent', person: 'Mrs Aminata Bangura, 2 children', identifier: `parent@${DEMO_EMAIL_DOMAIN}`, blurb: 'Both children’s results, attendance, fees and school news.' },
  { key: 'bursar', portal: 'Bursar', person: 'Ms Fatmata Conteh', identifier: `bursar@${DEMO_EMAIL_DOMAIN}`, blurb: 'Fees, receipts, discounts, expenses, payroll and accounts.' },
  { key: 'admissions', portal: 'Admissions Officer', person: 'Mr Abdul Koroma', identifier: `admissions@${DEMO_EMAIL_DOMAIN}`, blurb: 'Applications pipeline, interviews and enrolment.' },
];

export const demoAccount = (key: string | null | undefined) => DEMO_ACCOUNTS.find((a) => a.key === key) || null;

/** Signed in to the demo school? (every demo account is on the demo domain) */
export function isDemoUser(user: Pick<AuthUser, 'email'> | null | undefined): boolean {
  return String(user?.email || '').toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}
