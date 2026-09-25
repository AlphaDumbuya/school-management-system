/**
 * reasonPolish — turns a rough, admin-typed reason into a clear, professional,
 * respectfully-worded explanation for the affected staff member.
 *
 * There is no external LLM configured, so this is a deterministic "assistant":
 * it cleans up the raw text (trims, fixes casing/punctuation, strips insults),
 * then frames it in a courteous sentence appropriate to the action. The result
 * reads well even when the admin's note is terse or blunt — the staff member
 * gets a considerate explanation rather than a raw fragment.
 */

type StatusKind = 'suspended' | 'dismissed' | 'inactive' | 'active';

/** Words we soften/strip so the message stays professional and non-abusive. */
const HARSH_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bstupid\b/gi, ''],
  [/\bidiot(ic)?\b/gi, ''],
  [/\blazy\b/gi, 'below the expected level of engagement'],
  [/\buseless\b/gi, 'not meeting expectations'],
  [/\bnonsense\b/gi, 'concerns'],
  [/\brubbish\b/gi, 'concerns'],
  [/\bfool(ish)?\b/gi, ''],
];

/** Tidy raw text: collapse whitespace, strip harsh words, fix ending punctuation. */
function tidy(raw: string): string {
  let s = String(raw || '').replace(/\s+/g, ' ').trim();
  for (const [re, rep] of HARSH_REPLACEMENTS) s = s.replace(re, rep);
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return '';
  // Capitalise first letter.
  s = s.charAt(0).toUpperCase() + s.slice(1);
  // Ensure it ends with sentence punctuation.
  if (!/[.!?]$/.test(s)) s += '.';
  return s;
}

const ACTION_FRAME: Record<StatusKind, { lead: string; close: string }> = {
  suspended: {
    lead: 'Following a review, your account has been temporarily suspended for the following reason:',
    close: 'This is a temporary measure. Please reach out to the school administration using the contact details below to discuss the matter or request reinstatement.',
  },
  dismissed: {
    lead: 'After careful consideration, a decision has been made to close your account for the following reason:',
    close: 'If you would like to understand this decision further or believe it may be in error, please contact the school administration using the details below.',
  },
  inactive: {
    lead: 'Your account has been deactivated for the following reason:',
    close: 'If you have questions or believe this was done in error, please contact the school administration using the details below.',
  },
  active: {
    lead: 'Your account has been reactivated. Note from the administration:',
    close: 'Welcome back — you can sign in and resume your work.',
  },
};

/**
 * Build a polished, multi-part explanation from a raw reason. Returns both a
 * short one-line summary (for notifications) and a fuller HTML-safe explanation
 * (for the email body). If no reason was given, returns nulls so callers can
 * fall back to their default wording.
 */
export function polishReason(
  raw: string | undefined | null,
  status: StatusKind,
): { summary: string; explanation: string } | null {
  const cleaned = tidy(raw || '');
  if (!cleaned) return null;

  const frame = ACTION_FRAME[status] || ACTION_FRAME.inactive;
  // A concise one-liner for notifications / previews.
  const summary = cleaned;
  // A courteous, fuller explanation for the email body.
  const explanation = `${frame.lead} "${cleaned}" ${frame.close}`;
  return { summary, explanation };
}

export default polishReason;
