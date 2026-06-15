import type { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

/**
 * Phase 18.4: Sensitive Action Logging with Approval Workflows
 * 
 * Manages sensitive actions requiring logging and approval:
 * - User role/permission changes
 * - Data deletion requests
 * - System configuration changes
 * - Sensitive data exports
 * - Password resets
 * - Access grant changes
 * - Records sensitive action reason
 * - Implements approval workflow for critical actions
 */

interface SensitiveAction {
  id: string;
  tenantId: string;
  userId: string;
  actionType: string;
  entityType: string;
  entityId: string;
  description: string;
  reason: string;
  requiresApproval: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  approvalData?: {
    approvedBy?: string;
    approvedAt?: Date;
    rejectionReason?: string;
    rejectedBy?: string;
    rejectedAt?: Date;
  };
  executionData?: {
    completedAt?: Date;
    completedBy?: string;
    result?: Record<string, any>;
  };
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

interface ActionApprovalRequest {
  id: string;
  actionId: string;
  assignedTo: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  deadline?: Date;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: Date;
}

export class SensitiveActionService {
  private db: Knex;

  // Define sensitive action types and whether they require approval
  private sensitiveActions: Record<string, { requiresApproval: boolean; notifyAdmins: boolean }> =
    {
      user_role_change: { requiresApproval: true, notifyAdmins: true },
      permission_grant: { requiresApproval: true, notifyAdmins: true },
      permission_revoke: { requiresApproval: true, notifyAdmins: true },
      data_deletion: { requiresApproval: true, notifyAdmins: true },
      data_export_sensitive: { requiresApproval: false, notifyAdmins: true },
      system_config_change: { requiresApproval: true, notifyAdmins: true },
      password_reset_admin: { requiresApproval: true, notifyAdmins: true },
      access_grant_admin: { requiresApproval: true, notifyAdmins: true },
      user_deactivation: { requiresApproval: true, notifyAdmins: true },
      security_policy_change: { requiresApproval: true, notifyAdmins: true },
      bulk_operation: { requiresApproval: false, notifyAdmins: true },
    };

  /**
   * Initializes sensitive action service
   * @param database - Knex database instance
   */
  constructor(database: Knex) {
    this.db = database;
    logger.info('SensitiveActionService initialized');
  }

  /**
   * Logs a sensitive action
   * @param action - Sensitive action details
   * @returns Created sensitive action record
   */
  async logSensitiveAction(
    tenantId: string,
    userId: string,
    actionType: string,
    entityType: string,
    entityId: string,
    description: string,
    reason: string,
    metadata?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<SensitiveAction> {
    try {
      const actionConfig = this.sensitiveActions[actionType];
      if (!actionConfig) {
        throw new AppError(`Unknown sensitive action type: ${actionType}`, 400);
      }

      const actionId = uuidv4();
      const requiresApproval = actionConfig.requiresApproval;

      // Create the sensitive action record
      const action: SensitiveAction = {
        id: actionId,
        tenantId,
        userId,
        actionType,
        entityType,
        entityId,
        description,
        reason,
        requiresApproval,
        status: requiresApproval ? 'pending' : 'completed',
        metadata,
        ipAddress,
        userAgent,
        createdAt: new Date(),
      };

      // If no approval needed, mark as completed immediately
      if (!requiresApproval) {
        action.status = 'completed';
        action.executionData = {
          completedAt: new Date(),
          completedBy: userId,
        };
      }

      // Store in database
      await this.db('sensitive_actions').insert({
        id: actionId,
        tenant_id: tenantId,
        user_id: userId,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId,
        description,
        reason,
        requires_approval: requiresApproval,
        status: action.status,
        metadata: metadata ? JSON.stringify(metadata) : null,
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
        created_at: new Date(),
      });

      // Create approval requests if needed
      if (requiresApproval) {
        await this.createApprovalRequests(
          tenantId,
          actionId,
          actionConfig.notifyAdmins ? 'critical' : 'high'
        );
      }

      logger.info(`Sensitive action logged: ${actionType} for ${entityType} ${entityId}`);
      return action;
    } catch (error) {
      logger.error('Failed to log sensitive action', error);
      throw new AppError('Failed to log sensitive action', 500, (error as Error).message);
    }
  }

  /**
   * Creates approval requests for a sensitive action
   * @param tenantId - Tenant ID
   * @param actionId - Sensitive action ID
   * @param priority - Approval priority
   */
  private async createApprovalRequests(
    tenantId: string,
    actionId: string,
    priority: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<void> {
    try {
      // Get admin users for this tenant
      const principals = await this.db('users')
        .where('tenant_id', tenantId)
        .where('role', 'principal')
        .select('id');

      // Create approval request for primary admin
      if (admins.length > 0) {
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 1); // 24 hour deadline

        await this.db('action_approval_requests').insert({
          id: uuidv4(),
          action_id: actionId,
          assigned_to: admins[0].id,
          priority,
          deadline,
          status: 'pending',
          created_at: new Date(),
        });

        logger.info(`Created approval request for action ${actionId} to user ${admins[0].id}`);
      }
    } catch (error) {
      logger.error('Failed to create approval requests', error);
      // Don't throw - approval request creation should not block action logging
    }
  }

  /**
   * Approves a sensitive action
   * @param actionId - Sensitive action ID
   * @param approvedBy - User ID approving the action
   * @returns Updated sensitive action
   */
  async approveSensitiveAction(actionId: string, approvedBy: string): Promise<SensitiveAction> {
    try {
      const action = await this.db('sensitive_actions')
        .where('id', actionId)
        .first();

      if (!action) {
        throw new AppError('Sensitive action not found', 404);
      }

      if (action.status !== 'pending') {
        throw new AppError(
          `Cannot approve action with status: ${action.status}`,
          400
        );
      }

      // Update action status
      await this.db('sensitive_actions')
        .where('id', actionId)
        .update({
          status: 'approved',
          approved_by: approvedBy,
          approved_at: new Date(),
        });

      // Update approval request status
      await this.db('action_approval_requests')
        .where('action_id', actionId)
        .where('status', 'pending')
        .update({
          status: 'approved',
          approved_at: new Date(),
        });

      logger.info(`Sensitive action ${actionId} approved by ${approvedBy}`);

      // Return updated action
      const updated = await this.db('sensitive_actions')
        .where('id', actionId)
        .first();

      return this.mapToSensitiveAction(updated);
    } catch (error) {
      logger.error('Failed to approve sensitive action', error);
      throw new AppError('Failed to approve sensitive action', 500, (error as Error).message);
    }
  }

  /**
   * Rejects a sensitive action
   * @param actionId - Sensitive action ID
   * @param rejectedBy - User ID rejecting the action
   * @param reason - Rejection reason
   * @returns Updated sensitive action
   */
  async rejectSensitiveAction(
    actionId: string,
    rejectedBy: string,
    reason: string
  ): Promise<SensitiveAction> {
    try {
      const action = await this.db('sensitive_actions')
        .where('id', actionId)
        .first();

      if (!action) {
        throw new AppError('Sensitive action not found', 404);
      }

      if (action.status !== 'pending') {
        throw new AppError(
          `Cannot reject action with status: ${action.status}`,
          400
        );
      }

      // Update action status
      await this.db('sensitive_actions')
        .where('id', actionId)
        .update({
          status: 'rejected',
          rejected_by: rejectedBy,
          rejected_at: new Date(),
          rejection_reason: reason,
        });

      // Update approval request status
      await this.db('action_approval_requests')
        .where('action_id', actionId)
        .where('status', 'pending')
        .update({
          status: 'rejected',
          rejected_at: new Date(),
        });

      logger.info(`Sensitive action ${actionId} rejected by ${rejectedBy}: ${reason}`);

      // Return updated action
      const updated = await this.db('sensitive_actions')
        .where('id', actionId)
        .first();

      return this.mapToSensitiveAction(updated);
    } catch (error) {
      logger.error('Failed to reject sensitive action', error);
      throw new AppError('Failed to reject sensitive action', 500, (error as Error).message);
    }
  }

  /**
   * Marks a sensitive action as completed
   * @param actionId - Sensitive action ID
   * @param completedBy - User ID completing the action
   * @param result - Execution result
   * @returns Updated sensitive action
   */
  async completeSensitiveAction(
    actionId: string,
    completedBy: string,
    result?: Record<string, any>
  ): Promise<SensitiveAction> {
    try {
      const action = await this.db('sensitive_actions')
        .where('id', actionId)
        .first();

      if (!action) {
        throw new AppError('Sensitive action not found', 404);
      }

      // Action must be approved (or not require approval) to be completed
      if (action.status !== 'approved' && action.status !== 'completed') {
        throw new AppError(
          `Cannot complete action with status: ${action.status}. Must be approved first.`,
          400
        );
      }

      // Update action status
      await this.db('sensitive_actions')
        .where('id', actionId)
        .update({
          status: 'completed',
          completed_by: completedBy,
          completed_at: new Date(),
          execution_result: result ? JSON.stringify(result) : null,
        });

      logger.info(`Sensitive action ${actionId} completed by ${completedBy}`);

      // Return updated action
      const updated = await this.db('sensitive_actions')
        .where('id', actionId)
        .first();

      return this.mapToSensitiveAction(updated);
    } catch (error) {
      logger.error('Failed to complete sensitive action', error);
      throw new AppError('Failed to complete sensitive action', 500, (error as Error).message);
    }
  }

  /**
   * Cancels a pending sensitive action
   * @param actionId - Sensitive action ID
   * @param cancelledBy - User ID cancelling the action
   * @param reason - Cancellation reason
   * @returns Updated sensitive action
   */
  async cancelSensitiveAction(
    actionId: string,
    cancelledBy: string,
    reason: string
  ): Promise<SensitiveAction> {
    try {
      const action = await this.db('sensitive_actions')
        .where('id', actionId)
        .first();

      if (!action) {
        throw new AppError('Sensitive action not found', 404);
      }

      if (action.status !== 'pending' && action.status !== 'approved') {
        throw new AppError(
          `Cannot cancel action with status: ${action.status}`,
          400
        );
      }

      // Update action status
      await this.db('sensitive_actions')
        .where('id', actionId)
        .update({
          status: 'cancelled',
          cancelled_by: cancelledBy,
          cancelled_at: new Date(),
          cancellation_reason: reason,
        });

      logger.info(`Sensitive action ${actionId} cancelled by ${cancelledBy}: ${reason}`);

      // Return updated action
      const updated = await this.db('sensitive_actions')
        .where('id', actionId)
        .first();

      return this.mapToSensitiveAction(updated);
    } catch (error) {
      logger.error('Failed to cancel sensitive action', error);
      throw new AppError('Failed to cancel sensitive action', 500, (error as Error).message);
    }
  }

  /**
   * Gets pending approvals for a user
   * @param userId - User ID
   * @param limit - Result limit
   * @param offset - Result offset
   * @returns Array of pending approvals
   */
  async getPendingApprovalsForUser(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<(ActionApprovalRequest & { action?: SensitiveAction })[]> {
    try {
      const requests = await this.db('action_approval_requests')
        .where('assigned_to', userId)
        .where('status', 'pending')
        .orderBy('priority', 'desc')
        .orderBy('created_at', 'asc')
        .limit(limit)
        .offset(offset)
        .select();

      // Fetch associated actions
      const enriched = await Promise.all(
        requests.map(async (req: any) => {
          const action = await this.db('sensitive_actions')
            .where('id', req.action_id)
            .first();

          return {
            id: req.id,
            actionId: req.action_id,
            assignedTo: req.assigned_to,
            priority: req.priority,
            deadline: req.deadline,
            status: req.status,
            createdAt: req.created_at,
            action: action ? this.mapToSensitiveAction(action) : undefined,
          };
        })
      );

      return enriched;
    } catch (error) {
      logger.error('Failed to get pending approvals', error);
      throw new AppError('Failed to get pending approvals', 500);
    }
  }

  /**
   * Gets sensitive actions with filtering
   * @param tenantId - Tenant ID
   * @param filters - Filter criteria
   * @returns Array of sensitive actions
   */
  async getSensitiveActions(
    tenantId: string,
    filters?: {
      actionType?: string;
      status?: string;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<SensitiveAction[]> {
    try {
      let query = this.db('sensitive_actions')
        .where('tenant_id', tenantId);

      if (filters?.actionType) {
        query = query.where('action_type', filters.actionType);
      }

      if (filters?.status) {
        query = query.where('status', filters.status);
      }

      if (filters?.userId) {
        query = query.where('user_id', filters.userId);
      }

      if (filters?.startDate) {
        query = query.where('created_at', '>=', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.where('created_at', '<=', filters.endDate);
      }

      const limit = filters?.limit || 100;
      const offset = filters?.offset || 0;

      const actions = await query
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .select();

      return actions.map((a: any) => this.mapToSensitiveAction(a));
    } catch (error) {
      logger.error('Failed to get sensitive actions', error);
      throw new AppError('Failed to get sensitive actions', 500);
    }
  }

  /**
   * Maps database record to SensitiveAction interface
   * @param record - Database record
   * @returns Mapped sensitive action
   */
  private mapToSensitiveAction(record: any): SensitiveAction {
    return {
      id: record.id,
      tenantId: record.tenant_id,
      userId: record.user_id,
      actionType: record.action_type,
      entityType: record.entity_type,
      entityId: record.entity_id,
      description: record.description,
      reason: record.reason,
      requiresApproval: record.requires_approval,
      status: record.status,
      approvalData: {
        approvedBy: record.approved_by,
        approvedAt: record.approved_at,
        rejectionReason: record.rejection_reason,
        rejectedBy: record.rejected_by,
        rejectedAt: record.rejected_at,
      },
      executionData: {
        completedAt: record.completed_at,
        completedBy: record.completed_by,
        result: record.execution_result ? JSON.parse(record.execution_result) : undefined,
      },
      metadata: record.metadata ? JSON.parse(record.metadata) : undefined,
      ipAddress: record.ip_address,
      userAgent: record.user_agent,
      createdAt: record.created_at,
    };
  }

  /**
   * Gets audit trail for a sensitive action
   * @param actionId - Sensitive action ID
   * @returns Audit trail events
   */
  async getActionAuditTrail(actionId: string): Promise<Array<Record<string, any>>> {
    try {
      // Get the main action
      const action = await this.db('sensitive_actions')
        .where('id', actionId)
        .first();

      if (!action) {
        throw new AppError('Sensitive action not found', 404);
      }

      // Build audit trail from action record
      const trail: Array<Record<string, any>> = [];

      trail.push({
        timestamp: action.created_at,
        event: 'action_created',
        actor: action.user_id,
        details: `${action.action_type} initiated on ${action.entity_type}`,
      });

      if (action.approved_at) {
        trail.push({
          timestamp: action.approved_at,
          event: 'action_approved',
          actor: action.approved_by,
          details: `Action approved by admin`,
        });
      }

      if (action.rejected_at) {
        trail.push({
          timestamp: action.rejected_at,
          event: 'action_rejected',
          actor: action.rejected_by,
          details: `Action rejected: ${action.rejection_reason}`,
        });
      }

      if (action.completed_at) {
        trail.push({
          timestamp: action.completed_at,
          event: 'action_completed',
          actor: action.completed_by,
          details: `Action executed successfully`,
        });
      }

      if (action.cancelled_at) {
        trail.push({
          timestamp: action.cancelled_at,
          event: 'action_cancelled',
          actor: action.cancelled_by,
          details: `Action cancelled: ${action.cancellation_reason}`,
        });
      }

      return trail;
    } catch (error) {
      logger.error('Failed to get action audit trail', error);
      throw new AppError('Failed to get action audit trail', 500);
    }
  }
}

export default SensitiveActionService;
