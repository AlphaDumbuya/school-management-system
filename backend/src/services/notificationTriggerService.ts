import { logger } from '@utils/logger';
import db from '@utils/database';
import notificationService from './notificationService';
import notificationPreferenceService from './notificationPreferenceService';

export interface NotificationTriggerConfig {
  id: string;
  triggerName: string;
  triggerType: string; // 'grade', 'attendance', 'payment', 'schedule', 'enrollment'
  isActive: boolean;
  config: Record<string, any>;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

class NotificationTriggerService {
  /**
   * Fire grade entry trigger
   */
  async fireGradeTrigger(gradeData: {
    studentId: string;
    teacherId: string;
    subjectId: string;
    grade: number;
    subject?: string;
    className?: string;
  }): Promise<void> {
    try {
      const trigger = await this.getTriggerByType('grade');
      if (!trigger?.isActive) {
        logger.info('Grade trigger is not active');
        return;
      }

      // Get student's user ID and parents
      const student = await db('users').where({ id: gradeData.studentId }).first();
      if (!student) return;

      // Get student's guardians/parents
      const guardians = await db('guardians')
        .where({ studentId: gradeData.studentId })
        .select('userId');

      const recipients = [gradeData.studentId, ...guardians.map((g: any) => g.userId)];

      for (const recipientId of recipients) {
        // Check preferences
        const shouldSendEmail = await notificationPreferenceService.shouldReceiveNotification(
          recipientId,
          'grade',
          'email'
        );
        const shouldSendInApp = await notificationPreferenceService.shouldReceiveNotification(
          recipientId,
          'grade',
          'in_app'
        );

        // Create notifications
        const channels = [];
        if (shouldSendEmail) channels.push('email');
        if (shouldSendInApp) channels.push('in_app');

        if (channels.length > 0) {
          await notificationService.createNotification({
            notificationType: 'grade',
            recipientId,
            subject: `New Grade Posted in ${gradeData.subject || 'Subject'}`,
            message: `A new grade of ${gradeData.grade}/100 has been posted in ${gradeData.subject} class for ${gradeData.className}.`,
            data: {
              studentId: gradeData.studentId,
              grade: gradeData.grade,
              subject: gradeData.subject,
              className: gradeData.className,
            },
            channels,
            sourceType: 'grade',
            sourceId: gradeData.subjectId,
          });
        }
      }

      logger.info(`Grade notification trigger fired for student: ${gradeData.studentId}`);
    } catch (error) {
      logger.error(`Error firing grade trigger: ${error}`);
    }
  }

  /**
   * Fire attendance trigger
   */
  async fireAttendanceTrigger(attendanceData: {
    studentId: string;
    status: string; // 'present', 'absent', 'late'
    classId: string;
    className?: string;
    date?: string;
  }): Promise<void> {
    try {
      const trigger = await this.getTriggerByType('attendance');
      if (!trigger?.isActive) {
        logger.info('Attendance trigger is not active');
        return;
      }

      // Only send notification for absent or late
      if (attendanceData.status === 'present') {
        return;
      }

      // Get student's guardians/parents
      const guardians = await db('guardians')
        .where({ studentId: attendanceData.studentId })
        .select('userId');

      const recipients = [attendanceData.studentId, ...guardians.map((g: any) => g.userId)];

      for (const recipientId of recipients) {
        const shouldSendEmail = await notificationPreferenceService.shouldReceiveNotification(
          recipientId,
          'attendance',
          'email'
        );
        const shouldSendInApp = await notificationPreferenceService.shouldReceiveNotification(
          recipientId,
          'attendance',
          'in_app'
        );

        const channels = [];
        if (shouldSendEmail) channels.push('email');
        if (shouldSendInApp) channels.push('in_app');

        if (channels.length > 0) {
          const statusText = attendanceData.status === 'absent' ? 'Absence Recorded' : 'Late Arrival Recorded';
          
          await notificationService.createNotification({
            notificationType: 'attendance',
            recipientId,
            subject: statusText,
            message: `${statusText} for ${attendanceData.className} on ${attendanceData.date || new Date().toLocaleDateString()}.`,
            data: {
              studentId: attendanceData.studentId,
              status: attendanceData.status,
              classId: attendanceData.classId,
              className: attendanceData.className,
              date: attendanceData.date,
            },
            channels,
            sourceType: 'attendance',
            sourceId: attendanceData.classId,
          });
        }
      }

      logger.info(`Attendance notification trigger fired for student: ${attendanceData.studentId}`);
    } catch (error) {
      logger.error(`Error firing attendance trigger: ${error}`);
    }
  }

  /**
   * Fire payment trigger
   */
  async firePaymentTrigger(paymentData: {
    studentId: string;
    amount: number;
    paymentMethod?: string;
    transactionRef?: string;
    type: 'payment_received' | 'payment_reminder' | 'payment_overdue';
  }): Promise<void> {
    try {
      const trigger = await this.getTriggerByType('payment');
      if (!trigger?.isActive) {
        logger.info('Payment trigger is not active');
        return;
      }

      // Get student's guardians/parents
      const guardians = await db('guardians')
        .where({ studentId: paymentData.studentId })
        .select('userId');

      const recipients = [paymentData.studentId, ...guardians.map((g: any) => g.userId)];

      for (const recipientId of recipients) {
        const shouldSendEmail = await notificationPreferenceService.shouldReceiveNotification(
          recipientId,
          'payment',
          'email'
        );
        const shouldSendInApp = await notificationPreferenceService.shouldReceiveNotification(
          recipientId,
          'payment',
          'in_app'
        );

        const channels = [];
        if (shouldSendEmail) channels.push('email');
        if (shouldSendInApp) channels.push('in_app');

        if (channels.length > 0) {
          let subject = '';
          let message = '';

          switch (paymentData.type) {
            case 'payment_received':
              subject = 'Payment Received';
              message = `Payment of ${paymentData.amount} received via ${paymentData.paymentMethod || 'online'}. Transaction ref: ${paymentData.transactionRef}`;
              break;
            case 'payment_reminder':
              subject = 'Payment Reminder';
              message = `Reminder: Payment of ${paymentData.amount} is due. Please make payment to avoid late fees.`;
              break;
            case 'payment_overdue':
              subject = 'Payment Overdue';
              message = `Payment of ${paymentData.amount} is now overdue. Late fees may apply.`;
              break;
          }

          await notificationService.createNotification({
            notificationType: 'payment',
            recipientId,
            subject,
            message,
            data: {
              studentId: paymentData.studentId,
              amount: paymentData.amount,
              type: paymentData.type,
              paymentMethod: paymentData.paymentMethod,
            },
            channels,
            sourceType: 'payment',
            sourceId: paymentData.studentId,
          });
        }
      }

      logger.info(`Payment notification trigger fired for student: ${paymentData.studentId}`);
    } catch (error) {
      logger.error(`Error firing payment trigger: ${error}`);
    }
  }

  /**
   * Fire schedule change trigger
   */
  async fireScheduleTrigger(scheduleData: {
    scheduleId: string;
    classId: string;
    className?: string;
    changeType: 'created' | 'updated' | 'cancelled';
    changeDescription?: string;
  }): Promise<void> {
    try {
      const trigger = await this.getTriggerByType('schedule');
      if (!trigger?.isActive) {
        logger.info('Schedule trigger is not active');
        return;
      }

      // Get all students in the class
      const enrollments = await db('enrollments')
        .where({ classId: scheduleData.classId })
        .select('studentId');

      const recipientIds = enrollments.map((e: any) => e.studentId);

      for (const recipientId of recipientIds) {
        const shouldSendEmail = await notificationPreferenceService.shouldReceiveNotification(
          recipientId,
          'schedule',
          'email'
        );
        const shouldSendInApp = await notificationPreferenceService.shouldReceiveNotification(
          recipientId,
          'schedule',
          'in_app'
        );

        const channels = [];
        if (shouldSendEmail) channels.push('email');
        if (shouldSendInApp) channels.push('in_app');

        if (channels.length > 0) {
          let subject = '';
          
          switch (scheduleData.changeType) {
            case 'created':
              subject = 'New Class Schedule';
              break;
            case 'updated':
              subject = 'Schedule Update';
              break;
            case 'cancelled':
              subject = 'Class Cancelled';
              break;
          }

          await notificationService.createNotification({
            notificationType: 'schedule',
            recipientId,
            subject,
            message: `Schedule change for ${scheduleData.className}: ${scheduleData.changeDescription || subject}`,
            data: {
              scheduleId: scheduleData.scheduleId,
              classId: scheduleData.classId,
              className: scheduleData.className,
              changeType: scheduleData.changeType,
            },
            channels,
            sourceType: 'schedule',
            sourceId: scheduleData.scheduleId,
          });
        }
      }

      logger.info(`Schedule notification trigger fired for class: ${scheduleData.classId}`);
    } catch (error) {
      logger.error(`Error firing schedule trigger: ${error}`);
    }
  }

  /**
   * Fire enrollment trigger
   */
  async fireEnrollmentTrigger(enrollmentData: {
    studentId: string;
    classId: string;
    status: 'approved' | 'rejected' | 'pending';
    className?: string;
    message?: string;
  }): Promise<void> {
    try {
      const trigger = await this.getTriggerByType('enrollment');
      if (!trigger?.isActive) {
        logger.info('Enrollment trigger is not active');
        return;
      }

      const shouldSendEmail = await notificationPreferenceService.shouldReceiveNotification(
        enrollmentData.studentId,
        'enrollment',
        'email'
      );
      const shouldSendInApp = await notificationPreferenceService.shouldReceiveNotification(
        enrollmentData.studentId,
        'enrollment',
        'in_app'
      );

      const channels = [];
      if (shouldSendEmail) channels.push('email');
      if (shouldSendInApp) channels.push('in_app');

      if (channels.length > 0) {
        let subject = '';
        
        switch (enrollmentData.status) {
          case 'approved':
            subject = 'Enrollment Approved';
            break;
          case 'rejected':
            subject = 'Enrollment Status Update';
            break;
          case 'pending':
            subject = 'Enrollment Submitted';
            break;
        }

        await notificationService.createNotification({
          notificationType: 'enrollment',
          recipientId: enrollmentData.studentId,
          subject,
          message: enrollmentData.message || `Your enrollment status for ${enrollmentData.className} is ${enrollmentData.status}.`,
          data: {
            studentId: enrollmentData.studentId,
            classId: enrollmentData.classId,
            className: enrollmentData.className,
            status: enrollmentData.status,
          },
          channels,
          sourceType: 'enrollment',
          sourceId: enrollmentData.classId,
        });
      }

      logger.info(`Enrollment notification trigger fired for student: ${enrollmentData.studentId}`);
    } catch (error) {
      logger.error(`Error firing enrollment trigger: ${error}`);
    }
  }

  /**
   * Get trigger by type
   */
  private async getTriggerByType(triggerType: string): Promise<NotificationTriggerConfig | null> {
    try {
      const trigger = await db('notification_triggers')
        .where({ triggerType })
        .first();

      return trigger ? this.formatTrigger(trigger) : null;
    } catch (error) {
      logger.error(`Error fetching trigger: ${error}`);
      return null;
    }
  }

  /**
   * Create trigger
   */
  async createTrigger(trigger: {
    triggerName: string;
    triggerType: string;
    config: Record<string, any>;
    isActive?: boolean;
    createdBy?: string;
  }): Promise<NotificationTriggerConfig> {
    try {
      const [created] = await db('notification_triggers')
        .insert({
          triggerName: trigger.triggerName,
          triggerType: trigger.triggerType,
          config: JSON.stringify(trigger.config),
          isActive: trigger.isActive !== false,
          createdBy: trigger.createdBy,
        })
        .returning('*');

      logger.info(`Notification trigger created: ${trigger.triggerName}`);
      return this.formatTrigger(created);
    } catch (error) {
      logger.error(`Error creating trigger: ${error}`);
      throw new Error(`Failed to create trigger: ${error}`);
    }
  }

  /**
   * Helper method to format trigger response
   */
  private formatTrigger(trigger: any): NotificationTriggerConfig {
    return {
      id: trigger.id,
      triggerName: trigger.triggerName,
      triggerType: trigger.triggerType,
      isActive: trigger.isActive,
      config: typeof trigger.config === 'string' ? JSON.parse(trigger.config) : trigger.config,
      createdBy: trigger.createdBy,
      createdAt: trigger.createdAt,
      updatedAt: trigger.updatedAt,
    };
  }
}

export default new NotificationTriggerService();
