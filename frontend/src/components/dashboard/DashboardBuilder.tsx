import React, { useState, useCallback, useEffect } from 'react';
import { logger } from '@lib/logger';

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'alert' | 'custom';
  title: string;
  description?: string;
  config: {
    width: number; // 1-4 (columns)
    height: number; // 1-3 (rows)
    refreshInterval?: number; // milliseconds
    [key: string]: any;
  };
  position?: {
    x: number;
    y: number;
  };
}

export interface DashboardLayout {
  id: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  isDefault: boolean;
  gridCols: number; // 12 for desktop
  createdAt: string;
  updatedAt: string;
}

export interface LayoutPreset {
  name: string;
  layout: DashboardLayout;
  icon: string;
}

interface DashboardBuilderProps {
  initialLayout?: DashboardLayout;
  onSave?: (layout: DashboardLayout) => Promise<void>;
  availableWidgets?: DashboardWidget[];
  editable?: boolean;
  className?: string;
}

const DEFAULT_WIDGETS: DashboardWidget[] = [
  {
    id: 'kpi-1',
    type: 'metric',
    title: 'Total Students',
    config: { width: 1, height: 1 },
  },
  {
    id: 'kpi-2',
    type: 'metric',
    title: 'Active Classes',
    config: { width: 1, height: 1 },
  },
  {
    id: 'kpi-3',
    type: 'metric',
    title: 'Overall Attendance',
    config: { width: 1, height: 1 },
  },
  {
    id: 'chart-1',
    type: 'chart',
    title: 'Enrollment Trend',
    config: { width: 2, height: 2 },
  },
  {
    id: 'chart-2',
    type: 'chart',
    title: 'Grade Distribution',
    config: { width: 2, height: 2 },
  },
  {
    id: 'table-1',
    type: 'table',
    title: 'Recent Activities',
    config: { width: 4, height: 2 },
  },
];

const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    name: 'Default Layout',
    icon: '📊',
    layout: {
      id: 'default',
      name: 'Default Layout',
      widgets: DEFAULT_WIDGETS,
      isDefault: true,
      gridCols: 12,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  {
    name: 'Compact Layout',
    icon: '📱',
    layout: {
      id: 'compact',
      name: 'Compact Layout',
      widgets: DEFAULT_WIDGETS.slice(0, 3),
      isDefault: false,
      gridCols: 12,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  {
    name: 'Full Width Layout',
    icon: '📺',
    layout: {
      id: 'fullwidth',
      name: 'Full Width Layout',
      widgets: DEFAULT_WIDGETS.map((w) => ({ ...w, config: { ...w.config, width: 4 } })),
      isDefault: false,
      gridCols: 12,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
];

/**
 * Dashboard Builder Component
 * Allows users to customize dashboard layout with drag-drop interface
 */
export const DashboardBuilder: React.FC<DashboardBuilderProps> = ({
  initialLayout,
  onSave,
  availableWidgets = DEFAULT_WIDGETS,
  editable = true,
  className = '',
}) => {
  const [layout, setLayout] = useState<DashboardLayout>(
    initialLayout || LAYOUT_PRESETS[0].layout
  );
  const [draggedWidget, setDraggedWidget] = useState<DashboardWidget | null>(null);
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [showWidgetLibrary, setShowWidgetLibrary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setError] = useState<string | null>(null);
  const [layoutName, setLayoutName] = useState(layout.name);

  // Handle widget selection
  const handleSelectWidget = useCallback((widgetId: string) => {
    if (editable) {
      setSelectedWidget(selectedWidget === widgetId ? null : widgetId);
    }
  }, [selectedWidget, editable]);

  // Handle widget drag start
  const handleDragStart = useCallback(
    (widget: DashboardWidget) => {
      if (editable) {
        setDraggedWidget(widget);
      }
    },
    [editable]
  );

  // Handle widget drag end
  const handleDragEnd = useCallback(() => {
    setDraggedWidget(null);
  }, []);

  // Handle widget drop
  const handleDropWidget = useCallback(
    (widget: DashboardWidget) => {
      if (!editable || !draggedWidget) return;

      // Check if widget already exists in layout
      const exists = layout.widgets.some((w) => w.id === widget.id);

      if (!exists) {
        setLayout((prev) => ({
          ...prev,
          widgets: [...prev.widgets, widget],
          updatedAt: new Date().toISOString(),
        }));
        logger.debug('Widget added:', widget.id);
      }

      setDraggedWidget(null);
    },
    [draggedWidget, editable, layout.widgets]
  );

  // Remove widget from layout
  const handleRemoveWidget = useCallback(
    (widgetId: string) => {
      setLayout((prev) => ({
        ...prev,
        widgets: prev.widgets.filter((w) => w.id !== widgetId),
        updatedAt: new Date().toISOString(),
      }));
      if (selectedWidget === widgetId) {
        setSelectedWidget(null);
      }
      logger.debug('Widget removed:', widgetId);
    },
    [selectedWidget]
  );

  // Resize widget
  const handleResizeWidget = useCallback(
    (widgetId: string, newWidth: number, newHeight: number) => {
      setLayout((prev) => ({
        ...prev,
        widgets: prev.widgets.map((w) =>
          w.id === widgetId
            ? { ...w, config: { ...w.config, width: newWidth, height: newHeight } }
            : w
        ),
        updatedAt: new Date().toISOString(),
      }));
      logger.debug('Widget resized:', widgetId, { width: newWidth, height: newHeight });
    },
    []
  );

  // Apply layout preset
  const handleApplyPreset = useCallback((preset: LayoutPreset) => {
    setLayout({
      ...preset.layout,
      id: `layout-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setLayoutName(preset.layout.name);
    setShowPresets(false);
    logger.info('Preset applied:', preset.name);
  }, []);

  // Save layout
  const handleSaveLayout = useCallback(async () => {
    try {
      setIsSaving(true);
      setError(null);

      const updatedLayout: DashboardLayout = {
        ...layout,
        name: layoutName,
        updatedAt: new Date().toISOString(),
      };

      if (onSave) {
        await onSave(updatedLayout);
      } else {
        // Save to localStorage by default
        localStorage.setItem(`dashboard-layout-${layout.id}`, JSON.stringify(updatedLayout));
      }

      setLayout(updatedLayout);
      logger.info('Layout saved:', layoutName);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save layout';
      setError(errorMessage);
      logger.error('Error saving layout:', error);
    } finally {
      setIsSaving(false);
    }
  }, [layout, layoutName, onSave]);

  // Reset to default
  const handleResetLayout = useCallback(() => {
    if (confirm('Are you sure you want to reset the layout to default?')) {
      setLayout(LAYOUT_PRESETS[0].layout);
      setLayoutName('Default Layout');
      setSelectedWidget(null);
      logger.info('Layout reset to default');
    }
  }, []);

  // Calculate grid position
  const getGridPosition = (index: number, gridCols: number = 12) => {
    const col = (index % (gridCols / 4)) * 4;
    const row = Math.floor(index / (gridCols / 4));
    return { col, row };
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Dashboard Builder</h2>
            <p className="text-blue-100 mt-1">Customize your dashboard layout</p>
          </div>
          {editable && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowPresets(!showPresets)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors text-sm font-medium"
                title="Load preset layouts"
              >
                📐 Presets
              </button>
              <button
                onClick={() => setShowWidgetLibrary(!showWidgetLibrary)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors text-sm font-medium"
                title="Add widgets from library"
              >
                ➕ Widgets
              </button>
            </div>
          )}
        </div>

        {/* Layout Name Input */}
        {editable && (
          <div className="flex gap-2 items-center">
            <label className="text-sm font-medium">Layout Name:</label>
            <input
              type="text"
              value={layoutName}
              onChange={(e) => setLayoutName(e.target.value)}
              className="px-3 py-2 bg-blue-600 border border-blue-400 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white text-sm"
              placeholder="Enter layout name"
            />
          </div>
        )}
      </div>

      {/* Presets Panel */}
      {showPresets && editable && (
        <div className="bg-gray-50 border-b border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Layout Presets</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {LAYOUT_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handleApplyPreset(preset)}
                className="p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left"
              >
                <div className="text-3xl mb-2">{preset.icon}</div>
                <div className="font-medium text-gray-900">{preset.name}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {preset.layout.widgets.length} widgets
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Widget Library Panel */}
      {showWidgetLibrary && editable && (
        <div className="bg-gray-50 border-b border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Available Widgets</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {availableWidgets
              .filter((w) => !layout.widgets.some((lw) => lw.id === w.id))
              .map((widget) => (
                <div
                  key={widget.id}
                  draggable={editable}
                  onDragStart={() => handleDragStart(widget)}
                  onDragEnd={handleDragEnd}
                  className="p-4 bg-white border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 cursor-move transition-all"
                >
                  <div className="text-sm font-medium text-gray-900">{widget.title}</div>
                  <div className="text-xs text-gray-500 mt-2">
                    Type: {widget.type}
                  </div>
                  <div className="text-xs text-gray-500">
                    Size: {widget.config.width}x{widget.config.height}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="p-6">
        {/* Errors */}
        {saveError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {saveError}
          </div>
        )}

        {/* Canvas Area */}
        <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-8 min-h-96 bg-gray-50 transition-colors hover:border-blue-400 hover:bg-blue-50"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (draggedWidget) {
              handleDropWidget(draggedWidget);
            }
          }}
        >
          {layout.widgets.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center">
              <div className="text-gray-500">
                <div className="text-4xl mb-2">📦</div>
                <p className="font-medium">No widgets added yet</p>
                <p className="text-sm mt-2">
                  {editable
                    ? 'Drag widgets from the library or select a preset to get started'
                    : 'This dashboard is empty'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-4 auto-rows-max">
              {layout.widgets.map((widget, index) => {
                const isSelected = selectedWidget === widget.id;
                const gridColSpan = Math.min(widget.config.width * 3, 12);

                return (
                  <div
                    key={widget.id}
                    className={`col-span-${gridColSpan} p-4 bg-white rounded-lg border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 shadow-lg'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleSelectWidget(widget.id)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{widget.title}</h4>
                        <p className="text-xs text-gray-500 mt-1">
                          Type: {widget.type} • Size: {widget.config.width}x{widget.config.height}
                        </p>
                      </div>
                      {editable && isSelected && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveWidget(widget.id);
                          }}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Remove widget"
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
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Widget Preview */}
                    <div className="h-24 bg-gray-50 rounded border border-gray-200 flex items-center justify-center text-gray-400">
                      <div className="text-center">
                        <div className="text-2xl mb-1">
                          {widget.type === 'metric'
                            ? '📊'
                            : widget.type === 'chart'
                            ? '📈'
                            : widget.type === 'table'
                            ? '📋'
                            : widget.type === 'alert'
                            ? '⚠️'
                            : '🔧'}
                        </div>
                        <div className="text-xs">Widget Preview</div>
                      </div>
                    </div>

                    {/* Widget Controls */}
                    {editable && isSelected && (
                      <div className="mt-4 space-y-3 border-t border-gray-200 pt-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-gray-700 block mb-1">
                              Width
                            </label>
                            <select
                              value={widget.config.width}
                              onChange={(e) =>
                                handleResizeWidget(
                                  widget.id,
                                  parseInt(e.target.value),
                                  widget.config.height
                                )
                              }
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                            >
                              {[1, 2, 3, 4].map((w) => (
                                <option key={w} value={w}>
                                  {w} col
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-700 block mb-1">
                              Height
                            </label>
                            <select
                              value={widget.config.height}
                              onChange={(e) =>
                                handleResizeWidget(
                                  widget.id,
                                  widget.config.width,
                                  parseInt(e.target.value)
                                )
                              }
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                            >
                              {[1, 2, 3].map((h) => (
                                <option key={h} value={h}>
                                  {h} row
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {editable && (
          <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={handleSaveLayout}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V3" />
                  </svg>
                  Save Layout
                </>
              )}
            </button>
            <button
              onClick={handleResetLayout}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Reset
            </button>
          </div>
        )}

        {/* Layout Info */}
        <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-gray-500">Widgets</p>
            <p className="text-lg font-bold text-gray-900">{layout.widgets.length}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Last Updated</p>
            <p className="text-lg font-bold text-gray-900">
              {new Date(layout.updatedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardBuilder;
