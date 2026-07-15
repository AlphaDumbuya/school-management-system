import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '../../ui/button';

export interface ErrorStateProps {
  message?: string;
  statusCode?: number;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message,
  statusCode,
  onRetry,
  className = '',
}) => {
  const displayMessage =
    statusCode === 403
      ? 'You do not have permission to view this data'
      : statusCode === 404
      ? 'This page or record could not be found'
      : message ?? 'Something went wrong. Please try again.';

  return (
    <div
      className={`flex flex-col items-center justify-center min-h-[200px] py-12 text-center ${className}`}
    >
      <AlertCircle size={40} className="text-red-400 mb-3" />
      <p className="text-sm font-semibold text-gray-700">{displayMessage}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
          Try again
        </Button>
      )}
    </div>
  );
};

export default ErrorState;
