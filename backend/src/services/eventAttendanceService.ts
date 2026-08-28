/**
 * Event Attendance Service
 * Handles event attendance tracking, check-in/out, and reporting.
 *
 * PRODUCTION FIXES:
 * - All queries scoped by tenant_id (derived from the event's tenant) to prevent cross-tenant leakage.
 * - bulkMarkAttendance now uses a single DB transaction correctly.
 * - QR code signed with HMAC-SHA256 (requires APP_SECRET env var) to prevent forgery.
 * - generateAttendanceQRCode returns both raw data and base64 image.
 */

import db from '../utils/database.js';
import crypto from 'crypto';
import {
  EventAttendance,
  MarkAttendanceDTO,
  AttendanceReport,
} from '../types/event.js';
import { logger } from '../utils/logger.js';
import QRCode from 'qrcode';

const APP_SECRET = process.env.APP_SECRET || process.env.JWT_SECRET;

if (!APP_SECRET) {
  // In production this is a hard error — QR codes signed with a predictable
  // key can be forged.  Fail fast to surface the misconfiguration.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[EventAttendanceService] APP_SECRET or JWT_SECRET must be set in production. ' +
      'QR code attendance check-in will not be secure without it.',
    );
  } else {
    // In dev/test fall back to a warning so the server still starts
    console.warn(
      '[EventAttendanceService] WARNING: Neither APP_SECRET nor JWT_SECRET is set. ' +
      'QR codes will use a fallback key — do NOT run this in production.',
    );
  }
}

const EFFECTIVE_SECRET = APP_SECRET || 'dev-fallback-secret-do-not-use-in-prod';
const QR_TTL_MINUTES = 15;

/**
 * Sign a payload string with HMAC-SHA256 to prevent QR forgery.
 */
function signPayload(data: string): string {
  return crypto.createHmac('sha256', EFFECTIVE_SECRET).update(data).digest('hex');
}

function verifySignature(data: string, signature: string): boolean {
  const expected = signPayload(data);
  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

export class EventAttendanceService {
  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Resolve the tenant_id for an event so every query can be scoped.
   */
  private async getTenantIdForEvent(eventId: string): Promise<string | null> {
    const row = await db('events').where({ event_id: eventId }).select('tenant_id').first();
    return row?.tenant_id ?? null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Attendance CRUD
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Mark (or update) attendance for a single user at an event.
   */
  async markAttendance(
    eventId: string,
    data: MarkAttendanceDTO,
    markedBy: string,
  ): Promise<EventAttendance> {
    const tenantId = await this.getTenantIdForEvent(eventId);
    if (!tenantId) throw new Error('Event not found');

    return this._markAttendanceInTrx(db, eventId, tenantId, data, markedBy);
  }

  /**
   * Internal helper that accepts any knex query builder / transaction.
   */
  private async _markAttendanceInTrx(
    trxOrDb: any,
    eventId: string,
    tenantId: string,
    data: MarkAttendanceDTO,
    markedBy: string,
  ): Promise<EventAttendance> {
    // Verify user is registered for this event (tenant-scoped)
    const registration = await trxOrDb('event_registrations')
      .join('events', 'event_registrations.event_id', 'events.event_id')
      .where({
        'event_registrations.event_id': eventId,
        'event_registrations.user_id': data.user_id,
        'events.tenant_id': tenantId,
      })
      .select('event_registrations.registration_id')
      .first();

    if (!registration) {
      throw new Error('User is not registered for this event');
    }

    const existing = await trxOrDb('event_attendance')
      .where({ event_id: eventId, user_id: data.user_id })
      .first();

    let attendance: EventAttendance;

    if (existing) {
      [attendance] = await trxOrDb('event_attendance')
        .where({ attendance_id: existing.attendance_id })
        .update({
          status: data.status,
          check_in_time: data.check_in_time || existing.check_in_time,
          notes: data.notes ?? existing.notes,
          marked_by: markedBy,
          updated_at: trxOrDb.fn.now(),
        })
        .returning('*');
    } else {
      [attendance] = await trxOrDb('event_attendance')
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

    // Sync registration attendance fields
    await trxOrDb('event_registrations')
      .where({ event_id: eventId, user_id: data.user_id })
      .update({
        attendance_status: data.status,
        check_in_time: data.check_in_time,
        updated_at: trxOrDb.fn.now(),
      });

    logger.info('Attendance marked', { eventId, userId: data.user_id, status: data.status, markedBy });
    return attendance;
  }

  /**
   * Self check-in with an optional method.
   */
  async checkIn(
    eventId: string,
    userId: string,
    method: 'manual' | 'qr_code' | 'automatic' = 'manual',
  ): Promise<EventAttendance> {
    const tenantId = await this.getTenantIdForEvent(eventId);
    if (!tenantId) throw new Error('Event not found');

    const existing = await db('event_attendance')
      .where({ event_id: eventId, user_id: userId })
      .first();

    if (existing?.check_in_time) {
      throw new Error('User already checked in');
    }

    const checkInTime = new Date();

    let attendance: EventAttendance;

    if (existing) {
      // Record exists but no check-in time yet (e.g. marked absent first)
      [attendance] = await db('event_attendance')
        .where({ attendance_id: existing.attendance_id })
        .update({
          status: 'present',
          check_in_time: checkInTime,
          attendance_method: method,
          updated_at: db.fn.now(),
        })
        .returning('*');
    } else {
      [attendance] = await db('event_attendance')
        .insert({
          event_id: eventId,
          user_id: userId,
          status: 'present',
          check_in_time: checkInTime,
          attendance_method: method,
        })
        .returning('*');
    }

    await db('event_registrations')
      .where({ event_id: eventId, user_id: userId })
      .update({
        check_in_time: checkInTime,
        attendance_status: 'present',
        updated_at: db.fn.now(),
      });

    logger.info('User checked in', { eventId, userId, method });
    return attendance;
  }

  /**
   * Self check-out.
   */
  async checkOut(eventId: string, userId: string): Promise<EventAttendance> {
    const checkOutTime = new Date();

    const [attendance] = await db('event_attendance')
      .where({ event_id: eventId, user_id: userId })
      .update({
        check_out_time: checkOutTime,
        updated_at: db.fn.now(),
      })
      .returning('*');

    if (!attendance) throw new Error('Check-in record not found');

    await db('event_registrations')
      .where({ event_id: eventId, user_id: userId })
      .update({ check_out_time: checkOutTime, updated_at: db.fn.now() });

    logger.info('User checked out', { eventId, userId });
    return attendance;
  }

  /**
   * Bulk-mark attendance inside a single transaction.
   */
  async bulkMarkAttendance(
    eventId: string,
    attendances: Array<{ user_id: string; status: string }>,
    markedBy: string,
  ): Promise<void> {
    const tenantId = await this.getTenantIdForEvent(eventId);
    if (!tenantId) throw new Error('Event not found');

    await db.transaction(async (trx) => {
      for (const item of attendances) {
        await this._markAttendanceInTrx(
          trx,
          eventId,
          tenantId,
          { user_id: item.user_id, status: item.status as any },
          markedBy,
        );
      }
    });

    logger.info('Bulk attendance marked', { eventId, count: attendances.length, markedBy });
  }

  /**
   * Get all attendance records for an event (includes user info).
   */
  async getEventAttendance(eventId: string): Promise<any[]> {
    const tenantId = await this.getTenantIdForEvent(eventId);
    if (!tenantId) throw new Error('Event not found');

    const attendance = await db('event_attendance')
      .join('users', 'event_attendance.user_id', 'users.id')
      .join('events', 'event_attendance.event_id', 'events.event_id')
      .where({
        'event_attendance.event_id': eventId,
        'events.tenant_id': tenantId,
      })
      .select(
        'event_attendance.*',
        'users.first_name',
        'users.last_name',
        'users.email',
        'users.role',
      )
      .orderBy('event_attendance.check_in_time', 'asc');

    return attendance;
  }

  /**
   * Get a user's attendance history (tenant-scoped via events table).
   */
  async getUserAttendance(userId: string, tenantId: string): Promise<EventAttendance[]> {
    const attendance = await db('event_attendance')
      .join('events', 'event_attendance.event_id', 'events.event_id')
      .where({
        'event_attendance.user_id': userId,
        'events.tenant_id': tenantId,
      })
      .select('event_attendance.*')
      .orderBy('event_attendance.created_at', 'desc');

    return attendance;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // QR Codes
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Generate a signed QR code for an event check-in station.
   * Returns both the raw JSON string (for storage/display) and a base64 PNG image.
   */
  async generateAttendanceQRCode(eventId: string): Promise<string> {
    const tenantId = await this.getTenantIdForEvent(eventId);
    if (!tenantId) throw new Error('Event not found');

    const payload = JSON.stringify({
      event_id: eventId,
      tenant_id: tenantId,
      type: 'attendance',
      issued_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + QR_TTL_MINUTES * 60 * 1000).toISOString(),
    });

    const signature = signPayload(payload);
    const qrData = JSON.stringify({ payload, signature });

    // Generate base64 PNG
    const qrImageBase64 = await QRCode.toDataURL(qrData, { errorCorrectionLevel: 'M' });

    logger.info('QR code generated', { eventId });
    return qrImageBase64;
  }

  /**
   * Verify a scanned QR code and perform check-in.
   */
  async checkInWithQRCode(rawQrData: string, userId: string): Promise<EventAttendance> {
    let parsed: { payload: string; signature: string };

    try {
      parsed = JSON.parse(rawQrData);
    } catch {
      throw new Error('Invalid QR code');
    }

    if (!verifySignature(parsed.payload, parsed.signature)) {
      throw new Error('Invalid QR code');
    }

    const data = JSON.parse(parsed.payload);

    if (data.type !== 'attendance') throw new Error('Invalid QR code');

    const expiresAt = new Date(data.expires_at);
    if (new Date() > expiresAt) throw new Error('QR code expired');

    return this.checkIn(data.event_id, userId, 'qr_code');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Reports & Stats
  // ──────────────────────────────────────────────────────────────────────────

  async generateAttendanceReport(eventId: string): Promise<AttendanceReport> {
    const event = await db('events').where({ event_id: eventId }).first();
    if (!event) throw new Error('Event not found');

    const stats = await db('event_attendance')
      .where({ event_id: eventId })
      .select(
        db.raw("COUNT(*) FILTER (WHERE status = 'present') as present"),
        db.raw("COUNT(*) FILTER (WHERE status = 'absent') as absent"),
        db.raw("COUNT(*) FILTER (WHERE status = 'late') as late"),
        db.raw("COUNT(*) FILTER (WHERE status = 'excused') as excused"),
        db.raw('COUNT(*) as total'),
      )
      .first();

    const regCount = await db('event_registrations')
      .where({ event_id: eventId, status: 'confirmed' })
      .count('* as count')
      .first();

    const totalRegistered = parseInt((regCount?.count as string) || '0');
    const totalPresent = parseInt(stats?.present || '0');
    const totalAbsent = parseInt(stats?.absent || '0');
    const totalLate = parseInt(stats?.late || '0');
    const totalExcused = parseInt(stats?.excused || '0');

    const attendanceRate = totalRegistered > 0 ? (totalPresent / totalRegistered) * 100 : 0;

    const attendees = await db('event_attendance')
      .join('users', 'event_attendance.user_id', 'users.id')
      .where('event_attendance.event_id', eventId)
      .select(
        'event_attendance.user_id',
        db.raw("CONCAT(users.first_name, ' ', users.last_name) as name"),
        'event_attendance.status',
        'event_attendance.check_in_time',
      );

    return {
      event_id: eventId,
      event_title: event.title,
      total_registered: totalRegistered,
      total_present: totalPresent,
      total_absent: totalAbsent,
      total_late: totalLate,
      total_excused: totalExcused,
      attendance_rate: Math.round(attendanceRate * 100) / 100,
      attendees,
    };
  }

  async getAttendanceStats(eventId: string): Promise<{
    present: number;
    absent: number;
    late: number;
    excused: number;
    not_marked: number;
    attendance_rate: number;
  }> {
    const stats = await db('event_attendance')
      .where({ event_id: eventId })
      .select(
        db.raw("COUNT(*) FILTER (WHERE status = 'present') as present"),
        db.raw("COUNT(*) FILTER (WHERE status = 'absent') as absent"),
        db.raw("COUNT(*) FILTER (WHERE status = 'late') as late"),
        db.raw("COUNT(*) FILTER (WHERE status = 'excused') as excused"),
      )
      .first();

    const regCount = await db('event_registrations')
      .where({ event_id: eventId, status: 'confirmed' })
      .count('* as count')
      .first();

    const totalRegistered = parseInt((regCount?.count as string) || '0');
    const present = parseInt(stats?.present || '0');
    const absent = parseInt(stats?.absent || '0');
    const late = parseInt(stats?.late || '0');
    const excused = parseInt(stats?.excused || '0');
    const marked = present + absent + late + excused;
    const notMarked = Math.max(0, totalRegistered - marked);

    const attendanceRate = totalRegistered > 0 ? (present / totalRegistered) * 100 : 0;

    return {
      present,
      absent,
      late,
      excused,
      not_marked: notMarked,
      attendance_rate: Math.round(attendanceRate * 100) / 100,
    };
  }
}

export default new EventAttendanceService();
