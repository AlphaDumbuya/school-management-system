/**
 * EventAnalyticsPage — /events/analytics
 * Analytics dashboard inside MainLayout
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { EventAnalytics } from '@components/events';
import { AnalyticsFilters } from '@types/events';

const fieldCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

export const EventAnalyticsPage: React.FC = () => {
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const quickFilter = (days: number) => {
    const today = new Date();
    const from = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
    setFilters({
      start_date: from.toISOString().split('T')[0],
      end_date: today.toISOString().split('T')[0],
    });
    setShowFilters(false);
  };

  const hasActiveFilters = filters.start_date || filters.end_date;

  return (
    <MainLayout>
      <PageShell
        title="Event Analytics"
        subtitle="Comprehensive insights into event performance and engagement"
        breadcrumbs={[{ label: 'Event Analytics' }]}
        actions={
          <Button variant="outline" size="sm" onClick={() => setShowFilters(v => !v)}>
            {showFilters ? 'Hide Filters' : 'Date Filters'}
          </Button>
        }
      >
        {/* Filter panel */}
        {showFilters && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Start Date</label>
                <input
                  type="date"
                  value={filters.start_date || ''}
                  onChange={e => setFilters(f => ({ ...f, start_date: e.target.value || undefined }))}
                  className={fieldCls}
                />
              </div>
              <div>
                <label className={labelCls}>End Date</label>
                <input
                  type="date"
                  value={filters.end_date || ''}
                  onChange={e => setFilters(f => ({ ...f, end_date: e.target.value || undefined }))}
                  className={fieldCls}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-gray-500 dark:text-gray-400">Quick:</span>
              {[
                { label: 'Last 7 days', days: 7 },
                { label: 'Last 30 days', days: 30 },
                { label: 'Last year', days: 365 },
              ].map(q => (
                <button
                  key={q.days}
                  onClick={() => quickFilter(q.days)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {q.label}
                </button>
              ))}
              <button
                onClick={() => setFilters({})}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 ml-2"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Active filter badges */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <span className="text-xs text-gray-500 dark:text-gray-400">Filters:</span>
            {filters.start_date && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 border border-gray-300 dark:border-gray-600 rounded-full text-xs text-gray-700 dark:text-gray-300">
                From: {filters.start_date}
                <button onClick={() => setFilters(f => ({ ...f, start_date: undefined }))} className="hover:text-gray-900 dark:hover:text-white">
                  <X size={11} />
                </button>
              </span>
            )}
            {filters.end_date && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 border border-gray-300 dark:border-gray-600 rounded-full text-xs text-gray-700 dark:text-gray-300">
                To: {filters.end_date}
                <button onClick={() => setFilters(f => ({ ...f, end_date: undefined }))} className="hover:text-gray-900 dark:hover:text-white">
                  <X size={11} />
                </button>
              </span>
            )}
          </div>
        )}

        {/* Analytics */}
        <EventAnalytics filters={filters} />
      </PageShell>
    </MainLayout>
  );
};

export default EventAnalyticsPage;
