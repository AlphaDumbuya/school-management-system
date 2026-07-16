/**
 * ExaminationDetailModal — View full details of an examination
 */

import React from 'react';
import { Modal } from '@components/admin/feedback/Modal';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { ExaminationRecord, EXAM_TYPES, EXAM_TERMS } from '@services/examinationsService';
import { Calendar, Clock, MapPin, BookOpen, Users, FileText } from 'lucide-react';

interface ExaminationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: ExaminationRecord | null;
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

const TYPE_LABELS: Record<string, string> = Object.fromEntries(EXAM_TYPES.map((t) => [t.value, t.label]));
const TERM_LABELS: Record<string, string> = Object.fromEntries(EXAM_TERMS.map((t) => [t.value, t.label]));

export const ExaminationDetailModal: React.FC<ExaminationDetailModalProps> = ({
  isOpen,
  onClose,
  exam,
}) => {
  if (!exam) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Examination Details"
      size="lg"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{exam.title}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {exam.academic_year} · {TERM_LABELS[exam.term] || exam.term}
            </p>
          </div>
          <StatusBadge status={exam.status} showDot />
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <FileText size={18} />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Type</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{TYPE_LABELS[exam.type] || exam.type}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              <Calendar size={18} />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Date</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {formatDate(exam.start_date)}
                {exam.end_date && exam.end_date !== exam.start_date && ` — ${formatDate(exam.end_date)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <Clock size={18} />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Duration</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {exam.duration_minutes} minutes ({Math.floor(exam.duration_minutes / 60)}h {exam.duration_minutes % 60}m)
              </p>
            </div>
          </div>

          {exam.venue && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                <MapPin size={18} />
              </div>
              <div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Venue</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{exam.venue}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <BookOpen size={18} />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Subject</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{exam.subject_name || 'All Subjects'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
              <Users size={18} />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Class</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{exam.class_name || 'All Classes'}</p>
            </div>
          </div>
        </div>

        {/* Marks */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-3">Marks</h3>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{exam.total_marks}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold uppercase">Total</p>
            </div>
            <div className="w-px h-10 bg-gray-200 dark:bg-gray-700"></div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{exam.pass_marks}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold uppercase">Pass Mark</p>
            </div>
            <div className="w-px h-10 bg-gray-200 dark:bg-gray-700"></div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{Math.round((exam.pass_marks / exam.total_marks) * 100)}%</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold uppercase">Pass %</p>
            </div>
          </div>
        </div>

        {/* Description */}
        {exam.description && (
          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-2">Description</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{exam.description}</p>
          </div>
        )}

        {/* Instructions */}
        {exam.instructions && (
          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-2">Instructions</h3>
            <div
              className="text-sm text-gray-700 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none
                [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
                [&_li]:my-0.5 [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-2 [&_h3]:mb-1"
              dangerouslySetInnerHTML={{ __html: exam.instructions }}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ExaminationDetailModal;
