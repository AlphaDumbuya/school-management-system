/**
 * Alerts Card Component
 * Displays system alerts and notifications
 * Phase 11: Frontend Dashboard Implementation
 */

import React, { useState } from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, XCircle } from 'react-icons/fa';
import { DashboardAlert } from '@types/index';
import clsx from 'clsx';

interface AlertsCardProps {
  alerts: DashboardAlert[];
  isLoading?: boolean;
  onDismiss?: (id: string) => void;
  onAction?: (id: string, actionUrl: string) => void;
}

const getSeverityStyles = (severity: DashboardAlert['severity']) => {
  const styles = {
    critical: 'bg-red-50 border-red-200 text-red-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };
  return styles[severity] || styles.info;
};

const getSeverityIcon = (severity: DashboardAlert['severity']) => {
  switch (severity) {
    case 'critical':
      return <AlertCircle className="w-5 h-5 text-red-600" />;
    case 'error':
      return <XCircle className="w-5 h-5 text-red-600" />;
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    case 'info':
      return <CheckCircle className="w-5 h-5 text-blue-600" />;
    default:
      return <CheckCircle className="w-5 h-5 text-blue-600" />;
  }
};

export const AlertsCard: React.FC<AlertsCardProps> = ({
  alerts,
  isLoading,
  onDismiss,
  onAction,
}) => {
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  const handleDismiss = (id: string) => {
    setDismissedAlerts((prev) => new Set(prev).add(id));
    onDismiss?.(id);
  };

  const handleAction = (id: string, actionUrl?: string) => {
    if (actionUrl) {
      onAction?.(id, actionUrl);
    }
  };

  const visibleAlerts = alerts.filter((alert) => !dismissedAlerts.has(alert.id));
  const criticalAlerts = visibleAlerts.filter((a) => a.severity === 'critical');

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="h-24 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (visibleAlerts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 text-center">
        <div className="text-4xl mb-2">✓</div>
        <p className="text-gray-600">No active alerts</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">System Alerts</h3>
          <span className="text-sm font-medium text-gray-600">
            {visibleAlerts.length} alert{visibleAlerts.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Critical alerts first */}
      {criticalAlerts.length > 0 && (
        <div className="border-b border-gray-200">
          <div className="px-6 py-3 bg-red-50 border-b border-red-200">
            <p className="text-sm font-semibold text-red-800">
              {criticalAlerts.length} Critical Alert{criticalAlerts.length !== 1 ? 's' : ''}
            </p>
          </div>
          {criticalAlerts.map((alert) => (
            <AlertItem key={alert.id} alert={alert} onDismiss={handleDismiss} onAction={handleAction} />
          ))}
        </div>
      )}

      {/* Warning and info alerts */}
      <div className="divide-y divide-gray-200">
        {visibleAlerts
          .filter((a) => a.severity !== 'critical')
          .map((alert) => (
            <AlertItem key={alert.id} alert={alert} onDismiss={handleDismiss} onAction={handleAction} />
          ))}
      </div>
    </div>
  );
};

interface AlertItemProps {
  alert: DashboardAlert;
  onDismiss: (id: string) => void;
  onAction: (id: string, actionUrl?: string) => void;
}

const AlertItem: React.FC<AlertItemProps> = ({ alert, onDismiss, onAction }) => {
  return (
    <div
      className={clsx(
        'p-4 border-l-4 transition-all duration-200',
        getSeverityStyles(alert.severity)
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="mt-0.5">{getSeverityIcon(alert.severity)}</div>

        {/* Content */}
        <div className="flex-1">
          <h4 className="font-semibold text-sm mb-1">{alert.title}</h4>
          <p className="text-sm opacity-90 mb-2">{alert.message}</p>
          <p className="text-xs opacity-75">
            {new Date(alert.timestamp).toLocaleString()}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          {alert.actionUrl && (
            <button
              onClick={() => onAction(alert.id, alert.actionUrl)}
              className="text-sm font-medium underline hover:no-underline"
            >
              {alert.actionLabel || 'View'}
            </button>
          )}
          {alert.dismissible && (
            <button
              onClick={() => onDismiss(alert.id)}
              className="text-sm font-medium underline hover:no-underline ml-2"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertsCard;
