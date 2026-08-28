/**
 * AddExamDayModal — adds an empty exam-day row to the exam timetable grid.
 * Replaces the native window.prompt with a proper custom modal.
 */

import React, { useEffect, useState } from 'react';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { CalendarPlus } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (date: string) => void;
  existingDates: string[];
}

export const AddExamDayModal: React.FC<Props> = ({ isOpen, onClose, onAdd, existingDates }) => {
  const [date, setDate] = useState('');

  useEffect(() => {
    if (isOpen) setDate('');
  }, [isOpen]);

  const handleAdd = () => {
    if (!date) { showToast.error('Please choose a date'); return; }
    if (existingDates.includes(date)) { showToast.error('That exam day already exists'); return; }
    onAdd(date);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Exam Day"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="default" onClick={handleAdd}>
            <CalendarPlus size={15} className="mr-1.5" /> Add Day
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Add a date to the exam timetable. You can then schedule subject exams for its Morning and Afternoon sessions.
        </p>
        <div>
          <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1 block">
            Exam Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>
      </div>
    </Modal>
  );
};

export default AddExamDayModal;
