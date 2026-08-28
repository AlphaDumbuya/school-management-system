/**
 * ID Card Service
 * API client for Identity Management Module
 */

import { apiClient } from '@lib/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CardFormat = 'pvc' | 'badge';
export type CardStatus = 'active' | 'expired' | 'lost' | 'revoked' | 'suspended';
export type TemplateStatus = 'draft' | 'pending_approval' | 'approved' | 'archived';
export type UserRole = 'student' | 'teacher' | 'staff' | 'principal' | 'super_admin';

export interface IdCard {
    id: string;
    tenantId: string;
    userId: string;
    templateId: string;
    cardNumber: string;
    format: CardFormat;
    status: CardStatus;
    pdfUrl: string | null;
    issuedAt: string;
    expiresAt: string;
    issuedBy: string;
    createdAt: string;
    updatedAt: string;
    user?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        role: UserRole;
        photoUrl?: string;
    };
    template?: CardTemplate;
}

export interface CardTemplate {
    id: string;
    tenantId: string;
    name: string;
    version: number;
    status: TemplateStatus;
    format: CardFormat;
    config: TemplateConfig;
    logoUrl?: string;
    isDefault: boolean;
    defaultForRoles: UserRole[];
    createdBy: string;
    approvedBy?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CanvasElement {
    id: string;
    type: 'text' | 'photo' | 'badge' | 'barcode' | 'qrCode' | 'shape';
    label: string;
    sublabel?: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    fontSize?: number;
    color?: string;
    bgColor?: string;
    side: 'front' | 'back';
    isCustom?: boolean;
}

export interface TemplateConfig {
    presetId?: string;
    printSides?: 'single' | 'double';
    headerStyle?: 'curved-wave' | 'dual-strip' | 'sidebar-left' | 'top-banner' | 'arch-frame' | 'minimal-clean' | 'angled-split' | 'gradient-diagonal' | 'corner-ribbon' | 'split-color' | 'rounded-band' | 'wave-bottom';
    primaryColor?: string;
    secondaryColor?: string;
    backgroundColor: string;
    textColor: string;
    fontFamily: string;
    fontSize: number;
    photoShape?: 'circle' | 'rounded' | 'square' | 'arch' | 'hexagon';
    photoBorderWidth?: number;
    photoBorderColor?: string;
    cardTitle?: string;
    idLabel?: string;
    dobLabel?: string;
    gradeLabel?: string;
    expiryLabel?: string;
    customSchoolName?: string;
    logoUrl?: string;
    logoEmblem?: 'graduation-cap' | 'building' | 'shield' | 'award' | 'book';
    visibleFields?: {
        showName?: boolean;
        showTitle?: boolean;
        showRole?: boolean;
        showId?: boolean;
        showDob?: boolean;
        showGrade?: boolean;
        showExpiry?: boolean;
        showSchoolName?: boolean;
        showLogo?: boolean;
    };
    showBarcode?: boolean;
    showQrCode?: boolean;
    logoPosition: 'top-left' | 'top-center' | 'top-right';
    layoutConfig: {
        photoPosition: { x: number; y: number; width: number; height: number; side?: 'front' | 'back' };
        namePosition: { x: number; y: number; side?: 'front' | 'back' };
        titlePosition?: { x: number; y: number; side?: 'front' | 'back' };
        schoolNamePosition?: { x: number; y: number; side?: 'front' | 'back' };
        logoPositionConfig?: { x: number; y: number; side?: 'front' | 'back' };
        rolePosition: { x: number; y: number; side?: 'front' | 'back' };
        idPosition: { x: number; y: number; side?: 'front' | 'back' };
        qrCodePosition: { x: number; y: number; size: number; side?: 'front' | 'back' };
        barcodePosition: { x: number; y: number; side?: 'front' | 'back' };
        customElements?: CanvasElement[];
    };
}

export interface CardGenerationRequest {
    userId: string;
    templateId?: string;
    format: CardFormat;
    expirationDate?: string;
}

export interface BulkCardRequest {
    userIds?: string[];
    filters?: {
        classId?: string;
        departmentId?: string;
        role?: UserRole;
    };
    templateId?: string;
    format: CardFormat;
}

export interface BulkJob {
    id: string;
    tenantId: string;
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
    totalCards: number;
    processedCards: number;
    successfulCards: number;
    failedCards: number;
    requestParams: any;
    pdfUrl?: string;
    requestedBy: string;
    startedAt?: string;
    completedAt?: string;
    createdAt: string;
}

export interface QrVerificationResult {
    isValid: boolean;
    userId?: string;
    userName?: string;
    role?: string;
    expirationDate?: string;
    failureReason?: string;
}

export interface CardAuditEntry {
    id: string;
    cardId: string;
    action: 'issued' | 'lost' | 'revoked' | 'suspended' | 'reactivated' | 'expired' | 'regenerated';
    previousStatus?: CardStatus;
    newStatus: CardStatus;
    performedBy: string;
    reason?: string;
    performedAt: string;
}

export interface DashboardStats {
    totalActive: number;
    totalExpired: number;
    totalRevoked: number;
    totalLost: number;
    expiringSoon: number;
}

// ── API Service ───────────────────────────────────────────────────────────────

export const idCardService = {
    // ── Card Generation ─────────────────────────────────────────────────────────

    /**
     * Generate a single ID card
     */
    generateCard: async (data: CardGenerationRequest) => {
        return apiClient.post('/api/v1/id-cards/generate', data);
    },

    /**
     * Regenerate an existing card
     */
    regenerateCard: async (cardId: string) => {
        return apiClient.post(`/api/v1/id-cards/regenerate/${cardId}`);
    },

    /**
     * Preview card before generation
     */
    previewCard: async (userId: string, templateId?: string) => {
        return apiClient.post('/api/v1/id-cards/preview', { userId, templateId });
    },

    // ── Card Retrieval ──────────────────────────────────────────────────────────

    /**
     * Get card by ID
     */
    getCard: async (cardId: string) => {
        return apiClient.get(`/api/v1/id-cards/${cardId}`);
    },

    /**
     * Get all cards for a user
     */
    getUserCards: async (userId: string) => {
        return apiClient.get(`/api/v1/id-cards/user/${userId}`);
    },

    /**
     * List all cards with filters
     */
    listCards: async (params?: {
        page?: number;
        limit?: number;
        status?: CardStatus;
        search?: string;
        userId?: string;
    }) => {
        return apiClient.get('/api/v1/id-cards', { params });
    },

    // ── Card Lifecycle ──────────────────────────────────────────────────────────

    /**
     * Revoke a card
     */
    revokeCard: async (cardId: string, reason: string) => {
        return apiClient.post(`/api/v1/id-cards/${cardId}/revoke`, { reason });
    },

    /**
     * Report card as lost
     */
    reportLost: async (cardId: string, reason?: string) => {
        return apiClient.post(`/api/v1/id-cards/${cardId}/report-lost`, { reason });
    },

    /**
     * Suspend a card
     */
    suspendCard: async (cardId: string, reason: string) => {
        return apiClient.post(`/api/v1/id-cards/${cardId}/suspend`, { reason });
    },

    /**
     * Reactivate a suspended card
     */
    reactivateCard: async (cardId: string) => {
        return apiClient.post(`/api/v1/id-cards/${cardId}/reactivate`);
    },

    /**
     * Get card history
     */
    getCardHistory: async (cardId: string) => {
        return apiClient.get(`/api/v1/id-cards/${cardId}/history`);
    },

    // ── Bulk Operations ─────────────────────────────────────────────────────────

    /**
     * Create bulk card generation job
     */
    createBulkJob: async (data: BulkCardRequest) => {
        return apiClient.post('/api/v1/id-cards/bulk', data);
    },

    /**
     * Get bulk job status
     */
    getBulkJobStatus: async (jobId: string) => {
        return apiClient.get(`/api/v1/id-cards/bulk/${jobId}/status`);
    },

    /**
     * Cancel bulk job
     */
    cancelBulkJob: async (jobId: string) => {
        return apiClient.post(`/api/v1/id-cards/bulk/${jobId}/cancel`);
    },

    /**
     * Get bulk job report
     */
    getBulkJobReport: async (jobId: string) => {
        return apiClient.get(`/api/v1/id-cards/bulk/${jobId}/report`);
    },

    // ── QR Code ─────────────────────────────────────────────────────────────────

    /**
     * Verify QR code
     */
    verifyQrCode: async (qrCodeContent: string) => {
        return apiClient.post('/api/v1/id-cards/qr-codes/verify', { qrCodeContent, scanningDeviceId: 'web-portal' });
    },

    /**
     * Get QR code for card
     */
    getQrCode: async (cardId: string) => {
        return apiClient.get(`/api/v1/qr-codes/${cardId}`);
    },

    // ── Templates ───────────────────────────────────────────────────────────────

    /**
     * List card templates
     */
    listTemplates: async (params?: {
        status?: TemplateStatus;
        format?: CardFormat;
    }) => {
        return apiClient.get('/api/v1/card-templates', { params });
    },

    /**
     * Get template by ID
     */
    getTemplate: async (templateId: string) => {
        return apiClient.get(`/api/v1/card-templates/${templateId}`);
    },

    /**
     * Get default template for role
     */
    getDefaultTemplate: async (role: UserRole) => {
        return apiClient.get(`/api/v1/card-templates/default/${role}`);
    },

    /**
     * Create card template
     */
    createTemplate: async (data: Partial<CardTemplate>) => {
        return apiClient.post('/api/v1/card-templates', data);
    },

    /**
     * Update card template
     */
    updateTemplate: async (templateId: string, data: Partial<CardTemplate>) => {
        return apiClient.put(`/api/v1/card-templates/${templateId}`, data);
    },

    /**
     * Set template as default
     */
    setDefaultTemplate: async (templateId: string, role: UserRole) => {
        return apiClient.post(`/api/v1/card-templates/${templateId}/set-default`, { role });
    },

    /**
     * Submit template for approval
     */
    submitForApproval: async (templateId: string) => {
        return apiClient.post(`/api/v1/card-templates/${templateId}/submit-approval`);
    },

    /**
     * Approve template
     */
    approveTemplate: async (templateId: string) => {
        return apiClient.post(`/api/v1/card-templates/${templateId}/approve`);
    },

    /**
     * Delete template
     */
    deleteTemplate: async (templateId: string) => {
        return apiClient.delete(`/api/v1/card-templates/${templateId}`);
    },

    /**
     * Delete card
     */
    deleteCard: async (cardId: string) => {
        return apiClient.delete(`/api/v1/id-cards/${cardId}`);
    },

    /**
     * Upload template logo
     */
    uploadLogo: async (file: File) => {
        const formData = new FormData();
        formData.append('logo', file);
        return apiClient.post('/api/v1/card-templates/upload-logo', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },

    // ── Reporting ───────────────────────────────────────────────────────────────

    /**
     * Get dashboard statistics
     */
    getDashboardStats: async () => {
        return apiClient.get('/api/v1/id-cards/stats');
    },

    /**
     * Get issuance report
     */
    getIssuanceReport: async (params: {
        startDate: string;
        endDate: string;
        role?: UserRole;
    }) => {
        return apiClient.get('/api/v1/id-cards/reports/issuance', { params });
    },

    /**
     * Get expiring cards
     */
    getExpiringCards: async (days: number = 30) => {
        return apiClient.get('/api/v1/id-cards/reports/expiring', { params: { days } });
    },

    /**
     * Get scan analytics
     */
    getScanAnalytics: async (userId?: string, startDate?: string, endDate?: string) => {
        return apiClient.get('/api/v1/id-cards/reports/scans', {
            params: { userId, startDate, endDate },
        });
    },

    /**
     * Get volume statistics
     */
    getVolumeStats: async (startDate?: string, endDate?: string) => {
        return apiClient.get('/api/v1/id-cards/reports/volume', {
            params: { startDate, endDate },
        });
    },
};

export default idCardService;
