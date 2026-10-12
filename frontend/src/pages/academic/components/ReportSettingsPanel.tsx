/**
 * ReportSettingsPanel — principal controls for the SL report system.
 *  - Toggles: auto-lock on entry, allow teacher edit after lock,
 *    allow teacher view results, auto-promote on publish.
 *  - Publish / unpublish a class's results (gates parent/student visibility).
 * All actions are principal / super_admin only (enforced by backend authorize).
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Eye, GraduationCap, ShieldCheck, Loader2, Send, CheckCircle2, History, XCircle, Undo2 } from 'lucide-react';
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

  // Unrelease-with-reason modal. `target` identifies which class/term to pull
  // back; when null the modal is closed.
  const [unreleaseTarget, setUnreleaseTarget] = useState<
    { classId: string; term: '' | SLTerm; label: string } | null
  >(null);
  const [unreleaseReason, setUnreleaseReason] = useState('');

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

  // Publish history for the selected academic year.
  const { data: pubResp, isLoading: pubLoading } = useQuery({
    queryKey: ['sl-report-publications', academicYear],
    queryFn: () => reportCardService.getPublications(academicYear),
    staleTime: 15_000,
  });
  const publications = ((pubResp as any)?.data ?? []) as import('@services/reportCardService').PublicationRecord[];
  const releasedPubs = publications.filter((p) => p.is_published);

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

  const handlePublish = async (
    published: boolean,
    override?: { classId: string; term: '' | SLTerm; reason?: string },
  ) => {
    const classId = override?.classId ?? pubClassId;
    const term = override?.term ?? pubTerm;
    if (!classId) { showToast.error('Select a class'); return; }
    setPublishing(true);
    try {
      const res: any = await reportCardService.setPublication({
        class_id: classId,
        academic_year: academicYear,
        term: term || null,
        published,
        reason: override?.reason ?? null,
      });
      const label = term ? SL_TERMS.find((t) => t.value === term)?.label || term : 'Whole year';
      const cls = classOptions.find((c) => c.value === classId)?.label || 'class';
      const ap = res?.auto_promotion;
      showToast.success(
        published
          ? `${label} released for ${cls}${ap?.ran ? ` · ${ap.promoted} promoted` : ''}`
          : `${label} unreleased for ${cls}`,
      );
      // Refresh the publish history and any caches the portals read from so the
      // release reflects everywhere without a manual reload.
      queryClient.invalidateQueries({ queryKey: ['sl-report-publications'] });
      queryClient.invalidateQueries({ queryKey: ['class-ranking'] });
      queryClient.invalidateQueries({ queryKey: ['report-card'] });
      queryClient.invalidateQueries({ queryKey: ['report-card-self'] });
      queryClient.invalidateQueries({ queryKey: ['report-card-parent-children'] });
      queryClient.invalidateQueries({ queryKey: ['student-results-self'] });
      queryClient.invalidateQueries({ queryKey: ['parent-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['parent-child-detail'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
    } catch {
      showToast.error('Failed to update publication');
    } finally {
      setPublishing(false);
    }
  };

  // Confirm the reason modal → unrelease the targeted class/term.
  const handleConfirmUnrelease = async () => {
    if (!unreleaseTarget) return;
    await handlePublish(false, {
      classId: unreleaseTarget.classId,
      term: unreleaseTarget.term,
      reason: unreleaseReason.trim() || undefined,
    });
    setUnreleaseTarget(null);
    setUnreleaseReason('');
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
          <Button
            variant="outline"
            onClick={() => {
              const cls = classOptions.find((c) => c.value === pubClassId)?.label || 'class';
              const label = pubTerm ? SL_TERMS.find((t) => t.value === pubTerm)?.label || pubTerm : 'Whole year';
              setUnreleaseReason('');
              setUnreleaseTarget({ classId: pubClassId, term: pubTerm, label: `${label} · ${cls}` });
            }}
            disabled={publishing || !pubClassId}
          >
            Unrelease
          </Button>
        </div>

        {/* ── Release history — confirms what has been published ── */}
        <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <History size={15} className="text-gray-400" />
            <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Release History · {academicYear}
            </h4>
          </div>
          {pubLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-3"><Loader2 size={14} className="animate-spin" /> Loading history…</div>
          ) : publications.length === 0 ? (
            <p className="text-xs text-gray-400 py-3">Nothing released yet for this year. Release a class above to see it here.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
              {publications.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-white dark:bg-gray-800">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {p.is_published ? (
                      <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                    ) : (
                      <XCircle size={16} className="text-gray-300 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {p.class_name || 'Class'} · <span className="font-normal text-gray-600 dark:text-gray-400">{p.term_label}</span>
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {p.is_published ? 'Released' : 'Unreleased'}
                        {p.published_at ? ` · ${new Date(p.published_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
                        {p.published_by_name ? ` · by ${p.published_by_name}` : ''}
                      </p>
                      {!p.is_published && p.unpublish_reason && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 line-clamp-2">
                          Reason: {p.unpublish_reason}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {p.is_published && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 h-7 px-2 text-xs"
                        disabled={publishing}
                        onClick={() => {
                          setUnreleaseReason('');
                          setUnreleaseTarget({
                            classId: p.class_id,
                            term: (p.term as SLTerm) || '',
                            label: `${p.term_label} · ${p.class_name || 'Class'}`,
                          });
                        }}
                      >
                        <Undo2 size={13} /> Unrelease
                      </Button>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      p.is_published
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {p.is_published ? 'LIVE' : 'OFF'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {releasedPubs.length > 0 && (
            <p className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              {releasedPubs.length} active release{releasedPubs.length === 1 ? '' : 's'} — visible in parent & student portals.
            </p>
          )}
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

      {/* ── Unrelease reason modal ── */}
      {/* Portaled to <body>: the Settings tab sits in an animated (transformed)
          container, which would otherwise pin a "fixed" overlay to the panel
          instead of the screen and push the dialog to the bottom. */}
      {unreleaseTarget && createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unrelease-title"
          onClick={() => { if (!publishing) { setUnreleaseTarget(null); setUnreleaseReason(''); } }}
        >
          <div
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
              <Undo2 size={16} className="text-amber-500" />
              <h4 id="unrelease-title" className="text-sm font-bold text-gray-900 dark:text-white">Unrelease results</h4>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                You are about to withdraw <strong>{unreleaseTarget.label}</strong>. Parents and students
                will no longer see these results and will be notified.
              </p>
              <div className="flex flex-col gap-1">
                <label htmlFor="unrelease-reason" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Reason <span className="font-normal text-gray-400">(optional — shared with parents & students)</span>
                </label>
                <textarea
                  id="unrelease-reason"
                  autoFocus
                  value={unreleaseReason}
                  onChange={(e) => setUnreleaseReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="e.g. Correcting an error in the Mathematics scores. Results will be re-released shortly."
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
                <span className="text-[10px] text-gray-400 self-end">{unreleaseReason.length}/500</span>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => { setUnreleaseTarget(null); setUnreleaseReason(''); }}
                disabled={publishing}
              >
                Cancel
              </Button>
              <Button onClick={handleConfirmUnrelease} disabled={publishing} className="gap-1.5">
                {publishing ? <Loader2 size={15} className="animate-spin" /> : <Undo2 size={15} />} Unrelease
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default ReportSettingsPanel;
