/**
 * RecurrenceEditor Component
 * Recurring event pattern configuration
 * Task 5.9
 */

import React, { useState, useEffect } from 'react';
import { RecurrenceEditorProps, RecurrenceConfig, RecurrencePattern } from '@appTypes/events';

export const RecurrenceEditor: React.FC<RecurrenceEditorProps> = ({ value, onChange }) => {
    const [config, setConfig] = useState<RecurrenceConfig>(
        value || {
            pattern: 'weekly',
            interval: 1,
            days: [],
        }
    );

    useEffect(() => {
        if (value) {
            setConfig(value);
        }
    }, [value]);

    const handleChange = (updates: Partial<RecurrenceConfig>) => {
        const newConfig = { ...config, ...updates };
        setConfig(newConfig);
        onChange(newConfig);
    };

    const toggleDay = (day: number) => {
        const days = config.days || [];
        if (days.includes(day)) {
            handleChange({ days: days.filter((d) => d !== day) });
        } else {
            handleChange({ days: [...days, day].sort() });
        }
    };

    const patterns: { value: RecurrencePattern; label: string }[] = [
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
        { value: 'custom', label: 'Custom' },
    ];

    const weekDays = [
        { value: 0, label: 'Sun' },
        { value: 1, label: 'Mon' },
        { value: 2, label: 'Tue' },
        { value: 3, label: 'Wed' },
        { value: 4, label: 'Thu' },
        { value: 5, label: 'Fri' },
        { value: 6, label: 'Sat' },
    ];

    return (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-900">Recurrence Pattern</h3>

            {/* Pattern Selection */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Repeat</label>
                <div className="grid grid-cols-4 gap-2">
                    {patterns.map((pattern) => (
                        <button
                            key={pattern.value}
                            type="button"
                            onClick={() => handleChange({ pattern: pattern.value })}
                            className={`
                px-3 py-2 rounded-md text-sm font-medium transition-colors
                ${config.pattern === pattern.value
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }
              `}
                        >
                            {pattern.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Interval */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Repeat every
                </label>
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        min="1"
                        max="30"
                        value={config.interval || 1}
                        onChange={(e) => handleChange({ interval: parseInt(e.target.value) || 1 })}
                        className="w-20 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">
                        {config.pattern === 'daily' && 'day(s)'}
                        {config.pattern === 'weekly' && 'week(s)'}
                        {config.pattern === 'monthly' && 'month(s)'}
                        {config.pattern === 'custom' && 'occurrence(s)'}
                    </span>
                </div>
            </div>

            {/* Days of Week (for weekly pattern) */}
            {config.pattern === 'weekly' && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Repeat on
                    </label>
                    <div className="flex gap-2">
                        {weekDays.map((day) => {
                            const isSelected = config.days?.includes(day.value);
                            return (
                                <button
                                    key={day.value}
                                    type="button"
                                    onClick={() => toggleDay(day.value)}
                                    className={`
                    w-10 h-10 rounded-full text-sm font-medium transition-colors
                    ${isSelected
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                                        }
                  `}
                                >
                                    {day.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* End Condition */}
            <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Ends</label>

                <div className="space-y-2">
                    <label className="flex items-center gap-2">
                        <input
                            type="radio"
                            name="endType"
                            checked={!config.end_date && !config.count}
                            onChange={() => handleChange({ end_date: undefined, count: undefined })}
                            className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Never</span>
                    </label>

                    <label className="flex items-center gap-2">
                        <input
                            type="radio"
                            name="endType"
                            checked={!!config.end_date}
                            onChange={() =>
                                handleChange({
                                    end_date: new Date().toISOString().split('T')[0],
                                    count: undefined,
                                })
                            }
                            className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">On</span>
                        {config.end_date !== undefined && (
                            <input
                                type="date"
                                value={config.end_date || ''}
                                onChange={(e) => handleChange({ end_date: e.target.value })}
                                className="ml-2 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        )}
                    </label>

                    <label className="flex items-center gap-2">
                        <input
                            type="radio"
                            name="endType"
                            checked={!!config.count}
                            onChange={() => handleChange({ count: 10, end_date: undefined })}
                            className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">After</span>
                        {config.count !== undefined && (
                            <>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={config.count}
                                    onChange={(e) => handleChange({ count: parseInt(e.target.value) || 1 })}
                                    className="ml-2 w-20 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <span className="text-sm text-gray-700">occurrences</span>
                            </>
                        )}
                    </label>
                </div>
            </div>

            {/* Summary */}
            <div className="pt-3 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                    {getSummary(config)}
                </p>
            </div>
        </div>
    );
};

// Helper function to generate human-readable summary
function getSummary(config: RecurrenceConfig): string {
    const { pattern, interval = 1, days, end_date, count } = config;

    let summary = 'Repeats ';

    if (pattern === 'daily') {
        summary += interval === 1 ? 'every day' : `every ${interval} days`;
    } else if (pattern === 'weekly') {
        summary += interval === 1 ? 'every week' : `every ${interval} weeks`;
        if (days && days.length > 0) {
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            summary += ` on ${days.map((d) => dayNames[d]).join(', ')}`;
        }
    } else if (pattern === 'monthly') {
        summary += interval === 1 ? 'every month' : `every ${interval} months`;
    } else {
        summary += 'with custom pattern';
    }

    if (end_date) {
        summary += ` until ${new Date(end_date).toLocaleDateString()}`;
    } else if (count) {
        summary += ` for ${count} occurrences`;
    }

    return summary;
}

export default RecurrenceEditor;
