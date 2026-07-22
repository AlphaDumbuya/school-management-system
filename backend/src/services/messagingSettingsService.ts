import db from '@utils/database';
import { logger } from '@utils/logger';

const DEFAULT_STOP_KEYWORDS = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'END', 'CANCEL', 'QUIT'];
const DEFAULT_START_KEYWORDS = ['START', 'UNSTOP', 'SUBSCRIBE', 'YES'];

export interface MessagingSettings {
  settings_id?: string;
  tenant_id: string;
  stop_keywords: string[];
  start_keywords: string[];
  default_language?: string;
}

/**
 * Tenant-scoped messaging settings service.
 * Provides configurable STOP/START keyword lists per tenant (multi-tenant safe).
 */
class MessagingSettingsService {
  /**
   * Get messaging settings for a tenant, falling back to sensible defaults
   * when the tenant has not configured custom keywords.
   */
  async getSettings(tenantId: string): Promise<MessagingSettings> {
    try {
      const row = await db('messaging_settings').where({ tenant_id: tenantId }).first();

      if (!row) {
        return {
          tenant_id: tenantId,
          stop_keywords: DEFAULT_STOP_KEYWORDS,
          start_keywords: DEFAULT_START_KEYWORDS,
        };
      }

      return {
        settings_id: row.settings_id,
        tenant_id: row.tenant_id,
        stop_keywords: this.parseKeywords(row.stop_keywords, DEFAULT_STOP_KEYWORDS),
        start_keywords: this.parseKeywords(row.start_keywords, DEFAULT_START_KEYWORDS),
        default_language: row.default_language,
      };
    } catch (error) {
      logger.error(`Error fetching messaging settings for tenant ${tenantId}: ${error}`);
      // Fail open with safe defaults so opt-out detection never silently stops working
      return {
        tenant_id: tenantId,
        stop_keywords: DEFAULT_STOP_KEYWORDS,
        start_keywords: DEFAULT_START_KEYWORDS,
      };
    }
  }

  /**
   * Create or update tenant messaging settings (upsert)
   */
  async updateSettings(
    tenantId: string,
    updates: { stop_keywords?: string[]; start_keywords?: string[]; default_language?: string }
  ): Promise<MessagingSettings> {
    try {
      const existing = await db('messaging_settings').where({ tenant_id: tenantId }).first();

      const payload: Record<string, any> = { updated_at: db.fn.now() };
      if (updates.stop_keywords) {
        payload.stop_keywords = JSON.stringify(this.normalizeKeywords(updates.stop_keywords));
      }
      if (updates.start_keywords) {
        payload.start_keywords = JSON.stringify(this.normalizeKeywords(updates.start_keywords));
      }
      if (updates.default_language !== undefined) {
        payload.default_language = updates.default_language;
      }

      let row;
      if (existing) {
        [row] = await db('messaging_settings')
          .where({ tenant_id: tenantId })
          .update(payload)
          .returning('*');
      } else {
        [row] = await db('messaging_settings')
          .insert({
            tenant_id: tenantId,
            stop_keywords: JSON.stringify(this.normalizeKeywords(updates.stop_keywords || DEFAULT_STOP_KEYWORDS)),
            start_keywords: JSON.stringify(this.normalizeKeywords(updates.start_keywords || DEFAULT_START_KEYWORDS)),
            default_language: updates.default_language,
            created_at: db.fn.now(),
            updated_at: db.fn.now(),
          })
          .returning('*');
      }

      logger.info(`Messaging settings updated for tenant ${tenantId}`);

      return {
        settings_id: row.settings_id,
        tenant_id: row.tenant_id,
        stop_keywords: this.parseKeywords(row.stop_keywords, DEFAULT_STOP_KEYWORDS),
        start_keywords: this.parseKeywords(row.start_keywords, DEFAULT_START_KEYWORDS),
        default_language: row.default_language,
      };
    } catch (error) {
      logger.error(`Error updating messaging settings for tenant ${tenantId}: ${error}`);
      throw new Error(`Failed to update messaging settings: ${error}`);
    }
  }

  /**
   * Check whether a message body matches a STOP keyword for the tenant
   */
  async isStopMessage(tenantId: string, body: string): Promise<boolean> {
    if (!body) return false;
    const settings = await this.getSettings(tenantId);
    const words = this.tokenize(body);
    return words.some(w => settings.stop_keywords.includes(w));
  }

  /**
   * Check whether a message body matches a START/resubscribe keyword for the tenant
   */
  async isStartMessage(tenantId: string, body: string): Promise<boolean> {
    if (!body) return false;
    const settings = await this.getSettings(tenantId);
    const words = this.tokenize(body);
    return words.some(w => settings.start_keywords.includes(w));
  }

  private tokenize(body: string): string[] {
    return body
      .replace(/[\W_]+/g, ' ')
      .toUpperCase()
      .split(/\s+/)
      .filter(Boolean);
  }

  private normalizeKeywords(keywords: string[]): string[] {
    return Array.from(new Set(keywords.map(k => String(k).trim().toUpperCase()).filter(Boolean)));
  }

  private parseKeywords(raw: any, fallback: string[]): string[] {
    if (!raw) return fallback;
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallback;
    } catch {
      return fallback;
    }
  }
}

export default new MessagingSettingsService();
