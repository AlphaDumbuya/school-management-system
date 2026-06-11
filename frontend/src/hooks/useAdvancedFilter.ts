import { useState, useCallback, useEffect } from 'react';
import { logger } from '@lib/logger';

export interface FilterCriterion {
  id: string;
  field: string;
  operator: 'equals' | 'contains' | 'gte' | 'lte' | 'between' | 'in' | 'notEquals';
  value: string | number | boolean | string[];
  label?: string;
}

export interface FilterPreset {
  id: string;
  name: string;
  description?: string;
  filters: FilterCriterion[];
  createdAt: string;
  updatedAt: string;
}

export interface AppliedFilters {
  filters: FilterCriterion[];
  preset?: FilterPreset;
  appliedAt: string;
}

export interface FilterResults<T> {
  data: T[];
  count: number;
  totalCount: number;
  appliedFilters: FilterCriterion[];
}

interface UseAdvancedFilterState<T> {
  filters: FilterCriterion[];
  presets: FilterPreset[];
  results: FilterResults<T> | null;
  isLoading: boolean;
  error: string | null;
  hasChanged: boolean;
  appliedFilters: AppliedFilters | null;
}

/**
 * Advanced filter hook for dashboard filtering
 * Manages filter state, presets, and result filtering
 */
export const useAdvancedFilter = <T = any>(onFilterApply?: (filters: FilterCriterion[]) => Promise<FilterResults<T>>) => {
  const [state, setState] = useState<UseAdvancedFilterState<T>>({
    filters: [],
    presets: [],
    results: null,
    isLoading: false,
    error: null,
    hasChanged: false,
    appliedFilters: null,
  });

  // Generate unique ID for filters
  const generateId = useCallback((): string => {
    return `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  /**
   * Add a new filter criterion
   */
  const addFilter = useCallback((criterion: Omit<FilterCriterion, 'id'>) => {
    const filter: FilterCriterion = {
      ...criterion,
      id: generateId(),
    };

    setState((prev) => ({
      ...prev,
      filters: [...prev.filters, filter],
      hasChanged: true,
    }));

    logger.debug('Filter added:', filter);
    return filter;
  }, [generateId]);

  /**
   * Remove a filter by ID
   */
  const removeFilter = useCallback((filterId: string) => {
    setState((prev) => ({
      ...prev,
      filters: prev.filters.filter((f) => f.id !== filterId),
      hasChanged: true,
    }));

    logger.debug('Filter removed:', filterId);
  }, []);

  /**
   * Update an existing filter
   */
  const updateFilter = useCallback(
    (filterId: string, changes: Partial<FilterCriterion>) => {
      setState((prev) => ({
        ...prev,
        filters: prev.filters.map((f) =>
          f.id === filterId ? { ...f, ...changes } : f
        ),
        hasChanged: true,
      }));

      logger.debug('Filter updated:', filterId, changes);
    },
    []
  );

  /**
   * Apply current filters
   */
  const applyFilters = useCallback(async () => {
    if (!onFilterApply) {
      logger.warn('No onFilterApply callback provided');
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const results = await onFilterApply(state.filters);

      setState((prev) => ({
        ...prev,
        results,
        isLoading: false,
        hasChanged: false,
        appliedFilters: {
          filters: state.filters,
          appliedAt: new Date().toISOString(),
        },
      }));

      logger.info('Filters applied successfully:', state.filters);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to apply filters';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      logger.error('Error applying filters:', error);
    }
  }, [state.filters, onFilterApply]);

  /**
   * Clear all filters
   */
  const clearFilters = useCallback(() => {
    setState((prev) => ({
      ...prev,
      filters: [],
      results: null,
      appliedFilters: null,
      hasChanged: true,
    }));

    logger.debug('All filters cleared');
  }, []);

  /**
   * Save current filters as a preset
   */
  const saveAsPreset = useCallback((name: string, description?: string) => {
    const preset: FilterPreset = {
      id: generateId(),
      name,
      description,
      filters: state.filters,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      presets: [...prev.presets, preset],
    }));

    // Save to localStorage for persistence
    try {
      const stored = localStorage.getItem('filterPresets') || '[]';
      const presets = JSON.parse(stored);
      presets.push(preset);
      localStorage.setItem('filterPresets', JSON.stringify(presets));
    } catch (error) {
      logger.warn('Failed to save preset to localStorage:', error);
    }

    logger.info('Preset saved:', preset);
    return preset;
  }, [state.filters, generateId]);

  /**
   * Load a saved preset
   */
  const loadPreset = useCallback((presetId: string) => {
    const preset = state.presets.find((p) => p.id === presetId);
    if (!preset) {
      logger.warn('Preset not found:', presetId);
      return;
    }

    setState((prev) => ({
      ...prev,
      filters: preset.filters,
      hasChanged: true,
    }));

    logger.debug('Preset loaded:', preset);
  }, [state.presets]);

  /**
   * Delete a preset
   */
  const deletePreset = useCallback((presetId: string) => {
    setState((prev) => ({
      ...prev,
      presets: prev.presets.filter((p) => p.id !== presetId),
    }));

    // Remove from localStorage
    try {
      const stored = localStorage.getItem('filterPresets') || '[]';
      const presets = JSON.parse(stored).filter(
        (p: FilterPreset) => p.id !== presetId
      );
      localStorage.setItem('filterPresets', JSON.stringify(presets));
    } catch (error) {
      logger.warn('Failed to delete preset from localStorage:', error);
    }

    logger.debug('Preset deleted:', presetId);
  }, []);

  /**
   * Load presets from localStorage on mount
   */
  useEffect(() => {
    try {
      const stored = localStorage.getItem('filterPresets');
      if (stored) {
        const presets = JSON.parse(stored);
        setState((prev) => ({
          ...prev,
          presets: Array.isArray(presets) ? presets : [],
        }));
      }
    } catch (error) {
      logger.warn('Failed to load presets from localStorage:', error);
    }
  }, []);

  return {
    // State
    filters: state.filters,
    presets: state.presets,
    results: state.results,
    isLoading: state.isLoading,
    error: state.error,
    hasChanged: state.hasChanged,
    appliedFilters: state.appliedFilters,

    // Methods
    addFilter,
    removeFilter,
    updateFilter,
    applyFilters,
    clearFilters,
    saveAsPreset,
    loadPreset,
    deletePreset,
  };
};

export default useAdvancedFilter;
