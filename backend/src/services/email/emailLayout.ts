/**
 * emailLayout — the shared HTML shell for every transactional email.
 *
 * Enterprise style: white document on a neutral canvas, the sender's own logo
 * and name in the header, a thin brand rule, restrained typography, one solid
 * call-to-action, and a footer with the sender's live contact details (the
 * SCHOOL for tenant emails, WiSkul for platform emails).
 *
 * Built for real inboxes:
 *  - Table layout with inline styles (Gmail, Outlook desktop/web, Apple Mail,
 *    Yahoo, Android/iOS mail apps); Outlook gets a fixed 600px ghost table and
 *    VML buttons, everything else is fluid.
 *  - Mobile first: 100% width under 600px, stacked detail rows, 44px tap
 *    targets, no fixed widths that overflow.
 *  - Every link is absolute. Buttons also print their URL underneath, so the
 *    link still works where buttons don't render.
 *  - Light colour scheme declared so dark-mode clients don't invert the logo.
 */
import type { EmailBranding } from './emailBranding';

// Neutral, accessible palette (WCAG AA on white).
const BRAND = '#1e3a8a'; // deep navy: rule, headings accents, buttons
const BRAND_HOVERLESS = '#1e40af';
const TEXT = '#1f2937';
const MUTED = '#6b7280';
const BORDER = '#e5e7eb';
const CANVAS = '#f3f4f6';
const PANEL = '#f9fafb';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only absolute http(s)/mailto/tel links are emitted; anything else is dropped. */
function safeHref(href: string): string | null {
  const h = String(href || '').trim();
  return /^(https?:\/\/|mailto:|tel:)/i.test(h) ? h.replace(/"/g, '%22') : null;
}

/**
 * Primary call-to-action. `href` must be absolute. Renders a bulletproof button
 * (VML for Outlook) and the plain link underneath as a fallback.
 */
export function emailButton(label: string, href: string): string {
  const url = safeHref(href);
  if (!url) return '';
  const text = escapeHtml(label);
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
    <tr>
      <td align="left" style="border-radius:6px;" bgcolor="${BRAND_HOVERLESS}">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:46px;v-text-anchor:middle;width:260px;" arcsize="12%" stroke="f" fillcolor="${BRAND_HOVERLESS}">
          <w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${text}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-- -->
        <a href="${url}" target="_blank" rel="noopener"
           style="display:inline-block;min-width:180px;padding:13px 28px;font-family:${FONT};font-size:15px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;text-align:center;border-radius:6px;background:${BRAND_HOVERLESS};mso-hide:all;">${text}</a>
        <!--<![endif]-->
      </td>
    </tr>
  </table>
  <p style="margin:0 0 4px;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">
    Button not working? Copy this link into your browser:<br />
    <a href="${url}" target="_blank" rel="noopener" style="color:${BRAND_HOVERLESS};text-decoration:underline;word-break:break-all;">${escapeHtml(url)}</a>
  </p>`;
}

/** A labelled row for a details table. Stacks label above value on phones. */
export function detailRow(label: string, value: string): string {
  return `
  <tr class="stack">
    <td class="detail-label" style="padding:11px 16px;border-top:1px solid ${BORDER};font-family:${FONT};font-size:13px;line-height:18px;color:${MUTED};vertical-align:top;width:38%;">${escapeHtml(label)}</td>
    <td class="detail-value" style="padding:11px 16px;border-top:1px solid ${BORDER};font-family:${FONT};font-size:14px;line-height:20px;color:${TEXT};font-weight:600;vertical-align:top;word-break:break-word;">${value}</td>
  </tr>`;
}

/** Wrap a set of detailRow()s in a bordered summary table. */
export function detailsCard(rows: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="width:100%;border:1px solid ${BORDER};border-radius:6px;border-collapse:separate;margin:18px 0;overflow:hidden;">
    ${/* no rule above the first row (label + value cell) */ rows.replace(`border-top:1px solid ${BORDER};`, 'border-top:0;').replace(`border-top:1px solid ${BORDER};`, 'border-top:0;')}
  </table>`;
}

/** A neutral note with a coloured rule. tone: 'info' | 'warn' | 'success'. */
export function calloutBlock(html: string, tone: 'info' | 'warn' | 'success' = 'info'): string {
  const rule = { info: '#2563eb', warn: '#d97706', success: '#059669' }[tone];
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:18px 0;">
    <tr>
      <td style="background:${PANEL};border:1px solid ${BORDER};border-left:3px solid ${rule};border-radius:4px;padding:14px 16px;font-family:${FONT};font-size:14px;line-height:21px;color:${TEXT};">
        ${html}
      </td>
    </tr>
  </table>`;
}

export interface RenderOptions {
  branding: EmailBranding;
  /** Small label above the heading, e.g. "Admissions". */
  eyebrow?: string;
  heading: string;
  /** Main body HTML (paragraphs, cards, buttons via the helpers above). */
  bodyHtml: string;
  /** Inbox preview text. */
  preheader?: string;
  /** Marketing emails: a token-based unsubscribe URL rendered in the footer. */
  unsubscribeUrl?: string;
}

/** Normalise the body's legacy inline styles to the enterprise palette. */
function tidyBody(html: string): string {
  return String(html || '')
    // old brand colours used inside bodies
    .replace(/#00d4aa/gi, BRAND_HOVERLESS)
    .replace(/color:#1d4ed8/gi, `color:${BRAND_HOVERLESS}`)
    .replace(/color:#64748b/gi, `color:${MUTED}`)
    .replace(/color:#334155/gi, `color:${TEXT}`)
    // paragraphs get consistent spacing
    .replace(/<p>/g, `<p style="margin:0 0 14px;">`);
}

/**
 * Render a complete responsive HTML email around the given body.
 */
export function renderEmail({ branding, eyebrow, heading, bodyHtml, preheader, unsubscribeUrl }: RenderOptions): string {
  const brandName = escapeHtml(branding.name);
  // Schools often save their website without a scheme ("myschool.edu.sl").
  const site = branding.website && !/^https?:\/\//i.test(branding.website) && /^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(branding.website.trim())
    ? `https://${branding.website.trim()}`
    : branding.website;
  branding = { ...branding, website: site };
  const home = safeHref(branding.website || branding.appUrl) || safeHref(branding.appUrl);

  // Header: the sender's logo (hosted, absolute) + name. Falls back to a
  // monogram tile when there is no usable logo.
  const logo = branding.logoUrl && /^https?:\/\//i.test(branding.logoUrl)
    ? `<img src="${branding.logoUrl.replace(/"/g, '%22')}" alt="${brandName}" width="48" height="48"
           style="display:block;width:48px;height:48px;max-width:48px;object-fit:contain;border:0;outline:none;text-decoration:none;border-radius:6px;" />`
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
         <td width="48" height="48" align="center" valign="middle" bgcolor="${BRAND}"
             style="width:48px;height:48px;border-radius:6px;font-family:${FONT};font-size:18px;font-weight:700;color:#ffffff;">${escapeHtml(initials(branding.name))}</td>
       </tr></table>`;
  const logoLinked = home ? `<a href="${home}" target="_blank" rel="noopener" style="text-decoration:none;">${logo}</a>` : logo;

  // Footer contacts: only what the sender has filled in, all clickable.
  const contact: string[] = [];
  if (branding.contactEmail) {
    contact.push(`<a href="mailto:${escapeHtml(branding.contactEmail)}" style="color:${BRAND_HOVERLESS};text-decoration:none;">${escapeHtml(branding.contactEmail)}</a>`);
  }
  if (branding.contactPhone) {
    const tel = String(branding.contactPhone).replace(/[^\d+]/g, '');
    contact.push(tel ? `<a href="tel:${tel}" style="color:${BRAND_HOVERLESS};text-decoration:none;">${escapeHtml(branding.contactPhone)}</a>` : escapeHtml(branding.contactPhone));
  }
  const website = branding.website && safeHref(branding.website)
    ? `<a href="${safeHref(branding.website)}" target="_blank" rel="noopener" style="color:${BRAND_HOVERLESS};text-decoration:none;">${escapeHtml(branding.website.replace(/^https?:\/\//i, '').replace(/\/$/, ''))}</a>`
    : '';

  const footerRows = [
    `<p style="margin:0 0 6px;font-size:14px;line-height:20px;font-weight:700;color:${TEXT};">${brandName}</p>`,
    branding.address ? `<p style="margin:0 0 4px;font-size:12px;line-height:18px;color:${MUTED};">${escapeHtml(branding.address)}</p>` : '',
    contact.length ? `<p style="margin:0 0 4px;font-size:12px;line-height:18px;color:${MUTED};">${contact.join('&nbsp;&nbsp;|&nbsp;&nbsp;')}</p>` : '',
    website ? `<p style="margin:0 0 4px;font-size:12px;line-height:18px;color:${MUTED};">${website}</p>` : '',
  ].join('');

  const notice = branding.isPlatform
    ? `You are receiving this email because of your WiSkul account or a request made on our website.`
    : `You are receiving this email because you are connected to ${brandName}. Replies go to the school.`;
  const poweredBy = branding.isPlatform
    ? ''
    : ` &nbsp;·&nbsp; Sent with <a href="https://www.wiskulsl.com" target="_blank" rel="noopener" style="color:${MUTED};text-decoration:underline;">WiSkul</a>`;
  const unsub = unsubscribeUrl && safeHref(unsubscribeUrl)
    ? ` &nbsp;·&nbsp; <a href="${safeHref(unsubscribeUrl)}" target="_blank" rel="noopener" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(heading)}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    :root { color-scheme: light; supported-color-schemes: light; }
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
    body { margin:0 !important; padding:0 !important; width:100% !important; background:${CANVAS}; }
    a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; }
    @media only screen and (max-width:620px) {
      .container { width:100% !important; max-width:100% !important; border-radius:0 !important; border-left:0 !important; border-right:0 !important; }
      .outer { padding:0 !important; }
      .pad { padding-left:20px !important; padding-right:20px !important; }
      .heading { font-size:20px !important; line-height:28px !important; }
      .stack .detail-label, .stack .detail-value { display:block !important; width:auto !important; }
      .stack .detail-label { padding-bottom:2px !important; }
      .stack .detail-value { border-top:0 !important; padding-top:0 !important; }
      .hide-sm { display:none !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${CANVAS};">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader || heading)}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CANVAS};">
    <tr>
      <td class="outer" align="center" style="padding:32px 12px;">
        <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
        <table role="presentation" class="container" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="width:100%;max-width:600px;background:#ffffff;border:1px solid ${BORDER};border-radius:8px;border-collapse:separate;overflow:hidden;">

          <!-- Brand rule -->
          <tr><td style="height:4px;line-height:4px;font-size:0;background:${BRAND};" bgcolor="${BRAND}">&nbsp;</td></tr>

          <!-- Header: logo + sender name -->
          <tr>
            <td class="pad" style="padding:22px 32px;border-bottom:1px solid ${BORDER};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="48" valign="middle" style="width:48px;padding-right:14px;">${logoLinked}</td>
                  <td valign="middle" style="font-family:${FONT};">
                    <div style="font-size:16px;line-height:22px;font-weight:700;color:${TEXT};">${brandName}</div>
                    ${branding.motto ? `<div style="font-size:12px;line-height:18px;color:${MUTED};">${escapeHtml(branding.motto)}</div>` : ''}
                  </td>
                  ${eyebrow ? `<td class="hide-sm" align="right" valign="middle" style="font-family:${FONT};font-size:11px;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};font-weight:600;white-space:nowrap;">${escapeHtml(eyebrow)}</td>` : ''}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="pad" style="padding:30px 32px 32px;font-family:${FONT};">
              <h1 class="heading" style="margin:0 0 18px;font-family:${FONT};font-size:22px;line-height:30px;font-weight:700;color:${TEXT};">${escapeHtml(heading)}</h1>
              <div style="font-family:${FONT};font-size:15px;line-height:24px;color:${TEXT};">
                ${tidyBody(bodyHtml)}
              </div>
            </td>
          </tr>

          <!-- Footer: sender's contact details -->
          <tr>
            <td class="pad" style="padding:22px 32px;background:${PANEL};border-top:1px solid ${BORDER};font-family:${FONT};" bgcolor="${PANEL}">
              ${footerRows}
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->

        <!-- Legal line -->
        <table role="presentation" class="container" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
          <tr>
            <td class="pad" align="center" style="padding:16px 32px 0;font-family:${FONT};font-size:11px;line-height:17px;color:${MUTED};">
              ${notice}${poweredBy}${unsub}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function initials(name: string): string {
  const words = String(name || '').trim().split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
  const s = (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || 'S').slice(0, 2));
  return s.toUpperCase();
}

export { escapeHtml };
