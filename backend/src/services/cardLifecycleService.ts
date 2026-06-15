import { Knex } from 'knex';
import { logger } from '../utils/logger.js';
import { QrCodeService } from './qrCodeService.js';

/**
 * Card Lifecycle Service
 * Phase 2.1: Identity Management Module
 * 
 * Manages complete card lifecycle including status transitions, expiration,
 * loss reporting, revocation, reissuance, and audit trail maintenance.
 * Integrates with notification service for expiration alerts.
 */

export interface CardHistoryEntry {
  cardId: string;
  action: 'issued' | 'lost' | 'revoked' | 'suspended' | 'reactivated' | 'expired' | 'regenerated';
  performedBy: string;
  reason?: string;
  timestamp: Date;
  previousStatus?: CardStatus;
  newStatus: CardStatus;
}

export type CardStatus = 'active' | 'expired' | 'lost' | 'revoked' | 'suspended';

export class CardLifecycleService {
  private qrCodeService: QrCodeService;

  constructor(private db: Knex) {
    this.qrCodeService = new QrCodeService(db);
  }

  /**
   * Issue a card (set initial status)
   * Requirements: 6.1, 6.2
   */
  async issueCard(cardId: string, issuedBy: string): Promise<void> {
    try {
      const card = await this.db('id_cards')
        .where({ id: cardId })
        .first();

      if (!card) {
        throw new Error(`Card ${cardId} not found`);
      }

      // Card is already issued during creation, this is for explicit issuance
      await this.db('card_audit_log').insert({
        card_id: cardId,
        action: 'issued',
        new_status: 'active',
        performed_by: issuedBy,
        reason: 'Card issued to user',
        performed_at: new Date(),
      });

      logger.info(`Card ${cardId} issued by ${issuedBy}`);
    } catch (error) {
      logger.error('Failed to issue card', { cardId, issuedBy, error });
      throw error;
    }
  }

  /**
   * Report a card as lost
   * Requirements: 6.3
   */
  async reportLost(cardId: string, reportedBy: string, reason?: string): Promise<void> {
    try {
      const card = await this.db('id_cards')
        .where({ id: cardId })
        .first();

      if (!card) {
        throw new Error(`Card ${cardId} not found`);
      }

      if (card.status !== 'active') {
        throw new Error(`Card is not active (current status: ${card.status})`);
      }

      const previousStatus = card.status;

      // Update card status
      await this.db('id_cards')
        .where({ id: cardId })
        .update({
          status: 'lost',
          updated_at: new Date(),
        });

      // Invalidate QR code
      await this.qrCodeService.invalidateQrCodesByCardId(cardId);

      // Log audit trail
      await this.db('card_audit_log').insert({
        card_id: cardId,
        action: 'lost',
        previous_status: previousStatus,
        new_status: 'lost',
        performed_by: reportedBy,
        reason: reason || 'Card reported as lost',
        performed_at: new Date(),
      });

      logger.info(`Card ${cardId} reported as lost`, { reportedBy, reason });
    } catch (error) {
      logger.error('Failed to report card as lost', { cardId, reportedBy, error });
      throw error;
    }
  }

  /**
   * Revoke a card
   * Requirements: 6.4
   */
  async revokeCard(cardId: string, revokedBy: string, reason: string): Promise<void> {
    try {
      const card = await this.db('id_cards')
        .where({ id: cardId })
        .first();

      if (!card) {
        throw new Error(`Card ${cardId} not found`);
      }

      if (card.status === 'revoked') {
        throw new Error('Card is already revoked');
      }

      const previousStatus = card.status;

      // Update card status
      await this.db('id_cards')
        .where({ id: cardId })
        .update({
          status: 'revoked',
          updated_at: new Date(),
        });

      // Invalidate QR code
      await this.qrCodeService.invalidateQrCodesByCardId(cardId);

      // Log audit trail
      await this.db('card_audit_log').insert({
        card_id: cardId,
        action: 'revoked',
        previous_status: previousStatus,
        new_status: 'revoked',
        performed_by: revokedBy,
        reason,
        performed_at: new Date(),
      });

      logger.info(`Card ${cardId} revoked`, { revokedBy, reason });
    } catch (error) {
      logger.error('Failed to revoke card', { cardId, revokedBy, error });
      throw error;
    }
  }

  /**
   * Suspend a card
   * Requirements: 6.4
   */
  async suspendCard(cardId: string, suspendedBy: string, reason: string): Promise<void> {
    try {
      const card = await this.db('id_cards')
        .where({ id: cardId })
        .first();

      if (!card) {
        throw new Error(`Card ${cardId} not found`);
      }

      if (!['active', 'suspended'].includes(card.status)) {
        throw new Error(`Cannot suspend card with status ${card.status}`);
      }

      const previousStatus = card.status;

      // Update card status
      await this.db('id_cards')
        .where({ id: cardId })
        .update({
          status: 'suspended',
          updated_at: new Date(),
        });

      // Invalidate QR code
      await this.qrCodeService.invalidateQrCodesByCardId(cardId);

      // Log audit trail
      await this.db('card_audit_log').insert({
        card_id: cardId,
        action: 'suspended',
        previous_status: previousStatus,
        new_status: 'suspended',
        performed_by: suspendedBy,
        reason,
        performed_at: new Date(),
      });

      logger.info(`Card ${cardId} suspended`, { suspendedBy, reason });
    } catch (error) {
      logger.error('Failed to suspend card', { cardId, suspendedBy, error });
      throw error;
    }
  }

  /**
   * Reactivate a suspended card
   * Requirements: 6.4
   */
  async reactivateCard(cardId: string, reactivatedBy: string): Promise<void> {
    try {
      const card = await this.db('id_cards')
        .where({ id: cardId })
        .first();

      if (!card) {
        throw new Error(`Card ${cardId} not found`);
      }

      if (card.status !== 'suspended') {
        throw new Error(`Card is not suspended (current status: ${card.status})`);
      }

      // Check if card is expired
      if (new Date() > new Date(card.expires_at)) {
        throw new Error('Cannot reactivate expired card');
      }

      const previousStatus = card.status;

      // Update card status
      await this.db('id_cards')
        .where({ id: cardId })
        .update({
          status: 'active',
          updated_at: new Date(),
        });

      // Note: QR code needs to be regenerated for security
      // This should be handled by the ID Card Service

      // Log audit trail
      await this.db('card_audit_log').insert({
        card_id: cardId,
        action: 'reactivated',
        previous_status: previousStatus,
        new_status: 'active',
        performed_by: reactivatedBy,
        reason: 'Card reactivated from suspension',
        performed_at: new Date(),
      });

      logger.info(`Card ${cardId} reactivated`, { reactivatedBy });
    } catch (error) {
      logger.error('Failed to reactivate card', { cardId, reactivatedBy, error });
      throw error;
    }
  }

  /**
   * Expire a card
   * Requirements: 6.5
   */
  async expireCard(cardId: string): Promise<void> {
    try {
      const card = await this.db('id_cards')
        .where({ id: cardId })
        .first();

      if (!card) {
        throw new Error(`Card ${cardId} not found`);
      }

      if (card.status === 'expired') {
        return; // Already expired
      }

      if (card.status === 'revoked') {
        return; // Revoked cards don't need to be expired
      }

      const previousStatus = card.status;

      // Update card status
      await this.db('id_cards')
        .where({ id: cardId })
        .update({
          status: 'expired',
          updated_at: new Date(),
        });

      // Invalidate QR code
      await this.qrCodeService.invalidateQrCodesByCardId(cardId);

      // Log audit trail
      await this.db('card_audit_log').insert({
        card_id: cardId,
        action: 'expired',
        previous_status: previousStatus,
        new_status: 'expired',
        performed_by: 'system',
        reason: 'Card expired automatically',
        performed_at: new Date(),
      });

      logger.info(`Card ${cardId} expired`);
    } catch (error) {
      logger.error('Failed to expire card', { cardId, error });
      throw error;
    }
  }

  /**
   * Get complete history for a card
   * Requirements: 6.7, 6.9
   */
  async getCardHistory(cardId: string): Promise<CardHistoryEntry[]> {
    try {
      const history = await this.db('card_audit_log')
        .where({ card_id: cardId })
        .orderBy('performed_at', 'desc')
        .select('*');

      return history.map((h: any) => ({
        cardId: h.card_id,
        action: h.action,
        performedBy: h.performed_by,
        reason: h.reason,
        timestamp: new Date(h.performed_at),
        previousStatus: h.previous_status,
        newStatus: h.new_status,
      }));
    } catch (error) {
      logger.error('Failed to get card history', { cardId, error });
      throw error;
    }
  }

  /**
   * Check for cards expiring soon
   * Requirements: 6.8, 9.3
   */
  async checkExpiringSoon(tenantId: string, daysThreshold: number = 30): Promise<any[]> {
    try {
      const today = new Date();
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

      const expiringCards = await this.db('id_cards')
        .where({ tenant_id: tenantId, status: 'active' })
        .whereBetween('expires_at', [today, thresholdDate])
        .join('users', 'id_cards.user_id', 'users.id')
        .select(
          'id_cards.*',
          'users.first_name',
          'users.last_name',
          'users.email',
          'users.role'
        )
        .orderBy('id_cards.expires_at', 'asc');

      logger.info(`Found ${expiringCards.length} cards expiring within ${daysThreshold} days`, {
        tenantId,
      });

      return expiringCards;
    } catch (error) {
      logger.error('Failed to check expiring cards', { tenantId, error });
      throw error;
    }
  }

  /**
   * Send expiration notifications
   * Requirements: 6.8
   */
  async sendExpirationNotifications(tenantId: string): Promise<void> {
    try {
      const expiringCards = await this.checkExpiringSoon(tenantId, 30);

      for (const card of expiringCards) {
        // Calculate days until expiration
        const daysUntilExpiry = Math.ceil(
          (new Date(card.expires_at).getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24)
        );

        // Create notification
        await this.db('notifications').insert({
          user_id: card.user_id,
          type: 'card_expiration',
          subject: 'ID Card Expiring Soon',
          message: `Your ID card will expire in ${daysUntilExpiry} days. Please contact administration to renew your card.`,
          status: 'pending',
          created_at: new Date(),
        });

        logger.info(`Sent expiration notification for card ${card.id}`, {
          userId: card.user_id,
          daysUntilExpiry,
        });
      }
    } catch (error) {
      logger.error('Failed to send expiration notifications', { tenantId, error });
      throw error;
    }
  }

  /**
   * Automatically expire cards that have passed expiration date
   * Requirements: 6.5
   */
  async autoExpireCards(): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find cards that should be expired
      const expiredCards = await this.db('id_cards')
        .where('expires_at', '<', today)
        .whereIn('status', ['active', 'suspended'])
        .select('id');

      // Expire each card
      let expiredCount = 0;
      for (const card of expiredCards) {
        try {
          await this.expireCard(card.id);
          expiredCount++;
        } catch (error) {
          logger.error(`Failed to auto-expire card ${card.id}`, { error });
        }
      }

      logger.info(`Auto-expired ${expiredCount} cards`);
      return expiredCount;
    } catch (error) {
      logger.error('Failed to auto-expire cards', { error });
      throw error;
    }
  }

  /**
   * Reissue a card (revoke old, create new)
   * Requirements: 6.6
   * Note: This method coordinates with IdCardService
   */
  async prepareReissuance(userId: string, tenantId: string, reissuedBy: string): Promise<void> {
    try {
      // Use transaction to ensure atomicity
      await this.db.transaction(async (trx) => {
        // Find existing active card
        const existingCard = await trx('id_cards')
          .where({ user_id: userId, status: 'active' })
          .first();

        if (existingCard) {
          // Revoke existing card
          await trx('id_cards')
            .where({ id: existingCard.id })
            .update({
              status: 'revoked',
              updated_at: new Date(),
            });

          // Invalidate QR codes
          await trx('qr_codes')
            .where({ card_id: existingCard.id })
            .update({
              is_valid: false,
            });

          // Log revocation
          await trx('card_audit_log').insert({
            card_id: existingCard.id,
            action: 'revoked',
            previous_status: 'active',
            new_status: 'revoked',
            performed_by: reissuedBy,
            reason: 'Revoked for card reissuance',
            performed_at: new Date(),
          });

          logger.info(`Revoked old card ${existingCard.id} for reissuance`, {
            userId,
            reissuedBy,
          });
        }
      });
    } catch (error) {
      logger.error('Failed to prepare reissuance', { userId, reissuedBy, error });
      throw error;
    }
  }

  /**
   * Handle user status change (cascade)
   * Requirements: 8.3
   */
  async handleUserStatusChange(userId: string, newStatus: string): Promise<void> {
    try {
      if (newStatus === 'inactive' || newStatus === 'deleted') {
        // Revoke all active cards for this user
        const activeCards = await this.db('id_cards')
          .where({ user_id: userId, status: 'active' })
          .select('id');

        for (const card of activeCards) {
          await this.revokeCard(card.id, 'system', `User status changed to ${newStatus}`);
        }

        logger.info(`Revoked ${activeCards.length} cards for user ${userId} due to status change`, {
          newStatus,
        });
      }
    } catch (error) {
      logger.error('Failed to handle user status change', { userId, newStatus, error });
      throw error;
    }
  }
}
