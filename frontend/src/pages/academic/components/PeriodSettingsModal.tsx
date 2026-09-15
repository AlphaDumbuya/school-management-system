/**
 * PeriodSettingsModal — Custom Timetable Periods Configurator
 * Allows school administrators to configure custom period times, labels, and break schedules.
 * Supports schools with 0 breaks, 1 break, or multiple breaks.
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import {
  PeriodDefinition,
  SchoolLevel,
  PERIOD_STRUCTURES,
  getCustomPeriodsAsync,
  saveCustomPeriodsAsync,
  resetPeriodsToDefaultAsync,
  generatePeriodsSchedule,
} from '@services/timetableService';
import { Clock, Plus, Trash2, RotateCcw, Zap, Coffee, Check, SlidersHorizontal } from 'lucide-react';

interface PeriodSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLevel: SchoolLevel;
  onSaved: () => void;
}

export const PeriodSettingsModal: React.FC<PeriodSettingsModalProps> = ({
  isOpen,
  onClose,
  currentLevel,
  onSaved,
}) => {
  const [selectedLevel, setSelectedLevel] = useState<SchoolLevel>(currentLevel);
  const [periods, setPeriods] = useState<PeriodDefinition[]>([]);
  
  // Auto-generator inputs
  const [startTime, setStartTime] = useState<string>('08:00');
  const [periodDuration, setPeriodDuration] = useState<number>(45);
  const [totalPeriods, setTotalPeriods] = useState<number>(8);
  const [includeBreak, setIncludeBreak] = useState<boolean>(true);
  const [breakAfter, setBreakAfter] = useState<number>(4);
  const [breakDuration, setBreakDuration] = useState<number>(15);
  const [includeLunch, setIncludeLunch] = useState<boolean>(true);
  const [lunchAfter, setLunchAfter] = useState<number>(6);
  const [lunchDuration, setLunchDuration] = useState<number>(30);

  const [isSaving, setIsSaving] = useState(false);

  // Load periods when modal opens or level changes
  useEffect(() => {
    if (isOpen) {
      setSelectedLevel(currentLevel);
      getCustomPeriodsAsync(currentLevel).then(setPeriods);
    }
  }, [isOpen, currentLevel]);

  // When level tab changes within modal
  const handleLevelChange = (lvl: SchoolLevel) => {
    setSelectedLevel(lvl);
    getCustomPeriodsAsync(lvl).then(setPeriods);
  };

  // Modify individual period
  const handleUpdatePeriod = (index: number, field: keyof PeriodDefinition, value: any) => {
    const updated = [...periods];
    updated[index] = { ...updated[index], [field]: value };
    setPeriods(updated);
  };

  // Add new period row
  const handleAddPeriodRow = () => {
    const last = periods[periods.length - 1];
    let newStart = '14:00';
    let newEnd = '14:45';

    if (last) {
      newStart = last.end;
      // add 45 mins
      const [h, m] = last.end.split(':').map(Number);
      const totalM = h * 60 + m + 45;
      const endH = Math.floor(totalM / 60) % 24;
      const endM = totalM % 60;
      newEnd = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    }

    const nextPeriodNum = periods.filter((p) => !p.isBreak).length + 1;
    setPeriods([
      ...periods,
      { label: `Period ${nextPeriodNum}`, start: newStart, end: newEnd, isBreak: false },
    ]);
  };

  // Remove period row
  const handleRemovePeriodRow = (index: number) => {
    if (periods.length <= 1) {
      showToast.warning('At least one period is required.');
      return;
    }
    setPeriods(periods.filter((_, i) => i !== index));
  };

  // Run auto-generator
  const handleGenerateSchedule = () => {
    const generated = generatePeriodsSchedule({
      startTime,
      periodDuration,
      totalPeriods,
      includeBreak,
      breakAfterPeriod: breakAfter,
      breakDurationMinutes: breakDuration,
      includeLunch,
      lunchAfterPeriod: lunchAfter,
      lunchDurationMinutes: lunchDuration,
    });

    setPeriods(generated);
    showToast.success('Schedule periods generated cleanly!');
  };

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveCustomPeriodsAsync(selectedLevel, periods);
      showToast.success(`Timetable periods for ${selectedLevel.toUpperCase()} saved!`);
      onSaved();
      onClose();
    } catch {
      showToast.apiError('Failed to save period configuration');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to system default
  const handleResetDefault = async () => {
    try {
      await resetPeriodsToDefaultAsync(selectedLevel);
      const defaults = PERIOD_STRUCTURES[selectedLevel];
      setPeriods(defaults);
      showToast.info(`Reset to standard default schedule.`);
    } catch {
      showToast.apiError('Failed to reset period configuration');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Customize Timetable Periods & Daily Schedule"
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetDefault}
            className="text-gray-500 hover:text-red-600 dark:hover:text-red-400 gap-1.5"
          >
            <RotateCcw size={14} /> Reset Defaults
          </Button>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="default" onClick={handleSave} disabled={isSaving} className="gap-2">
              <Check size={16} /> {isSaving ? 'Saving…' : 'Save Period Schedule'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {/* ── Level Selector Tabs ── */}
        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3 overflow-x-auto">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-2">
            Target Level:
          </span>
          {(['nursery', 'primary', 'jss', 'sss'] as SchoolLevel[]).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => handleLevelChange(lvl)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all uppercase ${
                selectedLevel === lvl
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
              }`}
            >
              {lvl === 'nursery' ? 'Nursery' : lvl === 'primary' ? 'Primary' : lvl === 'jss' ? 'JSS' : 'SSS'}
            </button>
          ))}
        </div>

        {/* ── Quick Generator Section ── */}
        <div className="p-4 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider flex items-center gap-2">
              <Zap size={14} className="text-amber-500" /> Smart Period Auto-Generator
            </h4>
            <span className="text-[11px] text-blue-600 dark:text-blue-400">
              Generate consecutive time slots automatically
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-gray-600 dark:text-gray-400 font-medium mb-1">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-gray-600 dark:text-gray-400 font-medium mb-1">Period Length (mins)</label>
              <input
                type="number"
                value={periodDuration}
                onChange={(e) => setPeriodDuration(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200"
              />
            </div>
            <div>
              <label className="block text-gray-600 dark:text-gray-400 font-medium mb-1">Total Periods</label>
              <input
                type="number"
                value={totalPeriods}
                onChange={(e) => setTotalPeriods(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleGenerateSchedule}
                className="w-full text-xs font-bold gap-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Zap size={14} /> Auto Generate
              </Button>
            </div>
          </div>

          {/* Break Toggles */}
          <div className="mt-3.5 pt-3 border-t border-blue-200/50 dark:border-blue-900/40 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeBreak}
                onChange={(e) => setIncludeBreak(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600"
              />
              <span className="text-gray-700 dark:text-gray-300 font-medium">Morning Break</span>
              {includeBreak && (
                <span className="text-[11px] text-gray-500">
                  (After P{breakAfter}, {breakDuration}m)
                </span>
              )}
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeLunch}
                onChange={(e) => setIncludeLunch(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600"
              />
              <span className="text-gray-700 dark:text-gray-300 font-medium">Lunch Break</span>
              {includeLunch && (
                <span className="text-[11px] text-gray-500">
                  (After P{lunchAfter}, {lunchDuration}m)
                </span>
              )}
            </label>
          </div>
        </div>

        {/* ── Interactive Period Rows List ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Clock size={14} className="text-blue-500" /> Active Schedule Time Slots ({periods.length} Periods)
            </h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddPeriodRow}
              className="text-xs gap-1"
            >
              <Plus size={14} /> Add Slot
            </Button>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold border-b border-gray-200 dark:border-gray-700 uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2.5 w-12 text-center">#</th>
                  <th className="px-3 py-2.5">Period Name</th>
                  <th className="px-3 py-2.5 w-28">Start Time</th>
                  <th className="px-3 py-2.5 w-28">End Time</th>
                  <th className="px-3 py-2.5 w-28 text-center">Is Break?</th>
                  <th className="px-3 py-2.5 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {periods.map((period, idx) => (
                  <tr
                    key={idx}
                    className={
                      period.isBreak
                        ? 'bg-amber-50/40 dark:bg-amber-950/20'
                        : 'bg-white dark:bg-gray-900'
                    }
                  >
                    <td className="px-3 py-2 text-center font-mono text-gray-400 font-semibold">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={period.label}
                        onChange={(e) => handleUpdatePeriod(idx, 'label', e.target.value)}
                        placeholder="e.g. Period 1, Short Break, Lunch"
                        className="w-full px-2 py-1 bg-transparent border border-transparent hover:border-gray-300 focus:border-blue-500 rounded text-xs font-semibold text-gray-900 dark:text-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="time"
                        value={period.start}
                        onChange={(e) => handleUpdatePeriod(idx, 'start', e.target.value)}
                        className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-800 dark:text-gray-200"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="time"
                        value={period.end}
                        onChange={(e) => handleUpdatePeriod(idx, 'end', e.target.value)}
                        className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-800 dark:text-gray-200"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={period.isBreak ?? false}
                        onChange={(e) => handleUpdatePeriod(idx, 'isBreak', e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400 cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemovePeriodRow(idx)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Remove Slot"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
};
