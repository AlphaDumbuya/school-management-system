/**
 * Houses tab: add, rename, recolour, switch off and remove houses, and the
 * ballot rules (how the houses are kept level).
 */
import React, { useState } from 'react';
import { FileUp, Pencil, Plus, Trash2, UserCog } from 'lucide-react';
import { Modal } from '@components/admin/feedback/Modal';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { houseService, type House, type HouseSettings, type HouseSummary } from '@services/houseService';
import { SWATCHES, inputClass, selectClass, textOn } from './houseUi';
import { ImportModal } from './ImportModal';

const Toggle: React.FC<{ id: string; label: string; hint: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }> = ({ id, label, hint, checked, disabled, onChange }) => (
  <label htmlFor={id} className="flex cursor-pointer items-start gap-3 py-3">
    <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
    <span>
      <span className="block text-sm font-semibold text-gray-900 dark:text-white">{label}</span>
      <span className="block text-xs text-gray-500">{hint}</span>
    </span>
  </label>
);

export const HousesTab: React.FC<{ summary?: HouseSummary; onChanged: () => void; onGoTeachers?: () => void }> = ({ summary, onChanged, onGoTeachers }) => {
  const houses = summary?.houses || [];
  const settings = summary?.settings;
  const [editing, setEditing] = useState<House | 'new' | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [motto, setMotto] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<House | null>(null);
  const [savingRule, setSavingRule] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const open = (h: House | 'new') => {
    setEditing(h);
    if (h === 'new') { setName(''); setColor(SWATCHES[houses.length % SWATCHES.length].hex); setMotto(''); }
    else { setName(h.name); setColor(h.color); setMotto(h.motto || ''); }
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const body = { name: name.trim(), color, motto: motto.trim() };
      const r = editing === 'new' ? await houseService.create(body) : await houseService.update(editing.id, body);
      if (r.success === false) { showToast.error(r.error || 'Could not save the house'); return; }
      showToast.success(editing === 'new' ? 'House added' : 'House saved');
      setEditing(null); onChanged();
    } finally { setSaving(false); }
  };

  const toggleActive = async (h: House) => {
    const r = await houseService.update(h.id, { is_active: !h.is_active });
    if (r.success === false) return showToast.error(r.error || 'Could not update the house');
    showToast.success(h.is_active ? `${h.name} switched off. Nobody new is drawn into it.` : `${h.name} switched on`);
    onChanged();
  };

  const remove = async () => {
    if (!removing) return;
    setSaving(true);
    try {
      const r = await houseService.remove(removing.id);
      if (r.success === false) { showToast.error(r.error || 'Could not remove the house'); return; }
      showToast.success('House removed'); setRemoving(null); onChanged();
    } finally { setSaving(false); }
  };

  const setRule = async (patch: Partial<HouseSettings>) => {
    setSavingRule(true);
    try {
      const r = await houseService.updateSettings(patch);
      if (r.success === false) return showToast.error(r.error || 'Could not save the rule');
      showToast.success('Ballot rules saved'); onChanged();
    } finally { setSavingRule(false); }
  };

  return (
    <div className="space-y-6">
      <section aria-labelledby="houses-h">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="houses-h" className="text-base font-bold text-gray-900 dark:text-white">Houses</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><FileUp size={14} className="mr-1" aria-hidden="true" /> Import existing houses</Button>
            <Button variant="create" size="sm" onClick={() => open('new')}><Plus size={14} className="mr-1" aria-hidden="true" /> Add house</Button>
          </div>
        </div>
        {summary && houses.filter((h) => h.is_active).length > 1 && (
          <p role="status" className={`mb-3 rounded-lg border px-3 py-2 text-xs ${summary.spread <= 1 ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
            {summary.spread <= 1
              ? 'The houses are level: no house has more than one student more than another.'
              : `The biggest house has ${summary.spread} more students than the smallest. New draws fill the smaller houses first until they are level. To level them now, move students from the Lists tab.`}
          </p>
        )}
        {houses.length === 0 ? (
          <EmptyState message="No houses yet" description="Add the school's houses, for example Red, Blue, Green and Yellow." action={{ label: 'Add the first house', onClick: () => open('new') }} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {houses.map((h) => (
              <div key={h.id} className={`overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 ${h.is_active ? '' : 'opacity-70'}`}>
                <div className="px-4 py-3" style={{ backgroundColor: h.color, color: textOn(h.color) }}>
                  <p className="text-lg font-black">{h.name}</p>
                  <p className="text-xs opacity-90">{h.is_active ? (h.motto ? `“${h.motto}”` : 'Active') : 'Switched off'}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="mb-2 text-xs text-gray-600 dark:text-gray-300">
                    {h.staff.find((s) => s.position === 'master')
                      ? <>Master / mistress: <strong>{h.staff.find((s) => s.position === 'master')!.name}</strong>{h.staff.length > 1 ? ` · ${h.staff.length - 1} more teacher${h.staff.length - 1 === 1 ? '' : 's'}` : ''}</>
                      : h.staff.length > 0 ? `${h.staff.length} teacher${h.staff.length === 1 ? '' : 's'}, no master or mistress yet` : 'No teachers assigned yet'}
                  </p>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">{h.total}</p>
                  <p className="text-xs text-gray-500">students · {h.male} boys · {h.female} girls{h.other ? ` · ${h.other} other` : ''}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => open(h)} aria-label={`Edit ${h.name}`}><Pencil size={13} className="mr-1" aria-hidden="true" /> Edit</Button>
                    {onGoTeachers && <Button size="sm" variant="outline" onClick={onGoTeachers} aria-label={`Assign the master and teachers of ${h.name}`}><UserCog size={13} className="mr-1" aria-hidden="true" /> Master & teachers</Button>}
                    <Button size="sm" variant="outline" onClick={() => toggleActive(h)}>{h.is_active ? 'Switch off' : 'Switch on'}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setRemoving(h)} aria-label={`Remove ${h.name}`}><Trash2 size={13} aria-hidden="true" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {settings && (
        <section aria-labelledby="rules-h" className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 id="rules-h" className="text-base font-bold text-gray-900 dark:text-white">Ballot rules</h2>
          <p className="mb-1 text-xs text-gray-500">The draw is always random, but it only picks among the smallest houses, so the houses always stay level. These rules decide the tie-breaks.</p>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            <div className="py-3">
              <label htmlFor="rule-scope" className="block text-sm font-semibold text-gray-900 dark:text-white">Also spread each class across the houses</label>
              <select id="rule-scope" value={settings.balance_scope} disabled={savingRule} onChange={(e) => setRule({ balance_scope: e.target.value as 'school' | 'class' })} className={`${selectClass} mt-1 max-w-xs`}>
                <option value="school">No, only keep the whole school level</option>
                <option value="class">Yes, every class gets a mix of houses</option>
              </select>
            </div>
            <Toggle id="rule-gender" label="Balance boys and girls" hint="Each house gets a similar number of boys and of girls." checked={settings.balance_gender} disabled={savingRule} onChange={(v) => setRule({ balance_gender: v })} />
            <Toggle id="rule-siblings" label="Keep brothers and sisters together" hint="A new student joins the house of a sibling (found through the shared parent), as long as that keeps the houses level." checked={settings.keep_siblings} disabled={savingRule} onChange={(v) => setRule({ keep_siblings: v })} />
            {settings.keep_siblings && (
              <div className="py-3 pl-7">
                <label htmlFor="rule-gap" className="block text-sm font-semibold text-gray-900 dark:text-white">A sibling may push a house up to</label>
                <select id="rule-gap" value={settings.level_gap} disabled={savingRule} onChange={(e) => setRule({ level_gap: Number(e.target.value) })} className={`${selectClass} mt-1 max-w-xs`}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} student{n === 1 ? '' : 's'} above the smallest house</option>)}
                </select>
                <p className="mt-1 text-xs text-gray-500">Beyond this the sibling is drawn like anyone else, so no house gets far ahead.</p>
              </div>
            )}
            <Toggle id="rule-auto" label="Draw automatically when a student is enrolled" hint="Applies when a student is enrolled from Admissions or added one by one. Imports of more than 25 students are left for the ballot. Leave this off to hold a live ballot on registration day instead." checked={settings.auto_assign_on_enrol} disabled={savingRule} onChange={(v) => setRule({ auto_assign_on_enrol: v })} />
          </div>
        </section>
      )}

      <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} onDone={onChanged} />

      <Modal isOpen={!!editing} onClose={() => !saving && setEditing(null)} title={editing === 'new' ? 'Add a house' : 'Edit house'} size="sm"
        footer={<div className="flex w-full justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button><Button onClick={save} disabled={saving || !name.trim()}>{saving ? 'Saving…' : 'Save'}</Button></div>}>
        <div className="space-y-4">
          <div>
            <label htmlFor="house-name" className="mb-1 block text-sm font-semibold text-gray-800 dark:text-gray-200">Name</label>
            <input id="house-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Blue House" className={inputClass} />
          </div>
          <fieldset>
            <legend className="mb-1 block text-sm font-semibold text-gray-800 dark:text-gray-200">Colour</legend>
            <div className="flex flex-wrap items-center gap-2">
              {SWATCHES.map((s) => (
                <button key={s.hex} type="button" onClick={() => setColor(s.hex)} aria-label={s.name} aria-pressed={color.toLowerCase() === s.hex}
                  className={`h-8 w-8 rounded-full border-2 ${color.toLowerCase() === s.hex ? 'border-gray-900 dark:border-white' : 'border-transparent'}`} style={{ backgroundColor: s.hex }} />
              ))}
              <label htmlFor="house-color" className="sr-only">Pick any colour</label>
              <input id="house-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-gray-300" />
            </div>
            <div className="mt-3 rounded-xl px-4 py-3 text-center text-sm font-black" style={{ backgroundColor: color, color: textOn(color) }}>{name.trim() || 'House name'}</div>
          </fieldset>
          <div>
            <label htmlFor="house-motto" className="mb-1 block text-sm font-semibold text-gray-800 dark:text-gray-200">Motto <span className="font-normal text-gray-500">(optional)</span></label>
            <input id="house-motto" value={motto} maxLength={160} onChange={(e) => setMotto(e.target.value)} className={inputClass} />
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!removing} onClose={() => !saving && setRemoving(null)} title={`Remove ${removing?.name || 'house'}?`} size="sm"
        footer={<div className="flex w-full justify-end gap-2"><Button variant="outline" onClick={() => setRemoving(null)} disabled={saving}>Cancel</Button><Button variant="destructive" onClick={remove} disabled={saving}>{saving ? 'Removing…' : 'Remove'}</Button></div>}>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {removing && removing.total > 0
            ? `${removing.name} has ${removing.total} student${removing.total === 1 ? '' : 's'}, so it can't be removed. Move them to another house first, or switch the house off so nobody new is drawn into it.`
            : 'The house will be deleted. This cannot be undone.'}
        </p>
      </Modal>
    </div>
  );
};
