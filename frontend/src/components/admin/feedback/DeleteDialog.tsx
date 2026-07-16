/**
 * DeleteDialog — Production-ready responsive delete confirmation
 * 
 * Features:
 * - Red destructive theme with warning icon
 * - Shows the item name being deleted
 * - Optional typing confirmation for dangerous deletes
 * - Loading state during async deletion
 * - Fully accessible (focus trap via Modal)
 * - Responsive (full-screen on mobile)
 * 
 * Usage:
 *   <DeleteDialog
 *     isOpen={!!deleteTarget}
 *     onClose={() => setDeleteTarget(null)}
 *     onConfirm={handleDelete}
 *     title="Delete Student"
 *     itemName={deleteTarget?.name}
 *     description="This will permanently remove the student and all associated records."
 *     requireConfirmation  // optional: forces user to type item name
 *   />
 */

import React, { useState, useEffect } from 'react';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from '../../ui/button';

export interface DeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  itemName?: string;
  description?: string;
  confirmLabel?: string;
  requireConfirmation?: boolean;
}

export const DeleteDialog: React.FC<DeleteDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName,
  description,
  confirmLabel = 'Delete',
  requireConfirmation = false,
}) => {
  const [isPending, setIsPending] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setConfirmText('');
      setIsPending(false);
    }
  }, [isOpen]);

  const canConfirm = requireConfirmation
    ? confirmText.toLowerCase() === (itemName || '').toLowerCase()
    : true;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setIsPending(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // Error handled by caller via toast
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={isPending ? () => {} : onClose} size="sm">
      <div className="p-6 text-center">
        {/* Icon */}
        <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <Trash2 size={24} className="text-red-500" />
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>

        {/* Item name */}
        {itemName && (
          <p className="text-sm font-medium text-gray-900 bg-gray-100 rounded-lg px-3 py-2 mb-3 break-words">
            {itemName}
          </p>
        )}

        {/* Description */}
        <p className="text-sm text-gray-500 mb-5">
          {description || 'This action cannot be undone. Are you sure you want to continue?'}
        </p>

        {/* Warning box */}
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-lg p-3 mb-5 text-left">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">
            This will permanently delete this record and all associated data. This cannot be reversed.
          </p>
        </div>

        {/* Typing confirmation */}
        {requireConfirmation && itemName && (
          <div className="mb-5 text-left">
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Type <span className="font-bold text-red-600">"{itemName}"</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={itemName}
              disabled={isPending}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:opacity-50"
              autoFocus
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            disabled={isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            disabled={isPending || !canConfirm}
            onClick={handleConfirm}
          >
            {isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={14} />
                {confirmLabel}
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteDialog;
