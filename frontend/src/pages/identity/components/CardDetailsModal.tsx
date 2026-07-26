/**
 * Card Details Modal
 * Modal for viewing ID card details and history
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@components/admin/feedback/Modal';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { Button } from '@components/ui/button';
import { idCardService, CardStatus } from '@services/idCardService';
import {
    CreditCard,
    User,
    Calendar,
    Download,
    History,
    QrCode,
    Loader2,
} from 'lucide-react';
import { VisualIdCardRenderer } from './VisualIdCardRenderer';

interface CardDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    cardId: string | null;
}

function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '—';
    }
}

function getStatusVariant(status: CardStatus): 'active' | 'inactive' | 'pending' | 'suspended' {
    const map: Record<CardStatus, 'active' | 'inactive' | 'pending' | 'suspended'> = {
        active: 'active',
        expired: 'inactive',
        lost: 'pending',
        revoked: 'inactive',
        suspended: 'suspended',
    };
    return map[status] || 'inactive';
}

export const CardDetailsModal: React.FC<CardDetailsModalProps> = ({
    isOpen,
    onClose,
    cardId,
}) => {
    // Fetch card details
    const { data: cardData, isLoading: cardLoading } = useQuery({
        queryKey: ['id-card', cardId],
        queryFn: () => idCardService.getCard(cardId!),
        enabled: isOpen && !!cardId,
    });

    const card: any = (cardData as any)?.card ?? (cardData as any)?.data;

    // Fetch card history
    const { data: historyData, isLoading: historyLoading } = useQuery({
        queryKey: ['id-card-history', cardId],
        queryFn: () => idCardService.getCardHistory(cardId!),
        enabled: isOpen && !!cardId,
    });

    const history = (historyData as any)?.data ?? [];

    if (!cardId) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg">
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 id="modal-title" className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <CreditCard size={24} className="text-blue-500" />
                        ID Card Details
                    </h2>
                    {card?.pdfUrl && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(card.pdfUrl.startsWith('/uploads/') ? `/storage${card.pdfUrl}` : card.pdfUrl, '_blank')}
                            className="flex items-center gap-1.5"
                        >
                            <Download size={16} />
                            Download PDF
                        </Button>
                    )}
                </div>

                {cardLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 size={32} className="animate-spin text-blue-500" />
                    </div>
                ) : !card ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        Card not found
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Visual Card Preview */}
                        <div className="w-full bg-slate-900 rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-center border border-gray-800 shadow-xl overflow-hidden">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Live Template Rendered Card</div>
                            <div className="w-full max-w-[380px] flex justify-center">
                                <VisualIdCardRenderer
                                    config={card.template?.config || {
                                        headerStyle: 'curved-wave',
                                        primaryColor: '#1E3A8A',
                                        secondaryColor: '#EA580C',
                                        backgroundColor: '#FFFFFF',
                                        textColor: '#0F172A',
                                        photoShape: 'circle',
                                        cardTitle: 'IDENTIFICATION CARD',
                                    }}
                                    format={card.format || 'pvc'}
                                    user={{
                                        name: card.user ? `${card.user.firstName} ${card.user.lastName}` : 'ID Holder',
                                        idNumber: card.user?.memberId || card.cardNumber,
                                        role: card.user?.role ? card.user.role.toUpperCase() : 'STUDENT',
                                        photoUrl: card.user?.photoUrl,
                                        expiresAt: formatDate(card.expiresAt),
                                        dob: card.user?.dob ? formatDate(card.user.dob) : undefined,
                                        departmentOrGrade: card.user?.departmentOrGrade,
                                    }}
                                    logoUrl={card.template?.logoUrl || card.template?.config?.logoUrl}
                                    side="front"
                                />
                            </div>
                        </div>

                        {/* Card Information */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
                                Card Information
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Card Number</div>
                                    <div className="font-mono font-semibold text-gray-900 dark:text-white">
                                        {card.cardNumber}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</div>
                                    <div>
                                        <StatusBadge status={getStatusVariant(card.status)} showDot />
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Format</div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-white uppercase">
                                        {card.format}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Template</div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                        {card.template?.name ?? 'Unknown'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                                        <Calendar size={12} />
                                        Issued
                                    </div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                        {formatDate(card.issuedAt)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                                        <Calendar size={12} />
                                        Expires
                                    </div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                        {formatDate(card.expiresAt)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* User Information */}
                        {card.user && (
                            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4 flex items-center gap-2">
                                    <User size={16} />
                                    User Information
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Name</div>
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                            {card.user.firstName} {card.user.lastName}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Email</div>
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                            {card.user.email}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Role</div>
                                        <div className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                                            {card.user.role}
                                        </div>
                                    </div>
                                    {card.user.photoUrl && (
                                        <div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Photo</div>
                                            <img
                                                src={card.user.photoUrl}
                                                alt={`${card.user.firstName} ${card.user.lastName}`}
                                                className="w-16 h-16 rounded-lg object-cover border-2 border-gray-200 dark:border-gray-700"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Card History */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
                                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
                                    <History size={16} />
                                    Card History
                                </h3>
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                {historyLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 size={24} className="animate-spin text-gray-400" />
                                    </div>
                                ) : history.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                                        No history available
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {history.map((entry: any, idx: number) => (
                                            <div key={`hist-${entry.id || 'e'}-${idx}`} className="px-5 py-3">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <div className="font-medium text-gray-900 dark:text-white capitalize">
                                                            {entry.action}
                                                        </div>
                                                        {entry.reason && (
                                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                                Reason: {entry.reason}
                                                            </div>
                                                        )}
                                                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                            {formatDate(entry.performedAt)}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        {entry.previousStatus && (
                                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                                {entry.previousStatus} → {entry.newStatus}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <Button type="button" variant="outline" onClick={onClose}>
                                Close
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};
