import { Knex } from 'knex';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

export interface EnrollmentRequestData {
  student_id: string;
  class_id: string;
  academic_session_id: string;
  reason_for_request?: string;
}

export interface EnrollmentRequestUpdate {
  status: 'approved' | 'rejected';
  rejection_reason?: string;
  reviewed_by: string;
}

export class EnrollmentRequestService {
  constructor(private db: Knex) {}

  /**
   * Submit an enrollment request
   */
  async submitEnrollmentRequest(data: EnrollmentRequestData, userId: string): Promise<any> {
    const { student_id, class_id, academic_session_id, reason_for_request } = data;

    // Validate required fields
    if (!student_id || !class_id || !academic_session_id) {
      throw new AppError('Missing required enrollment request fields', 400, 'VALIDATION_ERROR');
    }

    // Check if student exists
    const student = await this.db('students').where('id', student_id).first();
    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    // Check if class exists
    const classRecord = await this.db('classes').where('id', class_id).first();
    if (!classRecord) {
      throw new AppError('Class not found', 404, 'NOT_FOUND');
    }

    // Check if academic session exists
    const session = await this.db('academic_sessions').where('id', academic_session_id).first();
    if (!session) {
      throw new AppError('Academic session not found', 404, 'NOT_FOUND');
    }

    // Check if student is already enrolled in this class
    const existingEnrollment = await this.db('enrollments')
      .where('student_id', student_id)
      .where('class_id', class_id)
      .where('academic_session_id', academic_session_id)
      .where('status', 'active')
      .first();

    if (existingEnrollment) {
      throw new AppError('Student is already enrolled in this class', 409, 'CONFLICT');
    }

    // Check if there's already a pending request
    const pendingRequest = await this.db('enrollment_requests')
      .where('student_id', student_id)
      .where('class_id', class_id)
      .where('academic_session_id', academic_session_id)
      .where('status', 'pending')
      .first();

    if (pendingRequest) {
      throw new AppError('A pending enrollment request already exists for this student and class', 409, 'CONFLICT');
    }

    // Check class capacity
    const enrollmentCount = await this.db('enrollments')
      .where('class_id', class_id)
      .where('academic_session_id', academic_session_id)
      .where('status', 'active')
      .count('* as count')
      .first();

    if (enrollmentCount.count >= classRecord.capacity) {
      throw new AppError(`Class is at full capacity (${classRecord.capacity} students)`, 409, 'CONFLICT');
    }

    // Create enrollment request
    const [requestId] = await this.db('enrollment_requests').insert({
      student_id,
      class_id,
      academic_session_id,
      reason_for_request,
      requested_by: userId,
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Log the action
    await this.logAuditTrail({
      entity_type: 'enrollment_request',
      entity_id: requestId,
      action: 'create',
      performed_by: userId,
      new_values: { student_id, class_id, academic_session_id, reason_for_request },
      reason: `Enrollment request submitted for student ${student_id} to class ${class_id}`,
      source: 'api',
    });

    logger.info(`Enrollment request created: ${requestId} (Student: ${student_id}, Class: ${class_id})`);

    return this.getEnrollmentRequestById(requestId);
  }

  /**
   * Get enrollment request by ID
   */
  async getEnrollmentRequestById(requestId: string): Promise<any> {
    const request = await this.db('enrollment_requests')
      .select('*')
      .where('id', requestId)
      .first();

    if (!request) {
      throw new AppError('Enrollment request not found', 404, 'NOT_FOUND');
    }

    return request;
  }

  /**
   * Get all enrollment requests with filtering
   */
  async getEnrollmentRequests(
    filters?: {
      status?: string;
      student_id?: string;
      class_id?: string;
      academic_session_id?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<any> {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 20, 100);
    const offset = (page - 1) * limit;

    let query = this.db('enrollment_requests');

    // Apply filters
    if (filters?.status) {
      query = query.where('status', filters.status);
    }

    if (filters?.student_id) {
      query = query.where('student_id', filters.student_id);
    }

    if (filters?.class_id) {
      query = query.where('class_id', filters.class_id);
    }

    if (filters?.academic_session_id) {
      query = query.where('academic_session_id', filters.academic_session_id);
    }

    // Get total count
    const countResult = await query.clone().count('* as count').first();
    const total = countResult.count;

    // Get paginated results
    const requests = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return {
      data: requests,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Approve an enrollment request
   */
  async approveEnrollmentRequest(requestId: string, reviewedBy: string): Promise<any> {
    const request = await this.getEnrollmentRequestById(requestId);

    if (request.status !== 'pending') {
      throw new AppError(`Cannot approve request with status: ${request.status}`, 400, 'INVALID_STATE');
    }

    // Check capacity again before approval
    const enrollmentCount = await this.db('enrollments')
      .where('class_id', request.class_id)
      .where('academic_session_id', request.academic_session_id)
      .where('status', 'active')
      .count('* as count')
      .first();

    const classRecord = await this.db('classes').where('id', request.class_id).first();

    if (enrollmentCount.count >= classRecord.capacity) {
      throw new AppError('Class is now at full capacity. Cannot approve this request.', 409, 'CONFLICT');
    }

    // Update request status
    await this.db('enrollment_requests')
      .where('id', requestId)
      .update({
        status: 'approved',
        reviewed_by: reviewedBy,
        reviewed_at: new Date(),
        updated_at: new Date(),
      });

    // Create corresponding enrollment
    const [enrollmentId] = await this.db('enrollments').insert({
      student_id: request.student_id,
      class_id: request.class_id,
      academic_session_id: request.academic_session_id,
      enrollment_request_id: requestId,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Log the action
    await this.logAuditTrail({
      entity_type: 'enrollment_request',
      entity_id: requestId,
      action: 'approve',
      performed_by: reviewedBy,
      new_values: { status: 'approved', enrollment_id: enrollmentId },
      reason: `Enrollment request approved`,
      source: 'api',
    });

    // Update notification flag
    await this.db('enrollment_requests')
      .where('id', requestId)
      .update({
        notification_sent: true,
        notification_sent_at: new Date(),
      });

    logger.info(`Enrollment request approved: ${requestId}, Enrollment created: ${enrollmentId}`);

    return this.getEnrollmentRequestById(requestId);
  }

  /**
   * Reject an enrollment request
   */
  async rejectEnrollmentRequest(requestId: string, rejectionReason: string, reviewedBy: string): Promise<any> {
    const request = await this.getEnrollmentRequestById(requestId);

    if (request.status !== 'pending') {
      throw new AppError(`Cannot reject request with status: ${request.status}`, 400, 'INVALID_STATE');
    }

    if (!rejectionReason) {
      throw new AppError('Rejection reason is required', 400, 'VALIDATION_ERROR');
    }

    // Update request status
    await this.db('enrollment_requests')
      .where('id', requestId)
      .update({
        status: 'rejected',
        rejection_reason: rejectionReason,
        reviewed_by: reviewedBy,
        reviewed_at: new Date(),
        updated_at: new Date(),
      });

    // Log the action
    await this.logAuditTrail({
      entity_type: 'enrollment_request',
      entity_id: requestId,
      action: 'reject',
      performed_by: reviewedBy,
      new_values: { status: 'rejected', rejection_reason: rejectionReason },
      reason: `Enrollment request rejected: ${rejectionReason}`,
      source: 'api',
    });

    // Update notification flag
    await this.db('enrollment_requests')
      .where('id', requestId)
      .update({
        notification_sent: true,
        notification_sent_at: new Date(),
      });

    logger.info(`Enrollment request rejected: ${requestId}`);

    return this.getEnrollmentRequestById(requestId);
  }

  /**
   * Cancel an enrollment request
   */
  async cancelEnrollmentRequest(requestId: string, userId: string): Promise<any> {
    const request = await this.getEnrollmentRequestById(requestId);

    if (request.status !== 'pending') {
      throw new AppError(`Cannot cancel request with status: ${request.status}`, 400, 'INVALID_STATE');
    }

    // Update request status
    await this.db('enrollment_requests')
      .where('id', requestId)
      .update({
        status: 'cancelled',
        updated_at: new Date(),
      });

    // Log the action
    await this.logAuditTrail({
      entity_type: 'enrollment_request',
      entity_id: requestId,
      action: 'cancel',
      performed_by: userId,
      new_values: { status: 'cancelled' },
      reason: `Enrollment request cancelled`,
      source: 'api',
    });

    logger.info(`Enrollment request cancelled: ${requestId}`);

    return this.getEnrollmentRequestById(requestId);
  }

  /**
   * Get pending requests for a class
   */
  async getPendingRequestsForClass(classId: string, academicSessionId: string): Promise<any> {
    const requests = await this.db('enrollment_requests')
      .select('*')
      .where('class_id', classId)
      .where('academic_session_id', academicSessionId)
      .where('status', 'pending')
      .orderBy('created_at', 'asc');

    return requests;
  }

  /**
   * Get enrollment requests for a student
   */
  async getStudentEnrollmentRequests(studentId: string): Promise<any> {
    const requests = await this.db('enrollment_requests')
      .select('*')
      .where('student_id', studentId)
      .orderBy('created_at', 'desc');

    return requests;
  }

  /**
   * Log audit trail entry
   */
  private async logAuditTrail(data: {
    entity_type: string;
    entity_id: string;
    action: string;
    performed_by?: string;
    old_values?: any;
    new_values?: any;
    reason?: string;
    source?: string;
  }): Promise<void> {
    try {
      await this.db('audit_logs').insert({
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        action: data.action,
        performed_by: data.performed_by,
        old_values: data.old_values,
        new_values: data.new_values,
        reason: data.reason,
        source: data.source || 'api',
        created_at: new Date(),
      });
    } catch (error) {
      logger.error('Failed to log audit trail:', error);
      // Don't throw - audit logging shouldn't fail the main operation
    }
  }
}
