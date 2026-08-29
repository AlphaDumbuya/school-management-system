/**
 * TemplatePreviewModal — read-only preview of a card template.
 *
 * Shows the front (and back, if double-sided) exactly as the generated card
 * will look, using the shared VisualIdCardRenderer in readonly mode. Lets an
 * admin inspect a template without opening the full editor.
 */

import React, { useState } from 'react';
import { X, FlipHorizontal2, Pencil } from 'lucide-react';
import { VisualIdCardRenderer } from './VisualIdCardRenderer';
import { CardTemplate } from '@services/idCardService';
import { Button } from '@components/ui/button';

interface TemplatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: CardTemplate | null;
  onEdit?: (template: CardTemplate) => void;
}

const STATUS_STYLE: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  pending_approval: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  archived: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

export const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({ isOpen, onClose, template, onEdit }) => {
  const [side, setSide] = useState<'front' | 'back'>('front');

  if (!isOpen || !template) return null;

  const config = (template.config || {}) as any;
  const isDouble = config.printSides === 'double';

  // Sample holder data so the preview looks like a real card.
  const sampleUser = {
    name: 'Alice Smith',
    idNumber: template.format === 'badge' ? 'STF-3011-2025' : 'STU-1092-2026',
    role: template.defaultForRoles?.[0] ? String(template.defaultForRoles[0]).toUpperCase() : 'STUDENT',
    departmentOrGrade: 'Grade 10',
    expiresAt: '31/08/2027',
    schoolName: config.customSchoolName,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">{template.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{template.format}</span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[template.status] || STATUS_STYLE.draft}`}>
                {String(template.status).replace('_', ' ')}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Card preview */}
        <div className="p-6 flex flex-col items-center bg-gray-50 dark:bg-gray-950/40">
          <div className="w-full max-w-[360px] flex justify-center">
            <VisualIdCardRenderer
              config={config}
              format={template.format}
              user={sampleUser}
              logoUrl={template.logoUrl || config.logoUrl}
              side={side}
              readonly
            />
          </div>

          {isDouble && (
            <button
              onClick={() => setSide((s) => (s === 'front' ? 'back' : 'front'))}
              className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              <FlipHorizontal2 size={15} /> Show {side === 'front' ? 'back' : 'front'}
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          {onEdit && (
            <Button variant="default" size="sm" onClick={() => onEdit(template)} className="flex items-center gap-1.5">
              <Pencil size={14} /> Edit Template
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplatePreviewModal;
