/**
 * The public demo school (backend/scripts/seedDemoTenant.ts). Visitors ask
 * for access on the homepage and get personal sign-in links by email
 * (/demo/start?t=…&portal=…). The school is read-only on the server.
 */
import type { AuthUser } from '@appTypes/index';

export const DEMO_EMAIL_DOMAIN = 'demo.wiskulsl.com';

export const DEMO_PORTALS = [
  { key: 'principal', portal: 'Principal', person: 'Mrs Mariama Kamara', blurb: 'School dashboard, staff, admissions, results, fees and reports.' },
  { key: 'teacher', portal: 'Teacher', person: 'Mr Ibrahim Sesay, JSS 2', blurb: 'Timetable, class registers, score entry and assignments.' },
  { key: 'student', portal: 'Student', person: 'Mohamed Bangura, JSS 2', blurb: 'Report card, attendance, homework, timetable and fees.' },
  { key: 'parent', portal: 'Parent', person: 'Mrs Aminata Bangura', blurb: 'Both children’s results, attendance, fees and school news.' },
  { key: 'bursar', portal: 'Bursar', person: 'Ms Fatmata Conteh', blurb: 'Fees, receipts, discounts, expenses, payroll and accounts.' },
  { key: 'admissions', portal: 'Admissions Officer', person: 'Mr Abdul Koroma', blurb: 'Applications pipeline, interviews and enrolment.' },
] as const;

export type DemoPortalKey = (typeof DEMO_PORTALS)[number]['key'];
export const demoPortal = (key: string | null | undefined) => DEMO_PORTALS.find((p) => p.key === key) || null;

/** Signed in to the demo school? (every demo account is on the demo domain) */
export function isDemoUser(user: Pick<AuthUser, 'email'> | null | undefined): boolean {
  return String(user?.email || '').toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}

/** The visitor's personal demo link token, kept on this device to switch portals. */
const TOKEN_KEY = 'wiskul.demo.token';
export const demoToken = {
  get: (): string | null => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
};
export const demoStartPath = (token: string, portal: string) => `/demo/start?t=${encodeURIComponent(token)}&portal=${portal}`;
