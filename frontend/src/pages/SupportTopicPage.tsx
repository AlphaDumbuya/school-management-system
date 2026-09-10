/**
 * SupportTopicPage — /support/:topicId
 * A descriptive "how to operate" guide for a single module. Sentences can embed
 * inline links so mentioning a feature turns the phrase itself into a link.
 */
import React from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, ChevronRight, Lightbulb, LifeBuoy,
  Settings, Users, GraduationCap, ClipboardCheck, Wallet, CreditCard,
  CalendarDays, Megaphone, BookOpen, Building, ShieldCheck,
} from 'lucide-react';
import { MainLayout } from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { getModule, RichText } from '@lib/helpCenter';

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Settings, Users, GraduationCap, ClipboardCheck, Wallet, CreditCard,
  CalendarDays, Megaphone, BookOpen, Building, ShieldCheck, LifeBuoy,
};

/** Render a rich paragraph, turning link tokens into inline anchors. */
export const Rich: React.FC<{ text: RichText; className?: string }> = ({ text, className }) => (
  <span className={className}>
    {text.map((seg, i) =>
      typeof seg === 'string' ? (
        <React.Fragment key={i}>{seg}</React.Fragment>
      ) : (
        <Link
          key={i}
          to={seg.to}
          className="font-semibold text-blue-600 hover:text-blue-700 underline decoration-blue-300 underline-offset-2"
        >
          {seg.text}
        </Link>
      )
    )}
  </span>
);

export const SupportTopicPage: React.FC = () => {
  const { topicId } = useParams();
  const module = getModule(topicId);

  if (!module) return <Navigate to="/support" replace />;

  // If the module isn't meant for this role, still show it (read-only help) but
  // send them back to the directory if they'd rather.
  const Icon = ICONS[module.icon] || BookOpen;

  return (
    <MainLayout>
      <PageShell
        title={module.title}
        subtitle="How to operate this module"
        breadcrumbs={[{ label: 'Support', href: '/support' }, { label: module.title }]}
        actions={
          module.route ? (
            <Link to={module.route}>
              <Button variant="default" size="sm">
                {module.routeLabel || 'Open'} <ArrowRight size={14} className="ml-1.5" />
              </Button>
            </Link>
          ) : undefined
        }
      >
        <Link to="/support" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-4">
          <ArrowLeft size={15} /> All help topics
        </Link>

        {/* Module hero */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 flex items-start gap-4">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
            <Icon size={24} />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{module.title}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
              <Rich text={module.intro} />
            </p>
          </div>
        </div>

        {/* Articles */}
        <div className="mt-6 space-y-6">
          {module.articles.map((a) => (
            <section key={a.id} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">{a.heading}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                <Rich text={a.intro} />
              </p>

              <ol className="mt-5 space-y-5">
                {a.steps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white">{s.title}</p>
                      {s.body.map((p, bi) => (
                        <p key={bi} className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                          <Rich text={p} />
                        </p>
                      ))}
                      {s.action && (
                        <Link
                          to={s.action.to}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          {s.action.label} <ChevronRight size={14} />
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ol>

              {a.tips && a.tips.length > 0 && (
                <div className="mt-5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 p-4">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-sm font-semibold mb-1.5">
                    <Lightbulb size={16} /> Tips
                  </div>
                  <ul className="space-y-1.5">
                    {a.tips.map((t, ti) => (
                      <li key={ti} className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                        <Rich text={t} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Still need help */}
        <section className="mt-6 rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/20 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Didn't find what you needed?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
              Raise a ticket from the <Link to="/support" className="text-blue-600 font-medium underline">support home</Link>, or email <a href="mailto:support@wiskulsl.com" className="text-blue-600 font-medium underline">support@wiskulsl.com</a>.
            </p>
          </div>
          <Link to="/support" className="shrink-0">
            <Button variant="outline">Back to help center</Button>
          </Link>
        </section>
      </PageShell>
    </MainLayout>
  );
};

export default SupportTopicPage;
