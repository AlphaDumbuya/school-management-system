/**
 * Event Analytics Service
 * Provides statistics, metrics, and analytics for events
 * Phase 2.2 - Events Management Module
 */

import db from '../utils/database.js';
import { EventStats, CategoryStats } from '../types/event.js';
import { logger } from '../utils/logger.js';

export class EventAnalyticsService {
  /**
   * Get overall event statistics
   */
  async getOverallStats(
    tenantId: string,
    dateRange?: { start_date?: Date; end_date?: Date }
  ): Promise<EventStats> {
    try {
      let query = db('events').where({ tenant_id: tenantId });

      if (dateRange?.start_date) {
        query = query.where('start_date', '>=', dateRange.start_date);
      }

      if (dateRange?.end_date) {
        query = query.where('end_date', '<=', dateRange.end_date);
      }

      const eventStats = await query
        .select(
          db.raw('COUNT(*) as total_events'),
          db.raw("COUNT(*) FILTER (WHERE status = 'published') as published_events"),
          db.raw("COUNT(*) FILTER (WHERE start_date > NOW()) as upcoming_events")
        )
        .first();

      // Get registration stats
      const registrationStats = await db('event_registrations')
        .join('events', 'event_registrations.event_id', 'events.event_id')
        .where('events.tenant_id', tenantId)
        .select(db.raw('COUNT(*) as total_registrations'))
        .first();

      // Get attendance stats
      const attendanceStats = await db('event_attendance')
        .join('events', 'event_attendance.event_id', 'events.event_id')
        .where('events.tenant_id', tenantId)
        .select(
          db.raw('COUNT(*) as total_attendance'),
          db.raw("COUNT(*) FILTER (WHERE status = 'present') as total_present")
        )
        .first();

      const totalRegistrations = parseInt(
        registrationStats?.total_registrations || '0'
      );
      const totalPresent = parseInt(attendanceStats?.total_present || '0');

      const averageAttendanceRate =
        totalRegistrations > 0 ? (totalPresent / totalRegistrations) * 100 : 0;

      return {
        total_events: parseInt(eventStats?.total_events || '0'),
        published_events: parseInt(eventStats?.published_events || '0'),
        upcoming_events: parseInt(eventStats?.upcoming_events || '0'),
        total_registrations: totalRegistrations,
        total_attendance: parseInt(attendanceStats?.total_attendance || '0'),
        average_attendance_rate: Math.round(averageAttendanceRate * 100) / 100,
      };
    } catch (error) {
      logger.error('Error getting overall stats:', error);
      throw new Error('Failed to get overall statistics');
    }
  }

  /**
   * Get category statistics
   */
  async getCategoryStats(tenantId: string): Promise<CategoryStats[]> {
    try {
      const stats = await db('event_categories')
        .leftJoin(
          'event_category_mappings',
          'event_categories.category_id',
          'event_category_mappings.category_id'
        )
        .leftJoin('events', function () {
          this.on('event_category_mappings.event_id', '=', 'events.event_id')
            .andOn('events.tenant_id', '=', db.raw('?', [tenantId]))
            .andOn('events.status', '=', db.raw('?', ['published']));
        })
        .leftJoin('event_registrations', function () {
          this.on('events.event_id', '=', 'event_registrations.event_id').andOn(
            'event_registrations.status',
            '=',
            db.raw('?', ['confirmed'])
          );
        })
        .leftJoin('event_attendance', function () {
          this.on('events.event_id', '=', 'event_attendance.event_id').andOn(
            'event_attendance.status',
            '=',
            db.raw('?', ['present'])
          );
        })
        .where('event_categories.tenant_id', tenantId)
        .where('event_categories.active', true)
        .groupBy('event_categories.category_id', 'event_categories.name')
        .select(
          'event_categories.category_id',
          'event_categories.name as category_name',
          db.raw('COUNT(DISTINCT events.event_id) as event_count'),
          db.raw(
            'COUNT(DISTINCT event_registrations.registration_id) as total_registrations'
          ),
          db.raw('COUNT(DISTINCT event_attendance.attendance_id) as total_attendance')
        )
        .orderBy('event_count', 'desc');

      return stats.map((stat) => {
        const registrations = parseInt(stat.total_registrations || '0');
        const attendance = parseInt(stat.total_attendance || '0');
        const averageAttendance =
          registrations > 0 ? (attendance / registrations) * 100 : 0;

        return {
          category_id: stat.category_id,
          category_name: stat.category_name,
          event_count: parseInt(stat.event_count),
          total_registrations: registrations,
          average_attendance: Math.round(averageAttendance * 100) / 100,
        };
      });
    } catch (error) {
      logger.error('Error getting category stats:', error);
      throw new Error('Failed to get category statistics');
    }
  }

  /**
   * Get event-specific statistics
   */
  async getEventStats(eventId: string): Promise<any> {
    try {
      const event = await db('events').where({ event_id: eventId }).first();

      if (!event) {
        throw new Error('Event not found');
      }

      // Registration stats
      const registrationStats = await db('event_registrations')
        .where({ event_id: eventId })
        .select(
          db.raw("COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed"),
          db.raw("COUNT(*) FILTER (WHERE status = 'waitlist') as waitlist"),
          db.raw("COUNT(*) FILTER (WHERE status = 'pending') as pending"),
          db.raw("COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled"),
          db.raw('COUNT(*) as total'),
          db.raw('SUM(guests_count) as total_guests')
        )
        .first();

      // Attendance stats
      const attendanceStats = await db('event_attendance')
        .where({ event_id: eventId })
        .select(
          db.raw("COUNT(*) FILTER (WHERE status = 'present') as present"),
          db.raw("COUNT(*) FILTER (WHERE status = 'absent') as absent"),
          db.raw("COUNT(*) FILTER (WHERE status = 'late') as late"),
          db.raw("COUNT(*) FILTER (WHERE status = 'excused') as excused")
        )
        .first();

      const confirmed = parseInt(registrationStats?.confirmed || '0');
      const present = parseInt(attendanceStats?.present || '0');
      const attendanceRate = confirmed > 0 ? (present / confirmed) * 100 : 0;

      return {
        event_id: eventId,
        event_title: event.title,
        event_status: event.status,
        capacity: event.capacity,
        registration_stats: {
          total: parseInt(registrationStats?.total || '0'),
          confirmed,
          waitlist: parseInt(registrationStats?.waitlist || '0'),
          pending: parseInt(registrationStats?.pending || '0'),
          cancelled: parseInt(registrationStats?.cancelled || '0'),
          total_guests: parseInt(registrationStats?.total_guests || '0'),
        },
        attendance_stats: {
          present,
          absent: parseInt(attendanceStats?.absent || '0'),
          late: parseInt(attendanceStats?.late || '0'),
          excused: parseInt(attendanceStats?.excused || '0'),
          attendance_rate: Math.round(attendanceRate * 100) / 100,
        },
        capacity_utilization:
          event.capacity > 0
            ? Math.round((confirmed / event.capacity) * 100 * 100) / 100
            : null,
      };
    } catch (error) {
      logger.error('Error getting event stats:', error);
      throw error;
    }
  }

  /**
   * Get RSVP conversion rate
   */
  async getRSVPConversionRate(eventId: string): Promise<number> {
    try {
      const stats = await db('event_registrations')
        .where({ event_id: eventId })
        .select(
          db.raw("COUNT(*) FILTER (WHERE rsvp_status = 'going') as going"),
          db.raw('COUNT(*) as total')
        )
        .first();

      const total = parseInt(stats?.total || '0');
      const going = parseInt(stats?.going || '0');

      if (total === 0) return 0;

      return Math.round((going / total) * 100 * 100) / 100;
    } catch (error) {
      logger.error('Error getting RSVP conversion rate:', error);
      throw new Error('Failed to get RSVP conversion rate');
    }
  }

  /**
   * Get popular events (most registrations)
   */
  async getPopularEvents(
    tenantId: string,
    limit: number = 10
  ): Promise<any[]> {
    try {
      const events = await db('events')
        .leftJoin(
          'event_registrations',
          'events.event_id',
          'event_registrations.event_id'
        )
        .where('events.tenant_id', tenantId)
        .where('events.status', 'published')
        .groupBy('events.event_id', 'events.title', 'events.start_date')
        .select(
          'events.event_id',
          'events.title',
          'events.start_date',
          db.raw('COUNT(event_registrations.registration_id) as registration_count')
        )
        .orderBy('registration_count', 'desc')
        .limit(limit);

      return events.map((event) => ({
        ...event,
        registration_count: parseInt(event.registration_count),
      }));
    } catch (error) {
      logger.error('Error getting popular events:', error);
      throw new Error('Failed to get popular events');
    }
  }

  /**
   * Get attendance trends over time
   */
  async getAttendanceTrends(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      date: string;
      events_count: number;
      total_attendance: number;
      average_attendance_rate: number;
    }>
  > {
    try {
      const trends = await db('events')
        .leftJoin('event_registrations', function () {
          this.on('events.event_id', '=', 'event_registrations.event_id').andOn(
            'event_registrations.status',
            '=',
            db.raw('?', ['confirmed'])
          );
        })
        .leftJoin('event_attendance', function () {
          this.on('events.event_id', '=', 'event_attendance.event_id').andOn(
            'event_attendance.status',
            '=',
            db.raw('?', ['present'])
          );
        })
        .where('events.tenant_id', tenantId)
        .whereBetween('events.start_date', [startDate, endDate])
        .where('events.status', 'published')
        .groupBy(db.raw('DATE(events.start_date)'))
        .select(
          db.raw('DATE(events.start_date) as date'),
          db.raw('COUNT(DISTINCT events.event_id) as events_count'),
          db.raw('COUNT(DISTINCT event_attendance.attendance_id) as total_attendance'),
          db.raw('COUNT(DISTINCT event_registrations.registration_id) as total_registrations')
        )
        .orderBy('date', 'asc');

      return trends.map((trend: any) => {
        const registrations = parseInt(trend.total_registrations || '0');
        const attendance = parseInt(trend.total_attendance || '0');
        const rate = registrations > 0 ? (attendance / registrations) * 100 : 0;

        return {
          date: trend.date,
          events_count: parseInt(trend.events_count),
          total_attendance: attendance,
          average_attendance_rate: Math.round(rate * 100) / 100,
        };
      });
    } catch (error) {
      logger.error('Error getting attendance trends:', error);
      throw new Error('Failed to get attendance trends');
    }
  }

  /**
   * Get participation by role
   */
  async getParticipationByRole(
    tenantId: string
  ): Promise<Array<{ role: string; event_count: number; registration_count: number }>> {
    try {
      const stats = await db('event_registrations')
        .join('users', 'event_registrations.user_id', 'users.id')
        .join('events', 'event_registrations.event_id', 'events.event_id')
        .where('events.tenant_id', tenantId)
        .where('event_registrations.status', 'confirmed')
        .groupBy('users.role')
        .select(
          'users.role',
          db.raw('COUNT(DISTINCT events.event_id) as event_count'),
          db.raw('COUNT(event_registrations.registration_id) as registration_count')
        )
        .orderBy('registration_count', 'desc');

      return stats.map((stat) => ({
        role: stat.role,
        event_count: parseInt(stat.event_count),
        registration_count: parseInt(stat.registration_count),
      }));
    } catch (error) {
      logger.error('Error getting participation by role:', error);
      throw new Error('Failed to get participation statistics');
    }
  }

  /**
   * Get no-show rate
   */
  async getNoShowRate(eventId?: string, tenantId?: string): Promise<number> {
    try {
      let query = db('event_registrations')
        .leftJoin(
          'event_attendance',
          'event_registrations.event_id',
          'event_attendance.event_id'
        )
        .where('event_registrations.status', 'confirmed');

      if (eventId) {
        query = query.where('event_registrations.event_id', eventId);
      } else if (tenantId) {
        query = query
          .join('events', 'event_registrations.event_id', 'events.event_id')
          .where('events.tenant_id', tenantId);
      }

      const stats = await query
        .select(
          db.raw('COUNT(DISTINCT event_registrations.registration_id) as total_confirmed'),
          db.raw(
            'COUNT(DISTINCT event_attendance.attendance_id) FILTER (WHERE event_attendance.status = \'present\') as total_present'
          )
        )
        .first();

      const confirmed = parseInt(stats?.total_confirmed || '0');
      const present = parseInt(stats?.total_present || '0');
      const noShow = confirmed - present;

      if (confirmed === 0) return 0;

      return Math.round((noShow / confirmed) * 100 * 100) / 100;
    } catch (error) {
      logger.error('Error getting no-show rate:', error);
      throw new Error('Failed to get no-show rate');
    }
  }

  /**
   * Get dashboard summary
   */
  async getDashboardSummary(tenantId: string): Promise<any> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Trends: last 30 days for the dashboard chart
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [overallStats, categoryStats, popularEvents, noShowRate, trends] =
        await Promise.all([
          this.getOverallStats(tenantId, {
            start_date: startOfMonth,
            end_date: endOfMonth,
          }),
          this.getCategoryStats(tenantId),
          this.getPopularEvents(tenantId, 5),
          this.getNoShowRate(undefined, tenantId),
          this.getAttendanceTrends(tenantId, thirtyDaysAgo, now),
        ]);

      return {
        period: {
          start: startOfMonth,
          end: endOfMonth,
        },
        overall: overallStats,
        categories: categoryStats,
        popular_events: popularEvents,
        no_show_rate: noShowRate,
        // Flatten fields so front-end can read them directly from the root
        total_events: overallStats.total_events,
        upcoming_events: overallStats.upcoming_events,
        past_events: overallStats.total_events - overallStats.upcoming_events,
        total_registrations: overallStats.total_registrations,
        total_attendees: overallStats.total_attendance,
        average_attendance_rate: overallStats.average_attendance_rate,
        popular_categories: categoryStats.map((c) => ({
          category_id: c.category_id,
          category_name: c.category_name,
          total_events: c.event_count,
          upcoming_events: 0,
          completed_events: 0,
          total_registrations: c.total_registrations,
          average_attendance_rate: c.average_attendance,
        })),
        // Real trends data from the last 30 days
        trends: trends.map((t) => ({
          date: t.date,
          events_count: t.events_count,
          registrations_count: t.total_attendance, // reuse field — attendance trends
          attendance_count: t.total_attendance,
        })),
      };
    } catch (error) {
      logger.error('Error getting dashboard summary:', error);
      throw new Error('Failed to get dashboard summary');
    }
  }

  /**
   * Generate a comprehensive report for a single event.
   * Called by the event reports scheduled job.
   */
  async generateEventReport(eventId: string): Promise<any> {
    const [stats, noShowRate] = await Promise.all([
      this.getEventStats(eventId),
      this.getNoShowRate(eventId),
    ]);
    return { event_id: eventId, ...stats, no_show_rate: noShowRate };
  }
}

export default new EventAnalyticsService();
