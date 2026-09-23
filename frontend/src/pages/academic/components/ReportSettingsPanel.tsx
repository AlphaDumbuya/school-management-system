/**
 * ReportSettingsPanel — principal controls for the SL report system.
 *  - Toggles: auto-lock on entry, allow teacher edit after lock,
 *    allow teacher view results, auto-promote on publish.
 *  - Publish / unpublish a class's results (gates parent/student visibility).
 * All actions are principal / super_admin only (enforced by backend authorize).
 */

import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Eye, GraduationCap, ShieldCheck, Loader2, Send, CheckCircle2 } from 'lucide-react';
import { Button } from '@components/ui/button';
import { SearchableSelect } from '@components/admin/forms/SearchableSelect';
import { showToast } from '@utils/toast';
import { classesService } from '@services/classesService';
import { reportCardService, ReportSettings, SL_TERMS, SLTerm } from '@services/reportCardService';

interface Props {
  academicYear: string;
}

const DEFAULTS: ReportSettings = {
  auto_lock_on_entry: false,
  allow_teacher_edit_after_lock: false,
  allow_teacher_view_results: true,
  auto_promote_on_publish: false,
};

const TOGGLES: { key: keyof ReportSettings; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    key: 'auto_lock_on_entry',
    label: 'Auto-lock scores on entry',
    desc: 'Once a teacher saves scores for a subject/term, they are locked to prevent later manipulation.',
    icon: <Lock size={16} />,
  },
  {
    key: 'allow_teacher_edit_after_lock',
    label: 'Allow teachers to edit after lock',
    desc: 'If enabled, assigned teachers can still edit locked scores. Leave off for stricter control.',
    icon: <ShieldCheck size={16} />,
  },
  {
    key: 'allow_teacher_view_results',
    label: 'Allow teachers to view results',
    desc: 'Let teachers view computed results/report cards for their assigned classes.',
    icon: <Eye size={16} />,
  },
  {
    key: 'auto_promote_on_publish',
    label: 'Auto-promote on result release',
    desc: 'When you publish a whole year, passing students (yearly avg ≥ 50%) are automatically moved to each class\'s configured "Next Class" (or graduated for final-year classes). Set the Next Class on each class first.',
    icon: <GraduationCap size={16} />,
  },
];

export const ReportSettingsPanel: React.FC<Props> = ({ academicYear }) => {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<ReportSettings>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  // Publish controls
  const [pubClassId, setPubClassId] = useState('');
  const [pubTerm, setPubTerm] = useState<'' | SLTerm>('');
  const [publishing, setPublishing] = useState(false);

  const { data: settingsResp, isLoading } = useQuery({
    queryKey: ['sl-report-settings'],
    queryFn: () => reportCardService.getSettings(),
    staleTime: 60_000,
  });

  useEffect(() => {
    const s = (settingsResp as any)?.data?.data ?? (settingsResp as any)?.data;
    if (s) setSettings({ ...DEFAULTS, ...s });
  }, [settingsResp]);

  const { data: classesData } = useQuery({
    queryKey: ['settings-classes'],
    queryFn: () => classesService.listClasses({ limit: 200 }),
    staleTime: 60_000,
  });
  const classes: any[] = (classesData as any)?.data ?? [];
  const classOptions = classes.map((c) => ({ value: String(c.id), label: c.name, sublabel: c.level }));

  const toggle = (key: keyof ReportSettings) =>
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await reportCardService.saveSettings(settings);
      showToast.success('Settings saved');
      queryClient.invalidateQueries({ queryKey: ['sl-report-settings'] });
    } catch {
      showToast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (published: boolean) => {
    if (!pubClassId) { showToast.error('Select a class'); return; }
    setPublishing(true);
    try {
      await reportCardService.setPublication({
        class_id: pubClassId,
        academic_year: academicYear,
        term: pubTerm || null,
        published,
      });
      showToast.success(published ? 'Results published' : 'Results unpublished');
    } catch {
      showToast.error('Failed to update publication');
    } finally {
      setPublishing(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={30} className="animate-spin text-blue-500" /></div>;
  }

  const StepBadge: React.FC<{ n: number }> = ({ n }) => (
    <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#1d4ed8] text-white text-xs font-bold">{n}</span>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Intro / workflow guide */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/20 p-4">
        <p className="text-sm font-bold text-gray-900 dark:text-white">Results & Grades workflow</p>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          <strong>1.</strong> Set grade controls & teacher permissions · <strong>2.</strong> Enter scores on the Results page ·
          <strong> 3.</strong> Release a term (single A4 sheet) or the whole year (full booklet) here.
        </p>
      </div>

      {/* ── STEP 1 — Release Results (primary action) ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
          <StepBadge n={1} /> <Send size={16} className="text-emerald-500" /> Release Results & Report Cards
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Release a <strong>single term</strong> (Term 1 or Term 2) to give parents and students a
          professional one-page A4 result sheet for that term only. Leave the term blank to release
          the <strong>whole year</strong> — this unlocks the complete folded report booklet
          (all terms + yearly summary + promotion) and is intended for the promotional term (Term 3).
          Releasing notifies parents & students by email and in-app.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <SearchableSelect
            label="Class"
            options={classOptions}
            value={pubClassId}
            onChange={setPubClassId}
            placeholder="Select class..."
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Term</label>
            <select
              value={pubTerm}
              onChange={(e) => setPubTerm(e.target.value as any)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
            >
              <option value="">Whole year (full booklet + promotion)</option>
              {SL_TERMS.map((t) => <option key={t.value} value={t.value}>{t.label} — single A4 sheet</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => handlePublish(true)} disabled={publishing || !pubClassId} className="gap-1.5">
            {publishing ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Release
          </Button>
          <Button variant="outline" onClick={() => handlePublish(false)} disabled={publishing || !pubClassId}>
            Unrelease
          </Button>
        </div>
      </div>

      {/* ── STEP 2 — Grade controls & teacher permissions ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
          <StepBadge n={2} /> Grade Controls & Teacher Permissions
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Control how scores lock, what teachers can do, and end-of-year promotion.</p>
        <div className="space-y-3">
          {TOGGLES.map((t) => (
            <div key={t.key} className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-blue-500 mt-0.5 flex-shrink-0">{t.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{t.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t.desc}</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings[t.key]}
                onClick={() => toggle(t.key)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                  settings[t.key] ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings[t.key] ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 size={15} className="animate-spin mr-1.5" /> Saving…</> : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReportSettingsPanel;
