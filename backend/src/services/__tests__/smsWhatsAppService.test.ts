/**
 * SMS/WhatsApp Service Tests
 * Covers pure helper logic and the provider adapter retry/error
 * classification behavior (ProviderSendError: retryable vs. permanent).
 * Database, provider network calls, and sibling services are mocked so
 * these tests run fully offline and deterministically.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const dbTableMock = vi.fn();
const updateMock = vi.fn().mockResolvedValue(1);
const insertMock = vi.fn().mockResolvedValue([1]);
const whereMock = vi.fn().mockReturnValue({ update: updateMock });

vi.mock('@utils/database', () => {
  const fn: any = (...args: any[]) => dbTableMock(...args);
  fn.fn = { now: vi.fn().mockReturnValue('NOW()') };
  return { default: fn };
});

vi.mock('@utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../smsWhatsAppProviderService', () => ({
  default: {
    getProviderById: vi.fn(),
  },
}));

vi.mock('../phoneNumberService', () => ({
  default: {
    isUserOptedOut: vi.fn(),
  },
}));

import smsWhatsAppService from '../smsWhatsAppService';
import smsWhatsAppProviderService from '../smsWhatsAppProviderService';
import phoneNumberService from '../phoneNumberService';

const service = smsWhatsAppService as any;

const twilioProvider = {
  provider_id: 'provider-1',
  provider_name: 'twilio',
  account_sid: 'AC123',
  auth_token: 'secret',
  phone_number: '+15551234567',
  cost_per_sms: 0.01,
  cost_per_whatsapp_message: 0.02,
};

function baseMessage(overrides: Record<string, any> = {}) {
  return {
    message_id: 'msg-1',
    tenant_id: 'tenant-1',
    recipient_id: 'user-1',
    provider_id: 'provider-1',
    channel: 'sms',
    recipient_phone_number: '+15559876543',
    message_content: 'Hello there',
    ...overrides,
  };
}

describe('SMSWhatsAppService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbTableMock.mockReturnValue({ where: whereMock, insert: insertMock });
    whereMock.mockReturnValue({ update: updateMock });
    (phoneNumberService.isUserOptedOut as any).mockResolvedValue(false);
  });

  describe('pure helpers', () => {
    it('calculateSMSParts returns 1 for a short plain-ASCII message', () => {
      expect(service.calculateSMSParts('Hello world')).toBe(1);
    });

    it('calculateSMSParts splits into multiple parts past the 160 char GSM limit', () => {
      const longMessage = 'a'.repeat(320);
      expect(service.calculateSMSParts(longMessage)).toBe(2);
    });

    it('calculateSMSParts uses the tighter 70 char limit when unicode symbols are present', () => {
      const message = '€'.repeat(140);
      expect(service.calculateSMSParts(message)).toBe(2);
    });

    it('calculateCost multiplies per-SMS cost by part count for sms channel', () => {
      const cost = service.calculateCost('sms', 3, { cost_per_sms: 0.05, cost_per_whatsapp_message: 0.1 });
      expect(cost).toBeCloseTo(0.15);
    });

    it('calculateCost uses a flat per-message cost for whatsapp channel regardless of parts', () => {
      const cost = service.calculateCost('whatsapp', 5, { cost_per_sms: 0.05, cost_per_whatsapp_message: 0.1 });
      expect(cost).toBeCloseTo(0.1);
    });

    it('replaceTemplateVariables substitutes all {{var}} placeholders', () => {
      const result = service.replaceTemplateVariables('Hi {{name}}, your code is {{code}}', {
        name: 'Alex',
        code: '123456',
      });
      expect(result).toBe('Hi Alex, your code is 123456');
    });

    it('replaceTemplateVariables leaves unmatched placeholders untouched', () => {
      const result = service.replaceTemplateVariables('Hi {{name}}, {{missing}}', { name: 'Alex' });
      expect(result).toBe('Hi Alex, {{missing}}');
    });
  });

  describe('sendViaProvider - opt-out enforcement', () => {
    it('blocks the message and never calls the provider when the recipient opted out', async () => {
      (smsWhatsAppProviderService.getProviderById as any).mockResolvedValue(twilioProvider);
      (phoneNumberService.isUserOptedOut as any).mockResolvedValue(true);
      global.fetch = vi.fn();

      await service.sendViaProvider(baseMessage());

      expect(global.fetch).not.toHaveBeenCalled();
      expect(whereMock).toHaveBeenCalledWith({ message_id: 'msg-1' });
      expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'blocked' }));
    });

    it('bypasses the opt-out check when bypassOptOutCheck is set (e.g. verification codes)', async () => {
      (smsWhatsAppProviderService.getProviderById as any).mockResolvedValue(twilioProvider);
      (phoneNumberService.isUserOptedOut as any).mockResolvedValue(true);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sid: 'SM123' }),
      });

      await service.sendViaProvider(baseMessage(), { bypassOptOutCheck: true });

      expect(phoneNumberService.isUserOptedOut).not.toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendViaProvider - retry & error classification', () => {
    it('sends successfully on the first attempt with no retries', async () => {
      (smsWhatsAppProviderService.getProviderById as any).mockResolvedValue(twilioProvider);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sid: 'SM123' }),
      });

      await service.sendViaProvider(baseMessage());

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'sent', provider_message_id: 'SM123' })
      );
    });

    it('does not retry a permanent (4xx) provider error and persists the error_code', async () => {
      (smsWhatsAppProviderService.getProviderById as any).mockResolvedValue(twilioProvider);
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => JSON.stringify({ code: 21211, message: 'Invalid To phone number' }),
      });

      await expect(service.sendViaProvider(baseMessage())).rejects.toThrow('Invalid To phone number');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', error_code: '21211' })
      );
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', error_code: '21211' })
      );
    });

    it('retries a transient (5xx) provider error up to the max attempt count before failing', async () => {
      (smsWhatsAppProviderService.getProviderById as any).mockResolvedValue(twilioProvider);
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: async () => '',
      });

      await expect(service.sendViaProvider(baseMessage())).rejects.toThrow();

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(updateMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'failed' })
      );
    }, 10000);

    it('treats a rate-limit (429) as retryable and succeeds once the limit clears', async () => {
      (smsWhatsAppProviderService.getProviderById as any).mockResolvedValue(twilioProvider);
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount += 1;
        if (callCount === 1) {
          return {
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            text: async () => JSON.stringify({ code: 'rate_limited', message: 'Slow down' }),
          };
        }
        return { ok: true, json: async () => ({ sid: 'SM456' }) };
      });

      await service.sendViaProvider(baseMessage());

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'sent', provider_message_id: 'SM456' })
      );
    });

    it('treats missing provider credentials as a non-retryable configuration error', async () => {
      (smsWhatsAppProviderService.getProviderById as any).mockResolvedValue({
        ...twilioProvider,
        account_sid: undefined,
      });
      global.fetch = vi.fn();

      await expect(service.sendViaProvider(baseMessage())).rejects.toThrow(
        'Twilio provider is missing account SID or auth token'
      );

      expect(global.fetch).not.toHaveBeenCalled();
      expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
    });

    it('rejects an unsupported provider name as non-retryable', async () => {
      (smsWhatsAppProviderService.getProviderById as any).mockResolvedValue({
        ...twilioProvider,
        provider_name: 'unknown-provider',
      });
      global.fetch = vi.fn();

      await expect(service.sendViaProvider(baseMessage())).rejects.toThrow('Unsupported provider');

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('sends WhatsApp through Brevo using its configured approved template', async () => {
      (smsWhatsAppProviderService.getProviderById as any).mockResolvedValue({
        ...twilioProvider,
        provider_name: 'brevo',
        api_key: 'brevo-key',
        configuration: { brevo_whatsapp_template_id: '123' },
      });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ messageId: 'brevo-message-1' }),
      });

      await service.sendViaProvider(baseMessage({ channel: 'whatsapp' }));

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.brevo.com/v3/whatsapp/sendMessage',
        expect.objectContaining({
          headers: expect.objectContaining({ 'api-key': 'brevo-key' }),
          body: JSON.stringify({
            contactNumbers: [15559876543],
            senderNumber: '15551234567',
            templateId: 123,
          }),
        })
      );
    });

    it('sends WhatsApp through MessageBird Conversations with its configured channel ID', async () => {
      (smsWhatsAppProviderService.getProviderById as any).mockResolvedValue({
        ...twilioProvider,
        provider_name: 'messagebird',
        api_key: 'messagebird-key',
        configuration: { messagebird_whatsapp_channel_id: 'whatsapp-channel-1' },
      });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'messagebird-message-1' }),
      });

      await service.sendViaProvider(baseMessage({ channel: 'whatsapp' }));

      expect(global.fetch).toHaveBeenCalledWith(
        'https://conversations.messagebird.com/v1/send',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'AccessKey messagebird-key' }),
          body: JSON.stringify({
            to: '+15559876543',
            from: 'whatsapp-channel-1',
            type: 'text',
            content: { text: 'Hello there' },
          }),
        })
      );
    });
  });
});
