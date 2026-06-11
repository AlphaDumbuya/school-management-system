import { Knex } from 'knex';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

export interface ScheduleData {
  class_id: string;
  subject_id: string;
  teacher_id: string;
  day_of_week: number; // 0-6 (Monday-Sunday)
  start_time: string; // HH:mm format
  end_time: string; // HH:mm format
  room_number?: string;
  academic_session_id: string;
}

export class ScheduleService {
  constructor(private db: Knex) {}

  /**
   * Create schedule entry
   */
  async createSchedule(data: ScheduleData, userId: string): Promise<any> {
    const { class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room_number, academic_session_id } = data;

    // Validate required fields
    if (!class_id || !subject_id || !teacher_id || day_of_week === undefined || !start_time || !end_time || !academic_session_id) {
      throw new AppError('Missing required schedule fields', 400, 'VALIDATION_ERROR');
    }

    // Validate day of week (0-6)
    if (day_of_week < 0 || day_of_week > 6) {
      throw new AppError('Day of week must be 0-6 (Monday-Sunday)', 400, 'VALIDATION_ERROR');
    }

    // Validate time format and sequence
    if (!this.isValidTimeFormat(start_time) || !this.isValidTimeFormat(end_time)) {
      throw new AppError('Time must be in HH:mm format', 400, 'VALIDATION_ERROR');
    }

    if (start_time >= end_time) {
      throw new AppError('Start time must be before end time', 400, 'VALIDATION_ERROR');
    }

    // Check for conflicts
    const conflicts = await this.checkScheduleConflicts(
      class_id,
      teacher_id,
      day_of_week,
      start_time,
      end_time,
      academic_session_id
    );

    if (conflicts.length > 0) {
      throw new AppError(`Schedule conflict detected: ${conflicts[0].reason}`, 409, 'CONFLICT');
    }

    // Create schedule
    const [scheduleId] = await this.db('schedules').insert({
      class_id,
      subject_id,
      teacher_id,
      day_of_week,
      start_time,
      end_time,
      room_number,
      academic_session_id,
      created_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    logger.info(`Schedule created: ${scheduleId}`);

    return this.getScheduleById(scheduleId);
  }

  /**
   * Get schedule by ID
   */
  async getScheduleById(scheduleId: string): Promise<any> {
    const schedule = await this.db('schedules')
      .select(
        'schedules.*',
        'subjects.name as subject_name',
        'teachers.id as teacher_id',
        'classes.name as class_name'
      )
      .leftJoin('subjects', 'schedules.subject_id', 'subjects.id')
      .leftJoin('teachers', 'schedules.teacher_id', 'teachers.id')
      .leftJoin('classes', 'schedules.class_id', 'classes.id')
      .where('schedules.id', scheduleId)
      .first();

    if (!schedule) {
      throw new AppError('Schedule not found', 404, 'NOT_FOUND');
    }

    return schedule;
  }

  /**
   * Get class schedule
   */
  async getClassSchedule(classId: string, academicSessionId: string): Promise<any[]> {
    return this.db('schedules')
      .select(
        'schedules.*',
        'subjects.name as subject_name',
        'teachers.first_name',
        'teachers.last_name',
        'classes.name as class_name'
      )
      .leftJoin('subjects', 'schedules.subject_id', 'subjects.id')
      .leftJoin('teachers', 'schedules.teacher_id', 'teachers.id')
      .leftJoin('classes', 'schedules.class_id', 'classes.id')
      .where('schedules.class_id', classId)
      .where('schedules.academic_session_id', academicSessionId)
      .orderBy('schedules.day_of_week', 'asc')
      .orderBy('schedules.start_time', 'asc');
  }

  /**
   * Get teacher schedule
   */
  async getTeacherSchedule(teacherId: string, academicSessionId: string): Promise<any[]> {
    return this.db('schedules')
      .select(
        'schedules.*',
        'subjects.name as subject_name',
        'classes.name as class_name'
      )
      .leftJoin('subjects', 'schedules.subject_id', 'subjects.id')
      .leftJoin('classes', 'schedules.class_id', 'classes.id')
      .where('schedules.teacher_id', teacherId)
      .where('schedules.academic_session_id', academicSessionId)
      .orderBy('schedules.day_of_week', 'asc')
      .orderBy('schedules.start_time', 'asc');
  }

  /**
   * Get schedule for a specific day
   */
  async getScheduleForDay(classId: string, dayOfWeek: number, academicSessionId: string): Promise<any[]> {
    return this.db('schedules')
      .select(
        'schedules.*',
        'subjects.name as subject_name',
        'teachers.first_name',
        'teachers.last_name'
      )
      .leftJoin('subjects', 'schedules.subject_id', 'subjects.id')
      .leftJoin('teachers', 'schedules.teacher_id', 'teachers.id')
      .where('schedules.class_id', classId)
      .where('schedules.day_of_week', dayOfWeek)
      .where('schedules.academic_session_id', academicSessionId)
      .orderBy('schedules.start_time', 'asc');
  }

  /**
   * Check for scheduling conflicts
   */
  private async checkScheduleConflicts(
    classId: string,
    teacherId: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    academicSessionId: string
  ): Promise<any[]> {
    const conflicts = [];

    // Check class conflicts
    const classConflict = await this.db('schedules')
      .where('class_id', classId)
      .where('day_of_week', dayOfWeek)
      .where('academic_session_id', academicSessionId)
      .where((builder) => {
        builder
          .where((b) => b.where('start_time', '<', endTime).where('end_time', '>', startTime));
      })
      .first();

    if (classConflict) {
      conflicts.push({ reason: 'Class already has a schedule at this time' });
    }

    // Check teacher conflicts
    const teacherConflict = await this.db('schedules')
      .where('teacher_id', teacherId)
      .where('day_of_week', dayOfWeek)
      .where('academic_session_id', academicSessionId)
      .where((builder) => {
        builder
          .where((b) => b.where('start_time', '<', endTime).where('end_time', '>', startTime));
      })
      .first();

    if (teacherConflict) {
      conflicts.push({ reason: 'Teacher already has a schedule at this time' });
    }

    return conflicts;
  }

  /**
   * Update schedule
   */
  async updateSchedule(scheduleId: string, data: Partial<ScheduleData>, userId: string): Promise<any> {
    const schedule = await this.getScheduleById(scheduleId);

    const updateData: any = { updated_at: new Date() };

    if (data.start_time || data.end_time) {
      const startTime = data.start_time || schedule.start_time;
      const endTime = data.end_time || schedule.end_time;

      if (startTime >= endTime) {
        throw new AppError('Start time must be before end time', 400, 'VALIDATION_ERROR');
      }

      // Check conflicts
      const conflicts = await this.checkScheduleConflicts(
        schedule.class_id,
        schedule.teacher_id,
        schedule.day_of_week,
        startTime,
        endTime,
        schedule.academic_session_id
      );

      if (conflicts.length > 0) {
        throw new AppError('Schedule conflict detected', 409, 'CONFLICT');
      }

      if (data.start_time) updateData.start_time = data.start_time;
      if (data.end_time) updateData.end_time = data.end_time;
    }

    if (data.room_number) updateData.room_number = data.room_number;

    await this.db('schedules').where('id', scheduleId).update(updateData);

    logger.info(`Schedule updated: ${scheduleId}`);

    return this.getScheduleById(scheduleId);
  }

  /**
   * Delete schedule
   */
  async deleteSchedule(scheduleId: string): Promise<void> {
    await this.db('schedules').where('id', scheduleId).del();

    logger.info(`Schedule deleted: ${scheduleId}`);
  }

  /**
   * Publish schedule
   */
  async publishSchedule(classId: string, academicSessionId: string, userId: string): Promise<any> {
    const schedules = await this.db('schedules')
      .where('class_id', classId)
      .where('academic_session_id', academicSessionId);

    if (schedules.length === 0) {
      throw new AppError('No schedules to publish', 400, 'INVALID_STATE');
    }

    // Update publication status
    await this.db('schedules')
      .where('class_id', classId)
      .where('academic_session_id', academicSessionId)
      .update({
        is_published: true,
        published_at: new Date(),
        published_by: userId,
        updated_at: new Date(),
      });

    logger.info(`Schedule published for class ${classId}`);

    return {
      class_id: classId,
      academic_session_id: academicSessionId,
      schedules_count: schedules.length,
      published_at: new Date(),
    };
  }

  /**
   * Validate time format HH:mm
   */
  private isValidTimeFormat(time: string): boolean {
    const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(time);
  }

  /**
   * Get full weekly schedule for class
   */
  async getWeeklySchedule(classId: string, academicSessionId: string): Promise<any> {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const weeklySchedule: Record<string, any> = {};

    for (let day = 0; day < 7; day++) {
      const schedule = await this.getScheduleForDay(classId, day, academicSessionId);
      weeklySchedule[days[day]] = schedule;
    }

    return weeklySchedule;
  }

  /**
   * Get schedule report for academic session
   */
  async getScheduleReport(academicSessionId: string): Promise<any> {
    const schedules = await this.db('schedules')
      .select(
        'schedules.*',
        'classes.name as class_name',
        'subjects.name as subject_name',
        'teachers.first_name',
        'teachers.last_name'
      )
      .leftJoin('classes', 'schedules.class_id', 'classes.id')
      .leftJoin('subjects', 'schedules.subject_id', 'subjects.id')
      .leftJoin('teachers', 'schedules.teacher_id', 'teachers.id')
      .where('schedules.academic_session_id', academicSessionId)
      .orderBy('schedules.class_id')
      .orderBy('schedules.day_of_week')
      .orderBy('schedules.start_time');

    const publishedCount = schedules.filter(s => s.is_published).length;

    return {
      academic_session_id: academicSessionId,
      total_schedules: schedules.length,
      published_schedules: publishedCount,
      pending_schedules: schedules.length - publishedCount,
      schedules,
      generated_at: new Date(),
    };
  }
}
