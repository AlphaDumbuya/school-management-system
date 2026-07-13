/**
 * Event Management Scheduled Jobs
 * Phase 2.2 - Events Management Module
 * Handles recurring events, reminders, cleanup, and analytics
 */

import cron from 'node-cron';
import logger from '../utils/logger.js';
import { db } from '../utils/database.js';
import eventService from '../services/eventService.js';
import eventAnalyticsService from '../services/eventAnalyticsService.js';
import eventAttendanceService from '../services/eventAttendanceService.js';
import notificationService from '../services/notificationService.js';
import emailService from '../services/emailService.js';

// Job configuration
const JOBS_CONFIG = {
  // Process recurring events every day at 2 AM
  recurringEvents: '0 2 * * *',
  
  // Send event reminders 24 hours before
  eventReminders24h: '0 9 * * *',
  
  // Send event reminders 1 hour before
  eventReminders1h: '0 * * * *',
  
  // Aggregate analytics every hour
  analyticsAggregation: '0 * * * *',
  
  // Clean up completed events weekly on Sundays at 3 AM
  eventCleanup: '0 3 * * 0',
  
  // Generate event reports daily at 1 AM
  eventReports: '0 1 * * *',
  
  // Process no-show analytics daily at 4 AM
  noShowAnalysis: '0 4 * * *',
};

let activeJobs: { [key: string]: cron.ScheduledTask } = {};

/**
 * Start all event management jobs
 */
export function startEventManagementJobs() {
  logger.info('Starting Event Management scheduled jobs');

  try {
    // Process recurring events
    activeJobs.recurringEvents = cron.schedule(JOBS_CONFIG.recurringEvents, () => {
      processRecurringEvents();
    });
    logger.info('✓ Recurring events job scheduled');

    // 24-hour event reminders
    activeJobs.eventReminders24h = cron.schedule(JOBS_CONFIG.eventReminders24h, () => {
      sendEventReminders24h();
    });
    logger.info('✓ 24-hour event reminders job scheduled');

    // 1-hour event reminders
    activeJobs.eventReminders1h = cron.schedule(JOBS_CONFIG.eventReminders1h, () => {
      sendEventReminders1h();
    });
    logger.info('✓ 1-hour event reminders job scheduled');

    // Analytics aggregation
    activeJobs.analyticsAggregation = cron.schedule(JOBS_CONFIG.analyticsAggregation, () => {
      aggregateAnalytics();
    });
    logger.info('✓ Analytics aggregation job scheduled');

    // Event cleanup
    activeJobs.eventCleanup = cron.schedule(JOBS_CONFIG.eventCleanup, () => {
      cleanupCompletedEvents();
    });
    logger.info('✓ Event cleanup job scheduled');

    // Event reports generation
    activeJobs.eventReports = cron.schedule(JOBS_CONFIG.eventReports, () => {
      generateEventReports();
    });
    logger.info('✓ Event reports generation job scheduled');

    // No-show analysis
    activeJobs.noShowAnalysis = cron.schedule(JOBS_CONFIG.noShowAnalysis, () => {
      processNoShowAnalysis();
    });
    logger.info('✓ No-show analysis job scheduled');

    logger.info('All Event Management jobs started successfully');
  } catch (error) {
    logger.error('Error starting event management jobs:', error);
  }
}

/**
 * Stop all active jobs
 */
export function stopEventManagementJobs() {
  Object.values(activeJobs).forEach(job => {
    job.stop();
  });
  activeJobs = {};
  logger.info('All Event Management jobs stopped');
}

/**
 * Process recurring events - create new instances for recurring series
 */
async function processRecurringEvents() {
  const jobStart = Date.now();
  logger.info('[EVENT JOB] Starting recurring events processing');

  try {
    // Get all active recurring events
    const recurringEvents = await db('events')
      .where({ status: 'published', is_recurring: true })
      .where('recurrence_rule', '!=', null)
      .select('*');

    logger.info(`[EVENT JOB] Found ${recurringEvents.length} recurring events to process`);

    for (const event of recurringEvents) {
      try {
        // Parse recurrence rule and generate next instance
        const nextInstance = generateNextRecurrence(event);
        
        if (!nextInstance) continue;

        // Create new event instance
        await db('events').insert({
          tenant_id: event.tenant_id,
          title: event.title,
          description: event.description,
          event_type: event.event_type,
          start_date: nextInstance.start_date,
          end_date: nextInstance.end_date,
          location: event.location,
          organizer_id: event.organizer_id,
          max_capacity: event.max_capacity,
          status: 'draft',
          is_recurring: true,
          parent_event_id: event.id,
          recurrence_rule: event.recurrence_rule,
          created_at: new Date(),
          updated_at: new Date(),
        });

        logger.debug(`[EVENT JOB] Created recurring instance for event ${event.id}`);
      } catch (err) {
        logger.error(`[EVENT JOB] Error processing event ${event.id}:`, err);
      }
    }

    const duration = Date.now() - jobStart;
    logger.info(
      `[EVENT JOB] Recurring events processing completed in ${duration}ms (${recurringEvents.length} processed)`
    );
  } catch (error) {
    logger.error('[EVENT JOB] Recurring events job failed:', error);
  }
}

/**
 * Send 24-hour event reminders to registered users
 */
async function sendEventReminders24h() {
  const jobStart = Date.now();
  logger.info('[EVENT JOB] Starting 24-hour event reminders');

  try {
    // Find events starting in ~24 hours (within 23-25 hour window)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startOfWindow = new Date(tomorrow);
    startOfWindow.setHours(startOfWindow.getHours() - 1);
    const endOfWindow = new Date(tomorrow);
    endOfWindow.setHours(endOfWindow.getHours() + 1);

    const upcomingEvents = await db('events')
      .where({ status: 'published' })
      .whereBetween('start_date', [startOfWindow, endOfWindow])
      .select('*');

    logger.info(`[EVENT JOB] Found ${upcomingEvents.length} events for 24-hour reminders`);

    for (const event of upcomingEvents) {
      try {
        // Get all registered users
        const registrations = await db('event_registrations')
          .where({ event_id: event.id, status: 'approved' })
          .select('user_id');

        logger.debug(
          `[EVENT JOB] Sending 24h reminder to ${registrations.length} users for event ${event.id}`
        );

        for (const registration of registrations) {
          try {
            // Get user details
            const user = await db('users').where({ id: registration.user_id }).first();
            if (!user) continue;

            // Send in-app notification
            await notificationService.createNotification({
              user_id: registration.user_id,
              tenant_id: event.tenant_id,
              type: 'event_reminder_24h',
              title: `Reminder: ${event.title} tomorrow`,
              message: `Your registered event "${event.title}" is scheduled for tomorrow at ${new Date(
                event.start_date
              ).toLocaleTimeString()}`,
              related_entity: 'event',
              related_id: event.id,
            });

            // Send email if enabled in user preferences
            if (user.email_notifications_enabled) {
              await emailService.sendEventReminder(
                user.email,
                user.first_name,
                event,
                '24 hours'
              );
            }
          } catch (err) {
            logger.error(`[EVENT JOB] Error sending reminder to user ${registration.user_id}:`, err);
          }
        }
      } catch (err) {
        logger.error(`[EVENT JOB] Error processing reminders for event ${event.id}:`, err);
      }
    }

    const duration = Date.now() - jobStart;
    logger.info(
      `[EVENT JOB] 24-hour reminders completed in ${duration}ms (${upcomingEvents.length} events)`
    );
  } catch (error) {
    logger.error('[EVENT JOB] 24-hour reminders job failed:', error);
  }
}

/**
 * Send 1-hour event reminders to registered users
 */
async function sendEventReminders1h() {
  const jobStart = Date.now();
  logger.info('[EVENT JOB] Starting 1-hour event reminders');

  try {
    // Find events starting in ~1 hour (within 59-61 minute window)
    const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
    const startOfWindow = new Date(inOneHour);
    startOfWindow.setMinutes(startOfWindow.getMinutes() - 1);
    const endOfWindow = new Date(inOneHour);
    endOfWindow.setMinutes(endOfWindow.getMinutes() + 1);

    const upcomingEvents = await db('events')
      .where({ status: 'published' })
      .whereBetween('start_date', [startOfWindow, endOfWindow])
      .select('*');

    logger.info(`[EVENT JOB] Found ${upcomingEvents.length} events for 1-hour reminders`);

    for (const event of upcomingEvents) {
      try {
        // Get registered users
        const registrations = await db('event_registrations')
          .where({ event_id: event.id, status: 'approved' })
          .select('user_id');

        for (const registration of registrations) {
          try {
            const user = await db('users').where({ id: registration.user_id }).first();
            if (!user) continue;

            // Send urgent notification
            await notificationService.createNotification({
              user_id: registration.user_id,
              tenant_id: event.tenant_id,
              type: 'event_reminder_1h',
              title: `Urgent: ${event.title} starts in 1 hour!`,
              message: `${event.title} starts in 1 hour at ${new Date(event.start_date).toLocaleTimeString()}`,
              related_entity: 'event',
              related_id: event.id,
              priority: 'high',
            });

            // Send SMS if phone available and SMS enabled
            if (user.phone && user.sms_notifications_enabled) {
              await notificationService.sendSMS(
                user.phone,
                `Urgent reminder: ${event.title} starts in 1 hour!`
              );
            }
          } catch (err) {
            logger.error(`[EVENT JOB] Error sending 1h reminder to user:`, err);
          }
        }
      } catch (err) {
        logger.error(`[EVENT JOB] Error processing 1h reminders for event ${event.id}:`, err);
      }
    }

    const duration = Date.now() - jobStart;
    logger.info(`[EVENT JOB] 1-hour reminders completed in ${duration}ms`);
  } catch (error) {
    logger.error('[EVENT JOB] 1-hour reminders job failed:', error);
  }
}

/**
 * Aggregate analytics for all events
 */
async function aggregateAnalytics() {
  const jobStart = Date.now();
  logger.info('[EVENT JOB] Starting analytics aggregation');

  try {
    // Get all tenants
    const tenants = await db('tenants').select('id').where({ status: 'active' });

    logger.info(`[EVENT JOB] Aggregating analytics for ${tenants.length} tenants`);

    for (const tenant of tenants) {
      try {
        // Get all events for tenant
        const events = await db('events')
          .where({ tenant_id: tenant.id, status: 'published' })
          .whereIn('status', ['completed', 'published'])
          .select('id');

        for (const event of events) {
          try {
            // Calculate and store analytics
            const registrationCount = await db('event_registrations')
              .where({ event_id: event.id, status: 'approved' })
              .count('* as count')
              .first();

            const attendanceCount = await db('event_attendance')
              .where({ event_id: event.id })
              .count('* as count')
              .first();

            const noShowCount = registrationCount.count - (attendanceCount?.count || 0);

            // Update event_analytics table
            await db('event_analytics')
              .where({ event_id: event.id })
              .update({
                total_registrations: registrationCount.count,
                total_attendance: attendanceCount?.count || 0,
                no_show_count: Math.max(0, noShowCount),
                attendance_rate:
                  registrationCount.count > 0
                    ? (((attendanceCount?.count || 0) / registrationCount.count) * 100).toFixed(2)
                    : 0,
                updated_at: new Date(),
              })
              .catch(() => {
                // Create if doesn't exist
                return db('event_analytics').insert({
                  event_id: event.id,
                  tenant_id: tenant.id,
                  total_registrations: registrationCount.count,
                  total_attendance: attendanceCount?.count || 0,
                  no_show_count: Math.max(0, noShowCount),
                  attendance_rate:
                    registrationCount.count > 0
                      ? (((attendanceCount?.count || 0) / registrationCount.count) * 100).toFixed(2)
                      : 0,
                  created_at: new Date(),
                  updated_at: new Date(),
                });
              });

            logger.debug(`[EVENT JOB] Analytics updated for event ${event.id}`);
          } catch (err) {
            logger.error(`[EVENT JOB] Error aggregating analytics for event ${event.id}:`, err);
          }
        }
      } catch (err) {
        logger.error(`[EVENT JOB] Error processing analytics for tenant ${tenant.id}:`, err);
      }
    }

    const duration = Date.now() - jobStart;
    logger.info(`[EVENT JOB] Analytics aggregation completed in ${duration}ms`);
  } catch (error) {
    logger.error('[EVENT JOB] Analytics aggregation failed:', error);
  }
}

/**
 * Clean up completed events - archive old attendance records
 */
async function cleanupCompletedEvents() {
  const jobStart = Date.now();
  logger.info('[EVENT JOB] Starting completed events cleanup');

  try {
    // Find events completed more than 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const completedEvents = await db('events')
      .where({ status: 'completed' })
      .where('end_date', '<', sevenDaysAgo)
      .select('id', 'tenant_id');

    logger.info(`[EVENT JOB] Found ${completedEvents.length} completed events to cleanup`);

    for (const event of completedEvents) {
      try {
        // Archive old attendance records (keep analytics but archive raw data)
        const attendanceRecords = await db('event_attendance')
          .where({ event_id: event.id })
          .select('*');

        if (attendanceRecords.length > 0) {
          // Could archive to separate table or compress
          logger.debug(`[EVENT JOB] Archiving ${attendanceRecords.length} attendance records for event ${event.id}`);
        }

        // Clean up temporary files/uploads related to event
        // (implementation depends on storage system)

        // Mark event as archived
        await db('events')
          .where({ id: event.id })
          .update({
            status: 'archived',
            archived_at: new Date(),
          });

        logger.debug(`[EVENT JOB] Archived event ${event.id}`);
      } catch (err) {
        logger.error(`[EVENT JOB] Error cleaning up event ${event.id}:`, err);
      }
    }

    const duration = Date.now() - jobStart;
    logger.info(`[EVENT JOB] Cleanup completed in ${duration}ms (${completedEvents.length} events archived)`);
  } catch (error) {
    logger.error('[EVENT JOB] Event cleanup job failed:', error);
  }
}

/**
 * Generate event reports for completed events
 */
async function generateEventReports() {
  const jobStart = Date.now();
  logger.info('[EVENT JOB] Starting event reports generation');

  try {
    // Find recently completed events (completed in last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const recentlyCompleted = await db('events')
      .where({ status: 'completed' })
      .where('end_date', '>', yesterday)
      .select('*');

    logger.info(`[EVENT JOB] Generating reports for ${recentlyCompleted.length} completed events`);

    for (const event of recentlyCompleted) {
      try {
        // Generate comprehensive report
        const report = await eventAnalyticsService.generateEventReport(event.id);

        // Store report
        await db('event_reports').insert({
          event_id: event.id,
          tenant_id: event.tenant_id,
          report_data: JSON.stringify(report),
          generated_by: 'system',
          generated_at: new Date(),
          created_at: new Date(),
        });

        // Notify organizer of report
        const organizer = await db('users').where({ id: event.organizer_id }).first();
        if (organizer && organizer.email_notifications_enabled) {
          await emailService.sendEventReport(
            organizer.email,
            organizer.first_name,
            event,
            report
          );
        }

        logger.debug(`[EVENT JOB] Report generated for event ${event.id}`);
      } catch (err) {
        logger.error(`[EVENT JOB] Error generating report for event ${event.id}:`, err);
      }
    }

    const duration = Date.now() - jobStart;
    logger.info(`[EVENT JOB] Reports generation completed in ${duration}ms`);
  } catch (error) {
    logger.error('[EVENT JOB] Event reports job failed:', error);
  }
}

/**
 * Process and analyze no-show patterns
 */
async function processNoShowAnalysis() {
  const jobStart = Date.now();
  logger.info('[EVENT JOB] Starting no-show analysis');

  try {
    // Get all completed events from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const completedEvents = await db('events')
      .where({ status: 'completed' })
      .where('end_date', '>', sevenDaysAgo)
      .select('id', 'tenant_id', 'organizer_id');

    logger.info(`[EVENT JOB] Analyzing no-shows for ${completedEvents.length} recent events`);

    for (const event of completedEvents) {
      try {
        // Calculate no-show rate
        const registered = await db('event_registrations')
          .where({ event_id: event.id, status: 'approved' })
          .count('* as count')
          .first();

        const attended = await db('event_attendance')
          .where({ event_id: event.id })
          .count('* as count')
          .first();

        const noShowCount = (registered?.count || 0) - (attended?.count || 0);
        const noShowRate =
          (registered?.count || 0) > 0
            ? ((noShowCount / (registered?.count || 0)) * 100).toFixed(2)
            : 0;

        // Identify chronic no-shows (users who no-showed multiple times)
        const noShowUsers = await db('event_registrations as er')
          .leftJoin(
            'event_attendance as ea',
            'er.user_id',
            '=',
            'ea.user_id'
          )
          .where('er.event_id', event.id)
          .where('er.status', 'approved')
          .whereNull('ea.user_id')
          .select('er.user_id');

        // Store analysis
        if (noShowCount > 0) {
          await db('event_no_show_analysis')
            .insert({
              event_id: event.id,
              tenant_id: event.tenant_id,
              total_registered: registered?.count || 0,
              total_attended: attended?.count || 0,
              no_show_count: noShowCount,
              no_show_rate: parseFloat(noShowRate as string),
              no_show_user_count: noShowUsers.length,
              analyzed_at: new Date(),
              created_at: new Date(),
            })
            .catch(() => null); // Silent fail if record exists
        }

        logger.debug(
          `[EVENT JOB] No-show analysis: ${event.id} had ${noShowRate}% no-show rate`
        );
      } catch (err) {
        logger.error(`[EVENT JOB] Error analyzing no-shows for event ${event.id}:`, err);
      }
    }

    const duration = Date.now() - jobStart;
    logger.info(`[EVENT JOB] No-show analysis completed in ${duration}ms`);
  } catch (error) {
    logger.error('[EVENT JOB] No-show analysis job failed:', error);
  }
}

/**
 * Helper: Generate next recurrence date based on recurrence rule
 */
function generateNextRecurrence(event: any) {
  try {
    const rule = JSON.parse(event.recurrence_rule || '{}');
    const lastDate = event.end_date ? new Date(event.end_date) : new Date(event.start_date);

    // Simple implementation - can be extended with more complex recurrence rules
    if (rule.frequency === 'daily') {
      const nextStart = new Date(lastDate);
      nextStart.setDate(nextStart.getDate() + 1);

      const nextEnd = new Date(nextStart);
      nextEnd.setHours(lastDate.getHours(), lastDate.getMinutes());

      return { start_date: nextStart, end_date: nextEnd };
    }

    if (rule.frequency === 'weekly') {
      const nextStart = new Date(lastDate);
      nextStart.setDate(nextStart.getDate() + 7);

      const nextEnd = new Date(nextStart);
      nextEnd.setHours(lastDate.getHours(), lastDate.getMinutes());

      return { start_date: nextStart, end_date: nextEnd };
    }

    if (rule.frequency === 'monthly') {
      const nextStart = new Date(lastDate);
      nextStart.setMonth(nextStart.getMonth() + 1);

      const nextEnd = new Date(nextStart);
      nextEnd.setHours(lastDate.getHours(), lastDate.getMinutes());

      return { start_date: nextStart, end_date: nextEnd };
    }

    return null;
  } catch (error) {
    logger.error('Error parsing recurrence rule:', error);
    return null;
  }
}

export default {
  startEventManagementJobs,
  stopEventManagementJobs,
};
