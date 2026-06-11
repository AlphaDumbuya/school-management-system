import { AcademicSession, AcademicTerm, ConfigurationResponse } from '../types/configuration';

/**
 * Academic Session Service
 * Manages academic sessions and terms
 */
export class AcademicSessionService {
  private sessions: Map<string, AcademicSession> = new Map();
  private currentSessionId: string | null = null;

  /**
   * Initialize default session
   */
  initializeDefault(): AcademicSession {
    const currentYear = new Date().getFullYear();
    const session: AcademicSession = {
      id: `session-${currentYear}-${currentYear + 1}`,
      name: `Academic Year ${currentYear}-${currentYear + 1}`,
      startDate: `${currentYear}-04-01`,
      endDate: `${currentYear + 1}-03-31`,
      isActive: true,
      terms: [
        {
          id: `term-1-${currentYear}`,
          name: 'Term 1',
          startDate: `${currentYear}-04-01`,
          endDate: `${currentYear}-06-30`,
          examStartDate: `${currentYear}-06-15`,
          examEndDate: `${currentYear}-06-25`,
          description: 'First term of academic year',
        },
        {
          id: `term-2-${currentYear}`,
          name: 'Term 2',
          startDate: `${currentYear}-07-01`,
          endDate: `${currentYear}-09-30`,
          examStartDate: `${currentYear}-09-15`,
          examEndDate: `${currentYear}-09-25`,
          description: 'Second term of academic year',
        },
        {
          id: `term-3-${currentYear}`,
          name: 'Term 3',
          startDate: `${currentYear}-10-01`,
          endDate: `${currentYear + 1}-03-31`,
          examStartDate: `${currentYear + 1}-03-10`,
          examEndDate: `${currentYear + 1}-03-20`,
          description: 'Third term of academic year',
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.sessions.set(session.id, session);
    this.currentSessionId = session.id;

    return session;
  }

  /**
   * Get all sessions
   */
  async getAllSessions(): Promise<AcademicSession[]> {
    if (this.sessions.size === 0) {
      this.initializeDefault();
    }
    return Array.from(this.sessions.values());
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<AcademicSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get current active session
   */
  async getCurrentSession(): Promise<AcademicSession | null> {
    if (this.sessions.size === 0) {
      this.initializeDefault();
    }

    if (this.currentSessionId) {
      return this.sessions.get(this.currentSessionId) || null;
    }

    // Find first active session
    const sessions = Array.from(this.sessions.values());
    const active = sessions.find(s => s.isActive);
    return active || (sessions.length > 0 ? sessions[0] : null);
  }

  /**
   * Create new academic session
   */
  async createSession(
    name: string,
    startDate: string,
    endDate: string,
    terms: AcademicTerm[]
  ): Promise<ConfigurationResponse<AcademicSession>> {
    try {
      // Validate dates
      const validation = this.validateSessionDates(startDate, endDate, terms);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(', '),
          timestamp: new Date().toISOString(),
        };
      }

      const session: AcademicSession = {
        id: `session-${Date.now()}`,
        name,
        startDate,
        endDate,
        isActive: false,
        terms,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.sessions.set(session.id, session);

      return {
        success: true,
        data: session,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Set active session
   */
  async setActiveSession(sessionId: string): Promise<ConfigurationResponse<AcademicSession>> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return {
          success: false,
          error: 'Session not found',
          timestamp: new Date().toISOString(),
        };
      }

      // Deactivate other sessions
      this.sessions.forEach(s => (s.isActive = false));

      // Activate selected session
      session.isActive = true;
      session.updatedAt = new Date().toISOString();
      this.currentSessionId = sessionId;

      return {
        success: true,
        data: session,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Add term to session
   */
  async addTerm(sessionId: string, term: AcademicTerm): Promise<ConfigurationResponse<AcademicSession>> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return {
          success: false,
          error: 'Session not found',
          timestamp: new Date().toISOString(),
        };
      }

      // Validate term dates against session dates
      if (term.startDate < session.startDate || term.endDate > session.endDate) {
        return {
          success: false,
          error: 'Term dates must be within session dates',
          timestamp: new Date().toISOString(),
        };
      }

      // Check for term overlap
      const overlap = session.terms.some(
        t => (term.startDate <= t.endDate && term.endDate >= t.startDate)
      );

      if (overlap) {
        return {
          success: false,
          error: 'Term overlaps with existing term',
          timestamp: new Date().toISOString(),
        };
      }

      session.terms.push(term);
      session.updatedAt = new Date().toISOString();

      return {
        success: true,
        data: session,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Update term
   */
  async updateTerm(sessionId: string, termId: string, updates: Partial<AcademicTerm>): Promise<ConfigurationResponse<AcademicSession>> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return {
          success: false,
          error: 'Session not found',
          timestamp: new Date().toISOString(),
        };
      }

      const termIndex = session.terms.findIndex(t => t.id === termId);
      if (termIndex === -1) {
        return {
          success: false,
          error: 'Term not found',
          timestamp: new Date().toISOString(),
        };
      }

      const term = session.terms[termIndex];
      const updatedTerm = { ...term, ...updates };

      // Validate dates
      if (updatedTerm.startDate < session.startDate || updatedTerm.endDate > session.endDate) {
        return {
          success: false,
          error: 'Term dates must be within session dates',
          timestamp: new Date().toISOString(),
        };
      }

      // Check for overlap with other terms
      const overlap = session.terms.some(
        (t, idx) => idx !== termIndex && (updatedTerm.startDate <= t.endDate && updatedTerm.endDate >= t.startDate)
      );

      if (overlap) {
        return {
          success: false,
          error: 'Term overlaps with existing term',
          timestamp: new Date().toISOString(),
        };
      }

      session.terms[termIndex] = updatedTerm;
      session.updatedAt = new Date().toISOString();

      return {
        success: true,
        data: session,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get term by ID
   */
  async getTerm(sessionId: string, termId: string): Promise<AcademicTerm | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    return session.terms.find(t => t.id === termId) || null;
  }

  /**
   * Get current term
   */
  async getCurrentTerm(): Promise<AcademicTerm | null> {
    const session = await this.getCurrentSession();
    if (!session) return null;

    const today = new Date().toISOString().split('T')[0];
    return session.terms.find(t => t.startDate <= today && t.endDate >= today) || null;
  }

  /**
   * Get term by date
   */
  async getTermByDate(sessionId: string, date: string): Promise<AcademicTerm | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    return session.terms.find(t => t.startDate <= date && t.endDate >= date) || null;
  }

  /**
   * Validate session dates
   */
  private validateSessionDates(
    startDate: string,
    endDate: string,
    terms: AcademicTerm[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!startDate || !endDate) {
      errors.push('Start and end dates are required');
      return { valid: false, errors };
    }

    if (startDate >= endDate) {
      errors.push('Start date must be before end date');
    }

    if (!terms || terms.length === 0) {
      errors.push('At least one term is required');
    }

    // Validate terms
    terms.forEach((term, index) => {
      if (term.startDate < startDate || term.endDate > endDate) {
        errors.push(`Term ${index + 1} dates must be within session dates`);
      }

      // Check for overlaps
      terms.forEach((otherTerm, otherIndex) => {
        if (index !== otherIndex && term.startDate <= otherTerm.endDate && term.endDate >= otherTerm.startDate) {
          errors.push(`Term ${index + 1} overlaps with term ${otherIndex + 1}`);
        }
      });
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get session progress
   */
  async getSessionProgress(sessionId: string): Promise<{ progress: number; status: string } | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    const today = new Date();
    const sessionStart = new Date(session.startDate);
    const sessionEnd = new Date(session.endDate);

    if (today < sessionStart) {
      return { progress: 0, status: 'not-started' };
    } else if (today > sessionEnd) {
      return { progress: 100, status: 'completed' };
    } else {
      const total = sessionEnd.getTime() - sessionStart.getTime();
      const elapsed = today.getTime() - sessionStart.getTime();
      const progress = (elapsed / total) * 100;
      return { progress: Math.round(progress), status: 'in-progress' };
    }
  }
}

export default new AcademicSessionService();
