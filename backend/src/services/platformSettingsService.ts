/**
 * platformSettingsService — global settings the PLATFORM OWNER controls from the
 * superadmin portal (not per-tenant).
 *
 * Backed by the `platform_settings` JSON key/value table. Values are resolved
 * as: stored DB value → env fallback → hardcoded default, so the system still
 * works before the owner has configured anything.
 */
import { db } from '../utils/database';
import { logger } from '../utils/logger';

export interface TrialConfig {
  /** Whether new schools get a promotional trial at all. */
  enabled: boolean;
  /** Which plan new schools start on for the trial. */
  planType: 'freetong' | 'combra' | 'bintumani';
  /** Trial length in days. */
  durationDays: number;
}

const TRIAL_KEY = 'trial_config';

/** Hardcoded safe defaults (used only if neither DB nor env provide a value). */
const DEFAULT_TRIAL: TrialConfig = {
  enabled: true,
  planType: 'bintumani',
  durationDays: 30,
};

/** Env fallback (lets ops seed a value before the owner sets one in the UI). */
function trialFromEnv(): Partial<TrialConfig> {
  const out: Partial<TrialConfig> = {};
  if (process.env.TRIAL_PLAN) out.planType = process.env.TRIAL_PLAN as TrialConfig['planType'];
  if (process.env.TRIAL_DAYS) out.durationDays = Number(process.env.TRIAL_DAYS);
  if (process.env.TRIAL_ENABLED) out.enabled = process.env.TRIAL_ENABLED !== 'false';
  return out;
}

function normalizeTrial(raw: any): TrialConfig {
  const env = trialFromEnv();
  const plan = raw?.planType ?? env.planType ?? DEFAULT_TRIAL.planType;
  const validPlan = ['freetong', 'combra', 'bintumani'].includes(plan) ? plan : DEFAULT_TRIAL.planType;
  const days = Number(raw?.durationDays ?? env.durationDays ?? DEFAULT_TRIAL.durationDays);
  return {
    enabled: raw?.enabled ?? env.enabled ?? DEFAULT_TRIAL.enabled,
    planType: validPlan,
    durationDays: Number.isFinite(days) && days > 0 ? Math.floor(days) : DEFAULT_TRIAL.durationDays,
  };
}

export class PlatformSettingsService {
  /** Read the new-school trial config (resolved DB → env → default). */
  static async getTrialConfig(): Promise<TrialConfig> {
    try {
      const row = await db('platform_settings').where({ key: TRIAL_KEY }).first();
      const stored = row?.value
        ? (typeof row.value === 'string' ? JSON.parse(row.value) : row.value)
        : null;
      return normalizeTrial(stored);
    } catch (err) {
      logger.warn(`getTrialConfig failed, using defaults: ${err instanceof Error ? err.message : err}`);
      return normalizeTrial(null);
    }
  }

  /** Upsert the trial config (superadmin only, enforced at the route). */
  static async setTrialConfig(patch: Partial<TrialConfig>, updatedBy?: string): Promise<TrialConfig> {
    const current = await this.getTrialConfig();
    const next = normalizeTrial({ ...current, ...patch });

    const existing = await db('platform_settings').where({ key: TRIAL_KEY }).first();
    if (existing) {
      await db('platform_settings').where({ key: TRIAL_KEY }).update({
        value: JSON.stringify(next),
        updated_by: updatedBy || null,
        updated_at: new Date(),
      });
    } else {
      await db('platform_settings').insert({
        key: TRIAL_KEY,
        value: JSON.stringify(next),
        updated_by: updatedBy || null,
        updated_at: new Date(),
      });
    }
    logger.info(`Trial config updated by ${updatedBy || 'system'}: ${JSON.stringify(next)}`);
    return next;
  }
}

export default PlatformSettingsService;
