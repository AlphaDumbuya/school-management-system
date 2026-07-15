import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { useAuth, getDashboardPath } from '@hooks/useAuth';

export interface BreadcrumbItem {
  label: string;
  href?: string; // omit for the current (last) segment
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  const { user } = useAuth();
  const homePath = user ? getDashboardPath(user.role) : '/';

  return (
    <nav aria-label="breadcrumb" className="text-sm mb-4">
      <ol className="flex flex-wrap items-center">
        {/* Home icon — always first */}
        <li className="flex items-center">
          <Link
            to={homePath}
            className="text-gray-500 hover:text-gray-700 hover:underline flex items-center"
            aria-label="Home"
          >
            <Home size={14} aria-hidden="true" />
          </Link>
        </li>

        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="flex items-center">
              {/* Separator */}
              <span aria-hidden="true" className="mx-1 text-gray-400">/</span>

              {/* Last segment — not a link */}
              {isLast || !item.href ? (
                <span aria-current={isLast ? 'page' : undefined} className="text-gray-900 font-medium">
                  {item.label}
                </span>
              ) : (
                /* Parent segment — link */
                <Link
                  to={item.href}
                  className="text-gray-500 hover:text-gray-700 hover:underline"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
