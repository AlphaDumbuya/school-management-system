import React, { useState } from 'react';
import { Award, TrendingUp, AlertCircle, MessageSquare, Send, CheckCircle2 } from 'lucide-react';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { showToast } from '@utils/toast';
import { disciplineService, ConductReport } from '@services/disciplineService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  report: ConductReport | null;
}

function fmt(d?: string) {
  return d ? new Date(d).toLocaleDateString() : '—';
}

const PERIOD_LABELS: Record<string, string> = {
  term: 'Term',
  semester: 'Semester',
  year: 'Academic Year',
  custom: 'Custom Period',
};

export const ConductReportViewModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, report }) => {
  const [sharing, setSharing] = useState(false);

  if (!report) return null;

  const rating = report.behavioral_rating ?? 0;
  const ratingColor =
    rating >= 8 ? 'text-green-600' : rating >= 5 ? 'text-amber-600' : 'text-red-600';

  const handleShare = async () => {
    setSharing(true);
    try {
      await disciplineService.shareReport(report.report_id);
      showToast.success('Report shared with parents/guardians');
      onSuccess();
      onClose();
    } catch {
      showToast.apiError('Failed to share report');
    } finally {
      setSharing(false);
    }
  };

  const Section: React.FC<{ icon: React.ReactNode; title: string; text?: string; tone?: string }> = ({
    icon, title, text, tone = 'text-gray-700 dark:text-gray-300',
  }) => (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-center gap-2 mb-1 text-sm font-semibold text-gray-900 dark:text-white">
        {icon}
        {title}
      </div>
      <p className={`text-sm ${tone}`}>{text || '—'}</p>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Conduct Report" size="lg">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {report.student_name || report.student_id}
            </h3>
            <p className="text-sm text-gray-500">
              {PERIOD_LABELS[report.report_period] || report.report_period} · {fmt(report.period_start_date)} – {fmt(report.period_end_date)}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-extrabold ${ratingColor}`}>{rating}/10</div>
            <p className="text-xs text-gray-500">Behavioral Rating</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-3 text-center">
            <div className="text-xl font-bold text-red-700 dark:text-red-300">{report.total_infractions}</div>
            <p className="text-xs text-gray-500">Total Infractions</p>
          </div>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 p-3 text-center">
            <div className="text-xl font-bold text-amber-700 dark:text-amber-300">{report.total_points}</div>
            <p className="text-xs text-gray-500">Total Points</p>
          </div>
        </div>

        {/* Narrative */}
        <Section icon={<Award size={15} className="text-green-500" />} title="Strengths" text={report.strengths} />
        <Section icon={<AlertCircle size={15} className="text-orange-500" />} title="Areas for Improvement" text={report.areas_for_improvement} />
        <Section icon={<MessageSquare size={15} className="text-blue-500" />} title="Teacher Comments" text={report.teacher_comments} />
        <Section icon={<TrendingUp size={15} className="text-purple-500" />} title="Overall Assessment" text={report.overall_assessment} />

        {/* Share status */}
        <div className="flex items-center gap-2 text-sm">
          {report.parent_shared ? (
            <span className="inline-flex items-center gap-1 text-green-600">
              <CheckCircle2 size={15} /> Shared with parents{report.parent_acknowledged ? ' · acknowledged' : ''}
            </span>
          ) : (
            <span className="text-gray-500">Not yet shared with parents</span>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          {!report.parent_shared && (
            <RoleGuard roles={['principal', 'super_admin']}>
              <Button type="button" onClick={handleShare} disabled={sharing}>
                <Send size={15} className="mr-1" />
                {sharing ? 'Sharing…' : 'Share with Parents'}
              </Button>
            </RoleGuard>
          )}
        </div>
      </div>
    </Modal>
  );
};
