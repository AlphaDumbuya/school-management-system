/**
 * Help Center content model.
 *
 * Structured like the help centres of large platforms:
 *   /support                              → home: search, popular articles, collections, tickets
 *   /support/:collectionId                → a collection (topic) listing its articles
 *   /support/:collectionId/:articleId     → a single article with an on-this-page outline
 *
 * Content lives in `helpArticles.ts` as structured data so the pages stay
 * declarative. Rich text supports INLINE LINKS: a paragraph is an array of
 * segments, each either plain text or a link token `{ text, to }`, so a
 * sentence can turn the phrase that names a feature into the link itself.
 */
import type { UserRole } from '@appTypes/index';
import { HELP_COLLECTIONS, HELP_ARTICLES } from './helpArticles';

/** A single inline segment: plain string, or a link with visible text + route. */
export type RichSegment = string | { text: string; to: string };
/** A rich paragraph is a sequence of segments rendered inline. */
export type RichText = RichSegment[];

export interface HelpStep {
  /** Short imperative title, e.g. "Mark a class register". */
  title: string;
  /** Body paragraphs; each supports inline links. */
  body: RichText[];
  /** Optional primary link shown under the step. */
  action?: { label: string; to: string };
}

/** Content blocks an article section is made of. */
export type HelpBlock =
  | { type: 'p'; text: RichText }
  | { type: 'steps'; items: HelpStep[] }
  | { type: 'list'; items: RichText[] }
  | { type: 'callout'; tone: 'tip' | 'note' | 'warning'; title?: string; text: RichText }
  | { type: 'table'; head: string[]; rows: RichText[][] };

export interface HelpSection {
  /** Anchor id, unique within the article (used by the on-this-page outline). */
  id: string;
  heading: string;
  blocks: HelpBlock[];
}

/** Roles as the help center understands them. Guardians read parent content. */
export type HelpRole = UserRole | 'guardian';

export interface HelpArticle {
  id: string;
  collection: string;
  title: string;
  /** One or two sentences shown in listings and under the title. */
  summary: string;
  /** Who this article is for. */
  roles: HelpRole[];
  /** Extra words people might search for (synonyms, error text). */
  keywords?: string[];
  /** Surfaced on the help-center home. */
  popular?: boolean;
  /** The page this article is about (shown as an "Open" button). */
  route?: string;
  routeLabel?: string;
  sections: HelpSection[];
  /** Related article ids (any collection). */
  related?: string[];
}

export interface HelpCollection {
  id: string;
  title: string;
  /** lucide icon name, resolved on the page. */
  icon: string;
  description: string;
}

export { HELP_COLLECTIONS, HELP_ARTICLES };

// ── Role helpers ─────────────────────────────────────────────────────────────

const normaliseRole = (role?: string | null): HelpRole | undefined => {
  if (!role) return undefined;
  return role as HelpRole;
};

/** Whether an article is meant for this role (guardian reads parent content). */
export function articleVisibleTo(article: HelpArticle, role?: string | null): boolean {
  const r = normaliseRole(role);
  if (!r) return false;
  if (r === 'super_admin') return true; // platform staff support every role
  if (article.roles.includes(r)) return true;
  if (r === 'guardian' && article.roles.includes('parent')) return true;
  return false;
}

export function getArticlesForRole(role?: string | null): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => articleVisibleTo(a, role));
}

/** Collections that contain at least one article for this role, in display order. */
export function getCollectionsForRole(role?: string | null): (HelpCollection & { articles: HelpArticle[] })[] {
  const visible = getArticlesForRole(role);
  return HELP_COLLECTIONS
    .map((c) => ({ ...c, articles: visible.filter((a) => a.collection === c.id) }))
    .filter((c) => c.articles.length > 0);
}

export function getCollection(id?: string): HelpCollection | undefined {
  return HELP_COLLECTIONS.find((c) => c.id === id);
}

export function getArticle(collectionId?: string, articleId?: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.collection === collectionId && a.id === articleId);
}

export function findArticleById(articleId: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.id === articleId);
}

export const articlePath = (a: Pick<HelpArticle, 'collection' | 'id'>) => `/support/${a.collection}/${a.id}`;

export function getPopularArticles(role?: string | null, limit = 8): HelpArticle[] {
  return getArticlesForRole(role).filter((a) => a.popular).slice(0, limit);
}

export function getRelatedArticles(article: HelpArticle, role?: string | null, limit = 4): HelpArticle[] {
  const explicit = (article.related || [])
    .map((id) => findArticleById(id))
    .filter((a): a is HelpArticle => !!a && articleVisibleTo(a, role));
  if (explicit.length >= limit) return explicit.slice(0, limit);
  // Top up with siblings from the same collection.
  const siblings = getArticlesForRole(role).filter(
    (a) => a.collection === article.collection && a.id !== article.id && !explicit.includes(a),
  );
  return [...explicit, ...siblings].slice(0, limit);
}

// ── Text helpers ─────────────────────────────────────────────────────────────

/** Flatten a RichText to a plain string (for search matching and snippets). */
export function richToPlain(rt: RichText): string {
  return rt.map((s) => (typeof s === 'string' ? s : s.text)).join('');
}

function blockToPlain(b: HelpBlock): string {
  switch (b.type) {
    case 'p': return richToPlain(b.text);
    case 'list': return b.items.map(richToPlain).join(' ');
    case 'callout': return `${b.title ?? ''} ${richToPlain(b.text)}`;
    case 'steps': return b.items.map((s) => `${s.title} ${s.body.map(richToPlain).join(' ')}`).join(' ');
    case 'table': return `${b.head.join(' ')} ${b.rows.map((r) => r.map(richToPlain).join(' ')).join(' ')}`;
    default: return '';
  }
}

/** Every searchable word of an article body. */
export function articleBodyText(a: HelpArticle): string {
  return a.sections.map((s) => `${s.heading} ${s.blocks.map(blockToPlain).join(' ')}`).join(' ');
}

export interface HelpSearchResult {
  article: HelpArticle;
  score: number;
  /** A short excerpt around the first body match (empty if the match was in the title). */
  snippet: string;
}

/**
 * Rank articles for a free-text query. Every term must appear somewhere; title
 * and keyword hits weigh more than body hits. Role-scoped.
 */
export function searchArticles(query: string, role?: string | null, limit = 20): HelpSearchResult[] {
  const terms = query.toLowerCase().split(/\s+/).map((t) => t.trim()).filter((t) => t.length > 1);
  if (terms.length === 0) return [];
  const results: HelpSearchResult[] = [];

  for (const a of getArticlesForRole(role)) {
    const title = a.title.toLowerCase();
    const summary = a.summary.toLowerCase();
    const keywords = (a.keywords || []).join(' ').toLowerCase();
    const headings = a.sections.map((s) => s.heading).join(' ').toLowerCase();
    const body = articleBodyText(a);
    const bodyLower = body.toLowerCase();

    let score = 0;
    let allFound = true;
    for (const t of terms) {
      let hit = 0;
      if (title.includes(t)) hit += 10;
      if (keywords.includes(t)) hit += 6;
      if (summary.includes(t)) hit += 4;
      if (headings.includes(t)) hit += 3;
      if (bodyLower.includes(t)) hit += 1;
      if (hit === 0) { allFound = false; break; }
      score += hit;
    }
    if (!allFound) continue;
    if (title.includes(query.toLowerCase().trim())) score += 15;

    let snippet = '';
    const at = bodyLower.indexOf(terms[0]);
    if (at >= 0 && !title.includes(terms[0])) {
      const start = Math.max(0, at - 60);
      const end = Math.min(body.length, at + 120);
      snippet = `${start > 0 ? '…' : ''}${body.slice(start, end).trim()}${end < body.length ? '…' : ''}`;
    }
    results.push({ article: a, score, snippet });
  }

  return results.sort((x, y) => y.score - x.score).slice(0, limit);
}

/** Roles shown as "Applies to" chips on an article. */
export const ROLE_LABELS: Record<string, string> = {
  principal: 'Principal',
  super_admin: 'Platform admin',
  teacher: 'Teacher',
  accountant: 'Accountant',
  admissions_officer: 'Admissions officer',
  parent: 'Parent',
  guardian: 'Guardian',
  student: 'Student',
};
