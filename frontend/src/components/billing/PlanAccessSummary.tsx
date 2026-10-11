/**
 * PlanAccessSummary — tells the principal, in one place, exactly what the
 * school's current plan gives them:
 *   - Included        (full use)
 *   - Read-only       (used on the trial / a higher plan; records kept, view only)
 *   - Portals off     (users of that portal can't sign in; with account counts)
 *   - Not included    (available on a higher plan)
 */
import React from 'react';
import { CheckCircle2, Lock, PowerOff, Plus } from 'lucide-react';
import type { PlanFeatureDef } from '@services/planService';

type Access = 'enabled' | 'read_only' | 'locked';

interface Props {
  planName: string;
  features: PlanFeatureDef[];
  access: Record<string, Access>;
  portals?: Record<string, { access: Access; users: number }>;
}

const Section: React.FC<{ title: string; hint: string; icon: React.ReactNode; tone: string; items: string[] }> = ({ title, hint, icon, tone, items }) =>
  items.length ? (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <h4 className="flex items-center gap-2 text-sm font-bold">{icon}{title}</h4>
      <p className="mt-0.5 text-xs opacity-80">{hint}</p>
      <ul className="mt-2 space-y-1 text-xs">
        {items.map((i) => <li key={i} className="flex gap-1.5"><span aria-hidden="true">•</span><span>{i}</span></li>)}
      </ul>
    </div>
  ) : null;

export const PlanAccessSummary: React.FC<Props> = ({ planName, features, access, portals }) => {
  const live = features.filter((f) => !f.soon);
  const core = live.filter((f) => f.core).map((f) => f.label);
  const switchable = live.filter((f) => !f.core);
  const included = [...core, ...switchable.filter((f) => access[f.key] === 'enabled').map((f) => f.label)];
  const readOnly = switchable.filter((f) => access[f.key] === 'read_only').map((f) => f.label);
  const portalsOff = switchable.filter((f) => f.key.startsWith('portal_') && access[f.key] === 'locked').map((f) => {
    const n = portals?.[f.key]?.users || 0;
    return n ? `${f.label}: ${n} account${n === 1 ? '' : 's'} can't sign in` : f.label;
  });
  const notIncluded = switchable.filter((f) => !f.key.startsWith('portal_') && access[f.key] === 'locked').map((f) => f.label);

  return (
    <section aria-label={`What the ${planName} plan includes`} className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <h3 className="text-base font-extrabold text-gray-900">What your {planName} plan includes</h3>
      <p className="text-xs text-gray-500 mt-0.5">Nothing is ever deleted. Upgrading brings back everything below straight away.</p>
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Section title="Included" hint="Full use for everyone with access." icon={<CheckCircle2 size={15} aria-hidden="true" />} tone="border-emerald-200 bg-emerald-50 text-emerald-900" items={included} />
        <div className="space-y-3">
          <Section title="Switched off" hint="These portals aren't in your plan. Their accounts are kept but can't sign in." icon={<PowerOff size={15} aria-hidden="true" />} tone="border-red-200 bg-red-50 text-red-900" items={portalsOff} />
          <Section title="Read-only" hint="Used during your trial or a higher plan. Records stay visible; nothing new can be added or changed." icon={<Lock size={15} aria-hidden="true" />} tone="border-amber-200 bg-amber-50 text-amber-900" items={readOnly} />
          <Section title="Available on a higher plan" hint="Hidden from your menus until you upgrade." icon={<Plus size={15} aria-hidden="true" />} tone="border-gray-200 bg-gray-50 text-gray-800" items={notIncluded} />
        </div>
      </div>
    </section>
  );
};

export default PlanAccessSummary;
