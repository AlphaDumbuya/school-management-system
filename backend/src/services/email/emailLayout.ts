/**
 * emailLayout — a shared, mobile-first, email-client-safe HTML shell.
 *
 * Design goals:
 *  - Renders well on small screens (most parents read on phones): fluid width,
 *    generous padding that scales down on narrow viewports, large tap targets,
 *    no fixed pixel widths that overflow.
 *  - Works across email clients: table-based layout, inline-ish styles, a
 *    <style> block with a mobile media query, safe web fonts.
 *  - Branding-aware: header logo/name, accent color, and footer contacts all
 *    come from the resolved EmailBranding (school for tenant emails, WiSkul for
 *    platform emails).
 *  - Every link is absolute and working (built from branding.appUrl).
 */
import type { EmailBranding } from './emailBranding';

// Brand palette (matches the marketing pages): blue primary, amber accent, navy ink.
const ACCENT = '#1d4ed8'; // primary blue — links & buttons
const HEADER_TO = '#25408f'; // moderate mid-navy for the header gradient end (not bright)
const AMBER = '#f59e0b'; // amber accent
const INK = '#1a2b6b'; // navy

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** A primary call-to-action button. `href` must be an absolute URL. */
export function emailButton(label: string, href: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr>
      <td align="center" bgcolor="${ACCENT}" style="border-radius:12px;">
        <a href="${href}" target="_blank"
           style="display:inline-block;padding:14px 32px;font-family:'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>
  </table>`;
}

/** A labelled row for a details table (stacks nicely on mobile). */
export function detailRow(label: string, value: string): string {
  return `
  <tr>
    <td style="padding:10px 0;border-bottom:1px solid #edf2f7;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#64748b;vertical-align:top;width:38%;word-break:break-word;">${escapeHtml(label)}</td>
    <td style="padding:10px 0;border-bottom:1px solid #edf2f7;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:${INK};font-weight:600;vertical-align:top;word-break:break-word;overflow-wrap:anywhere;">${value}</td>
  </tr>`;
}

/** Wrap a set of detailRow()s in a card table. */
export function detailsCard(rows: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#f8fafc;border-radius:12px;padding:8px 18px;margin:8px 0 4px;">
    ${rows}
  </table>`;
}

/** A soft info/callout block. tone: 'info' | 'warn' | 'success'. */
export function calloutBlock(html: string, tone: 'info' | 'warn' | 'success' = 'info'): string {
  const styles = {
    info: { bg: '#eff6ff', border: '#3b82f6', color: '#1e3a8a' },
    warn: { bg: '#fff7ed', border: '#f97316', color: '#7c2d12' },
    success: { bg: '#ecfdf5', border: '#10b981', color: '#065f46' },
  }[tone];
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;">
    <tr>
      <td style="background:${styles.bg};border-left:4px solid ${styles.border};border-radius:8px;padding:14px 16px;font-family:'Segoe UI',Arial,sans-serif;font-size:13px;line-height:1.6;color:${styles.color};">
        ${html}
      </td>
    </tr>
  </table>`;
}

export interface RenderOptions {
  branding: EmailBranding;
  /** Small kicker/eyebrow above the heading, e.g. "Discipline Notice". */
  eyebrow?: string;
  heading: string;
  /** Main body HTML (paragraphs, cards, buttons via the helpers above). */
  bodyHtml: string;
  /** Optional preheader text (hidden preview snippet in the inbox). */
  preheader?: string;
  /** Marketing emails: a token-based unsubscribe URL rendered in the footer. */
  unsubscribeUrl?: string;
}

/**
 * Render a complete responsive HTML email around the given body.
 */
export function renderEmail({ branding, eyebrow, heading, bodyHtml, preheader, unsubscribeUrl }: RenderOptions): string {
  const brandName = escapeHtml(branding.name);

  // Header logo: use an image only when it's an absolute http(s) URL. Many email
  // clients (Gmail/Outlook) block `data:` base64 images, so those fall back to a
  // clean text logo rather than showing a broken image. The mark always sits on
  // a white rounded chip so it stays crisp and professional over the dark header.
  const isHostedLogo = !!branding.logoUrl && /^https?:\/\//i.test(branding.logoUrl);
  const logoInner = isHostedLogo
    ? `<img src="${branding.logoUrl}" alt="${brandName}" height="40" style="height:40px;max-width:200px;width:auto;display:block;border:0;" />`
    : `<div style="font-size:22px;font-weight:800;color:${INK};letter-spacing:-0.5px;line-height:1;">${brandName}</div>`;
  const headerLogo = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td align="center" bgcolor="#ffffff" style="background:#ffffff;border-radius:14px;padding:12px 20px;box-shadow:0 2px 8px rgba(0,0,0,0.12);">
          ${logoInner}
        </td>
      </tr>
    </table>`;

  // Footer contact lines — only render what exists.
  const footerLines: string[] = [];
  const contactBits: string[] = [];
  if (branding.contactEmail) {
    contactBits.push(`<a href="mailto:${branding.contactEmail}" style="color:#94a3b8;text-decoration:none;">${escapeHtml(branding.contactEmail)}</a>`);
  }
  if (branding.contactPhone) contactBits.push(escapeHtml(branding.contactPhone));
  if (contactBits.length) footerLines.push(contactBits.join('&nbsp;&nbsp;•&nbsp;&nbsp;'));
  if (branding.address) footerLines.push(escapeHtml(branding.address));
  if (branding.website) {
    footerLines.push(`<a href="${branding.website}" target="_blank" style="color:#94a3b8;text-decoration:none;">${escapeHtml(branding.website.replace(/^https?:\/\//, ''))}</a>`);
  }
  // Tenant emails get a small "powered by WiSkul" line; platform emails don't.
  const poweredBy = branding.isPlatform
    ? ''
    : `<p style="margin:14px 0 0;font-size:11px;color:#64748b;">Powered by <a href="https://www.wiskulsl.com" target="_blank" style="color:${AMBER};text-decoration:none;font-weight:600;">WiSkul</a></p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(heading)}</title>
  <style>
    body { margin:0; padding:0; background:#eef1f6; -webkit-text-size-adjust:100%; }
    img { border:0; line-height:100%; outline:none; text-decoration:none; }
    a { color:${ACCENT}; }
    /* Mobile: reduce side padding so content isn't tight, keep tap targets big */
    @media only screen and (max-width:600px) {
      .email-container { width:100% !important; }
      .email-pad { padding-left:20px !important; padding-right:20px !important; }
      .email-head { padding:26px 20px !important; }
      .email-heading { font-size:20px !important; }
      .stack td { display:block !important; width:100% !important; }
    }
  </style>
</head>
<body>
  <!-- Hidden preheader -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader || heading)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:16px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0"
               style="width:600px;max-width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(16,24,40,0.08);">

          <!-- Header -->
          <tr>
            <td class="email-head" align="center" bgcolor="${INK}"
                style="background:${INK};background:linear-gradient(135deg, ${INK} 0%, ${HEADER_TO} 100%);padding:32px 30px;">
              ${headerLogo}
              ${eyebrow ? `<div style="margin-top:10px;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.85);font-weight:600;">${escapeHtml(eyebrow)}</div>` : ''}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="email-pad" style="padding:32px 36px;font-family:'Segoe UI',Arial,sans-serif;">
              <h1 class="email-heading" style="margin:0 0 16px;font-size:23px;line-height:1.3;color:${INK};font-weight:800;">${escapeHtml(heading)}</h1>
              <div style="font-size:15px;line-height:1.65;color:#334155;">
                ${bodyHtml}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="background:${INK};padding:26px 24px;font-family:'Segoe UI',Arial,sans-serif;">
              <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#ffffff;">${brandName}</p>
              ${footerLines.map((l) => `<p style="margin:3px 0;font-size:12px;color:#94a3b8;">${l}</p>`).join('')}
              ${poweredBy}
              ${unsubscribeUrl ? `<p style="margin:14px 0 0;font-size:11px;color:#64748b;">Don't want these emails? <a href="${unsubscribeUrl}" target="_blank" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a></p>` : ''}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export { escapeHtml };
