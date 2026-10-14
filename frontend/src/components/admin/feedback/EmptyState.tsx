import React from 'react';
import { Button } from '../../ui/button';
import { EmptyArt, pickIllustration, type EmptyIllustration } from './emptyArt';

export type { EmptyIllustration } from './emptyArt';

export interface EmptyStateProps {
  message: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  isSearchResult?: boolean;
  onClearSearch?: () => void;
  className?: string;
  /** Overrides the automatic pick (search results / message keywords). Default 'empty'. */
  illustration?: EmptyIllustration;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  message,
  description,
  action,
  isSearchResult = false,
  onClearSearch,
  className = '',
  illustration,
}) => {
  const art: EmptyIllustration =
    illustration ?? (isSearchResult ? 'search' : pickIllustration(`${message} ${description ?? ''}`));

  return (
    <div
      className={`flex flex-col items-center justify-center min-h-[200px] py-12 text-center ${className}`}
    >
      <EmptyArt name={art} className="mb-3" />

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
