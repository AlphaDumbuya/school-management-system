import React from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle, X } from 'lucide-react';

export interface AlertProps {
  id: string;
  type: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  actionUrl?: string;
  dismissible?: boolean;
  onDismiss?: (id: string) => void;
  actionLabel?: string;
}

const alertStyles = {
  info: {
    container: 'bg-blue-50 border-blue-200 text-blue-800',
    icon: 'text-blue-500',
    button: 'bg-blue-100 hover:bg-blue-200 text-blue-800',
  },
  warning: {
    container: 'bg-amber-50 border-amber-200 text-amber-800',
    icon: 'text-amber-500',
    button: 'bg-amber-100 hover:bg-amber-200 text-amber-800',
  },
  error: {
    container: 'bg-red-50 border-red-200 text-red-800',
    icon: 'text-red-500',
    button: 'bg-red-100 hover:bg-red-200 text-red-800',
  },
  critical: {
    container: 'bg-red-100 border-red-300 text-red-900',
    icon: 'text-red-600',
    button: 'bg-red-200 hover:bg-red-300 text-red-900',
  },
};

const alertIcons = {
  info: <Info size={20} />,
  warning: <AlertTriangle size={20} />,
  error: <AlertCircle size={20} />,
  critical: <AlertTriangle size={20} />,
};

export const AlertCard: React.FC<AlertProps> = ({
  id,
  type,
  title,
  message,
  actionUrl,
  dismissible = true,
  onDismiss,
  actionLabel = 'View',
}) => {
  const styles = alertStyles[type];

  const handleAction = () => {
    if (actionUrl) {
      window.location.href = actionUrl;
    }
  };

  return (
    <div className={`p-4 rounded-lg border-l-4 border-opacity-50 flex items-start gap-4 ${styles.container} transition-all duration-300`}>
      <div className={`flex-shrink-0 mt-0.5 ${styles.icon}`}>{alertIcons[type]}</div>

      <div className="flex-grow">
        <h4 className="font-semibold text-sm mb-1">{title}</h4>
        <p className="text-sm opacity-90">{message}</p>
      </div>

      <div className="flex-shrink-0 flex gap-2">
        {actionUrl && (
          <button
            onClick={handleAction}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${styles.button}`}
          >
            {actionLabel}
          </button>
        )}
        {dismissible && (
          <button
            onClick={() => onDismiss?.(id)}
            className={`p-1 rounded transition-colors ${styles.button}`}
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default AlertCard;
