/**
 * DropdownMenu — Reusable dropdown action menu
 * 
 * Handles positioning, outside click, keyboard navigation, and accessibility.
 * 
 * Usage:
 *   <DropdownMenu
 *     trigger={<Button variant="outline" size="sm"><MoreHorizontal size={16} /></Button>}
 *     items={[
 *       { label: 'Edit', icon: <Edit size={14} />, onClick: handleEdit },
 *       { label: 'Duplicate', icon: <Copy size={14} />, onClick: handleDuplicate },
 *       { type: 'separator' },
 *       { label: 'Delete', icon: <Trash2 size={14} />, onClick: handleDelete, variant: 'destructive' },
 *     ]}
 *   />
 */

import React, { useState, useRef, useEffect } from 'react';

export type DropdownItem =
  | { type: 'separator' }
  | {
      type?: 'item';
      label: string;
      icon?: React.ReactNode;
      onClick: () => void;
      variant?: 'default' | 'destructive';
      disabled?: boolean;
    };

export interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  trigger,
  items,
  align = 'right',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-flex">
      <div onClick={() => setOpen((v) => !v)} className="cursor-pointer">
        {trigger}
      </div>

      {open && (
        <div
          role="menu"
          className={`absolute top-full mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[160px] py-1 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item, i) => {
            if ('type' in item && item.type === 'separator') {
              return <div key={i} className="my-1 border-t border-gray-100" />;
            }

            const menuItem = item as Extract<DropdownItem, { label: string }>;
            const isDestructive = menuItem.variant === 'destructive';

            return (
              <button
                key={i}
                role="menuitem"
                disabled={menuItem.disabled}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  isDestructive
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => {
                  menuItem.onClick();
                  setOpen(false);
                }}
              >
                {menuItem.icon && <span className="flex-shrink-0">{menuItem.icon}</span>}
                {menuItem.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DropdownMenu;
