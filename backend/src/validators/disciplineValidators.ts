/**
 * Discipline & Conduct — request validation schemas (Zod)
 * Applied to write endpoints that previously spread req.body directly.
 */

import { z } from 'zod';

const isoDate = z.string().min(1, 'is required'); // accept ISO date/datetime strings
const optionalDate = z.string().optional();

// ── Infractions ────────────────────────────────────────────────────────────

export const recordInfractionSchema = z.object({
  student_id: z.string().uuid('must be a valid student id'),
  infraction_type_id: z.string().min(1, 'is required'),
  incident_date: isoDate,
  incident_description: z.string().min(1, 'is required'),
  incident_location: z.string().optional(),
  severity_override: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
  is_confidential: z.boolean().optional(),
  class_id: z.string().uuid().optional(),
  evidence_type: z.string().optional(),
  evidence_urls: z.array(z.string()).optional(),
}).passthrough();

export const updateInfractionSchema = z.object({
  incident_description: z.string().optional(),
  incident_location: z.string().optional(),
  severity_override: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
  is_confidential: z.boolean().optional(),
  status: z.string().optional(),
}).passthrough();

export const resolveInfractionSchema = z.object({
  resolution_notes: z.string().min(1, 'is required'),
}).passthrough();

// ── Discipline actions ───────────────────────────────────────────────────────

export const assignActionSchema = z.object({
  student_id: z.string().uuid('must be a valid student id'),
  infraction_id: z.string().uuid('must be a valid infraction id'),
  action_type: z.enum(['warning', 'detention', 'suspension', 'expulsion', 'counseling']),
  action_subtype: z.string().optional(),
  action_description: z.string().optional(),
  action_date: isoDate,
  start_date: optionalDate,
  end_date: optionalDate,
  duration_days: z.number().int().min(0).optional(),
  conditions: z.string().optional(),
  requires_follow_up: z.boolean().optional(),
  follow_up_date: optionalDate,
  follow_up_assigned_to: z.string().uuid().optional(),
  notes: z.string().optional(),
}).passthrough();

export const updateActionStatusSchema = z.object({
  status: z.enum(['active', 'completed', 'appealed', 'cancelled']),
  notes: z.string().optional(),
}).passthrough();

export const cancelActionSchema = z.object({
  reason: z.string().min(1, 'is required'),
}).passthrough();

// ── Detentions ───────────────────────────────────────────────────────────────

export const scheduleDetentionSchema = z.object({
  action_id: z.string().uuid('must be a valid action id'),
  student_id: z.string().uuid('must be a valid student id'),
  detention_type: z.string().min(1, 'is required'),
  scheduled_date: isoDate,
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  location: z.string().optional(),
  supervised_by: z.string().uuid().optional(),
}).passthrough();

export const rescheduleDetentionSchema = z.object({
  new_date: isoDate,
  reason: z.string().optional(),
}).passthrough();

// ── Appeals ──────────────────────────────────────────────────────────────────

export const submitAppealSchema = z.object({
  action_id: z.string().uuid('must be a valid action id'),
  student_id: z.string().uuid('must be a valid student id'),
  submitted_by_type: z.string().min(1, 'is required'),
  appeal_reason: z.string().min(1, 'is required'),
}).passthrough();

export const approveAppealSchema = z.object({
  decision_notes: z.string().optional(),
  modified_action: z.string().optional(),
}).passthrough();

export const rejectAppealSchema = z.object({
  decision_notes: z.string().optional(),
}).passthrough();

export const escalateAppealSchema = z.object({
  reason: z.string().optional(),
}).passthrough();

// ── Behavioral notes ──────────────────────────────────────────────────────────

export const createNoteSchema = z.object({
  student_id: z.string().uuid('must be a valid student id'),
  note_type: z.enum(['positive', 'concern', 'observation', 'commendation']),
  content: z.string().min(1, 'is required'),
  category: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  class_id: z.string().uuid().optional(),
  note_date: optionalDate,
  is_confidential: z.boolean().optional(),
}).passthrough();

export const updateNoteSchema = z.object({
  note_type: z.enum(['positive', 'concern', 'observation', 'commendation']).optional(),
  content: z.string().optional(),
  category: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  is_confidential: z.boolean().optional(),
}).passthrough();

// ── Conduct reports ────────────────────────────────────────────────────────────

export const generateReportSchema = z.object({
  student_id: z.string().uuid('must be a valid student id'),
  report_period: z.enum(['term', 'semester', 'year', 'custom']),
  start_date: optionalDate,
  end_date: optionalDate,
}).passthrough().refine(
  (d) => d.report_period !== 'custom' || (!!d.start_date && !!d.end_date),
  { message: 'start_date and end_date are required for a custom report period', path: ['start_date'] }
);
