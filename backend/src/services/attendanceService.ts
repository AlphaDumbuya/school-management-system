import { Knex } from 'knex';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

export interface AttendanceData {
  student_id: string;
  class_id: string;
  academic_session_id: string;
  attendance_date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  remarks?: string;
}

export class AttendanceService {
  constructor(private db: Knex) {}

  /**
   * Record attendance
   */
  async recordAttendance(data: AttendanceData, userId: string): Promise<any> {
    const { student_id, class_id, academic_session_id, attendance_date, status, remarks } = data;

    // Validate required fields
    if (!student_id || !class_id || !academic_session_id || !attendance_date || !status) {
      throw new AppError('Missing required attendance fields', 400, 'VALIDATION_ERROR');
    }

    // Validate status
    const validStatuses = ['present', 'absent', 'late', 'excused'];
    if (!validStatuses.includes(status)) {
      throw new AppError('Invalid attendance status', 400, 'VALIDATION_ERROR');
    }

    // Check if student is enrolled
    const enrollment = await this.db('enrollments')
      .where('student_id', student_id)
      .where('class_id', class_id)
      .where('academic_session_id', academic_session_id)
      .where('status', 'active')
      .first();

    if (!enrollment) {
      throw new AppError('Student is not enrolled in this class', 400, 'INVALID_STATE');
    }

    // Check for duplicate attendance record
    const existingRecord = await this.db('attendance')
      .where('student_id', student_id)
      .where('class_id', class_id)
      .where('academic_session_id', academic_session_id)
      .where('attendance_date', attendance_date)
      .first();

    if (existingRecord) {
      throw new AppError('Attendance already recorded for this date', 409, 'CONFLICT');
    }

    // Record attendance
    const [recordId] = await this.db('attendance').insert({
      student_id,
      class_id,
      academic_session_id,
      attendance_date,
      status,
      remarks,
      recorded_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    logger.info(`Attendance recorded: ${recordId} (Student: ${student_id}, Status: ${status})`);

    return this.getAttendanceById(recordId);
  }

  /**
   * Get attendance by ID
   */
  async getAttendanceById(recordId: string): Promise<any> {
    const record = await this.db('attendance')
      .select('*')
      .where('id', recordId)
      .first();

    if (!record) {
      throw new AppError('Attendance record not found', 404, 'NOT_FOUND');
    }

    return record;
  }

  /**
   * Get student attendance
   */
  async getStudentAttendance(
    studentId: string,
    filters?: { class_id?: string; academic_session_id?: string; page?: number; limit?: number }
  ): Promise<any> {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 20, 100);
    const offset = (page - 1) * limit;

    let query = this.db('attendance').where('student_id', studentId);

    if (filters?.class_id) {
      query = query.where('class_id', filters.class_id);
    }

    if (filters?.academic_session_id) {
      query = query.where('academic_session_id', filters.academic_session_id);
    }

    const countResult = await query.clone().count('* as count').first();
    const total = countResult.count;

    const records = await query
      .orderBy('attendance_date', 'desc')
      .limit(limit)
      .offset(offset);

    return {
      data: records,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get class attendance for a date
   */
  async getClassAttendanceForDate(
    classId: string,
    academicSessionId: string,
    attendanceDate: string
  ): Promise<any[]> {
    return this.db('attendance')
      .select('attendance.*', 'students.first_name', 'students.last_name', 'students.student_id')
      .innerJoin('students', 'attendance.student_id', 'students.id')
      .where('attendance.class_id', classId)
      .where('attendance.academic_session_id', academicSessionId)
      .where('attendance.attendance_date', attendanceDate)
      .orderBy('students.first_name', 'asc');
  }

  /**
   * Calculate attendance percentage for student
   */
  async calculateAttendancePercentage(
    studentId: string,
    classId: string,
    academicSessionId: string
  ): Promise<any> {
    const result = await this.db('attendance')
      .where('student_id', studentId)
      .where('class_id', classId)
      .where('academic_session_id', academicSessionId)
      .select('status')
      .count('* as total')
      .first();

    const totalDays = result.total || 0;

    if (totalDays === 0) {
      return {
        student_id: studentId,
        class_id: classId,
        academic_session_id: academicSessionId,
        total_days: 0,
        present_days: 0,
        absent_days: 0,
        late_days: 0,
        excused_days: 0,
        attendance_percentage: 0,
      };
    }

    const presentDays = await this.db('attendance')
      .where('student_id', studentId)
      .where('class_id', classId)
      .where('academic_session_id', academicSessionId)
      .where('status', 'present')
      .count('* as count')
      .first();

    const absentDays = await this.db('attendance')
      .where('student_id', studentId)
      .where('class_id', classId)
      .where('academic_session_id', academicSessionId)
      .where('status', 'absent')
      .count('* as count')
      .first();

    const lateDays = await this.db('attendance')
      .where('student_id', studentId)
      .where('class_id', classId)
      .where('academic_session_id', academicSessionId)
      .where('status', 'late')
      .count('* as count')
      .first();

    const excusedDays = await this.db('attendance')
      .where('student_id', studentId)
      .where('class_id', classId)
      .where('academic_session_id', academicSessionId)
      .where('status', 'excused')
      .count('* as count')
      .first();

    const percentage = ((presentDays.count + lateDays.count) / totalDays * 100).toFixed(2);

    return {
      student_id: studentId,
      class_id: classId,
      academic_session_id: academicSessionId,
      total_days: totalDays,
      present_days: presentDays.count,
      absent_days: absentDays.count,
      late_days: lateDays.count,
      excused_days: excusedDays.count,
      attendance_percentage: parseFloat(percentage),
    };
  }

  /**
   * Get class attendance summary
   */
  async getClassAttendanceSummary(
    classId: string,
    academicSessionId: string
  ): Promise<any> {
    const records = await this.db('attendance')
      .where('class_id', classId)
      .where('academic_session_id', academicSessionId);

    const presentCount = records.filter(r => r.status === 'present').length;
    const absentCount = records.filter(r => r.status === 'absent').length;
    const lateCount = records.filter(r => r.status === 'late').length;
    const excusedCount = records.filter(r => r.status === 'excused').length;

    return {
      class_id: classId,
      academic_session_id: academicSessionId,
      total_records: records.length,
      present_count: presentCount,
      absent_count: absentCount,
      late_count: lateCount,
      excused_count: excusedCount,
      average_attendance_percentage:
        records.length > 0 ?
          (((presentCount + lateCount) / records.length) * 100).toFixed(2) :
          0,
    };
  }

  /**
   * Update attendance
   */
  async updateAttendance(
    recordId: string,
    data: { status?: string; remarks?: string },
    userId: string
  ): Promise<any> {
    const record = await this.getAttendanceById(recordId);

    const updateData: any = { updated_at: new Date() };

    if (data.status) {
      const validStatuses = ['present', 'absent', 'late', 'excused'];
      if (!validStatuses.includes(data.status)) {
        throw new AppError('Invalid attendance status', 400, 'VALIDATION_ERROR');
      }
      updateData.status = data.status;
    }

    if (data.remarks !== undefined) {
      updateData.remarks = data.remarks;
    }

    await this.db('attendance').where('id', recordId).update(updateData);

    logger.info(`Attendance updated: ${recordId}`);

    return this.getAttendanceById(recordId);
  }

  /**
   * Generate attendance report
   */
  async generateAttendanceReport(
    classId: string,
    academicSessionId: string,
    startDate?: string,
    endDate?: string
  ): Promise<any> {
    let query = this.db('attendance')
      .select(
        'attendance.*',
        'students.first_name',
        'students.last_name',
        'students.student_id'
      )
      .innerJoin('students', 'attendance.student_id', 'students.id')
      .where('attendance.class_id', classId)
      .where('attendance.academic_session_id', academicSessionId);

    if (startDate) {
      query = query.where('attendance.attendance_date', '>=', startDate);
    }

    if (endDate) {
      query = query.where('attendance.attendance_date', '<=', endDate);
    }

    const records = await query.orderBy('students.first_name', 'asc');

    // Group by student
    const studentAttendance: Record<string, any> = {};
    for (const record of records) {
      if (!studentAttendance[record.student_id]) {
        studentAttendance[record.student_id] = {
          student_id: record.student_id,
          first_name: record.first_name,
          last_name: record.last_name,
          records: [],
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
        };
      }

      studentAttendance[record.student_id].records.push(record);
      studentAttendance[record.student_id].total++;

      if (record.status === 'present') {
        studentAttendance[record.student_id].present++;
      } else if (record.status === 'absent') {
        studentAttendance[record.student_id].absent++;
      } else if (record.status === 'late') {
        studentAttendance[record.student_id].late++;
      } else if (record.status === 'excused') {
        studentAttendance[record.student_id].excused++;
      }
    }

    return {
      class_id: classId,
      academic_session_id: academicSessionId,
      start_date: startDate,
      end_date: endDate,
      student_attendance: Object.values(studentAttendance),
      generated_at: new Date(),
    };
  }
}
