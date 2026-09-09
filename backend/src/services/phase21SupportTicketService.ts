import type { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

/**
 * Phase 21.3: Support Ticket Service
 * 
 * Provides support ticket management:
 * - Ticket submission
 * - Ticket tracking
 * - Priority management
 * - Ticket history
 * - Support agent assignment
 */

export interface SupportTicket {
  id: string;
  tenantId: string;
  userId: string;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  category: string;
  assignedTo?: string;
  attachments: string[];
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

export interface SupportResponse {
  id: string;
  ticketId: string;
  responderId: string;
  message: string;
  attachments: string[];
  isPublic: boolean;
  createdAt: Date;
}

export class SupportTicketService {
  private db: Knex;

  /**
   * Initializes support ticket service
   * @param database - Knex database instance
   */
  constructor(database: Knex) {
    this.db = database;
    logger.info('SupportTicketService initialized');
  }

  /** Human-friendly reference derived from the ticket UUID (display-only). */
  static reference(ticketId: string): string {
    return 'TKT-' + String(ticketId).replace(/-/g, '').slice(0, 8).toUpperCase();
  }

  /**
   * Admin (super-admin) cross-tenant ticket list with the requester's name,
   * email, and school. Not tenant-scoped — for platform support triage only.
   */
  async getAllTickets(filters?: {
    status?: string;
    priority?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    let query = this.db('support_tickets')
      .leftJoin('users', 'support_tickets.user_id', 'users.id')
      .leftJoin('tenants', 'support_tickets.tenant_id', 'tenants.id')
      .select(
        'support_tickets.*',
        this.db.raw("COALESCE(users.first_name || ' ' || users.last_name, users.email) as requester_name"),
        'users.email as requester_email',
        'tenants.name as tenant_name',
      );

    if (filters?.status) query = query.where('support_tickets.status', filters.status);
    if (filters?.priority) query = query.where('support_tickets.priority', filters.priority);
    if (filters?.search) {
      const term = `%${filters.search.trim()}%`;
      query = query.where((b) =>
        b.where('support_tickets.subject', 'ilike', term).orWhere('tenants.name', 'ilike', term)
      );
    }

    const rows = await query
      .orderBy('support_tickets.created_at', 'desc')
      .limit(filters?.limit || 100)
      .offset(filters?.offset || 0);

    return rows.map((t: any) => ({
      id: t.id,
      reference: SupportTicketService.reference(t.id),
      tenantId: t.tenant_id,
      tenantName: t.tenant_name,
      requesterName: t.requester_name,
      requesterEmail: t.requester_email,
      subject: t.subject,
      description: t.description,
      priority: t.priority,
      status: t.status,
      category: t.category,
      assignedTo: t.assigned_to,
      resolution: t.resolution,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      resolvedAt: t.resolved_at,
    }));
  }

  /** Admin fetch of one ticket (any tenant) with requester + school context. */
  async getTicketAdmin(ticketId: string): Promise<any> {
    const t = await this.db('support_tickets')
      .leftJoin('users', 'support_tickets.user_id', 'users.id')
      .leftJoin('tenants', 'support_tickets.tenant_id', 'tenants.id')
      .where('support_tickets.id', ticketId)
      .select(
        'support_tickets.*',
        this.db.raw("COALESCE(users.first_name || ' ' || users.last_name, users.email) as requester_name"),
        'users.email as requester_email',
        'tenants.name as tenant_name',
      )
      .first();
    if (!t) throw new AppError('Support ticket not found', 404);
    return {
      id: t.id,
      reference: SupportTicketService.reference(t.id),
      tenantId: t.tenant_id,
      tenantName: t.tenant_name,
      requesterName: t.requester_name,
      requesterEmail: t.requester_email,
      subject: t.subject,
      description: t.description,
      priority: t.priority,
      status: t.status,
      category: t.category,
      assignedTo: t.assigned_to,
      resolution: t.resolution,
      attachments: JSON.parse(t.attachments || '[]'),
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      resolvedAt: t.resolved_at,
    };
  }

  /** Resolve the requester's email + name for a ticket (for notifications). */
  async getRequesterContact(ticketId: string): Promise<{ email: string | null; name: string | null; subject: string } | null> {
    const t = await this.db('support_tickets')
      .leftJoin('users', 'support_tickets.user_id', 'users.id')
      .where('support_tickets.id', ticketId)
      .select(
        'support_tickets.subject',
        'users.email',
        this.db.raw("COALESCE(users.first_name || ' ' || users.last_name, users.email) as name"),
      )
      .first();
    if (!t) return null;
    return { email: t.email || null, name: t.name || null, subject: t.subject };
  }

  /**
   * Creates support ticket
   * @param tenantId - Tenant ID
   * @param userId - User ID
   * @param ticket - Ticket data
   */
  async createTicket(
    tenantId: string,
    userId: string,
    ticket: Omit<SupportTicket, 'id' | 'tenantId' | 'userId' | 'status' | 'createdAt' | 'updatedAt' | 'resolvedAt'>
  ): Promise<SupportTicket> {
    try {
      const ticketId = uuidv4();
      const now = new Date();

      await this.db('support_tickets').insert({
        id: ticketId,
        tenant_id: tenantId,
        user_id: userId,
        subject: ticket.subject,
        description: ticket.description,
        priority: ticket.priority || 'medium',
        status: 'open',
        category: ticket.category,
        assigned_to: ticket.assignedTo || null,
        attachments: JSON.stringify(ticket.attachments || []),
        created_at: now,
        updated_at: now,
      });

      logger.info(`Support ticket created: ${ticketId}`);

      return {
        id: ticketId,
        tenantId,
        userId,
        subject: ticket.subject,
        description: ticket.description,
        priority: ticket.priority || 'medium',
        status: 'open',
        category: ticket.category,
        assignedTo: ticket.assignedTo,
        attachments: ticket.attachments || [],
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      logger.error('Failed to create support ticket', error);
      throw new AppError('Failed to create support ticket', 500);
    }
  }

  /**
   * Gets ticket by ID
   * @param ticketId - Ticket ID
   * @param tenantId - Tenant ID
   */
  async getTicket(ticketId: string, tenantId: string): Promise<SupportTicket> {
    try {
      const ticket = await this.db('support_tickets')
        .where('id', ticketId)
        .where('tenant_id', tenantId)
        .first();

      if (!ticket) {
        throw new AppError('Support ticket not found', 404);
      }

      return {
        id: ticket.id,
        reference: SupportTicketService.reference(ticket.id),
        tenantId: ticket.tenant_id,
        userId: ticket.user_id,
        subject: ticket.subject,
        description: ticket.description,
        priority: ticket.priority,
        status: ticket.status,
        category: ticket.category,
        assignedTo: ticket.assigned_to,
        attachments: JSON.parse(ticket.attachments || '[]'),
        resolution: ticket.resolution,
        createdAt: ticket.created_at,
        updatedAt: ticket.updated_at,
        resolvedAt: ticket.resolved_at,
      } as any;
    } catch (error) {
      logger.error('Failed to get support ticket', error);
      throw error;
    }
  }

  /**
   * Gets tickets with filtering
   * @param tenantId - Tenant ID
   * @param filters - Filter criteria
   */
  async getTickets(
    tenantId: string,
    filters?: {
      userId?: string;
      status?: string;
      priority?: string;
      category?: string;
      assignedTo?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<SupportTicket[]> {
    try {
      let query = this.db('support_tickets')
        .where('tenant_id', tenantId);

      if (filters?.userId) {
        query = query.where('user_id', filters.userId);
      }

      if (filters?.status) {
        query = query.where('status', filters.status);
      }

      if (filters?.priority) {
        query = query.where('priority', filters.priority);
      }

      if (filters?.category) {
        query = query.where('category', filters.category);
      }

      if (filters?.assignedTo) {
        query = query.where('assigned_to', filters.assignedTo);
      }

      const limit = filters?.limit || 50;
      const offset = filters?.offset || 0;

      const tickets = await query
        .orderBy('priority', 'desc')
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .select();

      return tickets.map((t: any) => ({
        id: t.id,
        reference: SupportTicketService.reference(t.id),
        tenantId: t.tenant_id,
        userId: t.user_id,
        subject: t.subject,
        description: t.description,
        priority: t.priority,
        status: t.status,
        category: t.category,
        assignedTo: t.assigned_to,
        attachments: JSON.parse(t.attachments || '[]'),
        resolution: t.resolution,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        resolvedAt: t.resolved_at,
      })) as any;
    } catch (error) {
      logger.error('Failed to get support tickets', error);
      throw new AppError('Failed to get support tickets', 500);
    }
  }

  /**
   * Updates ticket status
   * @param ticketId - Ticket ID
   * @param status - New status
   * @param resolution - Resolution message (for closed tickets)
   */
  async updateTicketStatus(ticketId: string, status: string, resolution?: string): Promise<SupportTicket> {
    try {
      const ticket = await this.db('support_tickets')
        .where('id', ticketId)
        .first();

      if (!ticket) {
        throw new AppError('Support ticket not found', 404);
      }

      const updateData: Record<string, any> = {
        status,
        updated_at: new Date(),
      };

      if (status === 'resolved' || status === 'closed') {
        updateData.resolved_at = new Date();
        if (resolution) {
          updateData.resolution = resolution;
        }
      }

      await this.db('support_tickets')
        .where('id', ticketId)
        .update(updateData);

      logger.info(`Ticket status updated: ${ticketId} -> ${status}`);

      const updated = await this.getTicket(ticketId, ticket.tenant_id);
      return updated;
    } catch (error) {
      logger.error('Failed to update ticket status', error);
      throw error;
    }
  }

  /**
   * Assigns ticket to agent
   * @param ticketId - Ticket ID
   * @param agentId - Agent ID
   */
  async assignTicket(ticketId: string, agentId: string): Promise<void> {
    try {
      await this.db('support_tickets')
        .where('id', ticketId)
        .update({
          assigned_to: agentId,
          updated_at: new Date(),
        });

      logger.info(`Ticket assigned: ${ticketId} -> ${agentId}`);
    } catch (error) {
      logger.error('Failed to assign ticket', error);
      throw new AppError('Failed to assign ticket', 500);
    }
  }

  /**
   * Adds response to ticket
   * @param ticketId - Ticket ID
   * @param responderId - Responder ID
   * @param message - Response message
   * @param attachments - Attachments
   * @param isPublic - Visibility flag
   */
  async addResponse(
    ticketId: string,
    responderId: string,
    message: string,
    attachments: string[] = [],
    isPublic: boolean = true
  ): Promise<SupportResponse> {
    try {
      const responseId = uuidv4();
      const now = new Date();

      await this.db('support_responses').insert({
        id: responseId,
        ticket_id: ticketId,
        responder_id: responderId,
        message,
        attachments: JSON.stringify(attachments),
        is_public: isPublic,
        created_at: now,
      });

      // Update ticket updated_at
      await this.db('support_tickets')
        .where('id', ticketId)
        .update({ updated_at: now });

      logger.info(`Response added to ticket: ${ticketId}`);

      return {
        id: responseId,
        ticketId,
        responderId,
        message,
        attachments,
        isPublic,
        createdAt: now,
      };
    } catch (error) {
      logger.error('Failed to add response', error);
      throw new AppError('Failed to add response', 500);
    }
  }

  /**
   * Gets ticket responses
   * @param ticketId - Ticket ID
   */
  async getResponses(ticketId: string): Promise<SupportResponse[]> {
    try {
      const responses = await this.db('support_responses')
        .where('ticket_id', ticketId)
        .orderBy('created_at', 'asc')
        .select();

      return responses.map((r: any) => ({
        id: r.id,
        ticketId: r.ticket_id,
        responderId: r.responder_id,
        message: r.message,
        attachments: JSON.parse(r.attachments || '[]'),
        isPublic: r.is_public,
        createdAt: r.created_at,
      }));
    } catch (error) {
      logger.error('Failed to get responses', error);
      throw new AppError('Failed to get responses', 500);
    }
  }

  /**
   * Gets ticket statistics
   * @param tenantId - Tenant ID
   */
  async getStatistics(tenantId: string): Promise<{
    openTickets: number;
    inProgressTickets: number;
    resolvedTickets: number;
    averageResolutionTime: number;
    ticketsByPriority: Record<string, number>;
    ticketsByCategory: Record<string, number>;
  }> {
    try {
      const open = await this.db('support_tickets')
        .where('tenant_id', tenantId)
        .where('status', 'open')
        .count('* as count')
        .first() as any;

      const inProgress = await this.db('support_tickets')
        .where('tenant_id', tenantId)
        .where('status', 'in-progress')
        .count('* as count')
        .first() as any;

      const resolved = await this.db('support_tickets')
        .where('tenant_id', tenantId)
        .where('status', 'resolved')
        .count('* as count')
        .first() as any;

      const avgResolutionTime = await this.db('support_tickets')
        .where('tenant_id', tenantId)
        .where('resolved_at', '!=', null)
        .select(
          this.db.raw('AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) as avg_seconds')
        )
        .first() as any;

      const byPriority = await this.db('support_tickets')
        .where('tenant_id', tenantId)
        .groupBy('priority')
        .select(
          'priority',
          this.db.raw('COUNT(*) as count')
        );

      const byCategory = await this.db('support_tickets')
        .where('tenant_id', tenantId)
        .groupBy('category')
        .select(
          'category',
          this.db.raw('COUNT(*) as count')
        );

      return {
        openTickets: open.count || 0,
        inProgressTickets: inProgress.count || 0,
        resolvedTickets: resolved.count || 0,
        averageResolutionTime: Math.round((avgResolutionTime.avg_seconds || 0) / 3600),
        ticketsByPriority: Object.fromEntries(byPriority.map((p: any) => [p.priority, p.count])),
        ticketsByCategory: Object.fromEntries(byCategory.map((c: any) => [c.category, c.count])),
      };
    } catch (error) {
      logger.error('Failed to get statistics', error);
      throw new AppError('Failed to get statistics', 500);
    }
  }
}

export default SupportTicketService;
