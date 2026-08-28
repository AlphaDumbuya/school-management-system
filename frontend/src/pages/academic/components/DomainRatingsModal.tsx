/**
 * DomainRatingsModal — enter Affective (12) + Psychomotor (12) ratings for one
 * student+term. Each trait has TWO ratings (Test 1 & Test 2), 1-5, mirroring the
 * booklet's "1 · 2 · Mn" columns. Also captures conduct + guidance comment.
 * Attendance is auto-computed from the attendance system.
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import {
  reportCardService, SLTerm, AFFECTIVE_TRAITS, PSYCHOMOTOR_SKILLS,
  RATING_LEGEND, CONDUCT_CODES,
} from '@services/reportCardService';

interface RatingPair { r1: number | null; r2: number | null }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  studentId: string;
  studentName: string;
  classId: string;
  academicYear: string;
  term: SLTerm;
  initialAffective?: Record<number, RatingPair>;
  initialPsychomotor?: Record<number, RatingPair>;
  initialTermRecord?: { conduct?: string; teacher_comment?: string };
}

// A compact 1-5 picker rendered as a small select (keeps 24 traits × 2 ratings manageable)
const RatingSelect: React.FC<{ value: number | null; onChange: (v: number | null) => void }> = ({ value, onChange }) => (
  <select
    value={value ?? ''}
    onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    className="w-14 text-center px-1 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
  >
    <option value="">–</option>
    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
  </select>
);

function mean2(r1: number | null, r2: number | null): number | null {
  if (r1 != null && r2 != null) return Math.round(((r1 + r2) / 2) * 10) / 10;
  if (r1 != null || r2 != null) return (r1 ?? r2);
  return null;
}

export const DomainRatingsModal: React.FC<Props> = ({
  isOpen, onClose, onSuccess, studentId, studentName, classId, academicYear, term,
  initialAffective, initialPsychomotor, initialTermRecord,
}) => {
  const [affective, setAffective] = useState<Record<number, RatingPair>>({});
  const [psychomotor, setPsychomotor] = useState<Record<number, RatingPair>>({});
  const [conduct, setConduct] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const aff: Record<number, RatingPair> = {};
    const psy: Record<number, RatingPair> = {};
    AFFECTIVE_TRAITS.forEach((_, i) => { aff[i + 1] = initialAffective?.[i + 1] ?? { r1: null, r2: null }; });
    PSYCHOMOTOR_SKILLS.forEach((_, i) => { psy[i + 1] = initialPsychomotor?.[i + 1] ?? { r1: null, r2: null }; });
    setAffective(aff);
    setPsychomotor(psy);
    setConduct(initialTermRecord?.conduct ?? '');
    setComment(initialTermRecord?.teacher_comment ?? '');
  }, [isOpen, initialAffective, initialPsychomotor, initialTermRecord]);

  const setAff = (idx: number, key: 'r1' | 'r2', v: number | null) =>
    setAffective((p) => ({ ...p, [idx]: { ...p[idx], [key]: v } }));
  const setPsy = (idx: number, key: 'r1' | 'r2', v: number | null) =>
    setPsychomotor((p) => ({ ...p, [idx]: { ...p[idx], [key]: v } }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const ratingsRes = await reportCardService.saveRatings({
        student_id: studentId, class_id: classId, academic_year: academicYear, term, affective, psychomotor,
      });
      if ((ratingsRes as any).success === false) throw new Error((ratingsRes as any).error);

      const termRes = await reportCardService.saveTermRecord({
        student_id: studentId, class_id: classId, academic_year: academicYear, term,
        conduct: conduct || undefined, teacher_comment: comment || undefined,
      });
      if ((termRes as any).success === false) throw new Error((termRes as any).error);

      showToast.success('Ratings & term record saved');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const renderDomain = (
    title: string,
    color: string,
    traits: string[],
    state: Record<number, RatingPair>,
    setter: (idx: number, key: 'r1' | 'r2', v: number | null) => void,
  ) => (
    <div>
      <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${color}`}>{title} — Test 1 · Test 2 → Mean</h3>
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="text-left py-1.5 px-2 font-bold text-[10px] text-gray-500 uppercase">Trait</th>
              <th className="py-1.5 px-1 font-bold text-[10px] text-gray-500 uppercase w-16">Test 1</th>
              <th className="py-1.5 px-1 font-bold text-[10px] text-gray-500 uppercase w-16">Test 2</th>
              <th className="py-1.5 px-1 font-bold text-[10px] text-gray-500 uppercase w-12">Mn</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {traits.map((trait, i) => {
              const idx = i + 1;
              const pair = state[idx] ?? { r1: null, r2: null };
              const mn = mean2(pair.r1, pair.r2);
              return (
                <tr key={trait} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-1 px-2 text-gray-700 dark:text-gray-300">{idx}. {trait}</td>
                  <td className="py-1 px-1 text-center"><RatingSelect value={pair.r1} onChange={(v) => setter(idx, 'r1', v)} /></td>
                  <td className="py-1 px-1 text-center"><RatingSelect value={pair.r2} onChange={(v) => setter(idx, 'r2', v)} /></td>
                  <td className="py-1 px-1 text-center font-bold font-mono">{mn ?? '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Ratings & Conduct — ${studentName}`}
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="default" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </div>
      }
    >
      <div className="space-y-6 max-h-[65vh] overflow-y-auto px-1">
        {/* Rating legend */}
        <div className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg">
          {RATING_LEGEND.map((r) => <span key={r.value} className="mr-3"><b>{r.value}</b> = {r.label}</span>)}
        </div>

        {renderDomain('Affective Domain', 'text-purple-700 dark:text-purple-400', AFFECTIVE_TRAITS, affective, setAff)}
        {renderDomain('Psychomotor Domain', 'text-green-700 dark:text-green-400', PSYCHOMOTOR_SKILLS, psychomotor, setPsy)}

        {/* Conduct + comment */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">Conduct & Comment ({term.replace('_', ' ')})</h3>
          <div className="mb-3 text-[11px] text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-lg p-2">
            On Time / Late / Absent counts are pulled automatically from the Attendance system.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">Conduct</label>
              <select value={conduct} onChange={(e) => setConduct(e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm">
                <option value="">—</option>
                {CONDUCT_CODES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">Guidance & Counselling Comment</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm" placeholder="Teacher's comment for this term..." />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DomainRatingsModal;
