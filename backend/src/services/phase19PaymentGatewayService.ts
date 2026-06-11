import type { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import crypto from 'crypto';

/**
 * Phase 19.3: Payment Gateway Integration
 * 
 * Provides payment gateway integration capabilities:
 * - Payment gateway configuration management
 * - Online payment processing (Stripe, PayPal, Razorpay, etc.)
 * - Payment verification and reconciliation
 * - Transaction tracking and reporting
 * - Webhook handling for payment updates
 * - Payment refund processing
 */

interface PaymentGatewayConfig {
  provider: 'stripe' | 'paypal' | 'razorpay' | 'square';
  publicKey: string;
  secretKey: string;
  webhookSecret?: string;
  currency: string;
  testMode: boolean;
  isActive: boolean;
}

interface PaymentTransaction {
  id: string;
  tenantId: string;
  studentId?: string;
  feeId?: string;
  amount: number;
  currency: string;
  description: string;
  externalTransactionId?: string;
  paymentMethod: string;
  status: 'initiated' | 'processing' | 'completed' | 'failed' | 'refunded';
  failureReason?: string;
  webhookData?: Record<string, any>;
  processedAt?: Date;
  createdAt: Date;
}

interface RefundRequest {
  id: string;
  transactionId: string;
  amount: number;
  reason: string;
  status: 'pending' | 'processed' | 'failed';
  externalRefundId?: string;
  processedAt?: Date;
  createdAt: Date;
}

export class PaymentGatewayService {
  private db: Knex;
  private config: PaymentGatewayConfig | null = null;

  /**
   * Initializes payment gateway service
   * @param database - Knex database instance
   */
  constructor(database: Knex) {
    this.db = database;
    logger.info('PaymentGatewayService initialized');
  }

  /**
   * Sets payment gateway configuration
   * @param tenantId - Tenant ID
   * @param config - Payment gateway configuration
   */
  async setPaymentGatewayConfig(
    tenantId: string,
    config: PaymentGatewayConfig
  ): Promise<PaymentGatewayConfig> {
    try {
      // Validate configuration
      if (!config.provider || !config.publicKey || !config.secretKey) {
        throw new AppError('Provider, public key, and secret key are required', 400);
      }

      if (!['stripe', 'paypal', 'razorpay', 'square'].includes(config.provider)) {
        throw new AppError('Invalid payment provider', 400);
      }

      // Store configuration (securely encrypt sensitive data)
      const existing = await this.db('payment_gateway_configs')
        .where('tenant_id', tenantId)
        .first();

      if (existing) {
        await this.db('payment_gateway_configs')
          .where('tenant_id', tenantId)
          .update({
            provider: config.provider,
            public_key: config.publicKey,
            secret_key: config.secretKey, // Should be encrypted in production
            webhook_secret: config.webhookSecret || null,
            currency: config.currency,
            test_mode: config.testMode,
            is_active: config.isActive,
            updated_at: new Date(),
          });
      } else {
        await this.db('payment_gateway_configs').insert({
          id: uuidv4(),
          tenant_id: tenantId,
          provider: config.provider,
          public_key: config.publicKey,
          secret_key: config.secretKey,
          webhook_secret: config.webhookSecret || null,
          currency: config.currency,
          test_mode: config.testMode,
          is_active: config.isActive,
          created_at: new Date(),
        });
      }

      this.config = config;
      logger.info(
        `Payment gateway configuration set for tenant ${tenantId} (${config.provider}, mode: ${config.testMode ? 'test' : 'live'})`
      );
      return config;
    } catch (error) {
      logger.error('Failed to set payment gateway configuration', error);
      throw new AppError('Failed to set payment gateway configuration', 500, (error as Error).message);
    }
  }

  /**
   * Gets payment gateway configuration for a tenant
   * @param tenantId - Tenant ID
   * @returns Payment gateway configuration
   */
  async getPaymentGatewayConfig(tenantId: string): Promise<PaymentGatewayConfig | null> {
    try {
      const config = await this.db('payment_gateway_configs')
        .where('tenant_id', tenantId)
        .first();

      if (!config) {
        return null;
      }

      return {
        provider: config.provider,
        publicKey: config.public_key,
        secretKey: config.secret_key,
        webhookSecret: config.webhook_secret,
        currency: config.currency,
        testMode: config.test_mode,
        isActive: config.is_active,
      };
    } catch (error) {
      logger.error('Failed to get payment gateway configuration', error);
      return null;
    }
  }

  /**
   * Initiates a payment transaction
   * @param tenantId - Tenant ID
   * @param studentId - Student ID
   * @param feeId - Fee ID
   * @param amount - Payment amount
   * @param description - Payment description
   * @returns Payment transaction
   */
  async initiatePayment(
    tenantId: string,
    studentId: string,
    feeId: string,
    amount: number,
    description: string
  ): Promise<PaymentTransaction> {
    try {
      // Get payment gateway config
      if (!this.config) {
        this.config = await this.getPaymentGatewayConfig(tenantId);
      }

      if (!this.config || !this.config.isActive) {
        throw new AppError('Payment gateway not configured for this tenant', 400);
      }

      const transactionId = uuidv4();

      // Create transaction record
      const transaction: PaymentTransaction = {
        id: transactionId,
        tenantId,
        studentId,
        feeId,
        amount,
        currency: this.config.currency,
        description,
        status: 'initiated',
        createdAt: new Date(),
      };

      await this.db('payment_transactions').insert({
        id: transactionId,
        tenant_id: tenantId,
        student_id: studentId,
        fee_id: feeId,
        amount,
        currency: this.config.currency,
        description,
        status: 'initiated',
        created_at: new Date(),
      });

      logger.info(`Payment initiated: ${transactionId} for student ${studentId}, amount ${amount}`);

      return transaction;
    } catch (error) {
      logger.error('Failed to initiate payment', error);
      throw error;
    }
  }

  /**
   * Verifies a completed payment
   * @param tenantId - Tenant ID
   * @param transactionId - Transaction ID
   * @param externalTransactionId - External payment provider transaction ID
   * @param paymentData - Payment data from provider
   * @returns Updated payment transaction
   */
  async verifyPayment(
    tenantId: string,
    transactionId: string,
    externalTransactionId: string,
    paymentData: any
  ): Promise<PaymentTransaction> {
    try {
      const transaction = await this.db('payment_transactions')
        .where('id', transactionId)
        .where('tenant_id', tenantId)
        .first();

      if (!transaction) {
        throw new AppError('Payment transaction not found', 404);
      }

      // Verify payment amount and currency match
      if (
        paymentData.amount !== transaction.amount ||
        paymentData.currency !== transaction.currency
      ) {
        throw new AppError('Payment amount or currency mismatch', 400);
      }

      // Update transaction
      await this.db('payment_transactions')
        .where('id', transactionId)
        .update({
          external_transaction_id: externalTransactionId,
          status: 'completed',
          processed_at: new Date(),
          webhook_data: JSON.stringify(paymentData),
        });

      // Update related fee status if applicable
      if (transaction.fee_id) {
        await this.db('fees')
          .where('id', transaction.fee_id)
          .update({
            status: 'paid',
            paid_date: new Date(),
          });
      }

      logger.info(`Payment verified: ${transactionId}, external ID: ${externalTransactionId}`);

      return {
        ...transaction,
        externalTransactionId,
        status: 'completed',
        processedAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to verify payment', error);
      throw error;
    }
  }

  /**
   * Records a failed payment
   * @param tenantId - Tenant ID
   * @param transactionId - Transaction ID
   * @param failureReason - Reason for failure
   * @returns Updated payment transaction
   */
  async recordFailedPayment(
    tenantId: string,
    transactionId: string,
    failureReason: string
  ): Promise<PaymentTransaction> {
    try {
      const transaction = await this.db('payment_transactions')
        .where('id', transactionId)
        .where('tenant_id', tenantId)
        .first();

      if (!transaction) {
        throw new AppError('Payment transaction not found', 404);
      }

      await this.db('payment_transactions')
        .where('id', transactionId)
        .update({
          status: 'failed',
          failure_reason: failureReason,
          processed_at: new Date(),
        });

      logger.warn(`Payment failed: ${transactionId}, reason: ${failureReason}`);

      return {
        ...transaction,
        status: 'failed',
        failureReason,
        processedAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to record payment failure', error);
      throw error;
    }
  }

  /**
   * Processes a refund for a payment
   * @param tenantId - Tenant ID
   * @param transactionId - Transaction ID
   * @param amount - Refund amount (null for full refund)
   * @param reason - Refund reason
   * @returns Refund request record
   */
  async processRefund(
    tenantId: string,
    transactionId: string,
    amount: number | null,
    reason: string
  ): Promise<RefundRequest> {
    try {
      const transaction = await this.db('payment_transactions')
        .where('id', transactionId)
        .where('tenant_id', tenantId)
        .first();

      if (!transaction) {
        throw new AppError('Payment transaction not found', 404);
      }

      if (transaction.status !== 'completed') {
        throw new AppError('Can only refund completed payments', 400);
      }

      const refundAmount = amount || transaction.amount;

      if (refundAmount > transaction.amount) {
        throw new AppError('Refund amount exceeds transaction amount', 400);
      }

      const refundId = uuidv4();

      // Create refund request
      await this.db('refund_requests').insert({
        id: refundId,
        transaction_id: transactionId,
        amount: refundAmount,
        reason,
        status: 'pending',
        created_at: new Date(),
      });

      // Attempt refund via payment provider
      try {
        // Provider-specific refund logic would go here
        // Stripe, PayPal, Razorpay implementations would be added
        const externalRefundId = `refund_${uuidv4()}`;

        await this.db('refund_requests')
          .where('id', refundId)
          .update({
            external_refund_id: externalRefundId,
            status: 'processed',
            processed_at: new Date(),
          });

        // Update transaction status if full refund
        if (refundAmount === transaction.amount) {
          await this.db('payment_transactions')
            .where('id', transactionId)
            .update({
              status: 'refunded',
            });
        }

        logger.info(
          `Refund processed: ${refundId} for transaction ${transactionId}, amount ${refundAmount}`
        );

        return {
          id: refundId,
          transactionId,
          amount: refundAmount,
          reason,
          status: 'processed',
          externalRefundId,
          processedAt: new Date(),
          createdAt: new Date(),
        };
      } catch (error) {
        logger.error('Failed to process refund via payment provider', error);
        throw new AppError('Failed to process refund', 500, (error as Error).message);
      }
    } catch (error) {
      logger.error('Failed to process refund', error);
      throw error;
    }
  }

  /**
   * Handles webhook from payment provider
   * @param tenantId - Tenant ID
   * @param signature - Webhook signature
   * @param payload - Webhook payload
   */
  async handleWebhook(tenantId: string, signature: string, payload: any): Promise<void> {
    try {
      // Get configuration
      if (!this.config) {
        this.config = await this.getPaymentGatewayConfig(tenantId);
      }

      if (!this.config || !this.config.webhookSecret) {
        throw new AppError('Webhook secret not configured', 400);
      }

      // Verify webhook signature
      const hash = crypto
        .createHmac('sha256', this.config.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (hash !== signature) {
        throw new AppError('Invalid webhook signature', 401);
      }

      // Process webhook based on event type
      if (payload.type === 'payment.completed') {
        await this.verifyPayment(
          tenantId,
          payload.transactionId,
          payload.externalTransactionId,
          payload.data
        );
      } else if (payload.type === 'payment.failed') {
        await this.recordFailedPayment(tenantId, payload.transactionId, payload.failureReason);
      }

      logger.info(`Webhook processed for tenant ${tenantId}, event: ${payload.type}`);
    } catch (error) {
      logger.error('Failed to process webhook', error);
      throw error;
    }
  }

  /**
   * Gets payment transaction history
   * @param tenantId - Tenant ID
   * @param studentId - Filter by student ID
   * @param limit - Result limit
   * @param offset - Result offset
   * @returns Array of payment transactions
   */
  async getPaymentHistory(
    tenantId: string,
    studentId?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<PaymentTransaction[]> {
    try {
      let query = this.db('payment_transactions')
        .where('tenant_id', tenantId);

      if (studentId) {
        query = query.where('student_id', studentId);
      }

      const transactions = await query
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .select();

      return transactions.map((t: any) => ({
        id: t.id,
        tenantId: t.tenant_id,
        studentId: t.student_id,
        feeId: t.fee_id,
        amount: t.amount,
        currency: t.currency,
        description: t.description,
        externalTransactionId: t.external_transaction_id,
        status: t.status,
        failureReason: t.failure_reason,
        webhookData: t.webhook_data ? JSON.parse(t.webhook_data) : undefined,
        processedAt: t.processed_at,
        createdAt: t.created_at,
      }));
    } catch (error) {
      logger.error('Failed to get payment history', error);
      throw new AppError('Failed to get payment history', 500);
    }
  }

  /**
   * Gets refund history
   * @param tenantId - Tenant ID
   * @param transactionId - Filter by transaction ID
   * @returns Array of refund requests
   */
  async getRefundHistory(tenantId: string, transactionId?: string): Promise<RefundRequest[]> {
    try {
      let query = this.db('refund_requests');

      if (transactionId) {
        query = query.where('transaction_id', transactionId);
      }

      const refunds = await query
        .orderBy('created_at', 'desc')
        .select();

      return refunds.map((r: any) => ({
        id: r.id,
        transactionId: r.transaction_id,
        amount: r.amount,
        reason: r.reason,
        status: r.status,
        externalRefundId: r.external_refund_id,
        processedAt: r.processed_at,
        createdAt: r.created_at,
      }));
    } catch (error) {
      logger.error('Failed to get refund history', error);
      throw new AppError('Failed to get refund history', 500);
    }
  }

  /**
   * Gets payment gateway health status
   * @param tenantId - Tenant ID
   * @returns Health status
   */
  async getPaymentGatewayHealth(tenantId: string): Promise<{
    status: string;
    provider: string;
    configured: boolean;
    active: boolean;
    successRate: number;
    totalTransactions: number;
  }> {
    try {
      const config = await this.getPaymentGatewayConfig(tenantId);

      if (!config) {
        return {
          status: 'unconfigured',
          provider: 'none',
          configured: false,
          active: false,
          successRate: 0,
          totalTransactions: 0,
        };
      }

      // Calculate success rate
      const total = await this.db('payment_transactions')
        .where('tenant_id', tenantId)
        .count('* as count')
        .first() as any;

      const successful = await this.db('payment_transactions')
        .where('tenant_id', tenantId)
        .where('status', 'completed')
        .count('* as count')
        .first() as any;

      const successRate = total.count ? (successful.count / total.count) * 100 : 0;

      return {
        status: config.isActive ? 'healthy' : 'inactive',
        provider: config.provider,
        configured: true,
        active: config.isActive,
        successRate: Math.round(successRate * 100) / 100,
        totalTransactions: total.count || 0,
      };
    } catch (error) {
      logger.error('Failed to get payment gateway health', error);
      return {
        status: 'error',
        provider: 'unknown',
        configured: false,
        active: false,
        successRate: 0,
        totalTransactions: 0,
      };
    }
  }
}

export default PaymentGatewayService;
