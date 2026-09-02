import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  backHref?: string;
  /** Optional icon rendered in a tinted chip beside the title. */
  icon?: React.ReactNode;
}

/**
 * PageHeader — top section for admin pages.
 *
 * Action button sizing convention:
 *   Action buttons passed via the `actions` prop are responsible for their own
 *   responsive sizing. PageHeader renders `{actions}` as-is and does not impose sizing.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  backHref,
  icon,
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

      {/* Title row: stacks on mobile (title above actions), side-by-side on sm+ */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
        {/* Left: optional icon chip + title + subtitle */}
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/20">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right: action slot — full row on mobile (wraps), right-aligned on sm+ */}
        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0 sm:justify-end">
            {actions}
          </div>
        )}
      </div>

      {/* Subtle hairline under the header for a crisper section break */}
      <div className="mt-4 h-px bg-gradient-to-r from-gray-200 via-gray-200/60 to-transparent" />
    </div>
  );
};

export default PageHeader;
