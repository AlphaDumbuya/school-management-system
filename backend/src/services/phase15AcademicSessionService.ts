
/**
 * Phase 15.3: Academic Session Configuration Service
 * 
 * Manages academic sessions and terms with:
 * - Academic session definition and management
 * - Term definition with start/end dates
 * - Session management endpoints
 */

import { Knex } from 'knex';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface Term {
  term_id: string;
  name: string;
  term_number: number;
  start_date: Date;
  end_date: Date;
  is_current: boolean;
}

export interface AcademicSession {
  session_id: string;
  tenant_id: string;
  name: string;
  year: number;
  start_date: Date;
  end_date: Date;
  terms: Term[];
  is_current: boolean;
  is_active: boolean;
  created_by: string;
}

/**
 * Phase 15.3: Academic Session Service
 */
export class Phase15AcademicSessionService {
  private db: Knex;

  constructor(db: Knex) {
    this.db = db;
  }

  /**
   * Create academic session
   */
  async createSession(
    tenantId: string,
    data: {
      name: string;
      year: number;
      start_date: Date;
      end_date: Date;
      terms?: Term[];
      is_current?: boolean;
    },
    userId: string
  ): Promise<AcademicSession> {
    try {
      // Validate dates
      if (data.start_date >= data.end_date) {
        throw new AppError('Start date must be before end date', 400, 'VALIDATION_ERROR');
      }

      // If current, unset others
      if (data.is_current) {
        await this.db('academic_sessions')
          .where('tenant_id', tenantId)
          .update({ is_current: false });
      }

      const sessionId = uuidv4();
      const terms = data.terms || this.generateDefaultTerms(data.start_date, data.end_date);

      await this.db('academic_sessions').insert({
        session_id: sessionId,
        tenant_id: tenantId,
        name: data.name,
        year: data.year,
        start_date: data.start_date,
        end_date: data.end_date,
        terms_json: JSON.stringify(terms),
        is_current: data.is_current || false,
        is_active: true,
        created_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
      });

      logger.info(`Academic session created: ${data.name} (${sessionId})`);

      return {
        session_id: sessionId,
        tenant_id: tenantId,
        name: data.name,
        year: data.year,
        start_date: data.start_date,
        end_date: data.end_date,
        terms,
        is_current: data.is_current || false,
        is_active: true,
        created_by: userId,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Failed to create academic session: ${(error as Error).message}`,
        500,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get academic session
   */
  async getSession(sessionId: string, tenantId: string): Promise<AcademicSession> {
    try {
      const session = await this.db('academic_sessions')
        .where('session_id', sessionId)
        .where('tenant_id', tenantId)
        .first();

      if (!session) {
        throw new AppError('Academic session not found', 404, 'NOT_FOUND');
      }

      return {
        session_id: session.session_id,
        tenant_id: session.tenant_id,
        name: session.name,
        year: session.year,
        start_date: new Date(session.start_date),
        end_date: new Date(session.end_date),
        terms: JSON.parse(session.terms_json),
        is_current: session.is_current,
        is_active: session.is_active,
        created_by: session.created_by,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Failed to retrieve session: ${(error as Error).message}`,
        500,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get current session
   */
  async getCurrentSession(tenantId: string): Promise<AcademicSession | null> {
    try {
      const session = await this.db('academic_sessions')
        .where('tenant_id', tenantId)
        .where('is_current', true)
        .where('is_active', true)
        .first();

      if (!session) return null;

      return {
        session_id: session.session_id,
        tenant_id: session.tenant_id,
        name: session.name,
        year: session.year,
        start_date: new Date(session.start_date),
        end_date: new Date(session.end_date),
        terms: JSON.parse(session.terms_json),
        is_current: session.is_current,
        is_active: session.is_active,
        created_by: session.created_by,
      };
    } catch (error) {
      logger.error('Failed to get current session:', error);
      return null;
    }
  }

  /**
   * Get all sessions
   */
  async getSessions(tenantId: string): Promise<AcademicSession[]> {
    try {
      const sessions = await this.db('academic_sessions')
        .where('tenant_id', tenantId)
        .where('is_active', true)
        .orderBy('year', 'desc');

      return sessions.map((s: any) => ({
        session_id: s.session_id,
        tenant_id: s.tenant_id,
        name: s.name,
        year: s.year,
        start_date: new Date(s.start_date),
        end_date: new Date(s.end_date),
        terms: JSON.parse(s.terms_json),
        is_current: s.is_current,
        is_active: s.is_active,
        created_by: s.created_by,
      }));
    } catch (error) {
      logger.error('Failed to get sessions:', error);
      return [];
    }
  }

  /**
   * Update session
   */
  async updateSession(
    sessionId: string,
    tenantId: string,
    updates: Partial<AcademicSession>,
    userId: string
  ): Promise<AcademicSession> {
    try {
      const updateData: any = {
        updated_at: new Date(),
        updated_by: userId,
      };

      if (updates.name) updateData.name = updates.name;
      if (updates.start_date) updateData.start_date = updates.start_date;
      if (updates.end_date) updateData.end_date = updates.end_date;
      if (updates.terms) updateData.terms_json = JSON.stringify(updates.terms);
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

      if (updates.is_current) {
        await this.db('academic_sessions')
          .where('tenant_id', tenantId)
          .where('session_id', '!=', sessionId)
          .update({ is_current: false });
        updateData.is_current = true;
      }

      await this.db('academic_sessions')
        .where('session_id', sessionId)
        .where('tenant_id', tenantId)
        .update(updateData);

      logger.info(`Academic session updated: ${sessionId}`);

      return this.getSession(sessionId, tenantId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Failed to update session: ${(error as Error).message}`,
        500,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Generate default terms (3 terms per academic year)
   */
  private generateDefaultTerms(startDate: Date, endDate: Date): Term[] {
    const terms: Term[] = [];
    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysPerTerm = Math.floor(totalDays / 3);

    for (let i = 0; i < 3; i++) {
      const termStart = new Date(startDate);
      termStart.setDate(termStart.getDate() + i * daysPerTerm);

      const termEnd = new Date(startDate);
      termEnd.setDate(
        termEnd.getDate() + (i === 2 ? totalDays : (i + 1) * daysPerTerm - 1)
      );

      terms.push({
        term_id: uuidv4(),
        name: `Term ${i + 1}`,
        term_number: i + 1,
        start_date: termStart,
        end_date: termEnd,
        is_current: false,
      });
    }

    return terms;
  }

  /**
   * Get current term
   */
  async getCurrentTerm(tenantId: string): Promise<Term | null> {
    try {
      const session = await this.getCurrentSession(tenantId);
      if (!session) return null;

      const today = new Date();
      return (
        session.terms.find((t) => new Date(t.start_date) <= today && today <= new Date(t.end_date)) ||
        null
      );
    } catch (error) {
      logger.error('Failed to get current term:', error);
      return null;
    }
  }
}
