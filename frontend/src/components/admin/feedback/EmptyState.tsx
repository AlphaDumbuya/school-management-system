import React from 'react';
import { Inbox, SearchX } from 'lucide-react';
import { Button } from '../../ui/button';

export interface EmptyStateProps {
  message: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  isSearchResult?: boolean;
  onClearSearch?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  message,
  description,
  action,
  isSearchResult = false,
  onClearSearch,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center min-h-[200px] py-12 text-center ${className}`}
    >
      {isSearchResult ? (
        <SearchX size={40} className="text-gray-300 mb-3" />
      ) : (
        <Inbox size={40} className="text-gray-300 mb-3" />
      )}

      <p className="text-sm font-semibold text-gray-700">{message}</p>

      {description && (
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      )}

      {isSearchResult && onClearSearch && (
        <button
          className="text-blue-600 text-sm underline hover:text-blue-800 mt-2"
          onClick={onClearSearch}
        >
          Clear search
        </button>
      )}

      {action && (
        <Button
          variant="default"
          size="sm"
          onClick={action.onClick}
          className="mt-4"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
