import React, { useState, useCallback, useEffect } from 'react';
import { logger } from '@lib/logger';

interface ExportTemplate {
  id: string;
  name: string;
  format: 'pdf' | 'excel' | 'csv' | 'json';
  columns?: string[];
  filters?: any;
  createdAt: string;
  updatedAt: string;
}

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  dashboardType: 'principal' | 'teacher' | 'student' | 'parent' | 'accountant' | 'admissions';
  onExport?: (config: ExportConfig) => Promise<void>;
  availableColumns?: string[];
  filters?: any;
}

interface ExportConfig {
  format: 'pdf' | 'excel' | 'csv' | 'json';
  dashboardType: string;
  includeCharts?: boolean;
  columns?: string[];
  filters?: any;
  template?: string;
  email?: string;
  saveAsTemplate?: boolean;
  templateName?: string;
}

/**
 * Export Dialog Component
 * Allows users to export dashboard data in multiple formats
 */
export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  dashboardType,
  onExport,
  availableColumns = [],
  filters = {},
}) => {
  const [format, setFormat] = useState<'pdf' | 'excel' | 'csv' | 'json'>('pdf');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(availableColumns.slice(0, 5));
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [tab, setTab] = useState<'config' | 'templates'>('config');

  // Load templates on mount
  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/export/templates', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load templates');
      }

      const data = await response.json();
      setTemplates(data.data || []);
    } catch (err) {
      logger.error('Error loading templates:', err);
      setError('Failed to load templates');
    }
  }, []);

  const handleFormatChange = useCallback((newFormat: string) => {
    setFormat(newFormat as any);
    setSelectedTemplate(null);
  }, []);

  const handleColumnToggle = useCallback((column: string) => {
    setSelectedColumns((prev) =>
      prev.includes(column) ? prev.filter((c) => c !== column) : [...prev, column]
    );
  }, []);

  const handleSelectAllColumns = useCallback(() => {
    setSelectedColumns(
      selectedColumns.length === availableColumns.length ? [] : availableColumns
    );
  }, [selectedColumns, availableColumns]);

  const handleLoadTemplate = useCallback((templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setFormat(template.format);
      if (template.columns) {
        setSelectedColumns(template.columns);
      }
      setSelectedTemplate(templateId);
      logger.debug('Template loaded:', template);
    }
  }, [templates]);

  const handleExport = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const config: ExportConfig = {
        format,
        dashboardType,
        includeCharts: format === 'pdf' ? includeCharts : undefined,
        columns: selectedColumns,
        filters,
        template: selectedTemplate || undefined,
        email: sendEmail ? email : undefined,
        saveAsTemplate,
        templateName: saveAsTemplate ? templateName : undefined,
      };

      if (onExport) {
        await onExport(config);
      } else {
        // Default export behavior
        await defaultExport(config);
      }

      // Show success message
      logger.info('Export completed successfully');
      setIsLoading(false);

      // Close dialog after a delay
      setTimeout(() => {
        resetDialog();
        onClose();
      }, 500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      setError(errorMessage);
      setIsLoading(false);
      logger.error('Export error:', err);
    }
  }, [
    format,
    dashboardType,
    includeCharts,
    selectedColumns,
    filters,
    selectedTemplate,
    sendEmail,
    email,
    saveAsTemplate,
    templateName,
    onExport,
  ]);

  const defaultExport = async (config: ExportConfig) => {
    const endpoint = sendEmail
      ? `/api/v1/export/dashboard/email`
      : `/api/v1/export/dashboard/${config.format}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error('Export request failed');
    }

    if (!sendEmail) {
      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dashboard-${dashboardType}-${Date.now()}.${getFileExtension(format)}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  };

  const getFileExtension = (fmt: string): string => {
    const extensions: Record<string, string> = {
      pdf: 'pdf',
      excel: 'xlsx',
      csv: 'csv',
      json: 'json',
    };
    return extensions[fmt] || fmt;
  };

  const resetDialog = () => {
    setFormat('pdf');
    setIncludeCharts(true);
    setSelectedColumns(availableColumns.slice(0, 5));
    setSelectedTemplate(null);
    setError(null);
    setSaveAsTemplate(false);
    setTemplateName('');
    setSendEmail(false);
    setEmail('');
    setTab('config');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Export Dashboard</h2>
            <p className="text-sm text-gray-600 mt-1">{dashboardType} Dashboard</p>
          </div>
          <button
            onClick={() => {
              resetDialog();
              onClose();
            }}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg
              className="w-6 h-6"
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
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6 pt-4">
          <button
            onClick={() => setTab('config')}
            className={`pb-3 px-4 font-medium border-b-2 transition-colors ${
              tab === 'config'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Export Settings
          </button>
          <button
            onClick={() => setTab('templates')}
            className={`pb-3 px-4 font-medium border-b-2 transition-colors ${
              tab === 'templates'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Templates ({templates.length})
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {tab === 'config' && (
            <div className="space-y-6">
              {/* Format Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Export Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'pdf', label: 'PDF', description: 'Professional report' },
                    { value: 'excel', label: 'Excel', description: 'Spreadsheet format' },
                    { value: 'csv', label: 'CSV', description: 'Comma-separated' },
                    { value: 'json', label: 'JSON', description: 'Raw data format' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleFormatChange(option.value)}
                      className={`p-3 rounded-lg border-2 text-left transition-colors ${
                        format === option.value
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{option.label}</div>
                      <div className="text-xs text-gray-500">{option.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* PDF-specific options */}
              {format === 'pdf' && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="includeCharts"
                    checked={includeCharts}
                    onChange={(e) => setIncludeCharts(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-600 cursor-pointer"
                  />
                  <label
                    htmlFor="includeCharts"
                    className="cursor-pointer text-sm font-medium text-gray-900"
                  >
                    Include charts and visualizations
                  </label>
                </div>
              )}

              {/* Columns Selection */}
              {availableColumns.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-semibold text-gray-900">
                      Columns to Include
                    </label>
                    <button
                      onClick={handleSelectAllColumns}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      {selectedColumns.length === availableColumns.length
                        ? 'Deselect All'
                        : 'Select All'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto">
                    {availableColumns.map((column) => (
                      <label
                        key={column}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedColumns.includes(column)}
                          onChange={() => handleColumnToggle(column)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-600"
                        />
                        <span className="text-sm text-gray-700">{column}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Email Options */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="sendEmail"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-600 cursor-pointer"
                />
                <label
                  htmlFor="sendEmail"
                  className="cursor-pointer text-sm font-medium text-gray-900"
                >
                  Send via email instead of download
                </label>
              </div>

              {sendEmail && (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              )}

              {/* Save as Template */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="checkbox"
                    id="saveAsTemplate"
                    checked={saveAsTemplate}
                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-600 cursor-pointer"
                  />
                  <label
                    htmlFor="saveAsTemplate"
                    className="cursor-pointer text-sm font-medium text-gray-900"
                  >
                    Save configuration as template
                  </label>
                </div>

                {saveAsTemplate && (
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Template name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                )}
              </div>
            </div>
          )}

          {tab === 'templates' && (
            <div className="space-y-3">
              {templates.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No templates saved yet</p>
              ) : (
                templates.map((template) => (
                  <div
                    key={template.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedTemplate === template.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleLoadTemplate(template.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{template.name}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Format: <span className="font-mono">{template.format}</span> •{' '}
                          {template.columns?.length || 0} columns
                        </div>
                        {new Date(template.updatedAt).toLocaleDateString()}
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        template.format === 'pdf'
                          ? 'bg-red-100 text-red-700'
                          : template.format === 'excel'
                          ? 'bg-green-100 text-green-700'
                          : template.format === 'csv'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {template.format.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => {
              resetDialog();
              onClose();
            }}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isLoading || (saveAsTemplate && !templateName)}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {sendEmail ? 'Send Export' : 'Download Export'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;
