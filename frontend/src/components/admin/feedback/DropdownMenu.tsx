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

import React, { useState, useRef, useId } from 'react';
import { AnchoredMenu, focusAnchor, menuItemClass } from './AnchoredMenu';

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
  // Anchor = the wrapper around the caller's trigger. It's focusable only so
  // Escape/Tab can hand focus back to it; the caller's button stays the
  // keyboard target (Enter/Space on it bubbles a click to this wrapper).
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  return (
    <div className="relative inline-flex">
      <div
        ref={anchorRef}
        tabIndex={-1}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="cursor-pointer outline-none"
      >
        {trigger}
      </div>

      {/* Portalled + positioned from the trigger rect (see AnchoredMenu). */}
      <AnchoredMenu
        id={menuId}
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        align={align === 'right' ? 'end' : 'start'}
        className="min-w-[160px]"
      >
        {items.map((item, i) => {
          if ('type' in item && item.type === 'separator') {
            return <div key={i} role="separator" className="my-1 border-t border-gray-100 dark:border-gray-700" />;
          }

          const menuItem = item as Extract<DropdownItem, { label: string }>;

          return (
            <button
              key={i}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={menuItem.disabled}
              className={menuItemClass(menuItem.variant)}
              onClick={() => {
                menuItem.onClick();
                focusAnchor(anchorRef.current);
                setOpen(false);
              }}
            >
              {menuItem.icon && <span className="flex-shrink-0">{menuItem.icon}</span>}
              {menuItem.label}
            </button>
          );
        })}
      </AnchoredMenu>
    </div>
  );
};

export default DropdownMenu;
