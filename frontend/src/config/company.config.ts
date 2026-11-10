/**
 * Company facts and copy shared by the public company pages (home, products, editions, services, about).
 *
 * Keep claims here honest: only things that are true today. No invented numbers, clients or quotes.
 * Contact details (email, phone, address) live in platform.config.ts so there is one source.
 */

export const COMPANY = {
  name: 'WiSkul',
  tagline: 'Technology company in Sierra Leone',
  url: 'https://www.wiskulsl.com',
  facebook: 'https://www.facebook.com/wiskulsl',
} as const;

export type ShowcaseRole = 'staff' | 'teacher' | 'parent' | 'pupil';

export interface ShowcaseSchool {
  id: 'aga' | 'amie';
  name: string;
  short: string;
  logo: string;
  /** The school's own brand colour, as set in its edition. */
  colour: string;
}

/** Schools we have delivered a School Edition to. Screens are real, with invented data. */
export const EDITION_CLIENTS: ShowcaseSchool[] = [
  { id: 'aga', name: 'Abiding Grace Academy', short: 'AGA', logo: '/showcase/logo-aga.webp', colour: '#0A2350' },
  { id: 'amie', name: 'Amie Academy', short: 'Amie', logo: '/showcase/logo-amie.webp', colour: '#8A0A0A' },
];

export const SHOWCASE_ROLES: { id: ShowcaseRole; label: string; text: string }[] = [
  { id: 'staff', label: 'Principal', text: 'Enrolment, staff, classes and fees collected, with the year\u2019s trends at a glance.' },
  { id: 'teacher', label: 'Teacher', text: 'Classes, subjects and today\u2019s schedule, with one-tap Enter Scores and Mark Attendance.' },
  { id: 'parent', label: 'Parent', text: 'Each child\u2019s attendance, scores and outstanding fees in one place.' },
  { id: 'pupil', label: 'Pupil', text: 'Attendance rate, average score, today\u2019s classes and fees, on any phone.' },
];

export const showcaseSrc = (school: ShowcaseSchool['id'], role: ShowcaseRole) => `/showcase/${school}-${role}.webp`;

export const showcaseAlt = (school: ShowcaseSchool, role: ShowcaseRole) => {
  const r = SHOWCASE_ROLES.find((x) => x.id === role)?.label ?? role;
  return `${school.name} app: the ${r.toLowerCase()} home screen, shown with sample data`;
};

/** Technology the products are built on (all true; see the repositories). */
export const TECH_STACK = ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Android (Capacitor)', 'Progressive web app'];

/** What every School Edition includes. */
export const EDITION_INCLUDES = [
  { title: 'Your name, logo and colours', text: 'Every screen, email, receipt, report card and ID card carries your school\u2019s identity. WiSkul does not appear anywhere.' },
  { title: 'Your own address', text: 'The system runs on your school\u2019s own web address, and sends email under your school\u2019s name.' },
  { title: 'Your own Android app', text: 'An installable app with your icon and your name, and a web app for iPhones and computers.' },
  { title: 'Your own database', text: 'One school, one database, one deployment. Your records are not shared with any other school.' },
  { title: 'Fees into your own account', text: 'Parents pay by mobile money or card, and the money settles into your school\u2019s own Monime account.' },
  { title: 'No plans, no limits', text: 'No trial clock, no plan tiers, and no cap on students, staff or storage.' },
];
