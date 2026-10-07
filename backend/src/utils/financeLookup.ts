/**
 * Finance pickers (record a payment, give a discount, bill a class) need the
 * WHOLE school's students and classes. A teacher who is also the Bursar keeps
 * role 'teacher' on /students and /classes (not duty modules), so those lists
 * would be limited to their own classes. Finance pages ask with
 * ?scope=finance; this says whether the caller may get the school-wide list.
 */
import type { Request } from 'express';
import { db } from './database';
import { parseDuties } from './staffDuties';

const FINANCE_ROLES = ['accountant', 'principal', 'super_admin'];

export async function isFinanceLookup(req: Request): Promise<boolean> {
  if (String((req.query as any)?.scope || '') !== 'finance') return false;
  const role = String(req.user?.role || '');
  if (FINANCE_ROLES.includes(role)) return true;
  if (role !== 'teacher' || !req.user?.id) return false;
  const row = await db('users').where('id', req.user.id).first('role', 'staff_duties').catch(() => null);
  return row?.role === 'teacher' && parseDuties(row?.staff_duties).includes('accountant');
}
