import React from 'react';
import { Badge } from '../../ui/badge';

type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';

const STATUS_MAP: Record<string, BadgeVariant> = {
  active: 'success',
  paid: 'success',
  inactive: 'secondary',
  draft: 'secondary',
  pending: 'warning',
  partial: 'warning',
  suspended: 'destructive',
  overdue: 'destructive',
  cancelled: 'destructive',
  published: 'default',
};

export interface StatusBadgeProps {
  status: string;
  showDot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, showDot = false }) => {
  const normalised = status.toLowerCase().trim();
  const variant: BadgeVariant = STATUS_MAP[normalised] ?? 'secondary';
  const label = normalised.charAt(0).toUpperCase() + normalised.slice(1);

  return (
    <Badge variant={variant}>
      {showDot && (
        <span
          className="w-1 h-1 rounded-full bg-current mr-1.5 inline-block flex-shrink-0"
          aria-hidden="true"
        />
      )}
      {label}
    </Badge>
  );
};

export default StatusBadge;
