import React, { useState, useCallback } from 'react';
import { useAdvancedFilter, FilterCriterion, FilterPreset } from '@hooks/useAdvancedFilter';
import { logger } from '@lib/logger';

interface AdvancedFilterPanelProps {
  onApply?: (filters: FilterCriterion[]) => Promise<any>;
  availableFields?: FilterFieldOption[];
  onFiltersChange?: (filters: FilterCriterion[]) => void;
  showPresets?: boolean;
  className?: string;
}

interface FilterFieldOption {
  value: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean';
  operators?: string[];
  options?: { value: string; label: string }[];
}

const DEFAULT_FIELDS: FilterFieldOption[] = [
  {
    value: 'status',
    label: 'Status',
    type: 'select',
    operators: ['equals', 'notEquals'],
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending' },
    ],
  },
  {
    value: 'createdAt',
    label: 'Created Date',
    type: 'date',
    operators: ['gte', 'lte', 'between'],
  },
  {
    value: 'updatedAt',
    label: 'Updated Date',
    type: 'date',
    operators: ['gte', 'lte', 'between'],
  },
  {
    value: 'name',
    label: 'Name',
    type: 'text',
    operators: ['equals', 'contains'],
  },
  {
    value: 'email',
    label: 'Email',
    type: 'text',
    operators: ['equals', 'contains'],
  },
];

const DEFAULT_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'notEquals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'gte', label: 'Greater Than or Equal' },
  { value: 'lte', label: 'Less Than or Equal' },
  { value: 'between', label: 'Between' },
  { value: 'in', label: 'In List' },
];

/**
 * Advanced Filter Panel Component
 * Provides multi-criterion filtering with preset support
 */
export const AdvancedFilterPanel: React.FC<AdvancedFilterPanelProps> = ({
  onApply,
  availableFields = DEFAULT_FIELDS,
  onFiltersChange,
  showPresets = true,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const {
    filters,
    presets,
    isLoading,
    error,
    hasChanged,
    results,
    addFilter,
    removeFilter,
    updateFilter,
    applyFilters,
    clearFilters,
    saveAsPreset,
    loadPreset,
    deletePreset,
  } = useAdvancedFilter(onApply);

  // Notify parent of filter changes
  React.useEffect(() => {
    onFiltersChange?.(filters);
  }, [filters, onFiltersChange]);

  const getFieldOptions = useCallback((fieldValue: string): FilterFieldOption | undefined => {
    return availableFields.find((f) => f.value === fieldValue);
  }, [availableFields]);

  const getOperatorsForField = useCallback((fieldValue: string) => {
    const field = getFieldOptions(fieldValue);
    if (field?.operators) {
      return DEFAULT_OPERATORS.filter((op) =>
        field.operators?.includes(op.value)
      );
    }
    return DEFAULT_OPERATORS;
  }, [getFieldOptions]);

  const handleAddFilter = useCallback(() => {
    if (availableFields.length === 0) {
      logger.warn('No available fields for filtering');
      return;
    }

    const firstField = availableFields[0];
    addFilter({
      field: firstField.value,
      operator: 'equals',
      value: '',
      label: firstField.label,
    });
  }, [availableFields, addFilter]);

  const handleFieldChange = useCallback(
    (filterId: string, newField: string) => {
      const field = getFieldOptions(newField);
      if (field) {
        updateFilter(filterId, {
          field: newField,
          label: field.label,
          operator: 'equals', // Reset operator to default
        });
      }
    },
    [getFieldOptions, updateFilter]
  );

  const handleOperatorChange = useCallback(
    (filterId: string, operator: string) => {
      updateFilter(filterId, { operator: operator as any });
    },
    [updateFilter]
  );

  const handleValueChange = useCallback(
    (filterId: string, value: any) => {
      updateFilter(filterId, { value });
    },
    [updateFilter]
  );

  const handleApplyFilters = useCallback(async () => {
    try {
      await applyFilters();
    } catch (error) {
      logger.error('Error applying filters:', error);
    }
  }, [applyFilters]);

  const handleSavePreset = useCallback(() => {
    if (!newPresetName.trim()) {
      logger.warn('Preset name cannot be empty');
      return;
    }

    saveAsPreset(newPresetName);
    setNewPresetName('');
    setShowPresetMenu(false);
  }, [newPresetName, saveAsPreset]);

  const handleLoadPreset = useCallback(
    (presetId: string) => {
      loadPreset(presetId);
      setSelectedPreset(presetId);
    },
    [loadPreset]
  );

  const handleDeletePreset = useCallback(
    (presetId: string) => {
      deletePreset(presetId);
      if (selectedPreset === presetId) {
        setSelectedPreset(null);
      }
    },
    [deletePreset, selectedPreset]
  );

  const renderFilterValue = (filter: FilterCriterion, fieldOption?: FilterFieldOption) => {
    if (!fieldOption) return null;

    const commonProps = {
      value: filter.value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        handleValueChange(filter.id, e.target.value),
      className:
        'px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm',
    };

    switch (fieldOption.type) {
      case 'date':
        return (
          <input
            type="date"
            {...commonProps}
            value={filter.value as string}
          />
        );

      case 'select':
        return (
          <select {...commonProps} value={filter.value as string}>
            <option value="">Select...</option>
            {fieldOption.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'number':
        return (
          <input
            type="number"
            {...commonProps}
            value={filter.value as number | string}
          />
        );

      case 'boolean':
        return (
          <select {...commonProps} value={filter.value ? 'true' : 'false'}>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        );

      default:
        return (
          <input
            type="text"
            {...commonProps}
            value={filter.value as string}
            placeholder="Enter value..."
          />
        );
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          <h3 className="font-semibold text-gray-900">
            Advanced Filters
            {filters.length > 0 && (
              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                {filters.length}
              </span>
            )}
          </h3>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isExpanded ? 'transform rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </div>

      {/* Filters Panel */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Active Filters */}
          {filters.length > 0 && (
            <div className="space-y-3">
              {filters.map((filter) => {
                const fieldOption = getFieldOptions(filter.field);
                return (
                  <div
                    key={filter.id}
                    className="flex gap-2 items-end p-3 bg-gray-50 rounded-lg"
                  >
                    {/* Field Select */}
                    <select
                      value={filter.field}
                      onChange={(e) => handleFieldChange(filter.id, e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm flex-1"
                    >
                      {availableFields.map((field) => (
                        <option key={field.value} value={field.value}>
                          {field.label}
                        </option>
                      ))}
                    </select>

                    {/* Operator Select */}
                    <select
                      value={filter.operator}
                      onChange={(e) => handleOperatorChange(filter.id, e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm flex-1"
                    >
                      {getOperatorsForField(filter.field).map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>

                    {/* Value Input */}
                    <div className="flex-1">
                      {renderFilterValue(filter, fieldOption)}
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => removeFilter(filter.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove filter"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Filter Button */}
          {filters.length === 0 && (
            <p className="text-sm text-gray-500 py-4 text-center">No filters applied</p>
          )}

          <button
            onClick={handleAddFilter}
            className="w-full px-4 py-2 border border-dashed border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            + Add Filter
          </button>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleApplyFilters}
              disabled={isLoading || !hasChanged}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {isLoading ? 'Applying...' : 'Apply Filters'}
            </button>

            {filters.length > 0 && (
              <button
                onClick={clearFilters}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                Clear
              </button>
            )}

            {showPresets && (
              <button
                onClick={() => setShowPresetMenu(!showPresetMenu)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                title="Manage presets"
              >
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 5a2 2 0 012-2h6a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5z"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Results Count */}
          {results && (
            <div className="text-sm text-gray-600 p-2 bg-blue-50 rounded-lg">
              Found <strong>{results.count}</strong> of <strong>{results.totalCount}</strong> results
            </div>
          )}

          {/* Presets Menu */}
          {showPresets && showPresetMenu && (
            <div className="border-t border-gray-200 pt-4 mt-4 space-y-3">
              <h4 className="font-semibold text-gray-900 text-sm">Filter Presets</h4>

              {/* Save Current as Preset */}
              {filters.length > 0 && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="Preset name..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    onKeyPress={(e) => e.key === 'Enter' && handleSavePreset()}
                  />
                  <button
                    onClick={handleSavePreset}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                  >
                    Save
                  </button>
                </div>
              )}

              {/* Load Presets */}
              {presets.length > 0 ? (
                <div className="space-y-2">
                  {presets.map((preset) => (
                    <div
                      key={preset.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg group hover:bg-gray-100 transition-colors"
                    >
                      <button
                        onClick={() => handleLoadPreset(preset.id)}
                        className="flex-1 text-left"
                      >
                        <div className="font-medium text-sm text-gray-900">
                          {preset.name}
                        </div>
                        {preset.description && (
                          <div className="text-xs text-gray-500">
                            {preset.description}
                          </div>
                        )}
                      </button>
                      <button
                        onClick={() => handleDeletePreset(preset.id)}
                        className="p-1 text-red-600 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded transition-all"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-2">
                  No presets saved yet
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedFilterPanel;
