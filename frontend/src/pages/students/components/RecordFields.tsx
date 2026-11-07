/**
 * RecordFields: the student-record form fields, drawn from the server's field list.
 * Used by the parent's pages (/update-record/...) and by the officer's session form.
 * validateRecord() checks the values the same way the server does and explains why a missing field is needed.
 */
import React from 'react';
import type { RecordField, RecordValues } from '@services/studentRecordsService';

const GROUPS: { id: RecordField['group']; title: string; hint?: string }[] = [
  { id: 'child', title: 'About the child' },
  { id: 'guardian', title: 'Parent or guardian', hint: 'We use these details to reach you and to open your parent portal.' },
  { id: 'emergency', title: 'Emergency contact', hint: 'Someone we can call if we cannot reach you.' },
];
const INPUT = 'w-full rounded-lg border bg-white px-3 py-2.5 text-base text-gray-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-gray-800 dark:text-white sm:text-sm';
const OK_BORDER = 'border-gray-300 focus:border-primary-500 focus:ring-primary-500/30 dark:border-gray-600';
// The ! forces these over the global input[type=text] border rule in styles/index.css.
const BAD_BORDER = '!border-red-500 focus:!border-red-500 focus:ring-red-500/30';
const shortLabel = (l: string) => l.replace(/ \(.*\)$/, '');

/** The reason a value is not acceptable, or '' when it is fine. Mirrors the server's checks. */
export function validateField(f: RecordField, raw: string | undefined): string {
  const v = (raw ?? '').trim();
  const name = shortLabel(f.label);
  if (!v) return f.required ? `${name} is required.${f.why ? ` ${f.why}` : ''}` : '';
  if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email address, for example name@example.com.';
  if (f.type === 'phone' && !/^\+?[\d\s()-]{6,20}$/.test(v)) return `${name}: enter a valid phone number, for example +232 76 123456.`;
  if (f.type === 'date') {
    const d = new Date(v);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(d.getTime())) return 'Enter a valid date of birth.';
    if (d > new Date()) return 'The date of birth cannot be in the future.';
    if (d.getFullYear() < 1985) return 'Please check the year of birth.';
  }
  if (f.type === 'gender' && !['male', 'female'].includes(v.toLowerCase())) return 'Choose male or female.';
  if (v.length > (f.type === 'long' ? 500 : f.type === 'phone' ? 20 : 200)) return `${name} is too long.`;
  return '';
}
/** Every field's problem, keyed by field key (fields without a problem are left out). */
export function validateRecord(fields: RecordField[], values: RecordValues): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) { const e = validateField(f, values[f.key]); if (e) out[f.key] = e; }
  return out;
}

interface Props {
  fields: RecordField[];
  values: RecordValues;
  onChange: (key: string, value: string) => void;
  /** Field keys to highlight as still missing (the officer's form). */
  missing?: string[];
  /** Problems to show under the fields. */
  errors?: Record<string, string>;
  /** Called when a field loses focus, so the page can check it. */
  onBlur?: (key: string) => void;
  idPrefix?: string;
}

export const RecordFields: React.FC<Props> = ({ fields, values, onChange, missing = [], errors = {}, onBlur, idPrefix = 'rec' }) => (
  <div className="space-y-6">
    {GROUPS.map((g) => {
      const list = fields.filter((f) => f.group === g.id);
      if (!list.length) return null;
      return (
        <fieldset key={g.id} className="rounded-2xl border border-gray-200 bg-white p-4 text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 sm:p-5">
          <legend className="rounded bg-white px-2 text-sm font-bold text-gray-900 dark:bg-gray-900 dark:text-white">{g.title}</legend>
          {g.hint && <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">{g.hint}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            {list.map((f) => {
              const id = `${idPrefix}-${f.key}`;
              const v = values[f.key] ?? '';
              const error = errors[f.key];
              const highlight = !error && missing.includes(f.key) && !v.trim();
              const describedBy = [f.help ? `${id}-help` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined;
              const cls = `${INPUT} ${error ? BAD_BORDER : highlight ? '!border-amber-400' : OK_BORDER}`;
              const common = { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, 'aria-required': f.required || undefined, onBlur: onBlur ? () => onBlur(f.key) : undefined } as const;
              return (
                <div key={f.key} className={f.type === 'long' || f.help ? 'sm:col-span-2' : ''}>
                  <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {f.label}{f.required && <span className="text-red-600" aria-hidden="true"> *</span>}
                  </label>
                  {f.type === 'long' ? (
                    <textarea {...common} rows={2} maxLength={500} placeholder={f.placeholder} value={v} onChange={(e) => onChange(f.key, e.target.value)} className={cls} />
                  ) : f.type === 'gender' ? (
                    <select {...common} value={v} onChange={(e) => onChange(f.key, e.target.value)} className={cls}>
                      <option value="">Choose…</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  ) : (
                    <input {...common} type={f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : 'text'}
                      inputMode={f.type === 'phone' ? 'tel' : f.type === 'email' ? 'email' : undefined} autoComplete="off" maxLength={f.type === 'phone' ? 20 : 200} placeholder={f.placeholder}
                      max={f.type === 'date' ? new Date().toISOString().slice(0, 10) : undefined}
                      value={v} onChange={(e) => onChange(f.key, e.target.value)} className={cls} />
                  )}
                  {f.help && !error && <p id={`${id}-help`} className="mt-1 text-xs text-gray-500 dark:text-gray-400">{f.help}</p>}
                  {error && <p id={`${id}-err`} role="alert" className="mt-1 rounded-md bg-red-50 px-3 py-2 text-sm font-medium leading-snug text-red-700">{error}</p>}
                </div>
              );
            })}
          </div>
        </fieldset>
      );
    })}
  </div>
);
export default RecordFields;
