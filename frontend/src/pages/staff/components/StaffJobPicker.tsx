/**
 * Staff jobs: Teaching / Accountant (Bursar) / Admissions Officer.
 *
 * Shared by Add/Edit Staff Member and Promote & Assign, so both follow the same
 * rules as the server (teacherRoutes POST/PUT):
 *  - Teaching ticked → main role teacher; any other job ticked is an extra duty
 *    (users.staff_duties), so a form teacher can also keep the fees.
 *  - Teaching not ticked → exactly one job, which becomes the main role
 *    (accountant → Bursar, admissions_officer → Administrator), no classes.
 */
import React from 'react';
import type { UseFormRegister } from 'react-hook-form';
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

/** Add to a schema's superRefine: at least one job; one main job without teaching. */
export function refineJobs(v: JobValues, ctx: z.RefinementCtx) {
  if (!v.teaches && !v.duty_accountant && !v.duty_admissions) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['teaches'], message: 'Choose at least one job.' });
  }
  if (!v.teaches && v.duty_accountant && v.duty_admissions) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['duty_admissions'], message: 'Without teaching, choose one main job: Accountant or Admissions Officer.' });
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
  const teaches = role === '' || role === 'teacher' || role === 'principal';
  return {
    teaches,
    duty_accountant: role === 'accountant' || duties.includes('accountant'),
    duty_admissions: role === 'admissions_officer' || duties.includes('admissions_officer'),
  };
}

/** Map the job checkboxes to the API payload (`primary_role` + `staff_duties`). */
export function jobsToPayload(v: JobValues): { primary_role: string; staff_duties: string[] } {
  const duties = [v.duty_accountant ? 'accountant' : null, v.duty_admissions ? 'admissions_officer' : null].filter(Boolean) as string[];
  if (v.teaches) return { primary_role: 'teacher', staff_duties: duties };
  return { primary_role: duties[0], staff_duties: [] };
}

/** A short human summary of the jobs ("Teaching + Accountant (Bursar)"). */
export function describeJobs(v: JobValues): string {
  const extra = [v.duty_accountant ? 'Accountant (Bursar)' : null, v.duty_admissions ? 'Admissions Officer' : null].filter(Boolean);
  if (v.teaches) return ['Teaching', ...extra].join(' + ');
  return extra[0] || '';
}

const JOBS = [
  { key: 'teaches' as const, label: 'Teaching', hint: 'Classes, registers, scores' },
  { key: 'duty_accountant' as const, label: 'Accountant (Bursar)', hint: 'Fees, invoices, payments' },
  { key: 'duty_admissions' as const, label: 'Admissions Officer', hint: 'Applications, enrolment' },
];

interface StaffJobPickerProps {
  register: UseFormRegister<any>;
  values: JobValues;
  error?: string;
  title?: string;
  description?: string;
}

export const StaffJobPicker: React.FC<StaffJobPickerProps> = ({
  register,
  values,
  error,
  title = 'Job at the School',
  description = 'Tick every job this person does. A form or subject teacher can also keep the fees or run admissions; they keep their classes and get those pages too.',
}) => (
  <fieldset className="space-y-3">
    <legend className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b pb-1 w-full">
      {title}
    </legend>
    <p className="text-[11px] text-gray-500 dark:text-gray-400">{description}</p>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {JOBS.map((j) => {
        const on = !!values[j.key];
        return (
          <label
            key={j.key}
            className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
              on ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/40'
            }`}
          >
            <input type="checkbox" {...register(j.key)} className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4" />
            <span>
              <span className="block text-sm font-semibold text-gray-900 dark:text-white">{j.label}</span>
              <span className="block text-[11px] text-gray-500 dark:text-gray-400">{j.hint}</span>
            </span>
          </label>
        );
      })}
    </div>
    {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
  </fieldset>
);

export default StaffJobPicker;
