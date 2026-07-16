/**
 * Template Form Modal
 * Modal for creating/editing card templates
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { idCardService, CardTemplate, CardFormat, UserRole } from '@services/idCardService';
import { Loader2 } from 'lucide-react';

interface TemplateFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editingTemplate?: CardTemplate | null;
}

export const TemplateFormModal: React.FC<TemplateFormModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    editingTemplate,
}) => {
    const [formData, setFormData] = useState({
        name: '',
        format: 'pvc' as CardFormat,
        backgroundColor: '#FFFFFF',
        textColor: '#000000',
        fontFamily: 'Arial',
        fontSize: 12,
        logoPosition: 'top-center' as 'top-left' | 'top-center' | 'top-right',
        defaultForRoles: [] as UserRole[],
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Populate form when editing
    useEffect(() => {
        if (editingTemplate) {
            setFormData({
                name: editingTemplate.name,
                format: editingTemplate.format,
                backgroundColor: editingTemplate.config.backgroundColor,
                textColor: editingTemplate.config.textColor,
                fontFamily: editingTemplate.config.fontFamily,
                fontSize: editingTemplate.config.fontSize,
                logoPosition: editingTemplate.config.logoPosition,
                defaultForRoles: editingTemplate.defaultForRoles,
            });
        } else {
            // Reset form
            setFormData({
                name: '',
                format: 'pvc',
                backgroundColor: '#FFFFFF',
                textColor: '#000000',
                fontFamily: 'Arial',
                fontSize: 12,
                logoPosition: 'top-center',
                defaultForRoles: [],
            });
        }
    }, [editingTemplate, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            showToast.error('Please enter a template name');
            return;
        }

        setIsSubmitting(true);

        try {
            const templateData = {
                name: formData.name,
                format: formData.format,
                config: {
                    backgroundColor: formData.backgroundColor,
                    textColor: formData.textColor,
                    fontFamily: formData.fontFamily,
                    fontSize: formData.fontSize,
                    logoPosition: formData.logoPosition,
                    layoutConfig: {
                        // Default layout - can be customized later
                        photoPosition: { x: 10, y: 10, width: 50, height: 50 },
                        namePosition: { x: 70, y: 15 },
                        rolePosition: { x: 70, y: 30 },
                        idPosition: { x: 70, y: 45 },
                        qrCodePosition: { x: 10, y: 70, size: 40 },
                        barcodePosition: { x: 60, y: 70 },
                    },
                },
                defaultForRoles: formData.defaultForRoles,
            };

            let res;
            if (editingTemplate) {
                res = await idCardService.updateTemplate(editingTemplate.id, templateData);
            } else {
                res = await idCardService.createTemplate(templateData);
            }

            if (res.success !== false) {
                showToast.success(
                    editingTemplate ? 'Template updated successfully' : 'Template created successfully'
                );
                onSuccess();
                onClose();
            } else {
                showToast.apiError(res.error);
            }
        } catch (error: any) {
            showToast.error(error.message || 'Failed to save template');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRoleToggle = (role: UserRole) => {
        setFormData((prev) => ({
            ...prev,
            defaultForRoles: prev.defaultForRoles.includes(role)
                ? prev.defaultForRoles.filter((r) => r !== role)
                : [...prev.defaultForRoles, role],
        }));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg">
            <div className="p-6">
                <h2 id="modal-title" className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                    {editingTemplate ? 'Edit Template' : 'Create Template'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Template Name */}
                    <div>
                        <label
                            htmlFor="name"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                            Template Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="name"
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            disabled={isSubmitting}
                            required
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                            placeholder="e.g., Student ID Card 2024"
                        />
                    </div>

                    {/* Format */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Card Format <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, format: 'pvc' })}
                                disabled={isSubmitting}
                                className={`px-4 py-3 border-2 rounded-lg text-sm font-medium transition-all ${formData.format === 'pvc'
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400'
                                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                                    }`}
                            >
                                PVC Card (85.6mm × 53.98mm)
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, format: 'badge' })}
                                disabled={isSubmitting}
                                className={`px-4 py-3 border-2 rounded-lg text-sm font-medium transition-all ${formData.format === 'badge'
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400'
                                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                                    }`}
                            >
                                Badge (4" × 6")
                            </button>
                        </div>
                    </div>

                    {/* Colors */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label
                                htmlFor="backgroundColor"
                                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                            >
                                Background Color
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    id="backgroundColor"
                                    type="color"
                                    value={formData.backgroundColor}
                                    onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                                    disabled={isSubmitting}
                                    className="w-12 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={formData.backgroundColor}
                                    onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                                    disabled={isSubmitting}
                                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="#FFFFFF"
                                />
                            </div>
                        </div>
                        <div>
                            <label
                                htmlFor="textColor"
                                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                            >
                                Text Color
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    id="textColor"
                                    type="color"
                                    value={formData.textColor}
                                    onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
                                    disabled={isSubmitting}
                                    className="w-12 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={formData.textColor}
                                    onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
                                    disabled={isSubmitting}
                                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="#000000"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Font Settings */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label
                                htmlFor="fontFamily"
                                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                            >
                                Font Family
                            </label>
                            <select
                                id="fontFamily"
                                value={formData.fontFamily}
                                onChange={(e) => setFormData({ ...formData, fontFamily: e.target.value })}
                                disabled={isSubmitting}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="Arial">Arial</option>
                                <option value="Helvetica">Helvetica</option>
                                <option value="Times-Roman">Times New Roman</option>
                                <option value="Courier">Courier</option>
                            </select>
                        </div>
                        <div>
                            <label
                                htmlFor="fontSize"
                                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                            >
                                Font Size (pt)
                            </label>
                            <input
                                id="fontSize"
                                type="number"
                                min="8"
                                max="24"
                                value={formData.fontSize}
                                onChange={(e) =>
                                    setFormData({ ...formData, fontSize: parseInt(e.target.value) || 12 })
                                }
                                disabled={isSubmitting}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Logo Position */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Logo Position
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['top-left', 'top-center', 'top-right'] as const).map((pos) => (
                                <button
                                    key={pos}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, logoPosition: pos })}
                                    disabled={isSubmitting}
                                    className={`px-3 py-2 border rounded-lg text-xs font-medium transition-all capitalize ${formData.logoPosition === pos
                                            ? 'border-blue-500 bg-blue-600/10 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400'
                                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                                        }`}
                                >
                                    {pos.replace('-', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Default for Roles */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Set as Default for Roles (Optional)
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {(['student', 'teacher', 'staff'] as const).map((role) => (
                                <button
                                    key={role}
                                    type="button"
                                    onClick={() => handleRoleToggle(role)}
                                    disabled={isSubmitting}
                                    className={`px-3 py-1.5 border rounded-lg text-xs font-medium transition-all capitalize ${formData.defaultForRoles.includes(role)
                                            ? 'border-green-500 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400'
                                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                                        }`}
                                >
                                    {role}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 mt-6">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="default" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={16} className="animate-spin mr-2" />
                                    {editingTemplate ? 'Updating...' : 'Creating...'}
                                </>
                            ) : editingTemplate ? (
                                'Update Template'
                            ) : (
                                'Create Template'
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </Modal>
    );
};
