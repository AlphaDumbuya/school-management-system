/**
 * AnchoredMenu — a floating menu glued to its trigger.
 *
 * Shared by the DataTable row "⋯" menu and DropdownMenu. It is rendered in a
 * portal on <body> with `position: fixed`, so no ancestor can move it:
 *  - MainLayout's page wrapper animates with a transform, which turns any
 *    `fixed` descendant into one positioned against that wrapper (inside the
 *    scrolling <main>) instead of the screen. That is why in-place fixed menus
 *    opened at the top of the page or on the wrong side on phones.
 *  - `overflow` on table wrappers / cards can't clip it.
 *
 * Placement: below the trigger, right edges aligned (align="end") or left
 * edges aligned (align="start"); flips above when there isn't room below;
 * clamped inside the viewport horizontally and vertically (scrolls itself if
 * taller than the space). Follows the trigger on scroll/resize and closes when
 * the trigger scrolls out of view or is hidden (e.g. breakpoint change).
 *
 * Keyboard: focus moves to the first item on open; ArrowUp/ArrowDown/Home/End
 * move between items; Escape and Tab close and return focus to the trigger.
 * Children should be buttons with role="menuitem" and tabIndex={-1}.
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface AnchoredMenuProps {
  /** The element the menu is anchored to (focus returns here on Esc/Tab). */
  anchorRef: React.RefObject<HTMLElement>;
  open: boolean;
  onClose: () => void;
  /** "end" aligns the menu's right edge to the trigger's right edge. */
  align?: 'start' | 'end';
  id?: string;
  className?: string;
  'aria-label'?: string;
  children: React.ReactNode;
}

/** Gap between trigger and menu, and minimum distance from screen edges. */
const GAP = 4;
const EDGE = 8;

interface Placement {
  top: number;
  left: number;
  maxHeight?: number;
}

const ITEM_SELECTOR = '[role="menuitem"]:not([disabled]):not([aria-disabled="true"])';
const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Focus the trigger: the anchor itself, or the first focusable inside it. */
export function focusAnchor(anchor: HTMLElement | null | undefined): void {
  if (!anchor) return;
  const target = anchor.matches(FOCUSABLE) ? anchor : anchor.querySelector<HTMLElement>(FOCUSABLE) ?? anchor;
  target.focus({ preventScroll: true });
}

/** Class string for a menu item button, shared so every menu looks the same. */
export function menuItemClass(variant: 'default' | 'destructive' = 'default'): string {
  return `w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2.5 transition-colors outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
    variant === 'destructive'
      ? 'text-red-600 dark:text-red-400 hover:bg-red-50 focus-visible:bg-red-50 dark:hover:bg-red-950/30 dark:focus-visible:bg-red-950/30'
      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 focus-visible:bg-gray-100 dark:hover:bg-gray-700 dark:focus-visible:bg-gray-700'
  }`;
}

export const AnchoredMenu: React.FC<AnchoredMenuProps> = ({
  anchorRef,
  open,
  onClose,
  align = 'end',
  id,
  className = '',
  'aria-label': ariaLabel,
  children,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const close = useCallback((restoreFocus: boolean) => {
    if (restoreFocus) focusAnchor(anchorRef.current);
    onCloseRef.current();
  }, [anchorRef]);

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;

    const r = anchor.getBoundingClientRect();
    // Layout viewport, which is what `position: fixed` is measured against.
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight;

    // Trigger hidden (display:none after a breakpoint change) or scrolled out
    // of view: a menu pointing at nothing is confusing, so close it.
    if ((r.width === 0 && r.height === 0) || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) {
      onCloseRef.current();
      return;
    }

    // Natural size (ignores any max-height applied on a previous pass).
    const width = menu.offsetWidth;
    const borderY = menu.offsetHeight - menu.clientHeight;
    const height = menu.scrollHeight + borderY;

    let left = align === 'end' ? r.right - width : r.left;
    left = Math.max(EDGE, Math.min(left, vw - width - EDGE));

    const spaceBelow = vh - r.bottom - GAP - EDGE;
    const spaceAbove = r.top - GAP - EDGE;
    let top: number;
    let maxHeight: number | undefined;
    if (height <= spaceBelow) {
      top = r.bottom + GAP;
    } else if (height <= spaceAbove) {
      top = r.top - GAP - height;
    } else if (spaceBelow >= spaceAbove) {
      top = r.bottom + GAP;
      maxHeight = Math.max(spaceBelow, 80);
    } else {
      maxHeight = Math.max(spaceAbove, 80);
      top = r.top - GAP - maxHeight;
    }
    top = Math.max(EDGE, top);

    setPlacement((prev) =>
      prev && prev.top === top && prev.left === left && prev.maxHeight === maxHeight
        ? prev
        : { top, left, maxHeight },
    );
  }, [anchorRef, align]);

  // Position before paint, then keep following the trigger.
  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    place();
    // Capture phase: scroll events don't bubble, and the page scrolls inside
    // <main> (and inside table wrappers), not the window.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    window.visualViewport?.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('resize', place);
    };
  }, [open, place]);

  // Focus the first item once the menu is placed and visible.
  const hasPlacement = placement !== null;
  useEffect(() => {
    if (!open || !hasPlacement) return;
    menuRef.current?.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus({ preventScroll: true });
  }, [open, hasPlacement]);

  // Escape closes wherever focus is. Window + capture runs before document
  // listeners, so an open menu inside a Modal closes without closing the Modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close(true);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, close]);

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      close(true);
      return;
    }
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % items.length;
    else if (e.key === 'ArrowUp') next = current <= 0 ? items.length - 1 : current - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next >= 0) {
      e.preventDefault();
      items[next].focus();
    }
  };

  if (!open) return null;

  return createPortal(
    <>
      {/* Transparent catcher: a tap outside closes the menu without also
          activating whatever is underneath it. */}
      <div
        className="fixed inset-0 z-[60]"
        aria-hidden
        onClick={(e) => { e.stopPropagation(); close(false); }}
        onContextMenu={(e) => { e.preventDefault(); close(false); }}
      />
      <div
        ref={menuRef}
        id={id}
        role="menu"
        aria-label={ariaLabel}
        aria-orientation="vertical"
        onKeyDown={handleMenuKeyDown}
        // React events bubble through portals: don't let a menu click reach a
        // clickable row/card that rendered the trigger.
        onClick={(e) => e.stopPropagation()}
        className={`fixed z-[61] overflow-y-auto overscroll-contain max-w-[calc(100vw-16px)] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl py-1.5 animate-in fade-in duration-100 ${className}`}
        style={{
          top: placement?.top ?? 0,
          left: placement?.left ?? 0,
          maxHeight: placement?.maxHeight,
          // Measured on the first pass, shown once placed.
          visibility: placement ? 'visible' : 'hidden',
        }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
};

export default AnchoredMenu;
