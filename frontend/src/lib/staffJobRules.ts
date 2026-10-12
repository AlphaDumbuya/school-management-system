/**
 * The rules behind the staff "jobs" checkboxes (Teaching / Accountant /
 * Admissions Officer): what is ticked for an existing record, and the
 * `primary_role` + `staff_duties` sent to the API. Plain functions, no React,
 * shared by the Add/Edit Staff and Promote & Assign forms.
 */
import * as z from 'zod';

export type StaffJob = 'teacher' | 'accountant' | 'admissions_officer';

export interface JobValues {
  teaches: boolean;
  duty_accountant: boolean;
  duty_admissions: boolean;
}

export const jobFieldsSchema = {
  teaches: z.boolean().default(true),
  duty_accountant: z.boolean().default(false),
  duty_admissions: z.boolean().default(false),
};

/** Add to a schema's superRefine: at least one job. */
export function refineJobs(v: JobValues, ctx: z.RefinementCtx) {
  if (!v.teaches && !v.duty_accountant && !v.duty_admissions) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['teaches'], message: 'Choose at least one job.' });
  }
}

/** The job checkboxes for an existing record (or a new one starting as `job`). */
export function jobsFromRecord(details: any, job: StaffJob = 'teacher'): JobValues {
  if (!details) {
    return { teaches: job === 'teacher', duty_accountant: job === 'accountant', duty_admissions: job === 'admissions_officer' };
  }
  const role = String(details.user_role || '');
  let duties: string[] = [];
  const raw = details.staff_duties;
  try { duties = Array.isArray(raw) ? raw : raw ? JSON.parse(raw) : []; } catch { duties = []; }
  const teaches = role === '' || role === 'teacher' || role === 'principal' || duties.includes('teacher');
  return {
    teaches,
    duty_accountant: role === 'accountant' || duties.includes('accountant'),
    duty_admissions: role === 'admissions_officer' || duties.includes('admissions_officer'),
  };
}

const LEADERSHIP_TITLES = ['head_teacher', 'vice_head_teacher', 'principal', 'vice_principal'];

/**
 * Map the job checkboxes to the API payload (`primary_role` + `staff_duties`).
 *  - The managing job is always the main one: Accountant + Teaching → Accountant
 *    (teaching on top); Admissions Officer + Teaching → Admissions Officer;
 *    Accountant + Admissions Officer → Accountant first. Teacher is the main
 *    job only when it is the only job. The server applies the same rule.
 *  - A leadership title (head teacher, principal…) stays on 'teacher' so the
 *    server maps it to the principal role; leaders already see everything.
 */
export function jobsToPayload(
  v: JobValues,
  opts: { currentRole?: string; designation?: string } = {},
): { primary_role: string; staff_duties: string[] } {
  const held: StaffJob[] = [
    ...(v.duty_accountant ? ['accountant' as const] : []),
    ...(v.duty_admissions ? ['admissions_officer' as const] : []),
    ...(v.teaches ? ['teacher' as const] : []),
  ];
  const leader = opts.currentRole === 'principal' || LEADERSHIP_TITLES.includes(String(opts.designation || ''));
  const main: StaffJob = leader && v.teaches ? 'teacher' : held[0];
  return { primary_role: main, staff_duties: held.filter((j) => j !== main) };
}

/** A short human summary of the jobs ("Teaching + Accountant (Bursar)"). */
export function describeJobs(v: JobValues): string {
  const extra = [v.duty_accountant ? 'Accountant (Bursar)' : null, v.duty_admissions ? 'Admissions Officer' : null].filter(Boolean);
  return [...(v.teaches ? ['Teaching'] : []), ...extra].join(' + ');
}
