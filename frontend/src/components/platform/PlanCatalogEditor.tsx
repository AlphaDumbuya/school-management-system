/**
 * Super admin plan editor: prices, limits, included features, marketing
 * highlights and visibility for each plan. Saving applies live to every school
 * on the plan (features + limits) and to the public pricing page; features a
 * school loses stay visible read-only for them.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, RotateCcw, Save, Pencil, X, Lock } from 'lucide-react';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import planService, { PlanCatalogPayload, PlanDef, fmtLimit, fmtPrice, isUnlimited } from '@services/planService';

const ACCENTS: Record<string, string> = {
  freetong: 'from-blue-500 to-indigo-600',
  combra: 'from-emerald-500 to-teal-600',
  bintumani: 'from-purple-600 to-pink-600',
};

const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1';

export const PlanCatalogEditor: React.FC<{ onSaved?: () => void }> = ({ onSaved }) => {
  const [catalog, setCatalog] = useState<PlanCatalogPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PlanDef | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setCatalog(await planService.getAdminPlans()); } catch { /* shown as empty */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading && !catalog) {
    return <div className="flex items-center gap-2 text-sm text-gray-500 mb-8"><Loader2 className="animate-spin" size={16} /> Loading plans…</div>;
  }
  if (!catalog) {
    return <p className="text-sm text-red-600 mb-8">Plans could not be loaded. <button className="underline" onClick={load}>Retry</button></p>;
  }

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const { id, ...patch } = editing;
      const res: any = await planService.updatePlan(id, patch);
      if (res?.success) {
        showToast.success(res.message || 'Plan saved');
        setEditing(null);
        await load();
        onSaved?.();
      } else {
        showToast.error(res?.error?.message || res?.error || 'Could not save the plan');
      }
    } finally { setSaving(false); }
  };

  const reset = async (plan: PlanDef) => {
    if (!window.confirm(`Reset ${plan.name} to its built-in prices, limits and features?`)) return;
    const res: any = await planService.resetPlan(plan.id);
    if (res?.success) { showToast.success(res.message || 'Plan reset'); setEditing(null); await load(); onSaved?.(); }
    else showToast.error(res?.error?.message || res?.error || 'Could not reset the plan');
  };

  return (
    <div className="mb-8">
      <div className="flex items-end justify-between gap-4 mb-3 flex-wrap">
        <div>
          <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">Plans &amp; features</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            Edit what each plan costs and includes. Changes apply right away to every school on the plan and to the public pricing page.
            Schools that lose a feature keep their records in read-only mode.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {catalog.plans.map((plan) => {
          const included = catalog.features.filter((f) => !f.core && plan.features[f.key]);
          return (
            <div key={plan.id} className={`bg-gradient-to-br ${ACCENTS[plan.id] || 'from-slate-600 to-slate-800'} rounded-2xl p-6 text-white shadow-md flex flex-col`}>
              <div className="flex justify-between items-center mb-3 gap-2">
                <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded truncate">{plan.badge || plan.id}</span>
                <span className="text-[11px] font-semibold bg-black/20 px-2 py-0.5 rounded">{catalog.tenants?.[plan.id] ?? 0} active</span>
              </div>
              <h4 className="text-xl font-bold mb-1">{plan.name}{!plan.is_public && <span className="ml-2 text-[10px] font-bold uppercase bg-black/30 px-1.5 py-0.5 rounded align-middle">Hidden</span>}</h4>
              <p className="text-2xl font-black">{fmtPrice(plan.monthly_price)} <span className="text-xs font-normal">/ month</span></p>
              <p className="text-xs opacity-80 mb-4">{fmtPrice(plan.yearly_price)} / year</p>
              <ul className="text-xs space-y-1.5 border-t border-white/10 pt-4 opacity-95 flex-1">
                <li className="flex items-center gap-1.5"><CheckCircle2 size={12} /> {fmtLimit(plan.max_students, 'students', catalog.unlimited)}</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 size={12} /> {fmtLimit(plan.max_staff, 'staff', catalog.unlimited)}</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 size={12} /> All core modules</li>
                {included.map((f) => (
                  <li key={f.key} className="flex items-center gap-1.5"><CheckCircle2 size={12} /> {f.label}{f.soon && <span className="text-[9px] uppercase font-bold bg-white/20 px-1 rounded">Soon</span>}</li>
                ))}
              </ul>
              <div className="flex gap-2 mt-5">
                <button type="button" onClick={() => setEditing(JSON.parse(JSON.stringify(plan)))}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 px-3 py-2 text-sm font-semibold">
                  <Pencil size={14} aria-hidden="true" /> Edit
                </button>
                <button type="button" onClick={() => reset(plan)} title="Reset to defaults" aria-label={`Reset ${plan.name} to defaults`}
                  className="inline-flex items-center justify-center rounded-lg bg-black/20 hover:bg-black/30 px-3 py-2">
                  <RotateCcw size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <PlanEditDialog plan={editing} catalog={catalog} saving={saving}
          onChange={setEditing} onCancel={() => setEditing(null)} onSave={save} />
      )}
    </div>
  );
};

const PlanEditDialog: React.FC<{
  plan: PlanDef; catalog: PlanCatalogPayload; saving: boolean;
  onChange: (p: PlanDef) => void; onCancel: () => void; onSave: () => void;
}> = ({ plan, catalog, saving, onChange, onCancel, onSave }) => {
  const set = <K extends keyof PlanDef>(k: K, v: PlanDef[K]) => onChange({ ...plan, [k]: v });
  const groups = useMemo(() => {
    const m = new Map<string, typeof catalog.features>();
    catalog.features.filter((f) => !f.core).forEach((f) => { if (!m.has(f.group)) m.set(f.group, []); m.get(f.group)!.push(f); });
    return [...m.entries()];
  }, [catalog]);
  const core = catalog.features.filter((f) => f.core);

  const limitField = (key: 'max_students' | 'max_staff' | 'max_users' | 'max_storage_gb', label: string, allowUnlimited = true) => {
    const unlimited = allowUnlimited && isUnlimited(plan[key], catalog.unlimited);
    return (
      <div>
        <label className={labelCls} htmlFor={`plan-${key}`}>{label}</label>
        <input id={`plan-${key}`} type="number" min={1} className={inputCls} disabled={unlimited}
          value={unlimited ? '' : plan[key]} placeholder={unlimited ? 'Unlimited' : undefined}
          onChange={(e) => set(key, Math.max(1, Number(e.target.value) || 1))} />
        {allowUnlimited && (
          <label className="mt-1 inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={unlimited}
              onChange={(e) => set(key, e.target.checked ? catalog.unlimited : 100)} /> Unlimited
          </label>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 p-3 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="plan-edit-title">
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-gray-800 shadow-xl my-6">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-4">
          <h2 id="plan-edit-title" className="text-base font-bold text-gray-900 dark:text-white">Edit {plan.name} <span className="text-xs font-normal text-gray-500">({plan.id})</span></h2>
          <button type="button" onClick={onCancel} aria-label="Close" className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-6 max-h-[70vh] overflow-y-auto">
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls} htmlFor="plan-name">Name</label>
              <input id="plan-name" className={inputCls} value={plan.name} maxLength={40} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="plan-badge">Badge</label>
              <input id="plan-badge" className={inputCls} value={plan.badge} maxLength={30} onChange={(e) => set('badge', e.target.value)} />
            </div>
            <div className="flex flex-col justify-end gap-1.5 text-sm text-gray-700 dark:text-gray-200">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={plan.is_public} onChange={(e) => set('is_public', e.target.checked)} /> Show on pricing page</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={plan.featured} onChange={(e) => set('featured', e.target.checked)} /> Highlight as most popular</label>
            </div>
            <div className="sm:col-span-3">
              <label className={labelCls} htmlFor="plan-tagline">Tagline</label>
              <input id="plan-tagline" className={inputCls} value={plan.tagline} maxLength={160} onChange={(e) => set('tagline', e.target.value)} />
            </div>
          </section>

          <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className={labelCls} htmlFor="plan-monthly">Monthly (NLe)</label>
              <input id="plan-monthly" type="number" min={0} step="0.01" className={inputCls} value={plan.monthly_price}
                onChange={(e) => set('monthly_price', Math.max(0, Number(e.target.value) || 0))} />
            </div>
            <div>
              <label className={labelCls} htmlFor="plan-yearly">Yearly (NLe)</label>
              <input id="plan-yearly" type="number" min={0} step="0.01" className={inputCls} value={plan.yearly_price}
                onChange={(e) => set('yearly_price', Math.max(0, Number(e.target.value) || 0))} />
              <button type="button" className="mt-1 text-xs text-blue-600 hover:underline" onClick={() => set('yearly_price', Math.round(plan.monthly_price * 10 * 100) / 100)}>
                Use 10 × monthly
              </button>
            </div>
            {limitField('max_students', 'Students')}
            {limitField('max_staff', 'Staff')}
            {limitField('max_users', 'User logins (staff)')}
            {limitField('max_storage_gb', 'Storage (GB)', false)}
          </section>

          <section>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Included features</h3>
            <p className="text-xs text-gray-500 mb-3">
              Always included: {core.map((f) => f.label).join(', ')}.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {groups.map(([group, feats]) => (
                <fieldset key={group} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                  <legend className="px-1 text-xs font-bold uppercase tracking-wider text-gray-500">{group}</legend>
                  {feats.map((f) => (
                    <label key={f.key} className="flex items-start gap-2 py-1.5 text-sm text-gray-800 dark:text-gray-100 cursor-pointer">
                      <input type="checkbox" className="mt-0.5" checked={!!plan.features[f.key]}
                        onChange={(e) => set('features', { ...plan.features, [f.key]: e.target.checked })} />
                      <span>
                        <span className="font-medium">{f.label}</span>
                        {f.soon && <span className="ml-1.5 text-[10px] font-bold uppercase text-amber-700 bg-amber-100 px-1 rounded">Soon</span>}
                        <span className="block text-xs text-gray-500">{f.description}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
          </section>

          <section>
            <label className={labelCls} htmlFor="plan-highlights">Extra bullets on the pricing card (one per line)</label>
            <textarea id="plan-highlights" rows={3} className={inputCls} value={(plan.highlights || []).join('\n')}
              onChange={(e) => set('highlights', e.target.value.split('\n').map((s) => s.trimStart()).slice(0, 12))} />
            <p className="mt-1 text-xs text-gray-500 flex items-center gap-1"><Lock size={12} aria-hidden="true" /> Schools that lose a feature keep their records in read-only mode; nothing is deleted.</p>
          </section>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 dark:border-gray-700 px-5 py-4">
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={onSave} disabled={saving || !plan.name.trim()}>
            {saving ? <Loader2 className="animate-spin mr-1.5" size={14} /> : <Save size={14} className="mr-1.5" />}
            Save plan
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PlanCatalogEditor;
