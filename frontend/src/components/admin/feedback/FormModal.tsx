/**
 * FormModal — Standardized form-in-modal wrapper
 * 
 * Provides consistent structure for all create/edit modals:
 * - Title with create/edit context
 * - Scrollable form body
 * - Sticky footer with Cancel + Submit buttons
 * - Loading state during submission
 * - Auto-resets form when closed
 * 
 * Usage:
 *   <FormModal
 *     isOpen={modalOpen}
 *     onClose={() => setModalOpen(false)}
 *     onSubmit={handleSubmit}
 *     title={editing ? 'Edit Student' : 'Add Student'}
 *     submitLabel={editing ? 'Update' : 'Create'}
 *     size="md"
 *   >
 *     <FormField name="firstName" label="First Name" ... />
 *     <FormField name="lastName" label="Last Name" ... />
 *   </FormModal>
 */

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal, ModalSize } from './Modal';
import { Button } from '../../ui/button';

export interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void> | void;
  title: string;
  submitLabel?: string;
  size?: ModalSize;
  isValid?: boolean;
  children: React.ReactNode;
}

export const FormModal: React.FC<FormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  submitLabel = 'Save',
  size = 'md',
  isValid = true,
  children,
}) => {
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isPending) return;
    setIsPending(true);
    try {
      await onSubmit();
      onClose();
    } catch {
      // Error handled by caller via showToast
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isPending ? () => {} : onClose}
      title={title}
      size={size}
      footer={
        <>
          <Button variant="outline" disabled={isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="form-modal-form"
            disabled={isPending || !isValid}
          >
            {isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving...
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </>
      }
    >
      <form id="form-modal-form" onSubmit={handleSubmit} className="space-y-4">
        {children}
      </form>
    </Modal>
  );
};

export default FormModal;
