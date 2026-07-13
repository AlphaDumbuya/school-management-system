import db from '@utils/database';
import { logger } from '@utils/logger';
import {
  PhoneNumber,
  AddPhoneNumberRequest,
  VerifyPhoneRequest,
  OptOut,
  CreateOptOutRequest,
} from '@types/sms-whatsapp';
import crypto from 'crypto';

/**
 * Phone Number Management Service
 * Handles phone number registration, verification, and opt-out management
 */
class PhoneNumberService {
  /**
   * Add phone number to user
   */
  async addPhoneNumber(
    tenantId: string,
    userId: string,
    request: AddPhoneNumberRequest
  ): Promise<PhoneNumber> {
    try {
      // Check if phone number already exists
      const existing = await db('phone_numbers')
        .where({
          tenant_id: tenantId,
          user_id: userId,
          phone_number: request.phone_number,
        })
        .first();

      if (existing) {
        return this.getPhoneNumberById(existing.phone_id);
      }

      // If this is primary, unset other primaries
      if (request.is_primary) {
        await db('phone_numbers')
          .where({ tenant_id: tenantId, user_id: userId, is_primary: true })
          .update({ is_primary: false });
      }

      const verificationCode = this.generateVerificationCode();

      const [phoneNumber] = await db('phone_numbers')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          phone_number: request.phone_number,
          country_code: request.country_code,
          phone_type: request.phone_type,
          is_primary: request.is_primary || false,
          sms_enabled: request.sms_enabled !== false,
          whatsapp_enabled: request.whatsapp_enabled || false,
          verification_code: verificationCode,
          verification_code_sent_at: db.fn.now(),
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning('*');

      logger.info(`Phone number added for user ${userId}: ${phoneNumber.phone_id}`);

      // TODO: Send verification code via SMS/WhatsApp
      logger.info(`Verification code generated: ${verificationCode}`);

      return this.formatPhoneNumber(phoneNumber);
    } catch (error) {
      logger.error(`Error adding phone number: ${error}`);
      throw new Error(`Failed to add phone number: ${error}`);
    }
  }

  /**
   * Get phone number by ID
   */
  async getPhoneNumberById(phoneId: string): Promise<PhoneNumber> {
    try {
      const phoneNumber = await db('phone_numbers')
        .where({ phone_id: phoneId })
        .first();

      if (!phoneNumber) {
        throw new Error('Phone number not found');
      }

      return this.formatPhoneNumber(phoneNumber);
    } catch (error) {
      logger.error(`Error fetching phone number: ${error}`);
      throw new Error(`Failed to fetch phone number: ${error}`);
    }
  }

  /**
   * Get user phone numbers
   */
  async getUserPhoneNumbers(tenantId: string, userId: string): Promise<PhoneNumber[]> {
    try {
      const phoneNumbers = await db('phone_numbers')
        .where({
          tenant_id: tenantId,
          user_id: userId,
          active: true,
        })
        .orderBy('is_primary', 'desc')
        .orderBy('created_at', 'desc');

      return phoneNumbers.map(p => this.formatPhoneNumber(p));
    } catch (error) {
      logger.error(`Error fetching user phone numbers: ${error}`);
      throw new Error(`Failed to fetch phone numbers: ${error}`);
    }
  }

  /**
   * Get primary phone number
   */
  async getPrimaryPhoneNumber(tenantId: string, userId: string): Promise<PhoneNumber | null> {
    try {
      const phoneNumber = await db('phone_numbers')
        .where({
          tenant_id: tenantId,
          user_id: userId,
          is_primary: true,
          active: true,
        })
        .first();

      return phoneNumber ? this.formatPhoneNumber(phoneNumber) : null;
    } catch (error) {
      logger.error(`Error fetching primary phone number: ${error}`);
      throw new Error(`Failed to fetch primary phone number: ${error}`);
    }
  }

  /**
   * Verify phone number with code
   */
  async verifyPhoneNumber(request: VerifyPhoneRequest): Promise<PhoneNumber> {
    try {
      const phoneNumber = await db('phone_numbers')
        .where({ phone_id: request.phone_id })
        .first();

      if (!phoneNumber) {
        throw new Error('Phone number not found');
      }

      if (phoneNumber.verification_code !== request.verification_code) {
        // Increment failed attempts
        await db('phone_numbers')
          .where({ phone_id: request.phone_id })
          .increment('verification_attempts', 1);

        throw new Error('Invalid verification code');
      }

      // Check if too many attempts
      if (phoneNumber.verification_attempts > 3) {
        throw new Error('Too many verification attempts. Please try again later.');
      }

      const [updated] = await db('phone_numbers')
        .where({ phone_id: request.phone_id })
        .update({
          verified: true,
          verified_at: db.fn.now(),
          verification_code: null,
          verification_code_sent_at: null,
          verification_attempts: 0,
          updated_at: db.fn.now(),
        })
        .returning('*');

      logger.info(`Phone number verified: ${request.phone_id}`);
      return this.formatPhoneNumber(updated);
    } catch (error) {
      logger.error(`Error verifying phone number: ${error}`);
      throw new Error(`Failed to verify phone number: ${error}`);
    }
  }

  /**
   * Resend verification code
   */
  async resendVerificationCode(phoneId: string): Promise<void> {
    try {
      const phoneNumber = await db('phone_numbers')
        .where({ phone_id: phoneId })
        .first();

      if (!phoneNumber) {
        throw new Error('Phone number not found');
      }

      if (phoneNumber.verified) {
        throw new Error('Phone number already verified');
      }

      const verificationCode = this.generateVerificationCode();

      await db('phone_numbers')
        .where({ phone_id: phoneId })
        .update({
          verification_code: verificationCode,
          verification_code_sent_at: db.fn.now(),
          verification_attempts: 0,
          updated_at: db.fn.now(),
        });

      logger.info(`Verification code resent: ${verificationCode}`);
      // TODO: Send verification code via SMS/WhatsApp
    } catch (error) {
      logger.error(`Error resending verification code: ${error}`);
      throw new Error(`Failed to resend verification code: ${error}`);
    }
  }

  /**
   * Update phone number
   */
  async updatePhoneNumber(
    phoneId: string,
    updates: Partial<AddPhoneNumberRequest>
  ): Promise<PhoneNumber> {
    try {
      const updateData: Record<string, any> = {
        updated_at: db.fn.now(),
      };

      if (updates.phone_type) updateData.phone_type = updates.phone_type;
      if (updates.sms_enabled !== undefined) updateData.sms_enabled = updates.sms_enabled;
      if (updates.whatsapp_enabled !== undefined) updateData.whatsapp_enabled = updates.whatsapp_enabled;

      if (updates.is_primary) {
        // Unset other primaries
        const phoneNumber = await db('phone_numbers').where({ phone_id: phoneId }).first();
        if (phoneNumber) {
          await db('phone_numbers')
            .where({ tenant_id: phoneNumber.tenant_id, user_id: phoneNumber.user_id, is_primary: true })
            .update({ is_primary: false });
        }
        updateData.is_primary = true;
      }

      const [updated] = await db('phone_numbers')
        .where({ phone_id: phoneId })
        .update(updateData)
        .returning('*');

      if (!updated) {
        throw new Error('Phone number not found');
      }

      logger.info(`Phone number updated: ${phoneId}`);
      return this.formatPhoneNumber(updated);
    } catch (error) {
      logger.error(`Error updating phone number: ${error}`);
      throw new Error(`Failed to update phone number: ${error}`);
    }
  }

  /**
   * Delete phone number
   */
  async deletePhoneNumber(phoneId: string): Promise<void> {
    try {
      const phoneNumber = await db('phone_numbers')
        .where({ phone_id: phoneId })
        .first();

      if (!phoneNumber) {
        throw new Error('Phone number not found');
      }

      // If deleting primary, set another as primary
      if (phoneNumber.is_primary) {
        const another = await db('phone_numbers')
          .where({
            tenant_id: phoneNumber.tenant_id,
            user_id: phoneNumber.user_id,
            active: true,
          })
          .whereNot({ phone_id: phoneId })
          .first();

        if (another) {
          await db('phone_numbers')
            .where({ phone_id: another.phone_id })
            .update({ is_primary: true });
        }
      }

      await db('phone_numbers')
        .where({ phone_id: phoneId })
        .delete();

      logger.info(`Phone number deleted: ${phoneId}`);
    } catch (error) {
      logger.error(`Error deleting phone number: ${error}`);
      throw new Error(`Failed to delete phone number: ${error}`);
    }
  }

  /**
   * Create opt-out for user
   */
  async createOptOut(
    tenantId: string,
    request: CreateOptOutRequest,
    userId: string
  ): Promise<OptOut> {
    try {
      // Check if opt-out already exists
      const existing = await db('sms_whatsapp_opt_outs')
        .where({
          tenant_id: tenantId,
          user_id: request.user_id,
          channel: request.channel,
          status: 'active',
        })
        .first();

      if (existing) {
        return this.formatOptOut(existing);
      }

      const [optOut] = await db('sms_whatsapp_opt_outs')
        .insert({
          tenant_id: tenantId,
          user_id: request.user_id,
          channel: request.channel,
          reason: request.reason || 'user_request',
          status: 'active',
          notes: request.notes,
          processed_by: userId,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning('*');

      logger.info(
        `Opt-out created for user ${request.user_id}: ${request.channel}`
      );
      return this.formatOptOut(optOut);
    } catch (error) {
      logger.error(`Error creating opt-out: ${error}`);
      throw new Error(`Failed to create opt-out: ${error}`);
    }
  }

  /**
   * Get user opt-outs
   */
  async getUserOptOuts(tenantId: string, userId: string): Promise<OptOut[]> {
    try {
      const optOuts = await db('sms_whatsapp_opt_outs')
        .where({
          tenant_id: tenantId,
          user_id: userId,
          status: 'active',
        });

      return optOuts.map(o => this.formatOptOut(o));
    } catch (error) {
      logger.error(`Error fetching user opt-outs: ${error}`);
      throw new Error(`Failed to fetch opt-outs: ${error}`);
    }
  }

  /**
   * Remove opt-out
   */
  async removeOptOut(optOutId: string): Promise<void> {
    try {
      await db('sms_whatsapp_opt_outs')
        .where({ optout_id: optOutId })
        .update({
          status: 'removed',
          updated_at: db.fn.now(),
        });

      logger.info(`Opt-out removed: ${optOutId}`);
    } catch (error) {
      logger.error(`Error removing opt-out: ${error}`);
      throw new Error(`Failed to remove opt-out: ${error}`);
    }
  }

  /**
   * Private helper methods
   */

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private formatPhoneNumber(phoneNumber: any): PhoneNumber {
    return {
      ...phoneNumber,
      metadata: phoneNumber.metadata ? JSON.parse(phoneNumber.metadata) : undefined,
    };
  }

  private formatOptOut(optOut: any): OptOut {
    return optOut;
  }
}

export default new PhoneNumberService();
