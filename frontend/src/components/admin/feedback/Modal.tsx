import React, { useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'fullscreen';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: ModalSize;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm:         'sm:max-w-[448px]',
  md:         'sm:max-w-[576px]',
  lg:         'sm:max-w-[768px]',
  xl:         'sm:max-w-[900px]',
  '2xl':      'sm:max-w-[1200px]',
  fullscreen: 'sm:max-w-[98vw]',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  size = 'md',
  footer,
  children,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    dialogRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled'));

      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocusRef.current && 'focus' in previousFocusRef.current) {
        (previousFocusRef.current as HTMLElement).focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const content = (
    <>
      {/* Backdrop with fade */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-[1px] z-40 animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog wrapper — full-sheet on mobile, centred card on sm+ */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
          tabIndex={-1}
          className={clsx(
            // Layout & sizing
            'w-full flex flex-col',
            // Mobile: full-screen sheet
            'h-dvh',
            // Desktop: auto-height with max constraint, rounded corners
            'sm:h-auto sm:max-h-[88vh] sm:rounded-2xl',
            // Appearance
            'bg-white dark:bg-gray-900 shadow-2xl overflow-hidden',
            // Animation
            'animate-in fade-in slide-in-from-bottom-2 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200',
            'focus:outline-none',
            SIZE_CLASSES[size]
          )}
          style={{
            // Respect the phone's status bar / notch and gesture bar so the full
            // mobile sheet (h-dvh) isn't pushed under the system UI, which would
            // hide the top header or bottom actions and break scrolling.
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {/* Header — sticky on scroll */}
          {title && (
            <div className="flex-shrink-0 flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <h2
                id="modal-title"
                className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate pr-4"
              >
                {title}
              </h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          )}

          {/* Body — scrollable content area. Extra bottom padding ensures the
              last element (e.g. form actions) clears the phone's gesture bar and
              is always reachable by scrolling on a full-height mobile sheet. */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5 pb-8 sm:pb-5 scroll-smooth">
            {children}
          </div>

          {/* Footer — sticky at bottom */}
          {footer && (
            <div className="flex-shrink-0 flex items-center justify-end gap-3 px-5 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );

  return ReactDOM.createPortal(content, document.body);
};

export default Modal;
