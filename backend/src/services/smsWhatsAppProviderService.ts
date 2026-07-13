import db from '@utils/database';
import { logger } from '@utils/logger';
import type {
  SMSWhatsAppProvider,
  CreateProviderRequest,
  ProviderStatusResponse,
} from '../types/sms-whatsapp';
import crypto from 'crypto';

/**
 * SMS & WhatsApp Provider Service
 * Manages provider configurations for SMS and WhatsApp messaging
 */
class SMSWhatsAppProviderService {
  /**
   * Create a new SMS/WhatsApp provider
   */
  async createProvider(
    tenantId: string,
    request: CreateProviderRequest,
    userId: string
  ): Promise<SMSWhatsAppProvider> {
    try {
      // Check if primary provider already exists
      if (request.provider_type?.includes('primary')) {
        await db('sms_whatsapp_providers')
          .where({ tenant_id: tenantId, is_primary: true })
          .update({ is_primary: false });
      }

      const [provider] = await db('sms_whatsapp_providers')
        .insert({
          tenant_id: tenantId,
          provider_name: request.provider_name,
          provider_type: request.provider_type,
          api_key: this.encryptSensitiveData(request.api_key),
          api_secret: request.api_secret ? this.encryptSensitiveData(request.api_secret) : null,
          account_sid: request.account_sid,
          auth_token: request.auth_token ? this.encryptSensitiveData(request.auth_token) : null,
          phone_number: request.phone_number,
          business_account_id: request.business_account_id,
          webhook_url: request.webhook_url,
          webhook_secret: request.webhook_secret ? this.encryptSensitiveData(request.webhook_secret) : null,
          cost_per_sms: request.cost_per_sms || 0.01,
          cost_per_whatsapp_message: request.cost_per_whatsapp_message || 0.02,
          configuration: request.configuration ? JSON.stringify(request.configuration) : null,
          created_by: userId,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning('*');

      logger.info(`Provider created: ${provider.provider_id} (${request.provider_name})`);
      return this.decryptSensitiveFields(provider);
    } catch (error) {
      logger.error(`Error creating provider: ${error}`);
      throw new Error(`Failed to create provider: ${error}`);
    }
  }

  /**
   * Get provider by ID
   */
  async getProviderById(providerId: string): Promise<SMSWhatsAppProvider | null> {
    try {
      const provider = await db('sms_whatsapp_providers')
        .where({ provider_id: providerId })
        .first();

      if (!provider) {
        return null;
      }

      return this.decryptSensitiveFields(provider);
    } catch (error) {
      logger.error(`Error fetching provider ${providerId}: ${error}`);
      throw new Error(`Failed to fetch provider: ${error}`);
    }
  }

  /**
   * Get all providers for a tenant
   */
  async getProvidersByTenant(tenantId: string): Promise<SMSWhatsAppProvider[]> {
    try {
      const providers = await db('sms_whatsapp_providers')
        .where({ tenant_id: tenantId })
        .orderBy('is_primary', 'desc')
        .orderBy('created_at', 'desc');

      return providers.map(p => this.decryptSensitiveFields(p));
    } catch (error) {
      logger.error(`Error fetching providers for tenant ${tenantId}: ${error}`);
      throw new Error(`Failed to fetch providers: ${error}`);
    }
  }

  /**
   * Get primary provider for a tenant
   */
  async getPrimaryProvider(tenantId: string, type?: 'sms' | 'whatsapp' | 'both'): Promise<SMSWhatsAppProvider | null> {
    try {
      let query = db('sms_whatsapp_providers')
        .where({ tenant_id: tenantId, is_primary: true, enabled: true });

      if (type) {
        query = query.where('provider_type', 'like', `%${type}%`);
      }

      const provider = await query.first();
      return provider ? this.decryptSensitiveFields(provider) : null;
    } catch (error) {
      logger.error(`Error fetching primary provider for tenant ${tenantId}: ${error}`);
      throw new Error(`Failed to fetch primary provider: ${error}`);
    }
  }

  /**
   * Update provider
   */
  async updateProvider(
    providerId: string,
    updates: Partial<CreateProviderRequest>,
    userId: string
  ): Promise<SMSWhatsAppProvider> {
    try {
      const updateData: Record<string, any> = {
        updated_at: db.fn.now(),
      };

      if (updates.api_key) updateData.api_key = this.encryptSensitiveData(updates.api_key);
      if (updates.api_secret) updateData.api_secret = this.encryptSensitiveData(updates.api_secret);
      if (updates.auth_token) updateData.auth_token = this.encryptSensitiveData(updates.auth_token);
      if (updates.webhook_secret) updateData.webhook_secret = this.encryptSensitiveData(updates.webhook_secret);
      if (updates.phone_number) updateData.phone_number = updates.phone_number;
      if (updates.webhook_url) updateData.webhook_url = updates.webhook_url;
      if (updates.cost_per_sms !== undefined) updateData.cost_per_sms = updates.cost_per_sms;
      if (updates.cost_per_whatsapp_message !== undefined) updateData.cost_per_whatsapp_message = updates.cost_per_whatsapp_message;
      if (updates.configuration) updateData.configuration = JSON.stringify(updates.configuration);

      const [provider] = await db('sms_whatsapp_providers')
        .where({ provider_id: providerId })
        .update(updateData)
        .returning('*');

      if (!provider) {
        throw new Error('Provider not found');
      }

      logger.info(`Provider updated: ${providerId}`);
      return this.decryptSensitiveFields(provider);
    } catch (error) {
      logger.error(`Error updating provider ${providerId}: ${error}`);
      throw new Error(`Failed to update provider: ${error}`);
    }
  }

  /**
   * Toggle provider status
   */
  async toggleProviderStatus(providerId: string, enabled: boolean): Promise<SMSWhatsAppProvider> {
    try {
      const [provider] = await db('sms_whatsapp_providers')
        .where({ provider_id: providerId })
        .update({
          enabled,
          updated_at: db.fn.now(),
        })
        .returning('*');

      if (!provider) {
        throw new Error('Provider not found');
      }

      logger.info(`Provider ${enabled ? 'enabled' : 'disabled'}: ${providerId}`);
      return this.decryptSensitiveFields(provider);
    } catch (error) {
      logger.error(`Error toggling provider status: ${error}`);
      throw new Error(`Failed to toggle provider status: ${error}`);
    }
  }

  /**
   * Set provider as primary
   */
  async setPrimaryProvider(tenantId: string, providerId: string): Promise<SMSWhatsAppProvider> {
    try {
      // Unset current primary
      await db('sms_whatsapp_providers')
        .where({ tenant_id: tenantId, is_primary: true })
        .update({ is_primary: false, updated_at: db.fn.now() });

      // Set new primary
      const [provider] = await db('sms_whatsapp_providers')
        .where({ provider_id: providerId, tenant_id: tenantId })
        .update({
          is_primary: true,
          updated_at: db.fn.now(),
        })
        .returning('*');

      if (!provider) {
        throw new Error('Provider not found');
      }

      logger.info(`Provider set as primary: ${providerId}`);
      return this.decryptSensitiveFields(provider);
    } catch (error) {
      logger.error(`Error setting primary provider: ${error}`);
      throw new Error(`Failed to set primary provider: ${error}`);
    }
  }

  /**
   * Delete provider
   */
  async deleteProvider(providerId: string): Promise<void> {
    try {
      const deleted = await db('sms_whatsapp_providers')
        .where({ provider_id: providerId })
        .delete();

      if (deleted === 0) {
        throw new Error('Provider not found');
      }

      logger.info(`Provider deleted: ${providerId}`);
    } catch (error) {
      logger.error(`Error deleting provider ${providerId}: ${error}`);
      throw new Error(`Failed to delete provider: ${error}`);
    }
  }

  /**
   * Test provider connection
   */
  async testProviderConnection(providerId: string): Promise<ProviderStatusResponse> {
    try {
      const provider = await this.getProviderById(providerId);
      if (!provider) {
        throw new Error('Provider not found');
      }

      // Test connection based on provider type
      let status: 'connected' | 'error' = 'connected';
      let errorMessage: string | undefined;

      try {
        switch (provider.provider_name) {
          case 'twilio':
            await this.testTwilioConnection(provider);
            break;
          case 'brevo':
            await this.testBrevoConnection(provider);
            break;
          case 'messagebird':
            await this.testMessageBirdConnection(provider);
            break;
          default:
            // Custom provider - basic validation
            break;
        }
      } catch (error) {
        status = 'error';
        errorMessage = String(error);
      }

      return {
        provider_id: providerId,
        provider_name: provider.provider_name,
        is_primary: provider.is_primary,
        enabled: provider.enabled,
        phone_number: provider.phone_number,
        status,
        last_tested_at: new Date(),
        error_message: errorMessage,
      };
    } catch (error) {
      logger.error(`Error testing provider connection: ${error}`);
      throw new Error(`Failed to test provider connection: ${error}`);
    }
  }

  /**
   * Private helper methods
   */

  private encryptSensitiveData(data: string): string {
    const key = process.env.ENCRYPTION_KEY || 'default-encryption-key-32-characters-';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key.substring(0, 32)), iv);
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  private decryptSensitiveData(data: string): string {
    try {
      const key = process.env.ENCRYPTION_KEY || 'default-encryption-key-32-characters-';
      const parts = data.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = Buffer.from(parts[1], 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key.substring(0, 32)), iv);
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    } catch {
      return data; // Return original if decryption fails
    }
  }

  private decryptSensitiveFields(provider: any): SMSWhatsAppProvider {
    return {
      ...provider,
      api_key: provider.api_key ? this.decryptSensitiveData(provider.api_key) : provider.api_key,
      api_secret: provider.api_secret ? this.decryptSensitiveData(provider.api_secret) : provider.api_secret,
      auth_token: provider.auth_token ? this.decryptSensitiveData(provider.auth_token) : provider.auth_token,
      webhook_secret: provider.webhook_secret ? this.decryptSensitiveData(provider.webhook_secret) : provider.webhook_secret,
      configuration: provider.configuration ? JSON.parse(provider.configuration) : provider.configuration,
    };
  }

  private async testTwilioConnection(provider: SMSWhatsAppProvider): Promise<void> {
    // Test Twilio connection
    const accountSid = provider.account_sid;
    const authToken = provider.auth_token;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      },
    });

    if (!response.ok) {
      throw new Error(`Twilio connection failed: ${response.statusText}`);
    }
  }

  private async testBrevoConnection(provider: SMSWhatsAppProvider): Promise<void> {
    // Test Brevo connection
    const url = 'https://api.brevo.com/v3/account';

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'api-key': provider.api_key,
      },
    });

    if (!response.ok) {
      throw new Error(`Brevo connection failed: ${response.statusText}`);
    }
  }

  private async testMessageBirdConnection(provider: SMSWhatsAppProvider): Promise<void> {
    // Test MessageBird connection
    const url = 'https://api.messagebird.com/balance';

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `AccessKey ${provider.api_key}`,
      },
    });

    if (!response.ok) {
      throw new Error(`MessageBird connection failed: ${response.statusText}`);
    }
  }
}

export default new SMSWhatsAppProviderService();
