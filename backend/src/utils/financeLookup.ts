/**
 * Finance pickers (record a payment, give a discount, bill a class) need the
 * WHOLE school's students and classes. A teacher who is also the Bursar keeps
 * role 'teacher' on /students and /classes (not duty modules), so those lists
 * would be limited to their own classes. Finance pages ask with
 * ?scope=finance; this says whether the caller may get the school-wide list.
 */
import type { Request } from 'express';
import { db } from './database';
import { holdsJob } from './staffDuties';

const FINANCE_ROLES = ['accountant', 'principal', 'super_admin'];

export async function isFinanceLookup(req: Request): Promise<boolean> {
  if (String((req.query as any)?.scope || '') !== 'finance') return false;
  const role = String(req.user?.role || '');
  if (FINANCE_ROLES.includes(role)) return true;
  if (!req.user?.id) return false;
  // Acting as a teacher on /classes or /students, but holding the Bursar job
  // (as the main job or on top of teaching / admissions).
  const row = await db('users').where('id', req.user.id).first('role', 'staff_duties').catch(() => null);
  return holdsJob(row?.role, row?.staff_duties, 'accountant');
}
