import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  backHref?: string;
}

/**
 * PageHeader — top section for admin pages.
 *
 * Action button sizing convention:
 *   Action buttons passed via the `actions` prop are responsible for their own
 *   responsive sizing. They should render `size="icon"` on mobile and
 *   `size="default"` on sm+ breakpoints (e.g. hidden label on mobile, visible
 *   on sm+). PageHeader renders `{actions}` as-is and does not impose sizing.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  backHref,
}) => {
  return (
    <div className="mb-6">
      {/* Back link — only rendered when backHref is provided */}
      {backHref && (
        <Link
          to={backHref}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"
        >
          <ChevronLeft size={16} />
          Back
        </Link>
      )}

      {/* Title row: stacks vertically on mobile, side-by-side on sm+ */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        {/* Left: title + optional subtitle */}
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>

        {/* Right: action slot */}
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
