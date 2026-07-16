/**
 * Card Generation Modal
 * Modal for generating new ID cards
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { idCardService, CardFormat } from '@services/idCardService';
import { Loader2 } from 'lucide-react';

interface CardGenerationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    userId?: string; // If provided, pre-select this user
}

export const CardGenerationModal: React.FC<CardGenerationModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    userId: preselectedUserId,
}) => {
    const [userId, setUserId] = useState(preselectedUserId || '');
    const [templateId, setTemplateId] = useState('');
    const [format, setFormat] = useState<CardFormat>('pvc');
    const [isGenerating, setIsGenerating] = useState(false);

    // Fetch users (for selection)
    const { data: usersData, isLoading: usersLoading } = useQuery({
        queryKey: ['users-for-cards'],
        queryFn: async () => {
            // This should call your users API
            const response = await fetch('/api/v1/users?limit=1000');
            return response.json();
        },
        enabled: isOpen && !preselectedUserId,
    });

    const users = usersData?.data?.data ?? [];

    // Fetch templates
    const { data: templatesData, isLoading: templatesLoading } = useQuery({
        queryKey: ['card-templates', format],
        queryFn: () => idCardService.listTemplates({ format }),
        enabled: isOpen,
    });

    const templates = templatesData?.data?.data ?? [];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!userId) {
            showToast.error('Please select a user');
            return;
        }

        setIsGenerating(true);

        try {
            const res = await idCardService.generateCard({
                userId,
                templateId: templateId || undefined,
                format,
            });

            if (res.success !== false) {
                showToast.success('ID card generated successfully');
                onSuccess();
                onClose();
                // Reset form
                setUserId(preselectedUserId || '');
                setTemplateId('');
                setFormat('pvc');
            } else {
                showToast.apiError(res.error);
            }
        } catch (error: any) {
            showToast.error(error.message || 'Failed to generate card');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleClose = () => {
        if (!isGenerating) {
            onClose();
            // Reset form after close
            setTimeout(() => {
                setUserId(preselectedUserId || '');
                setTemplateId('');
                setFormat('pvc');
            }, 300);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} size="md">
            <div className="p-6">
                <h2 id="modal-title" className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                    Generate ID Card
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* User Selection */}
                    {!preselectedUserId && (
                        <div>
                            <label
                                htmlFor="userId"
                                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                            >
                                Select User <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="userId"
                                value={userId}
                                onChange={(e) => setUserId(e.target.value)}
                                disabled={usersLoading || isGenerating}
                                required
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <option value="">-- Select User --</option>
                                {users.map((user: any) => (
                                    <option key={user.id} value={user.id}>
                                        {user.firstName} {user.lastName} ({user.email}) - {user.role}
                                    </option>
                                ))}
                            </select>
                            {usersLoading && (
                                <p className="text-xs text-gray-500 mt-1">Loading users...</p>
                            )}
                        </div>
                    )}

                    {/* Format Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Card Format <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setFormat('pvc')}
                                disabled={isGenerating}
                                className={`px-4 py-3 border-2 rounded-lg text-sm font-medium transition-all ${format === 'pvc'
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400'
                                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                <div className="font-bold">PVC Card</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    85.6mm × 53.98mm
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormat('badge')}
                                disabled={isGenerating}
                                className={`px-4 py-3 border-2 rounded-lg text-sm font-medium transition-all ${format === 'badge'
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400'
                                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                <div className="font-bold">Badge</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    4" × 6" Lanyard
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Template Selection */}
                    <div>
                        <label
                            htmlFor="templateId"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                            Template (Optional)
                        </label>
                        <select
                            id="templateId"
                            value={templateId}
                            onChange={(e) => setTemplateId(e.target.value)}
                            disabled={templatesLoading || isGenerating}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="">-- Use Default Template --</option>
                            {templates.map((template: any) => (
                                <option key={template.id} value={template.id}>
                                    {template.name} {template.isDefault ? '(Default)' : ''}
                                </option>
                            ))}
                        </select>
                        {templatesLoading && (
                            <p className="text-xs text-gray-500 mt-1">Loading templates...</p>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 mt-6">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={isGenerating}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" variant="default" disabled={isGenerating || !userId}>
                            {isGenerating ? (
                                <>
                                    <Loader2 size={16} className="animate-spin mr-2" />
                                    Generating...
                                </>
                            ) : (
                                'Generate Card'
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </Modal>
    );
};
