import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from '../../ui/button';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: string;
  confirmLabel?: string;
  isDestructive?: boolean;
  /** Extra content under the message (e.g. a required reason field). */
  children?: React.ReactNode;
  /** Disable Confirm until the extra content is valid. */
  confirmDisabled?: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  isDestructive = true,
  children,
  confirmDisabled = false,
}) => {
  const [isPending, setIsPending] = useState(false);

  const handleConfirm = async () => {
    setIsPending(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // onConfirm reports its own error (toast); keep the dialog open.
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" disabled={isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={isDestructive ? 'destructive' : 'default'}
            disabled={isPending || confirmDisabled}
            onClick={handleConfirm}
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center text-center py-2">
        <AlertTriangle size={40} className="text-red-500 mb-3" />
        <p className="text-sm text-gray-600 dark:text-gray-300">{message}</p>
      </div>
      {children}
    </Modal>
  );
};

export default ConfirmationDialog;
