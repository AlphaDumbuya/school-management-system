/**
 * AssignmentDetailModal — View full details of an assignment
 */

import React from 'react';
import { Modal } from '@components/admin/feedback/Modal';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { sanitizeMarkup } from '@lib/sanitizeHtml';
import {
  AssignmentRecord,
  ASSIGNMENT_TYPES,
} from '@services/assignmentsService';
import {
  Calendar,
  Clock,
  BookOpen,
  Users,
  FileText,
  Star,
  CheckCircle2,
  User,
  Tag,
  ClipboardList,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** A DATE column arrives as "YYYY-MM-DD" or a midnight ISO string: read the calendar day, never shift it by timezone. */
function dayOf(dateStr: string): Date {
  const ymd = String(dateStr).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? new Date(`${ymd}T00:00:00`) : new Date(dateStr);
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const d = dayOf(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function isOverdue(dueDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dayOf(dueDate) < today;
}

function formatStamp(ts: string | null | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ASSIGNMENT_TYPES.map((t) => [t.value, t.label])
);

// ── Type badge colours ────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  homework:     'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  classwork:    'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
  essay:        'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
  practical:    'bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-300',
  project:      'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  quiz:         'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
  test:         'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  presentation: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  group_work:   'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  revision:     'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  reading:      'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  exercise:     'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
};

// ── Sub-component: Info card ──────────────────────────────────────────────────

interface InfoCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  iconBg?: string;
}

const InfoCard: React.FC<InfoCardProps> = ({ icon, label, value, iconBg = 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' }) => (
  <div className="flex items-center gap-3 p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/50">
    <div className={`p-2 rounded-lg flex-shrink-0 ${iconBg}`}>
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-0.5">
        {label}
      </p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
        {value}
      </p>
    </div>
  </div>
);

// ── Props ─────────────────────────────────────────────────────────────────────

interface AssignmentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: AssignmentRecord | null;
  onEdit?: (assignment: AssignmentRecord) => void;
  /** A past year viewed by a student/parent: history, so never "Overdue". */
  historyMode?: boolean;
  /** Student/parent view: whose submission this is ("you" or the child's name). */
  viewerLabel?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const AssignmentDetailModal: React.FC<AssignmentDetailModalProps> = ({
  isOpen,
  onClose,
  assignment,
  onEdit,
  historyMode = false,
  viewerLabel,
}) => {
  if (!assignment) return null;

  // The student's own submission (present on student / single-child rows).
  const hasOwn = !!viewerLabel && 'my_submission_status' in assignment;
  const ownStatus = String(assignment.my_submission_status || '');
  const ownHandedIn = !!assignment.my_submitted_at || ['submitted', 'graded', 'late'].includes(ownStatus);
  const ownGraded = ownStatus === 'graded' || !!assignment.my_graded_at || (assignment.my_marks !== null && assignment.my_marks !== undefined);

  const overdue =
    assignment.status === 'active' && isOverdue(assignment.due_date) && !historyMode && !(hasOwn && ownHandedIn);

  const submissionPct =
    assignment.total_submissions && assignment.total_submissions > 0
      ? Math.round(
          (Number(assignment.graded_count ?? 0) /
            Number(assignment.total_submissions)) *
            100
        )
      : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assignment Details"
      size="xl"
      footer={
        onEdit ? (
          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => { onClose(); onEdit(assignment); }}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm"
            >
              Edit Assignment
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  TYPE_COLOR[assignment.type] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                <Tag size={10} />
                {TYPE_LABELS[assignment.type] || assignment.type}
              </span>
              {overdue && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[11px] font-bold">
                  ⚠️ Overdue
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
              {assignment.title}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {assignment.subject_name}
              {assignment.subject_code && (
                <span className="ml-1 text-xs font-mono text-gray-400">
                  ({assignment.subject_code})
                </span>
              )}
            </p>
          </div>
          <StatusBadge status={assignment.status} showDot />
        </div>

        {/* ── Info Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InfoCard
            icon={<Users size={16} />}
            label="Class"
            value={assignment.class_name || '—'}
            iconBg="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
          />
          <InfoCard
            icon={<User size={16} />}
            label="Teacher"
            value={assignment.teacher_name || '—'}
            iconBg="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
          />
          <InfoCard
            icon={<Calendar size={16} />}
            label="Assigned Date"
            value={formatDate(assignment.assigned_date)}
            iconBg="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
          />
          <InfoCard
            icon={<Clock size={16} />}
            label="Due Date"
            value={
              <span className={overdue ? 'text-red-600 dark:text-red-400' : undefined}>
                {formatDate(assignment.due_date)}
                {overdue && ' · Overdue'}
              </span>
            }
            iconBg={
              overdue
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
            }
          />
          <InfoCard
            icon={<Star size={16} />}
            label="Max Marks"
            value={`${assignment.max_marks} marks`}
            iconBg="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"
          />
          <InfoCard
            icon={<BookOpen size={16} />}
            label="Subject"
            value={assignment.subject_name || '—'}
            iconBg="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
          />
        </div>

        {/* ── Own submission (student / parent) ── */}
        {hasOwn && (
          <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-3 flex items-center gap-2">
              <ClipboardList size={13} /> {viewerLabel === 'you' ? 'Your submission' : `${viewerLabel}'s submission`}
            </h3>
            {ownGraded ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-800/30 dark:bg-emerald-900/20">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  Graded{assignment.my_marks !== null && assignment.my_marks !== undefined ? `: ${assignment.my_marks} / ${assignment.max_marks}` : ''}
                  {formatStamp(assignment.my_graded_at) ? <span className="font-normal"> · {formatStamp(assignment.my_graded_at)}</span> : null}
                </p>
                {assignment.my_feedback && (
                  <p className="mt-2 text-sm text-emerald-900/80 dark:text-emerald-200/80 whitespace-pre-line">
                    <span className="font-semibold">Teacher's feedback: </span>{assignment.my_feedback}
                  </p>
                )}
              </div>
            ) : ownHandedIn ? (
              <p className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-800/30 dark:bg-blue-900/20 dark:text-blue-300">
                {ownStatus === 'late' ? 'Handed in late' : 'Handed in'}
                {formatStamp(assignment.my_submitted_at) ? ` on ${formatStamp(assignment.my_submitted_at)}` : ''}. Waiting for the teacher to mark it.
              </p>
            ) : (
              <p className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700 dark:border-gray-700/50 dark:bg-gray-800/60 dark:text-gray-300">
                {historyMode
                  ? 'No submission was recorded for this assignment.'
                  : viewerLabel === 'you'
                    ? 'Not handed in yet. Give your work to your teacher by the due date; it shows here once they record it.'
                    : 'Not handed in yet. It shows here once the teacher records it.'}
              </p>
            )}
          </div>
        )}

        {/* ── Submission Stats (staff) ── */}
        {!viewerLabel && (assignment.total_submissions !== undefined) && (
          <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
              <ClipboardList size={13} /> Submissions
            </h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/50">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Number(assignment.total_submissions ?? 0)}
                </p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                  Total
                </p>
              </div>
              <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {Number(assignment.graded_count ?? 0)}
                </p>
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-1">
                  Graded
                </p>
              </div>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/30">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {submissionPct}%
                </p>
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-1">
                  Graded %
                </p>
              </div>
            </div>
            {/* Progress bar */}
            {Number(assignment.total_submissions) > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Grading progress</span>
                  <span className="font-semibold">{submissionPct}%</span>
                </div>
                <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all duration-500"
                    style={{ width: `${submissionPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Description ── */}
        {assignment.description && (
          <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-3 flex items-center gap-2">
              <FileText size={13} /> Description
            </h3>
            <div
              className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed prose prose-sm dark:prose-invert max-w-none
                [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
                [&_li]:my-0.5 [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-2 [&_h3]:mb-1"
              dangerouslySetInnerHTML={sanitizeMarkup(assignment.description)}
            />
          </div>
        )}

        {/* ── Instructions ── */}
        {assignment.instructions && (
          <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-3 flex items-center gap-2">
              <CheckCircle2 size={13} /> Instructions
            </h3>
            <div
              className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed prose prose-sm dark:prose-invert max-w-none
                [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
                [&_li]:my-0.5 [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-2 [&_h3]:mb-1"
              dangerouslySetInnerHTML={sanitizeMarkup(assignment.instructions)}
            />
          </div>
        )}

        {/* ── Meta ── */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            Created{' '}
            {new Date(assignment.created_at).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default AssignmentDetailModal;
