/**
 * planCatalogService — the subscription plan catalog, editable by the platform
 * owner (super admin) and read live everywhere (billing, limits, feature gates,
 * sidebar, marketing pricing page).
 *
 * Storage: `platform_settings['plan_catalog']` (JSON). Values not stored fall
 * back to the defaults below, so the system works before anything is edited.
 *
 * Plan IDs are fixed (freetong / combra / bintumani): they are referenced by
 * subscriptions, checkout sessions and trials. Everything else about a plan
 * (name, prices, limits, which features it includes, marketing bullets) is
 * dynamic.
 */
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export type PlanId = 'freetong' | 'combra' | 'bintumani';
export const PLAN_IDS: PlanId[] = ['freetong', 'combra', 'bintumani'];

/** "Unlimited" is stored as a large number; UIs show it as Unlimited. */
export const UNLIMITED = 999999;

export interface FeatureDef {
  key: string;
  label: string;
  description: string;
  group: 'Core' | 'Students' | 'Academic' | 'Finance' | 'Identity' | 'Events' | 'Communication' | 'Platform';
  /** Core features are part of every plan and can't be switched off. */
  core?: boolean;
  /** Not shipped yet: shown on plans as "Coming soon", never enforced. */
  soon?: boolean;
}

/**
 * Feature registry. Keys are the contract between the backend guards
 * (requirePlanFeature), the frontend sidebar/routes and the plan editor.
 * Keep keys stable; labels/descriptions can change freely.
 */
export const FEATURES: FeatureDef[] = [
  // Core: every plan
  { key: 'class_subject_mgmt', label: 'Classes, subjects & timetables', description: 'Classes, streams, subjects, timetables and exam timetables.', group: 'Core', core: true },
  { key: 'directory_profiles', label: 'Student & guardian directory', description: 'Student directory, profiles and parent links.', group: 'Core', core: true },
  { key: 'attendance_basic', label: 'Attendance', description: 'Daily student register and staff sign-in.', group: 'Core', core: true },
  { key: 'gradebook', label: 'Assignments, results & report cards', description: 'Assignments, gradebook, results and report cards.', group: 'Core', core: true },
  { key: 'fee_collection', label: 'Fees, invoices & online payments', description: 'Fee structures, invoices, receipts and online payments.', group: 'Core', core: true },
  { key: 'announcements', label: 'Announcements & in-app notifications', description: 'Announcements to the whole school or a class, the in-app notification bell, and optional email copies.', group: 'Core', core: true },
  { key: 'portals', label: 'Student & parent portals', description: 'Logins for students, parents and staff, plus the mobile app.', group: 'Core', core: true },
  { key: 'dashboards', label: 'Role dashboards', description: 'Live dashboards for the principal, teachers, bursar, admissions, parents and students.', group: 'Core', core: true },
  { key: 'exports', label: 'Excel, PDF & CSV exports', description: 'Export lists, registers and reports from every module you have.', group: 'Core', core: true },
  { key: 'school_branding', label: 'Your school branding', description: 'Your logo, name, motto and contacts on report cards, receipts and emails.', group: 'Core', core: true },
  { key: 'support', label: 'Help centre & support tickets', description: 'Built-in guides and direct support from the WiSkul team.', group: 'Core', core: true },

  // Switchable per plan
  { key: 'admissions', label: 'Admissions & online applications', description: 'Admissions pipeline, interviews, enrolment and the public application form.', group: 'Students' },
  { key: 'promotions', label: 'Student promotions', description: 'End-of-year promotion of classes into the new year.', group: 'Academic' },
  { key: 'discipline', label: 'Discipline & conduct', description: 'Infractions, detentions, conduct reports and appeals.', group: 'Students' },
  { key: 'id_cards', label: 'ID cards & badge designer', description: 'Card templates, ID card generation and printing.', group: 'Identity' },
  { key: 'events', label: 'Events, calendar & event analytics', description: 'School events, registrations, calendar and event analytics.', group: 'Events' },
  { key: 'fee_management', label: 'Discounts, scholarships, arrears & payment plans', description: 'Sibling, staff-child and scholarship/bursary discounts, waivers, arrears aging, late fees and instalment plans.', group: 'Finance' },
  { key: 'expenses', label: 'Expenses, petty cash & budgets', description: 'School expenses, petty cash and budgets.', group: 'Finance' },
  { key: 'payroll', label: 'Payroll & payslips', description: 'Salary runs and staff payslips.', group: 'Finance' },
  { key: 'accounting', label: 'Accounting & financial statements', description: 'Journal, chart of accounts, financial statements, bank reconciliation and audit log.', group: 'Finance' },
  { key: 'academic_archive', label: 'Academic archive', description: 'Past years’ results and records.', group: 'Academic' },
];
// Not listed on purpose (not live, so never sold): SMS, WhatsApp, chat,
// advanced cross-module analytics, multi-branch. Add a key here (with
// `soon: true` until it ships) when one of them is built.

const FEATURE_KEYS = new Set(FEATURES.map((f) => f.key));
const CORE_KEYS = FEATURES.filter((f) => f.core).map((f) => f.key);

export interface PlanDef {
  id: PlanId;
  name: string;
  tagline: string;
  badge: string;
  monthly_price: number;
  yearly_price: number;
  max_students: number;
  max_staff: number;
  max_users: number;
  max_storage_gb: number;
  /** Switchable feature → included. Core features are always added as true. */
  features: Record<string, boolean>;
  /** Extra marketing bullets shown on pricing cards (e.g. "Priority support"). */
  highlights: string[];
  /** Shown on the public pricing page. */
  is_public: boolean;
  /** Highlighted ("most popular") on the pricing page. */
  featured: boolean;
  sort: number;
}

const on = (...keys: string[]) => Object.fromEntries(keys.map((k) => [k, true]));

/** Defaults: match what billing charged and enforced before the catalog existed. */
const DEFAULT_PLANS: Record<PlanId, PlanDef> = {
  freetong: {
    id: 'freetong', name: 'Freetong', tagline: 'Everything a school needs to run day to day.', badge: 'Starter',
    monthly_price: 400, yearly_price: 4000,
    max_students: 200, max_staff: 15, max_users: 15, max_storage_gb: 5,
    features: on('admissions', 'promotions', 'fee_management', 'academic_archive'),
    highlights: ['Email support'], is_public: true, featured: false, sort: 0,
  },
  combra: {
    id: 'combra', name: 'Combra', tagline: 'For growing schools that want more tools.', badge: 'Most popular',
    monthly_price: 900, yearly_price: 9000,
    max_students: 500, max_staff: 40, max_users: 45, max_storage_gb: 20,
    features: on('admissions', 'promotions', 'fee_management', 'academic_archive', 'discipline', 'id_cards', 'events', 'expenses'),
    highlights: ['Priority email support'], is_public: true, featured: true, sort: 1,
  },
  bintumani: {
    id: 'bintumani', name: 'Bintumani', tagline: 'The complete platform with full accounting.', badge: 'Complete',
    monthly_price: 1750, yearly_price: 17500,
    max_students: UNLIMITED, max_staff: UNLIMITED, max_users: UNLIMITED, max_storage_gb: 100,
    features: on(...FEATURES.filter((f) => !f.core).map((f) => f.key)),
    highlights: ['Dedicated onboarding', 'Priority phone support'], is_public: true, featured: false, sort: 2,
  },
};

const CATALOG_KEY = 'plan_catalog';
const CACHE_MS = 30_000;
let cache: { at: number; plans: Record<PlanId, PlanDef> } | null = null;

const num = (v: any, dflt: number, min = 0) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min ? Math.round(n * 100) / 100 : dflt;
};
const int = (v: any, dflt: number, min = 0) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min ? Math.min(Math.floor(n), UNLIMITED) : dflt;
};
const str = (v: any, dflt: string, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : dflt);

/** Merge a stored/edited plan over its default, dropping unknown keys and bad values. */
function normalizePlan(id: PlanId, raw: any): PlanDef {
  const d = DEFAULT_PLANS[id];
  const r = raw && typeof raw === 'object' ? raw : {};
  const features: Record<string, boolean> = {};
  const srcFeatures = r.features && typeof r.features === 'object' ? r.features : d.features;
  for (const f of FEATURES) {
    if (f.core) continue;
    features[f.key] = srcFeatures[f.key] === true;
  }
  const highlights = Array.isArray(r.highlights)
    ? r.highlights.filter((h: any) => typeof h === 'string' && h.trim()).map((h: string) => h.trim().slice(0, 120)).slice(0, 12)
    : d.highlights;
  return {
    id,
    name: str(r.name, d.name, 40) || d.name,
    tagline: str(r.tagline, d.tagline, 160),
    badge: str(r.badge, d.badge, 30),
    monthly_price: num(r.monthly_price, d.monthly_price),
    yearly_price: num(r.yearly_price, d.yearly_price),
    max_students: int(r.max_students, d.max_students, 1),
    max_staff: int(r.max_staff, d.max_staff, 1),
    max_users: int(r.max_users, d.max_users, 1),
    max_storage_gb: int(r.max_storage_gb, d.max_storage_gb, 1),
    features,
    highlights,
    is_public: typeof r.is_public === 'boolean' ? r.is_public : d.is_public,
    featured: typeof r.featured === 'boolean' ? r.featured : d.featured,
    sort: int(r.sort, d.sort),
  };
}

async function readStored(): Promise<Record<string, any>> {
  try {
    const row = await db('platform_settings').where({ key: CATALOG_KEY }).first();
    if (!row?.value) return {};
    return typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
  } catch (err) {
    logger.warn(`plan catalog read failed, using defaults: ${err instanceof Error ? err.message : err}`);
    return {};
  }
}

export const PlanCatalog = {
  FEATURES,
  PLAN_IDS,

  isPlanId(v: unknown): v is PlanId {
    return typeof v === 'string' && (PLAN_IDS as string[]).includes(v);
  },

  /** All plans (live, cached briefly), keyed by id. */
  async getAll(): Promise<Record<PlanId, PlanDef>> {
    if (cache && Date.now() - cache.at < CACHE_MS) return cache.plans;
    const stored = await readStored();
    const plans = Object.fromEntries(PLAN_IDS.map((id) => [id, normalizePlan(id, stored[id])])) as Record<PlanId, PlanDef>;
    cache = { at: Date.now(), plans };
    return plans;
  },

  async list(opts: { publicOnly?: boolean } = {}): Promise<PlanDef[]> {
    const all = Object.values(await this.getAll()).sort((a, b) => a.sort - b.sort);
    return opts.publicOnly ? all.filter((p) => p.is_public) : all;
  },

  async get(id: string): Promise<PlanDef> {
    if (!this.isPlanId(id)) throw new AppError('Invalid subscription plan type', 400, 'VALIDATION_ERROR');
    return (await this.getAll())[id];
  },

  /** Full feature map for a plan (core features included as true). */
  async featuresFor(id: string): Promise<Record<string, boolean>> {
    const plan = this.isPlanId(id) ? (await this.getAll())[id] : null;
    return { ...Object.fromEntries(CORE_KEYS.map((k) => [k, true])), ...(plan?.features || {}) };
  },

  /** Price for one billing cycle. */
  priceFor(plan: PlanDef, cycle: 'monthly' | 'yearly'): number {
    return cycle === 'yearly' ? plan.yearly_price : plan.monthly_price;
  },

  /** Super admin edit of one plan. Returns the saved plan. */
  async update(id: string, patch: any, updatedBy?: string): Promise<PlanDef> {
    if (!this.isPlanId(id)) throw new AppError('Invalid subscription plan type', 400, 'VALIDATION_ERROR');
    if (patch?.features && typeof patch.features === 'object') {
      const unknown = Object.keys(patch.features).filter((k) => !FEATURE_KEYS.has(k));
      if (unknown.length) throw new AppError(`Unknown feature(s): ${unknown.join(', ')}`, 400, 'VALIDATION_ERROR');
    }
    const stored = await readStored();
    const current = normalizePlan(id, stored[id]);
    const next = normalizePlan(id, {
      ...current, ...patch,
      features: { ...current.features, ...(patch?.features || {}) },
      id,
    });
    if (!next.name) throw new AppError('Plan name is required', 400, 'VALIDATION_ERROR');
    const value = JSON.stringify({ ...stored, [id]: next });
    const exists = await db('platform_settings').where({ key: CATALOG_KEY }).first();
    if (exists) {
      await db('platform_settings').where({ key: CATALOG_KEY }).update({ value, updated_by: updatedBy || null, updated_at: new Date() });
    } else {
      await db('platform_settings').insert({ key: CATALOG_KEY, value, updated_by: updatedBy || null, updated_at: new Date() });
    }
    cache = null;
    logger.info(`Plan ${id} updated by ${updatedBy || 'system'}`);
    return next;
  },

  /** Restore one plan to its defaults. */
  async reset(id: string, updatedBy?: string): Promise<PlanDef> {
    if (!this.isPlanId(id)) throw new AppError('Invalid subscription plan type', 400, 'VALIDATION_ERROR');
    const stored = await readStored();
    delete stored[id];
    await db('platform_settings').where({ key: CATALOG_KEY }).update({ value: JSON.stringify(stored), updated_by: updatedBy || null, updated_at: new Date() });
    cache = null;
    return normalizePlan(id, null);
  },

  /** Test hook / after external writes. */
  clearCache() { cache = null; },
};

export default PlanCatalog;
