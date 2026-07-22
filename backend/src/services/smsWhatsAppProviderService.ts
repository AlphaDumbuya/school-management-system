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
      this.validateProviderRequest(request);

      if (request.is_primary) {
        await db('sms_whatsapp_providers')
          .where({ tenant_id: tenantId, is_primary: true })
          .update({ is_primary: false, updated_at: db.fn.now() });
      }

      const [provider] = await db('sms_whatsapp_providers')
        .insert({
          tenant_id: tenantId,
          provider_name: request.provider_name,
          provider_type: request.provider_type,
          api_key: this.encryptSensitiveData(request.api_key || ''),
          api_secret: request.api_secret ? this.encryptSensitiveData(request.api_secret) : null,
          account_sid: request.account_sid,
          auth_token: request.auth_token ? this.encryptSensitiveData(request.auth_token) : null,
          phone_number: request.phone_number,
          business_account_id: request.business_account_id,
          webhook_url: request.webhook_url,
          webhook_secret: request.webhook_secret ? this.encryptSensitiveData(request.webhook_secret) : null,
          cost_per_sms: request.cost_per_sms ?? 0.01,
          cost_per_whatsapp_message: request.cost_per_whatsapp_message ?? 0.02,
          is_primary: request.is_primary ?? false,
          enabled: request.enabled ?? true,
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

      if (type && type !== 'both') {
        query = query.whereIn('provider_type', [type, 'both']);
      }

      const provider = await query.first();
      if (!provider) {
        let fallbackQuery = db('sms_whatsapp_providers')
          .where({ tenant_id: tenantId, enabled: true });

        if (type && type !== 'both') {
          fallbackQuery = fallbackQuery.whereIn('provider_type', [type, 'both']);
        }

        const fallbackProvider = await fallbackQuery
          .orderBy('is_primary', 'desc')
          .orderBy('created_at', 'desc')
          .first();

        return fallbackProvider ? this.decryptSensitiveFields(fallbackProvider) : null;
      }
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
      const providerRecord = await db('sms_whatsapp_providers')
        .where({ provider_id: providerId })
        .first();

      if (!providerRecord) {
        throw new Error('Provider not found');
      }

      const updateData: Record<string, any> = {
        updated_at: db.fn.now(),
      };

      this.validateProviderUpdateRequest(updates, providerRecord);

      if (updates.provider_name) updateData.provider_name = updates.provider_name;
      if (updates.provider_type) updateData.provider_type = updates.provider_type;
      if (updates.api_key) updateData.api_key = this.encryptSensitiveData(updates.api_key);
      if (updates.api_secret) updateData.api_secret = this.encryptSensitiveData(updates.api_secret);
      if (updates.account_sid) updateData.account_sid = updates.account_sid;
      if (updates.auth_token) updateData.auth_token = this.encryptSensitiveData(updates.auth_token);
      if (updates.phone_number) updateData.phone_number = updates.phone_number;
      if (updates.business_account_id) updateData.business_account_id = updates.business_account_id;
      if (updates.webhook_url) updateData.webhook_url = updates.webhook_url;
      if (updates.webhook_secret) updateData.webhook_secret = this.encryptSensitiveData(updates.webhook_secret);
      if (updates.cost_per_sms !== undefined) updateData.cost_per_sms = updates.cost_per_sms;
      if (updates.cost_per_whatsapp_message !== undefined) updateData.cost_per_whatsapp_message = updates.cost_per_whatsapp_message;
      if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
      if (updates.configuration) updateData.configuration = JSON.stringify(updates.configuration);

      if (updates.is_primary) {
        await db('sms_whatsapp_providers')
          .where({ tenant_id: providerRecord.tenant_id, is_primary: true })
          .update({ is_primary: false, updated_at: db.fn.now() });
        updateData.is_primary = true;
      }

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

  private validateProviderRequest(request: CreateProviderRequest): void {
    if (!['twilio', 'brevo', 'messagebird', 'custom'].includes(request.provider_name)) {
      throw new Error('Invalid provider name');
    }

    if (!['sms', 'whatsapp', 'both'].includes(request.provider_type)) {
      throw new Error('Invalid provider type');
    }

    if (!request.phone_number) {
      throw new Error('Provider phone number is required');
    }

    if (request.provider_name === 'twilio') {
      if (!request.account_sid || !request.auth_token) {
        throw new Error('Twilio requires account SID and auth token');
      }
    }

    if (['brevo', 'messagebird'].includes(request.provider_name)) {
      if (!request.api_key) {
        throw new Error(`${request.provider_name} requires an API key`);
      }
    }
  }

  private validateProviderUpdateRequest(
    updates: Partial<CreateProviderRequest>,
    existingProvider: SMSWhatsAppProvider
  ): void {
    const providerName = updates.provider_name || existingProvider.provider_name;
    const providerType = updates.provider_type || existingProvider.provider_type;
    const phoneNumber = updates.phone_number || existingProvider.phone_number;

    if (updates.provider_name && !['twilio', 'brevo', 'messagebird', 'custom'].includes(updates.provider_name)) {
      throw new Error('Invalid provider name');
    }

    if (updates.provider_type && !['sms', 'whatsapp', 'both'].includes(updates.provider_type)) {
      throw new Error('Invalid provider type');
    }

    if (phoneNumber === undefined || phoneNumber === null || String(phoneNumber).trim() === '') {
      throw new Error('Provider phone number is required');
    }

    if (providerName === 'twilio') {
      const accountSid = updates.account_sid || existingProvider.account_sid;
      const authToken = updates.auth_token || existingProvider.auth_token;
      if (!accountSid || !authToken) {
        throw new Error('Twilio requires account SID and auth token');
      }
    }

    if (['brevo', 'messagebird'].includes(providerName)) {
      const apiKey = updates.api_key || existingProvider.api_key;
      if (!apiKey) {
        throw new Error(`${providerName} requires an API key`);
      }
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
    const accountSid = provider.account_sid;
    const authToken = provider.auth_token;
    const authorization = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const accountUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`;

    const response = await fetch(accountUrl, {
      method: 'GET',
      headers: {
        Authorization: authorization,
      },
    });

    if (!response.ok) {
      throw new Error(`Twilio connection failed: ${response.statusText}`);
    }

    const senderUrl = new URL(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`);
    senderUrl.searchParams.set('PhoneNumber', provider.phone_number);
    const senderResponse = await fetch(senderUrl, {
      method: 'GET',
      headers: { Authorization: authorization },
    });

    if (!senderResponse.ok) {
      throw new Error(`Twilio sender-number check failed: ${senderResponse.statusText}`);
    }

    const senderData = await senderResponse.json() as {
      incoming_phone_numbers?: Array<{ capabilities?: { sms?: boolean } }>;
    };
    const sender = senderData.incoming_phone_numbers?.[0];
    if (!sender) {
      throw new Error('The configured sender number is not owned by this Twilio account. Buy or select an SMS-capable Twilio number and update the provider.');
    }

    if (provider.provider_type !== 'whatsapp' && !sender.capabilities?.sms) {
      throw new Error('The configured Twilio sender number is not SMS-capable. Choose a Twilio number with SMS enabled.');
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
