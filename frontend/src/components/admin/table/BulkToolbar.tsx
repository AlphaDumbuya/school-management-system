import React from 'react';
import { Button } from '../../ui/button';
import { useAuth } from '@hooks/useAuth';

type UserRole = 'super_admin' | 'principal' | 'teacher' | 'student' | 'parent' | 'accountant' | 'admissions_officer';

export interface BulkAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  roles?: UserRole[];
}

export interface BulkToolbarProps {
  selectedCount: number;
  actions: BulkAction[];
  onDeselectAll: () => void;
}

export const BulkToolbar: React.FC<BulkToolbarProps> = ({
  selectedCount,
  actions,
  onDeselectAll,
}) => {
  const { canAccess } = useAuth();

  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-3">
      {/* Left: count + deselect */}
      <div className="flex items-center gap-3 text-sm">
        <span className="font-medium text-blue-800">
          {selectedCount} selected
        </span>
        <Button variant="link" size="sm" onClick={onDeselectAll} className="text-blue-600 p-0 h-auto">
          Deselect all
        </Button>
      </div>

      {/* Right: bulk actions */}
      <div className="flex items-center gap-2">
        {actions.map((action, i) => {
          // Hide destructive actions for non-authorised roles
          if (
            action.variant === 'destructive' &&
            !canAccess(['super_admin', 'principal'])
          ) {
            return null;
          }
          // Hide if roles restriction is set and user doesn't qualify
          if (action.roles && !canAccess(action.roles)) {
            return null;
          }
          return (
            <Button
              key={i}
              variant={action.variant === 'destructive' ? 'destructive' : 'outline'}
              size="sm"
              onClick={action.onClick}
            >
              {action.icon}
              {action.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default BulkToolbar;
