import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { disciplineService } from '@services/disciplineService';
import { studentsService } from '@services/studentsService';
import { SearchableSelect } from '@components/admin/forms/SearchableSelect';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  prefilledStudentId?: string;
  prefilledStudentName?: string;
}

const REPORT_PERIODS = [
  { value: 'term', label: 'Term (current term to date)' },
  { value: 'semester', label: 'Semester (current semester to date)' },
  { value: 'year', label: 'Academic Year (year to date)' },
  { value: 'custom', label: 'Custom Date Range' },
];

const fieldCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const errorCls = 'text-xs text-red-600 mt-0.5';

export const ConductReportModal: React.FC<Props> = ({
  isOpen, onClose, onSuccess, prefilledStudentId = '', prefilledStudentName = '',
}) => {
  const [loading, setLoading] = useState(false);
  const [studentId, setStudentId] = useState(prefilledStudentId);
  const [reportPeriod, setReportPeriod] = useState('term');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: studentsData } = useQuery({
    queryKey: ['students-conduct-report-modal'],
    queryFn: () => studentsService.listStudents({ limit: 200 }),
    enabled: isOpen && !prefilledStudentId,
    staleTime: 60_000,
  });

  const studentOptions = useMemo(() => {
    const list = (studentsData as any)?.data ?? [];
    return list.map((s: any) => ({
      value: s.id,
      label: `${s.first_name} ${s.last_name}`,
      sublabel: `ID: ${s.student_id}${s.class_name ? ` • ${s.class_name}` : ''}`,
    }));
  }, [studentsData]);

  useEffect(() => {
    if (isOpen) {
      setStudentId(prefilledStudentId);
      setReportPeriod('term');
      setStartDate('');
      setEndDate('');
      setErrors({});
    }
  }, [isOpen, prefilledStudentId]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!studentId.trim()) e.student_id = 'Please select a student';
    if (!reportPeriod) e.report_period = 'Report period is required';
    if (reportPeriod === 'custom') {
      if (!startDate) e.start_date = 'Start date is required for a custom range';
      if (!endDate) e.end_date = 'End date is required for a custom range';
      if (startDate && endDate && startDate > endDate) e.end_date = 'End date must be after start date';
    }
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      await disciplineService.generateReport({
        student_id: studentId,
        report_period: reportPeriod,
        start_date: reportPeriod === 'custom' ? startDate : undefined,
        end_date: reportPeriod === 'custom' ? endDate : undefined,
      });
      showToast.success('Conduct report generated successfully');
      onSuccess();
      onClose();
    } catch {
      showToast.apiError('Failed to generate conduct report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generate Conduct Report" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {prefilledStudentId ? (
          <div>
            <label className={labelCls}>Student <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={prefilledStudentName || prefilledStudentId}
              className={fieldCls}
              readOnly
            />
          </div>
        ) : (
          <SearchableSelect
            label="Select Student"
            required
            options={studentOptions}
            value={studentId}
            onChange={(val) => {
              setStudentId(val);
              if (errors.student_id) setErrors(prev => ({ ...prev, student_id: '' }));
            }}
            placeholder="Search student by name or ID..."
            error={errors.student_id}
          />
        )}

        <div>
          <label className={labelCls}>Report Period <span className="text-red-500">*</span></label>
          <select value={reportPeriod} onChange={e => setReportPeriod(e.target.value)} className={fieldCls}>
            {REPORT_PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          {errors.report_period && <p className={errorCls}>{errors.report_period}</p>}
        </div>

        {reportPeriod === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Start Date <span className="text-red-500">*</span></label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={fieldCls} />
              {errors.start_date && <p className={errorCls}>{errors.start_date}</p>}
            </div>
            <div>
              <label className={labelCls}>End Date <span className="text-red-500">*</span></label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={fieldCls} />
              {errors.end_date && <p className={errorCls}>{errors.end_date}</p>}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400">
          The report aggregates infractions, points, and behavioral notes for the selected period and
          auto-generates strengths, areas for improvement, and an overall assessment.
        </p>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Generating…' : 'Generate Report'}</Button>
        </div>
      </form>
    </Modal>
  );
};
