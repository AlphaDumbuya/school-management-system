/**
 * Staff jobs: Teaching / Accountant (Bursar) / Admissions Officer.
 *
 * Shared by Add/Edit Staff Member and Promote & Assign, so both follow the same
 * rules as the server (teacherRoutes POST/PUT): tick every job the person does.
 *  - One job is their main job (users.role). The others are extra jobs
 *    (users.staff_duties), so a Bursar can also teach and lead a class, an
 *    Admissions Officer can also be a form teacher, a form teacher can also
 *    keep the fees.
 *  - Their main job is kept when they still do it; for someone new it is the
 *    managing job (Accountant, then Admissions Officer) before Teaching.
 *  - Classes and subjects apply whenever Teaching is ticked, whatever the main job.
 */
import React from 'react';
import type { UseFormRegister } from 'react-hook-form';
import type { JobValues } from '@lib/staffJobRules';
import useAuthStore from '@store/authStore';
import { featureAccess } from '@lib/planFeatures';

export {
  jobFieldsSchema, refineJobs, jobsFromRecord, jobsToPayload, describeJobs,
  type StaffJob, type JobValues,
} from '@lib/staffJobRules';

const JOBS = [
  { key: 'teaches' as const, label: 'Teaching', hint: 'Classes, registers, scores', portal: null },
  { key: 'duty_accountant' as const, label: 'Accountant (Bursar)', hint: 'Fees, invoices, payments', portal: 'portal_bursar' },
  { key: 'duty_admissions' as const, label: 'Admissions Officer', hint: 'Applications, enrolment', portal: 'portal_admissions' },
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
  description = 'Tick every job this person does. A Bursar or Admissions Officer can also teach and lead a class, and a teacher can also keep the fees or run admissions. Each job shows its own pages and its own data.',
}) => {
  // Jobs whose portal isn't in the school's plan aren't offered (the server
  // refuses them too). A job the person already holds stays visible so it
  // can be unticked.
  const { user } = useAuthStore();
  const jobs = JOBS.filter((j) => !j.portal || featureAccess(user, j.portal) === 'enabled' || !!values[j.key]);
  const hidden = JOBS.filter((j) => !jobs.includes(j));
  return (
  <fieldset className="space-y-3">
    <legend className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b pb-1 w-full">
      {title}
    </legend>
    <p className="text-[11px] text-gray-500 dark:text-gray-400">{description}</p>
    <div className={`grid grid-cols-1 gap-2 ${jobs.length === 3 ? 'sm:grid-cols-3' : jobs.length === 2 ? 'sm:grid-cols-2' : ''}`}>
      {jobs.map((j) => {
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
    {hidden.length > 0 && (
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        {hidden.map((j) => j.label).join(' and ')} {hidden.length === 1 ? 'is' : 'are'} available on a higher plan. See Settings → Plan &amp; Billing.
      </p>
    )}
    {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
  </fieldset>
  );
};

export default StaffJobPicker;
