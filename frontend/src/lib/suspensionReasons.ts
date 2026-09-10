/**
 * Suspension categories and their predefined reasons.
 *
 * Used by the platform-owner suspend UIs so reasons are picked from a consistent
 * list (with a "Custom reason…" escape hatch) rather than typed freehand every
 * time. The category also drives the tailored resolution guidance in the
 * suspension notification email (see backend emailService.suspensionGuidance).
 */
export type SuspensionCategory = 'payment' | 'policy' | 'abuse' | 'review' | 'security' | 'other';

export const SUSPENSION_CATEGORIES: { value: SuspensionCategory; label: string }[] = [
  { value: 'payment', label: 'Overdue payment / billing' },
  { value: 'policy', label: 'Policy / terms review' },
  { value: 'review', label: 'Pending verification / review' },
  { value: 'security', label: 'Security precaution' },
  { value: 'abuse', label: 'Suspected misuse / abuse' },
  { value: 'other', label: 'Other' },
];

/** Preset reasons per category. The last entry is always the custom sentinel. */
export const CUSTOM_REASON = '__custom__';

export const SUSPENSION_REASONS: Record<SuspensionCategory, string[]> = {
  payment: [
    'Subscription payment overdue',
    'Subscription expired and not renewed',
    'Failed / reversed payment',
    'Trial period ended without upgrade',
  ],
  policy: [
    'Violation of platform terms of service',
    'Breach of acceptable-use policy',
    'Repeated policy warnings unaddressed',
    'Content policy violation',
  ],
  review: [
    'Awaiting account verification',
    'Pending compliance review',
    'Documents requested but not provided',
    'Under routine audit',
  ],
  security: [
    'Suspicious login activity detected',
    'Compromised administrator account',
    'Security review in progress',
    'Precautionary hold to protect data',
  ],
  abuse: [
    'Suspected fraudulent activity',
    'Spam or bulk-messaging abuse',
    'Misuse of platform resources',
    'Reported abuse under investigation',
  ],
  other: [
    'Requested by school administrator',
    'Temporary administrative hold',
    'Duplicate / test account',
  ],
};

/** Default reason for a category (first preset). */
export const defaultReasonFor = (cat: SuspensionCategory): string =>
  SUSPENSION_REASONS[cat]?.[0] ?? '';
