/**
 * Event Attendance Service
 * Handles event attendance tracking, check-in/out, and reporting
 * Phase 2.2 - Events Management Module
 */

import db from '../utils/database.js';
import {
  EventAttendance,
  MarkAttendanceDTO,
  AttendanceReport,
} from '../types/event.js';
import logger from '../utils/logger.js';
import QRCode from 'qrcode';

export class EventAttendanceService {
  /**
   * Mark attendance for user
   */
  async markAttendance(
    eventId: string,
    data: MarkAttendanceDTO,
    markedBy: string
  ): Promise<EventAttendance> {
    try {
      // Check if event exists
      const event = await db('events').where({ event_id: eventId }).first();

      if (!event) {
        throw new Error('Event not found');
      }

      // Check if user is registered
      const registration = await db('event_registrations')
        .where({ event_id: eventId, user_id: data.user_id })
        .first();

      if (!registration) {
        throw new Error('User is not registered for this event');
      }

      // Check if attendance already exists
      const existing = await db('event_attendance')
        .where({ event_id: eventId, user_id: data.user_id })
        .first();

      let attendance;

      if (existing) {
        // Update existing attendance
        [attendance] = await db('event_attendance')
          .where({ attendance_id: existing.attendance_id })
          .update({
            status: data.status,
            check_in_time: data.check_in_time || existing.check_in_time,
            notes: data.notes || existing.notes,
            marked_by: markedBy,
            updated_at: db.fn.now(),
          })
          .returning('*');
      } else {
        // Create new attendance record
        [attendance] = await db('event_attendance')
          .insert({
            event_id: eventId,
            user_id: data.user_id,
            status: data.status,
            check_in_time: data.check_in_time || new Date(),
            attendance_method: 'manual',
            marked_by: markedBy,
            notes: data.notes,
          })
          .returning('*');
      }

      // Update registration with attendance info
      await db('event_registrations')
        .where({ event_id: eventId, user_id: data.user_id })
        .update({
          attendance_status: data.status,
          check_in_time: data.check_in_time,
        });

      logger.info(`Attendance marked for event: ${eventId}`, {
        userId: data.user_id,
        status: data.status,
        markedBy,
      });

      return attendance;
    } catch (error) {
      logger.error('Error marking attendance:', error);
      throw error;
    }
  }

  /**
   * Check-in user
   */
  async checkIn(
    eventId: string,
    userId: string,
    method: 'manual' | 'qr_code' | 'automatic' = 'manual'
  ): Promise<EventAttendance> {
    try {
      const checkInTime = new Date();

      // Check if already checked in
      const existing = await db('event_attendance')
        .where({ event_id: eventId, user_id: userId })
        .first();

      if (existing) {
        throw new Error('User already checked in');
      }

      const [attendance] = await db('event_attendance')
        .insert({
          event_id: eventId,
          user_id: userId,
          status: 'present',
          check_in_time: checkInTime,
          attendance_method: method,
        })
        .returning('*');

      // Update registration
      await db('event_registrations')
        .where({ event_id: eventId, user_id: userId })
        .update({
          check_in_time: checkInTime,
          attendance_status: 'present',
        });

      logger.info(`User checked in: ${eventId}`, { userId, method });

      return attendance;
    } catch (error) {
      logger.error('Error checking in:', error);
      throw error;
    }
  }

  /**
   * Check-out user
   */
  async checkOut(eventId: string, userId: string): Promise<EventAttendance> {
    try {
      const checkOutTime = new Date();

      const [attendance] = await db('event_attendance')
        .where({ event_id: eventId, user_id: userId })
        .update({
          check_out_time: checkOutTime,
          updated_at: db.fn.now(),
        })
        .returning('*');

      if (!attendance) {
        throw new Error('Check-in record not found');
      }

      // Update registration
      await db('event_registrations')
        .where({ event_id: eventId, user_id: userId })
        .update({
          check_out_time: checkOutTime,
        });

      logger.info(`User checked out: ${eventId}`, { userId });

      return attendance;
    } catch (error) {
      logger.error('Error checking out:', error);
      throw error;
    }
  }

  /**
   * Bulk mark attendance
   */
  async bulkMarkAttendance(
    eventId: string,
    attendances: Array<{ user_id: string; status: string }>,
    markedBy: string
  ): Promise<void> {
    const trx = await db.transaction();

    try {
      for (const item of attendances) {
        await this.markAttendance(
          eventId,
          {
            user_id: item.user_id,
            status: item.status as any,
          },
          markedBy
        );
      }

      await trx.commit();

      logger.info(`Bulk attendance marked for event: ${eventId}`, {
        count: attendances.length,
        markedBy,
      });
    } catch (error) {
      await trx.rollback();
      logger.error('Error bulk marking attendance:', error);
      throw error;
    }
  }

  /**
   * Get event attendance
   */
  async getEventAttendance(eventId: string): Promise<any[]> {
    try {
      const attendance = await db('event_attendance')
        .join('users', 'event_attendance.user_id', 'users.id')
        .where('event_attendance.event_id', eventId)
        .select(
          'event_attendance.*',
          'users.first_name',
          'users.last_name',
          'users.email',
          'users.role'
        )
        .orderBy('event_attendance.check_in_time', 'asc');

      return attendance;
    } catch (error) {
      logger.error('Error getting event attendance:', error);
      throw new Error('Failed to get event attendance');
    }
  }

  /**
   * Get user's attendance history
   */
  async getUserAttendance(userId: string): Promise<EventAttendance[]> {
    try {
      const attendance = await db('event_attendance')
        .where({ user_id: userId })
        .orderBy('created_at', 'desc');

      return attendance;
    } catch (error) {
      logger.error('Error getting user attendance:', error);
      throw new Error('Failed to get user attendance');
    }
  }

  /**
   * Generate QR code for event attendance
   */
  async generateAttendanceQRCode(eventId: string): Promise<string> {
    try {
      // Create QR code data (could include event ID + timestamp + signature)
      const qrData = JSON.stringify({
        event_id: eventId,
        type: 'attendance',
        timestamp: new Date().toISOString(),
      });

      // Generate QR code as base64 image
      const qrCode = await QRCode.toDataURL(qrData);

      logger.info(`QR code generated for event: ${eventId}`);

      return qrCode;
    } catch (error) {
      logger.error('Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Verify QR code and check-in
   */
  async checkInWithQRCode(qrData: string, userId: string): Promise<EventAttendance> {
    try {
      const data = JSON.parse(qrData);

      if (data.type !== 'attendance') {
        throw new Error('Invalid QR code');
      }

      // Verify timestamp (QR code valid for 5 minutes)
      const qrTime = new Date(data.timestamp);
      const now = new Date();
      const diffMinutes = (now.getTime() - qrTime.getTime()) / (1000 * 60);

      if (diffMinutes > 5) {
        throw new Error('QR code expired');
      }

      // Check-in user
      const attendance = await this.checkIn(data.event_id, userId, 'qr_code');

      return attendance;
    } catch (error) {
      logger.error('Error checking in with QR code:', error);
      throw error;
    }
  }

  /**
   * Generate attendance report
   */
  async generateAttendanceReport(eventId: string): Promise<AttendanceReport> {
    try {
      const event = await db('events').where({ event_id: eventId }).first();

      if (!event) {
        throw new Error('Event not found');
      }

      // Get attendance stats
      const stats = await db('event_attendance')
        .where({ event_id: eventId })
        .select(
          db.raw("COUNT(*) FILTER (WHERE status = 'present') as present"),
          db.raw("COUNT(*) FILTER (WHERE status = 'absent') as absent"),
          db.raw("COUNT(*) FILTER (WHERE status = 'late') as late"),
          db.raw('COUNT(*) as total')
        )
        .first();

      // Get registered count
      const registrationCount = await db('event_registrations')
        .where({ event_id: eventId, status: 'confirmed' })
        .count('* as count')
        .first();

      const totalRegistered = parseInt(registrationCount?.count as string || '0');
      const totalPresent = parseInt(stats?.present || '0');
      const totalAbsent = parseInt(stats?.absent || '0');
      const totalLate = parseInt(stats?.late || '0');

      const attendanceRate = totalRegistered > 0
        ? (totalPresent / totalRegistered) * 100
        : 0;

      // Get attendee details
      const attendees = await db('event_attendance')
        .join('users', 'event_attendance.user_id', 'users.id')
        .where('event_attendance.event_id', eventId)
        .select(
          'event_attendance.user_id',
          db.raw("CONCAT(users.first_name, ' ', users.last_name) as name"),
          'event_attendance.status',
          'event_attendance.check_in_time'
        );

      return {
        event_id: eventId,
        event_title: event.title,
        total_registered: totalRegistered,
        total_present: totalPresent,
        total_absent: totalAbsent,
        total_late: totalLate,
        attendance_rate: Math.round(attendanceRate * 100) / 100,
        attendees,
      };
    } catch (error) {
      logger.error('Error generating attendance report:', error);
      throw new Error('Failed to generate attendance report');
    }
  }

  /**
   * Get attendance statistics
   */
  async getAttendanceStats(eventId: string): Promise<{
    present: number;
    absent: number;
    late: number;
    excused: number;
    not_marked: number;
    attendance_rate: number;
  }> {
    try {
      const stats = await db('event_attendance')
        .where({ event_id: eventId })
        .select(
          db.raw("COUNT(*) FILTER (WHERE status = 'present') as present"),
          db.raw("COUNT(*) FILTER (WHERE status = 'absent') as absent"),
          db.raw("COUNT(*) FILTER (WHERE status = 'late') as late"),
          db.raw("COUNT(*) FILTER (WHERE status = 'excused') as excused")
        )
        .first();

      const registrationCount = await db('event_registrations')
        .where({ event_id: eventId, status: 'confirmed' })
        .count('* as count')
        .first();

      const totalRegistered = parseInt(registrationCount?.count as string || '0');
      const present = parseInt(stats?.present || '0');
      const absent = parseInt(stats?.absent || '0');
      const late = parseInt(stats?.late || '0');
      const excused = parseInt(stats?.excused || '0');
      const marked = present + absent + late + excused;
      const notMarked = totalRegistered - marked;

      const attendanceRate = totalRegistered > 0
        ? (present / totalRegistered) * 100
        : 0;

      return {
        present,
        absent,
        late,
        excused,
        not_marked: notMarked,
        attendance_rate: Math.round(attendanceRate * 100) / 100,
      };
    } catch (error) {
      logger.error('Error getting attendance stats:', error);
      throw new Error('Failed to get attendance statistics');
    }
  }
}

export default new EventAttendanceService();
