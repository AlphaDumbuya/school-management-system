/**
 * SupportTopicPage — the help-center ARTICLE and COLLECTION pages.
 *   /support/:collectionId              → a collection listing its articles
 *   /support/:collectionId/:articleId   → a single article
 *
 * Article pages have breadcrumbs, an "on this page" outline, applies-to chips,
 * a "Was this helpful?" prompt, related articles and prev/next navigation —
 * the structure used by large help centres.
 */
import React, { useMemo, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowRightCircle, ArrowLeftCircle, LifeBuoy, ThumbsUp, ThumbsDown } from 'lucide-react';
import { MainLayout } from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { useAuth } from '@hooks/useAuth';
import {
  getCollection, getArticle, getArticlesForRole, getRelatedArticles,
  articleVisibleTo, articlePath, ROLE_LABELS, type HelpArticle,
} from '@lib/helpCenter';
import { COLLECTION_ICONS, Block } from './support/helpUi';

const BookOpen = COLLECTION_ICONS.BookOpen;

// ── Collection page ────────────────────────────────────────────────────────
const CollectionView: React.FC<{ collectionId: string }> = ({ collectionId }) => {
  const { user } = useAuth();
  const collection = getCollection(collectionId);
  const articles = useMemo(
    () => getArticlesForRole(user?.role).filter((a) => a.collection === collectionId),
    [collectionId, user?.role],
  );
  if (!collection || articles.length === 0) return <Navigate to="/support" replace />;
  const Icon = COLLECTION_ICONS[collection.icon] || BookOpen;

  return (
    <MainLayout>
      <PageShell
        title={collection.title}
        subtitle={collection.description}
        breadcrumbs={[{ label: 'Help Center', href: '/support' }, { label: collection.title }]}
      >
        <Link to="/support" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-4">
          <ArrowLeft size={15} /> All collections
        </Link>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 flex items-start gap-4 mb-6">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"><Icon size={24} /></span>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{collection.title}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{collection.description}</p>
            <p className="text-xs text-gray-400 mt-2">{articles.length} article{articles.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          {articles.map((a) => (
            <Link key={a.id} to={articlePath(a)} className="block px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 group">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600">{a.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{a.summary}</p>
                </div>
                <ArrowRight size={16} className="shrink-0 text-gray-300 group-hover:text-blue-500 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </PageShell>
    </MainLayout>
  );
};

// ── "Was this helpful?" ──────────────────────────────────────────────────────
const Helpful: React.FC<{ articleId: string }> = ({ articleId }) => {
  const [vote, setVote] = useState<'up' | 'down' | null>(null);
  return (
    <div className="mt-8 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-5 text-center">
      {vote === null ? (
        <>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Was this article helpful?</p>
          <div className="mt-3 flex items-center justify-center gap-3">
            <button onClick={() => setVote('up')} aria-label="Yes, helpful" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:border-emerald-400 hover:text-emerald-600">
              <ThumbsUp size={15} /> Yes
            </button>
            <button onClick={() => setVote('down')} aria-label="No, not helpful" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:border-rose-400 hover:text-rose-600">
              <ThumbsDown size={15} /> No
            </button>
          </div>
        </>
      ) : vote === 'up' ? (
        <p className="text-sm text-gray-700 dark:text-gray-200">Thanks for the feedback.</p>
      ) : (
        <p className="text-sm text-gray-700 dark:text-gray-200">
          Sorry this didn't help. <Link to="/support" state={{ openTicket: true }} className="text-blue-600 font-semibold underline">Raise a ticket</Link> and we'll sort it out.
        </p>
      )}
      <input type="hidden" value={articleId} readOnly />
    </div>
  );
};

// ── Article page ──────────────────────────────────────────────────────────────
const ArticleView: React.FC<{ collectionId: string; articleId: string }> = ({ collectionId, articleId }) => {
  const { user } = useAuth();
  const article = getArticle(collectionId, articleId);
  const collection = getCollection(collectionId);

  if (!article || !collection) return <Navigate to="/support" replace />;
  if (!articleVisibleTo(article, user?.role)) return <Navigate to={`/support/${collectionId}`} replace />;

  const related = getRelatedArticles(article, user?.role);
  // Prev/next within the same collection (role-scoped).
  const siblings = getArticlesForRole(user?.role).filter((a) => a.collection === collectionId);
  const idx = siblings.findIndex((a) => a.id === article.id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  const roles = article.roles.filter((r) => r !== 'super_admin');

  return (
    <MainLayout>
      <PageShell
        title={article.title}
        subtitle={article.summary}
        breadcrumbs={[
          { label: 'Help Center', href: '/support' },
          { label: collection.title, href: `/support/${collection.id}` },
          { label: article.title },
        ]}
        actions={article.route ? (
          <Link to={article.route}><Button variant="default" size="sm">{article.routeLabel || 'Open'} <ArrowRight size={14} className="ml-1.5" /></Button></Link>
        ) : undefined}
      >
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <article className="min-w-0 flex-1 space-y-8">
            {/* Applies-to chips */}
            {roles.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">For</span>
                {roles.map((r) => (
                  <span key={r} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{ROLE_LABELS[r] || r}</span>
                ))}
              </div>
            )}

            {article.sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-24 space-y-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{s.heading}</h2>
                {s.blocks.map((b, i) => <Block key={i} block={b} />)}
              </section>
            ))}

            <Helpful articleId={article.id} />

            {/* Prev / next */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {prev ? (
                <Link to={articlePath(prev)} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-300 flex items-center gap-3">
                  <ArrowLeftCircle size={18} className="text-blue-500 shrink-0" />
                  <span className="min-w-0"><span className="block text-[11px] text-gray-400">Previous</span><span className="block text-sm font-semibold text-gray-900 dark:text-white truncate">{prev.title}</span></span>
                </Link>
              ) : <span />}
              {next && (
                <Link to={articlePath(next)} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-300 flex items-center gap-3 sm:text-right sm:flex-row-reverse">
                  <ArrowRightCircle size={18} className="text-blue-500 shrink-0" />
                  <span className="min-w-0"><span className="block text-[11px] text-gray-400">Next</span><span className="block text-sm font-semibold text-gray-900 dark:text-white truncate">{next.title}</span></span>
                </Link>
              )}
            </div>
          </article>

          {/* On-this-page + related (sticky sidebar) */}
          <aside className="w-full lg:w-60 shrink-0 lg:sticky lg:top-6 space-y-6">
            {article.sections.length > 1 && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">On this page</p>
                <nav className="space-y-1">
                  {article.sections.map((s) => (
                    <a key={s.id} href={`#${s.id}`} className="block text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 py-0.5">{s.heading}</a>
                  ))}
                </nav>
              </div>
            )}
            {related.length > 0 && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Related</p>
                <nav className="space-y-2">
                  {related.map((r: HelpArticle) => (
                    <Link key={r.id} to={articlePath(r)} className="block text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600">{r.title}</Link>
                  ))}
                </nav>
              </div>
            )}
            <div className="rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/20 p-4">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-sm font-bold"><LifeBuoy size={16} /> Still stuck?</div>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Raise a ticket from the <Link to="/support" className="text-blue-600 underline font-medium">Help Center</Link>.</p>
            </div>
          </aside>
        </div>
      </PageShell>
    </MainLayout>
  );
};

export const SupportTopicPage: React.FC = () => {
  const { collectionId, articleId } = useParams();
  if (!collectionId) return <Navigate to="/support" replace />;
  if (!articleId) return <CollectionView collectionId={collectionId} />;
  return <ArticleView collectionId={collectionId} articleId={articleId} />;
};

export default SupportTopicPage;
