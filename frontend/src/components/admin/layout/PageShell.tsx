import React from 'react';
import { Breadcrumb } from './Breadcrumb';
import { PageHeader } from './PageHeader';
// SkeletonChart will be created as part of task 3.1 (feedback/Skeleton.tsx)
import { SkeletonChart } from '../feedback/Skeleton';
import { RefreshButton } from '../common/RefreshButton';

export type { BreadcrumbItem } from './Breadcrumb';
export type { BreadcrumbProps } from './Breadcrumb';

// Inline TabItem since PageTabs (common/PageTabs.tsx) doesn't exist yet.
// Once PageTabs is created, this should be replaced with:
//   import type { TabItem } from '../common/PageTabs';
export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface PageShellProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: import('./Breadcrumb').BreadcrumbItem[];
  actions?: React.ReactNode;
  isLoading?: boolean;
  backHref?: string;
  tabs?: TabItem[];
  /** When provided, a Refresh control is shown in the header actions area. */
  onRefresh?: () => void | Promise<unknown>;
  /** Drive the refresh spinner from the parent (optional). */
  isRefreshing?: boolean;
  children: React.ReactNode;
}

/**
 * PageShell — outermost content wrapper for every admin page.
 *
 * Goes INSIDE MainLayout's <main> slot; does NOT wrap MainLayout.
 *
 * Render order:
 *   1. <Breadcrumb>     — only when breadcrumbs is non-empty
 *   2. <PageHeader>     — always
 *   3. tabs placeholder — only when tabs is non-empty (TODO: replace with <PageTabs> once available)
 *   4. children         — or <SkeletonChart> when isLoading is true
 */
export const PageShell: React.FC<PageShellProps> = ({
  title,
  subtitle,
  breadcrumbs,
  actions,
  isLoading = false,
  backHref,
  tabs,
  onRefresh,
  isRefreshing,
  children,
}) => {
  // Compose a Refresh control (when requested) with the page's own actions so
  // every page that opts in gets a consistent reload button.
  const headerActions = onRefresh ? (
    <div className="flex items-center gap-2">
      <RefreshButton onRefresh={onRefresh} isRefreshing={isRefreshing} />
      {actions}
    </div>
  ) : (
    actions
  );
  return (
    // No horizontal padding on mobile: MainLayout's <main> already provides p-3.
    // Only re-introduce inner gutters at larger breakpoints, keeping the page
    // centred with a max width. This avoids the "choked" double-padding on phones.
    <div className="max-w-7xl mx-auto sm:px-2 lg:px-4 py-2 sm:py-4">
      {/* Breadcrumb — only when breadcrumbs array is non-empty */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb items={breadcrumbs} />
      )}

      {/* Page header — always rendered */}
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={headerActions}
        backHref={backHref}
      />

      {/* Tabs placeholder — TODO: replace with <PageTabs tabs={tabs} ...> once
          common/PageTabs.tsx exists. Import TabItem from there and remove the
          inline interface above. */}
      {tabs && tabs.length > 0 && (
        <div className="border-b border-gray-200 mb-6" />
      )}

      {/* Main content area */}
      {isLoading ? (
        <SkeletonChart height={400} />
      ) : (
        children
      )}
    </div>
  );
};

export default PageShell;
