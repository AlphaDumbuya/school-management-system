/**
 * Shared bits of the grades screens (preview table, enter-grades window, edit-one-student window).
 * The two things that differ between WiSkul and the School Editions live here, so every other file can be identical:
 * the table header colour and the way a live mean is rounded.
 */
import type { ScoreGridRow } from '@services/reportCardService';

export const TABLE_HEAD = 'bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] border-b border-blue-700';
export const TH = 'py-3 px-3 font-bold text-xs text-white uppercase tracking-wider';
export const INPUT_CLASS =
  'w-full text-center px-2 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-800';

/** The mean shown while typing: (Test 1 + Test 2) / 2, or the one test that exists. */
export function liveMean(t1: string, t2: string): number | null {
  const a = t1 === '' ? null : Number(t1);
  const b = t2 === '' ? null : Number(t2);
  if (a == null && b == null) return null;
  if (a != null && b != null) return Math.round(((a + b) / 2) * 10) / 10;
  return Math.round((a ?? b)! * 10) / 10;
}

export const toStr = (v: number | string | null | undefined): string => (v == null || v === '' ? '' : String(Number(v)));
export const toNum = (v: number | string | null | undefined): number | null => (v == null || v === '' ? null : Number(v));

/** One student's row while it is being typed. */
export interface EditableRow extends ScoreGridRow {
  _t1: string;
  _t2: string;
}

/** A fingerprint of what is typed, to tell whether anything changed since the last save. */
export const snapshotKey = (list: EditableRow[]): Record<string, string> =>
  Object.fromEntries(list.map((r) => [r.student_id, `${r._t1}|${r._t2}`]));

export type ScoreField = '_t1' | '_t2';
export const FIELD_LABEL: Record<ScoreField, string> = { _t1: 'Test 1', _t2: 'Test 2' };

/** Is this typed text allowed in a score box? Empty, or a whole number from 0 to 100. */
export function isValidScoreText(value: string): boolean {
  if (value === '') return true;
  if (!/^\d{1,3}$/.test(value)) return false;
  const n = Number(value);
  return n >= 0 && n <= 100;
}

export interface EntryTarget {
  classId: string;
  subjectId: string;
  term: 'first_term' | 'second_term' | 'third_term';
}
