/**
 * Chart Card Component
 * Wrapper for displaying charts with loading states
 * Phase 11: Frontend Dashboard Implementation
 */

import React from 'react';
import { ChartData } from '@appTypes/index';

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  isLoading?: boolean;
  error?: string | null;
  description?: string;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  children,
  isLoading,
  error,
  description,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      </div>

      {/* Content */}
      <div className="p-6">
        {isLoading ? (
          <div className="h-80 bg-gray-100 rounded animate-pulse flex items-center justify-center">
            <p className="text-gray-400">Loading chart...</p>
          </div>
        ) : error ? (
          <div className="h-80 flex items-center justify-center bg-red-50 rounded">
            <div className="text-center">
              <p className="text-red-600 font-medium">Failed to load chart</p>
              <p className="text-red-500 text-sm mt-1">{error}</p>
            </div>
          </div>
        ) : (
          <div>{children}</div>
        )}
      </div>
    </div>
  );
};

export default ChartCard;
