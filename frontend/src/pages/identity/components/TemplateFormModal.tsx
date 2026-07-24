/**
 * Template Form Modal
 * Modal for creating/editing card templates with interactive visual canvas, Canva presets, and front/back support.
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { idCardService, CardTemplate, CardFormat, UserRole, CanvasElement } from '@services/idCardService';
import { Loader2, Sparkles, Upload, Layout, Palette, Type, Eye, EyeOff, Plus, Copy, Trash2, Move, ArrowLeftRight, AlignCenter, AlignLeft, AlignRight, HelpCircle, Layers, ShieldCheck, CheckCircle2, UserCheck, BookOpen, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { VisualIdCardRenderer, VisualCardUserData } from './VisualIdCardRenderer';

interface TemplateFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editingTemplate?: CardTemplate | null;
}

// ── Professional Light Colors Preset ──
const PRESET_LIGHT_THEMES = [
    { name: 'Pure Ice White', bg: '#FFFFFF', text: '#0F172A' },
    { name: 'Warm Cream', bg: '#FAF6EE', text: '#1E293B' },
    { name: 'Cool Sky Blue', bg: '#F0F5FA', text: '#1E293B' },
    { name: 'Warm Sand', bg: '#FAF4EB', text: '#27272A' },
    { name: 'Soft Mint Green', bg: '#F1F7F4', text: '#1C1917' },
    { name: 'Pale Slate Gray', bg: '#F3F4F6', text: '#111827' },
    { name: 'Lavender Blush', bg: '#F7F4FA', text: '#1E293B' },
    { name: 'Bright Alabaster', bg: '#FCFCF9', text: '#1A202C' },
];

const PRESET_FONTS = [
    { label: 'Helvetica / Arial', value: 'Helvetica, sans-serif' },
    { label: 'Times New Roman', value: '"Times New Roman", serif' },
    { label: 'Courier Monospace', value: '"Courier New", monospace' },
    { label: 'Inter / Modern Sans', value: 'Inter, sans-serif' }
];

// Helper to get default coordinates depending on layout
const getDefaultLayout = (format: CardFormat) => {
    if (format === 'pvc') {
        return {
            photoPosition: { x: 5, y: 12, width: 25, height: 30, side: 'front' as const },
            namePosition: { x: 34, y: 14, side: 'front' as const },
            rolePosition: { x: 34, y: 23, side: 'front' as const },
            idPosition: { x: 34, y: 31, side: 'front' as const },
            qrCodePosition: { x: 64, y: 13, size: 16, side: 'front' as const },
            barcodePosition: { x: 34, y: 39, side: 'front' as const },
            customElements: [] as CanvasElement[],
        };
    } else {
        // badge 101.6mm x 152.4mm
        return {
            photoPosition: { x: 25, y: 20, width: 50, height: 60, side: 'front' as const },
            namePosition: { x: 10, y: 90, side: 'front' as const },
            rolePosition: { x: 10, y: 102, side: 'front' as const },
            idPosition: { x: 10, y: 110, side: 'front' as const },
            qrCodePosition: { x: 38, y: 120, size: 25, side: 'front' as const },
            barcodePosition: { x: 10, y: 140, side: 'front' as const },
            customElements: [] as CanvasElement[],
        };
    }
};

// ── Canva Premium Sample Templates Configurations ──
const CANVA_TEMPLATES = [
    {
        id: 'wiskul-lion-executive',
        name: 'WiSkul Classic - Lion Mountain Executive',
        shortName: 'WiSkul Lion Executive',
        description: 'Curved red top header & bottom arc with golden badges & circle photo frame.',
        format: 'pvc' as CardFormat,
        printSides: 'single' as const,
        headerStyle: 'curved-wave' as const,
        primaryColor: '#991B1B',
        secondaryColor: '#DC2626',
        backgroundColor: '#FFFFFF',
        textColor: '#0F172A',
        photoShape: 'circle' as const,
        photoBorderColor: '#991B1B',
        photoBorderWidth: 3,
        cardTitle: 'EXECUTIVE DIRECTOR',
        fontFamily: 'Helvetica, sans-serif',
        fontSize: 12,
        logoPosition: 'top-left' as const,
        layoutConfig: {
            photoPosition: { x: 6, y: 14, width: 24, height: 30, side: 'front' as const },
            namePosition: { x: 33, y: 14, side: 'front' as const },
            rolePosition: { x: 33, y: 22, side: 'front' as const },
            idPosition: { x: 33, y: 29, side: 'front' as const },
            qrCodePosition: { x: 68, y: 32, size: 13, side: 'front' as const },
            barcodePosition: { x: 33, y: 44, side: 'front' as const },
            customElements: [],
        }
    },
    {
        id: 'wiskul-kakua-crest',
        name: 'WiSkul Premier - Kakua Gold Crest',
        shortName: 'WiSkul Kakua Crest',
        description: 'Dynamic multi-layer wave header with structured key-value grid for Salone Scholars.',
        format: 'pvc' as CardFormat,
        printSides: 'single' as const,
        headerStyle: 'dual-strip' as const,
        primaryColor: '#1E3A8A',
        secondaryColor: '#EA580C',
        backgroundColor: '#F8FAFC',
        textColor: '#0F172A',
        photoShape: 'rounded' as const,
        photoBorderColor: '#EA580C',
        photoBorderWidth: 2,
        cardTitle: 'STUDENT PASS',
        fontFamily: 'Helvetica, sans-serif',
        fontSize: 12,
        logoPosition: 'top-left' as const,
        layoutConfig: {
            photoPosition: { x: 6, y: 14, width: 24, height: 30, side: 'front' as const },
            namePosition: { x: 33, y: 14, side: 'front' as const },
            rolePosition: { x: 33, y: 22, side: 'front' as const },
            idPosition: { x: 33, y: 29, side: 'front' as const },
            qrCodePosition: { x: 68, y: 32, size: 13, side: 'front' as const },
            barcodePosition: { x: 33, y: 44, side: 'front' as const },
            customElements: [],
        }
    },
    {
        id: 'wiskul-fullah-pepper',
        name: 'WiSkul Tech - Fullah Pepper Academic',
        shortName: 'WiSkul Fullah Tech',
        description: 'Navy header block with cap emblem and clean academic diploma layout.',
        format: 'pvc' as CardFormat,
        printSides: 'single' as const,
        headerStyle: 'top-banner' as const,
        primaryColor: '#0F172A',
        secondaryColor: '#3B82F6',
        backgroundColor: '#FFFFFF',
        textColor: '#1E293B',
        photoShape: 'square' as const,
        photoBorderColor: '#3B82F6',
        photoBorderWidth: 2,
        cardTitle: 'TECHNICAL DIPLOMA',
        fontFamily: 'Helvetica, sans-serif',
        fontSize: 12,
        logoPosition: 'top-center' as const,
        layoutConfig: {
            photoPosition: { x: 6, y: 15, width: 24, height: 30, side: 'front' as const },
            namePosition: { x: 33, y: 15, side: 'front' as const },
            rolePosition: { x: 33, y: 23, side: 'front' as const },
            idPosition: { x: 33, y: 30, side: 'front' as const },
            qrCodePosition: { x: 68, y: 32, size: 13, side: 'front' as const },
            barcodePosition: { x: 33, y: 44, side: 'front' as const },
            customElements: [],
        }
    },
    {
        id: 'wiskul-cotton-tree-onyx',
        name: 'WiSkul Heritage - Cotton Tree Onyx VIP',
        shortName: 'WiSkul Cotton Tree VIP',
        description: 'Luxury black onyx background with metallic gold accents for Honor Roll & VIPs.',
        format: 'pvc' as CardFormat,
        printSides: 'single' as const,
        headerStyle: 'dual-strip' as const,
        primaryColor: '#09090B',
        secondaryColor: '#EAB308',
        backgroundColor: '#18181B',
        textColor: '#FAFAFA',
        photoShape: 'circle' as const,
        photoBorderColor: '#EAB308',
        photoBorderWidth: 3,
        cardTitle: 'SALONE VIP PASS',
        fontFamily: 'Helvetica, sans-serif',
        fontSize: 12,
        logoPosition: 'top-left' as const,
        layoutConfig: {
            photoPosition: { x: 6, y: 14, width: 24, height: 30, side: 'front' as const },
            namePosition: { x: 33, y: 14, side: 'front' as const },
            rolePosition: { x: 33, y: 22, side: 'front' as const },
            idPosition: { x: 33, y: 29, side: 'front' as const },
            qrCodePosition: { x: 68, y: 32, size: 13, side: 'front' as const },
            barcodePosition: { x: 33, y: 44, side: 'front' as const },
            customElements: [],
        }
    },
    {
        id: 'wiskul-eastern-diamond-stem',
        name: 'WiSkul Cyber - Kono Diamond STEM',
        shortName: 'WiSkul Diamond STEM',
        description: 'Futuristic cyan and deep ocean blue vector shapes for STEM & IT academies.',
        format: 'pvc' as CardFormat,
        printSides: 'single' as const,
        headerStyle: 'angled-split' as const,
        primaryColor: '#0284C7',
        secondaryColor: '#38BDF8',
        backgroundColor: '#F0F9FF',
        textColor: '#0C4A6E',
        photoShape: 'hexagon' as const,
        photoBorderColor: '#0284C7',
        photoBorderWidth: 3,
        cardTitle: 'CYBER STEM CREDENTIAL',
        fontFamily: 'Helvetica, sans-serif',
        fontSize: 12,
        logoPosition: 'top-left' as const,
        layoutConfig: {
            photoPosition: { x: 6, y: 14, width: 24, height: 30, side: 'front' as const },
            namePosition: { x: 33, y: 14, side: 'front' as const },
            rolePosition: { x: 33, y: 22, side: 'front' as const },
            idPosition: { x: 33, y: 29, side: 'front' as const },
            qrCodePosition: { x: 68, y: 32, size: 13, side: 'front' as const },
            barcodePosition: { x: 33, y: 44, side: 'front' as const },
            customElements: [],
        }
    },
    {
        id: 'wiskul-tonkolili-gold',
        name: 'WiSkul Elite - Tonkolili Gold Faculty Dean',
        shortName: 'WiSkul Tonkolili Dean',
        description: 'Rich emerald green with gold highlights for Faculty Deans & Principal Staff.',
        format: 'pvc' as CardFormat,
        printSides: 'single' as const,
        headerStyle: 'arch-frame' as const,
        primaryColor: '#065F46',
        secondaryColor: '#F59E0B',
        backgroundColor: '#FFFFFF',
        textColor: '#064E3B',
        photoShape: 'arch' as const,
        photoBorderColor: '#F59E0B',
        photoBorderWidth: 3,
        cardTitle: 'FACULTY DEAN PASSPORT',
        fontFamily: 'Helvetica, sans-serif',
        fontSize: 12,
        logoPosition: 'top-left' as const,
        layoutConfig: {
            photoPosition: { x: 55, y: 14, width: 24, height: 30, side: 'front' as const },
            namePosition: { x: 6, y: 14, side: 'front' as const },
            rolePosition: { x: 6, y: 22, side: 'front' as const },
            idPosition: { x: 6, y: 29, side: 'front' as const },
            qrCodePosition: { x: 36, y: 36, size: 13, side: 'front' as const },
            barcodePosition: { x: 6, y: 44, side: 'front' as const },
            customElements: [],
        }
    },
    {
        id: 'wiskul-barray-master',
        name: 'WiSkul Barray - Chief Master Emerald Arch',
        shortName: 'WiSkul Barray Arch',
        description: 'Emerald arch frame with circular photo box and teacher details.',
        format: 'pvc' as CardFormat,
        printSides: 'single' as const,
        headerStyle: 'arch-frame' as const,
        primaryColor: '#047857',
        secondaryColor: '#10B981',
        backgroundColor: '#F0FDF4',
        textColor: '#064E3B',
        photoShape: 'circle' as const,
        photoBorderColor: '#047857',
        photoBorderWidth: 3,
        cardTitle: 'CHIEF BARRAY FACULTY',
        fontFamily: 'Helvetica, sans-serif',
        fontSize: 12,
        logoPosition: 'top-left' as const,
        layoutConfig: {
            photoPosition: { x: 55, y: 14, width: 24, height: 30, side: 'front' as const },
            namePosition: { x: 6, y: 14, side: 'front' as const },
            rolePosition: { x: 6, y: 22, side: 'front' as const },
            idPosition: { x: 6, y: 29, side: 'front' as const },
            qrCodePosition: { x: 36, y: 36, size: 13, side: 'front' as const },
            barcodePosition: { x: 6, y: 44, side: 'front' as const },
            customElements: [],
        }
    },
    {
        id: 'wiskul-regency-slate',
        name: 'WiSkul Regency - Salone Slate Sidebar',
        shortName: 'WiSkul Regency Slate',
        description: 'Dark navy left vertical accent bar with gold rotated title.',
        format: 'pvc' as CardFormat,
        printSides: 'single' as const,
        headerStyle: 'sidebar-left' as const,
        primaryColor: '#1E293B',
        secondaryColor: '#F59E0B',
        backgroundColor: '#FFFFFF',
        textColor: '#0F172A',
        photoShape: 'arch' as const,
        photoBorderColor: '#1E293B',
        photoBorderWidth: 2,
        cardTitle: 'REGENCY CREDENTIAL',
        fontFamily: 'Helvetica, sans-serif',
        fontSize: 12,
        logoPosition: 'top-left' as const,
        layoutConfig: {
            photoPosition: { x: 55, y: 14, width: 24, height: 30, side: 'front' as const },
            namePosition: { x: 18, y: 14, side: 'front' as const },
            rolePosition: { x: 18, y: 22, side: 'front' as const },
            idPosition: { x: 18, y: 29, side: 'front' as const },
            qrCodePosition: { x: 36, y: 36, size: 13, side: 'front' as const },
            barcodePosition: { x: 18, y: 44, side: 'front' as const },
            customElements: [],
        }
    },
    {
        id: 'wiskul-lumley-sunset',
        name: 'WiSkul Sunset - Lumley Jollof Sports Pass',
        shortName: 'WiSkul Lumley Sports',
        description: 'Vibrant sunset orange swooshes for sports teams & athletics pass.',
        format: 'pvc' as CardFormat,
        printSides: 'single' as const,
        headerStyle: 'curved-wave' as const,
        primaryColor: '#C2410C',
        secondaryColor: '#F97316',
        backgroundColor: '#FFF7ED',
        textColor: '#431407',
        photoShape: 'rounded' as const,
        photoBorderColor: '#C2410C',
        photoBorderWidth: 3,
        cardTitle: 'SALONE ATHLETICS PASS',
        fontFamily: 'Helvetica, sans-serif',
        fontSize: 12,
        logoPosition: 'top-left' as const,
        layoutConfig: {
            photoPosition: { x: 6, y: 14, width: 24, height: 30, side: 'front' as const },
            namePosition: { x: 33, y: 14, side: 'front' as const },
            rolePosition: { x: 33, y: 22, side: 'front' as const },
            idPosition: { x: 33, y: 29, side: 'front' as const },
            qrCodePosition: { x: 68, y: 32, size: 13, side: 'front' as const },
            barcodePosition: { x: 33, y: 44, side: 'front' as const },
            customElements: [],
        }
    },
    {
        id: 'wiskul-sherbro-turtle',
        name: 'WiSkul Sherbro - Turtle Island Blue Orbit',
        shortName: 'WiSkul Sherbro Orbit',
        description: 'Vibrant blue curved header, centered photo frame, and bottom barcode.',
        format: 'pvc' as CardFormat,
        printSides: 'single' as const,
        headerStyle: 'curved-wave' as const,
        primaryColor: '#2563EB',
        secondaryColor: '#60A5FA',
        backgroundColor: '#FFFFFF',
        textColor: '#1E293B',
        photoShape: 'circle' as const,
        photoBorderColor: '#2563EB',
        photoBorderWidth: 3,
        cardTitle: 'SHERBRO IDENTIFICATION',
        fontFamily: 'Helvetica, sans-serif',
        fontSize: 12,
        logoPosition: 'top-center' as const,
        layoutConfig: {
            photoPosition: { x: 6, y: 14, width: 24, height: 30, side: 'front' as const },
            namePosition: { x: 33, y: 14, side: 'front' as const },
            rolePosition: { x: 33, y: 22, side: 'front' as const },
            idPosition: { x: 33, y: 29, side: 'front' as const },
            qrCodePosition: { x: 68, y: 32, size: 13, side: 'front' as const },
            barcodePosition: { x: 33, y: 44, side: 'front' as const },
            customElements: [],
        }
    },
    {
        id: 'wiskul-loma-peak',
        name: 'WiSkul Loma Peak - Purple Lanyard Badge',
        shortName: 'WiSkul Loma Badge',
        description: 'Vertical lanyard badge layout with purple accents and pill tags.',
        format: 'badge' as CardFormat,
        printSides: 'single' as const,
        headerStyle: 'curved-wave' as const,
        primaryColor: '#7C3AED',
        secondaryColor: '#C084FC',
        backgroundColor: '#FAF5FF',
        textColor: '#4C1D95',
        photoShape: 'rounded' as const,
        photoBorderColor: '#7C3AED',
        photoBorderWidth: 3,
        cardTitle: 'STUDENT COUNCIL BADGE',
        fontFamily: 'Helvetica, sans-serif',
        fontSize: 14,
        logoPosition: 'top-center' as const,
        layoutConfig: {
            photoPosition: { x: 26, y: 22, width: 50, height: 60, side: 'front' as const },
            namePosition: { x: 10, y: 90, side: 'front' as const },
            rolePosition: { x: 10, y: 100, side: 'front' as const },
            idPosition: { x: 10, y: 108, side: 'front' as const },
            qrCodePosition: { x: 68, y: 120, size: 22, side: 'front' as const },
            barcodePosition: { x: 10, y: 138, side: 'front' as const },
            customElements: [],
        }
    },
    {
        id: 'wiskul-granat-maroon',
        name: 'WiSkul Granat - Pepper Soup Maroon & Gold',
        shortName: 'WiSkul Granat Maroon',
        description: 'Dark maroon angled vectors with high-contrast information table.',
        format: 'pvc' as CardFormat,
        printSides: 'single' as const,
        headerStyle: 'angled-split' as const,
        primaryColor: '#881337',
        secondaryColor: '#F59E0B',
        backgroundColor: '#FFFFFF',
        textColor: '#1E293B',
        photoShape: 'rounded' as const,
        photoBorderColor: '#881337',
        photoBorderWidth: 3,
        cardTitle: 'SALONE STUDENT CARD',
        fontFamily: 'Helvetica, sans-serif',
        fontSize: 12,
        logoPosition: 'top-left' as const,
        layoutConfig: {
            photoPosition: { x: 6, y: 14, width: 24, height: 30, side: 'front' as const },
            namePosition: { x: 33, y: 14, side: 'front' as const },
            rolePosition: { x: 33, y: 22, side: 'front' as const },
            idPosition: { x: 33, y: 29, side: 'front' as const },
            qrCodePosition: { x: 68, y: 32, size: 13, side: 'front' as const },
            barcodePosition: { x: 33, y: 44, side: 'front' as const },
            customElements: [],
        }
    },
    {
        id: 'wiskul-kissi-palm',
        name: 'WiSkul Kissi Palm - Salone Mint Wave',
        shortName: 'WiSkul Kissi Mint',
        description: 'Clean mint swooshes with right-aligned details grid.',
        format: 'pvc' as CardFormat,
        printSides: 'single' as const,
        headerStyle: 'curved-wave' as const,
        primaryColor: '#059669',
        secondaryColor: '#34D399',
        backgroundColor: '#F0FDF4',
        textColor: '#064E3B',
        photoShape: 'circle' as const,
        photoBorderColor: '#059669',
        photoBorderWidth: 2,
        cardTitle: 'SALONE MEMBERSHIP',
        fontFamily: 'Helvetica, sans-serif',
        fontSize: 11,
        logoPosition: 'top-right' as const,
        layoutConfig: {
            photoPosition: { x: 6, y: 14, width: 24, height: 30, side: 'front' as const },
            namePosition: { x: 33, y: 14, side: 'front' as const },
            rolePosition: { x: 33, y: 22, side: 'front' as const },
            idPosition: { x: 33, y: 29, side: 'front' as const },
            qrCodePosition: { x: 68, y: 32, size: 13, side: 'front' as const },
            barcodePosition: { x: 33, y: 44, side: 'front' as const },
            customElements: [],
        }
    },
    {
        id: 'wiskul-mende-chief',
        name: 'WiSkul Mende Chief - Ice Clean Minimalist',
        shortName: 'WiSkul Mende Ice',
        description: 'Ice blue background with minimalist typography and maximum readability.',
        format: 'pvc' as CardFormat,
        printSides: 'single' as const,
        headerStyle: 'minimal-clean' as const,
        primaryColor: '#3B82F6',
        secondaryColor: '#93C5FD',
        backgroundColor: '#F0F5FA',
        textColor: '#0F172A',
        photoShape: 'square' as const,
        photoBorderColor: '#3B82F6',
        photoBorderWidth: 2,
        cardTitle: 'SALONE IDENTIFICATION',
        fontFamily: 'Helvetica, sans-serif',
        fontSize: 11,
        logoPosition: 'top-left' as const,
        layoutConfig: {
            photoPosition: { x: 6, y: 14, width: 23, height: 28, side: 'front' as const },
            namePosition: { x: 33, y: 14, side: 'front' as const },
            rolePosition: { x: 33, y: 22, side: 'front' as const },
            idPosition: { x: 33, y: 29, side: 'front' as const },
            qrCodePosition: { x: 68, y: 32, size: 13, side: 'front' as const },
            barcodePosition: { x: 33, y: 44, side: 'front' as const },
            customElements: [],
        }
    }
];

export const TemplateFormModal: React.FC<TemplateFormModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    editingTemplate,
}) => {
    // Form state with custom field labels & toggles
    const [formData, setFormData] = useState({
        name: '',
        presetId: 'freetown-model-executive',
        format: 'pvc' as CardFormat,
        printSides: 'single' as 'single' | 'double',
        headerStyle: 'curved-wave' as 'curved-wave' | 'dual-strip' | 'sidebar-left' | 'top-banner' | 'arch-frame' | 'minimal-clean' | 'angled-split',
        primaryColor: '#991B1B',
        secondaryColor: '#DC2626',
        backgroundColor: '#FFFFFF',
        textColor: '#0F172A',
        photoShape: 'circle' as 'circle' | 'rounded' | 'square' | 'arch' | 'hexagon',
        photoBorderColor: '#991B1B',
        photoBorderWidth: 3,
        cardTitle: 'STUDENT ID CARD',
        idLabel: 'ID NO',
        dobLabel: 'D.O.B',
        gradeLabel: 'GRADE',
        expiryLabel: 'EXPIRES',
        customSchoolName: 'WI SKUL ACADEMY',
        logoEmblem: 'graduation-cap' as 'graduation-cap' | 'building' | 'shield' | 'award' | 'book',
        visibleFields: {
            showName: true,
            showTitle: true,
            showRole: true,
            showId: true,
            showDob: true,
            showGrade: true,
            showExpiry: true,
            showSchoolName: true,
            showLogo: true,
        },
        fontFamily: 'Helvetica, sans-serif',
        fontSize: 12,
        showBarcode: false,
        showQrCode: true,
        logoPosition: 'top-left' as 'top-left' | 'top-center' | 'top-right',
        logoUrl: '',
        defaultForRoles: [] as UserRole[],
        layoutConfig: getDefaultLayout('pvc') as any,
    });

    const [activeTab, setActiveTab] = useState<'general' | 'style' | 'layout'>('general');
    const [selectedElement, setSelectedElement] = useState<string | null>(null);
    const [previewSide, setPreviewSide] = useState<'front' | 'back' | 'both'>('front');
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(true);
    const [borderMargin, setBorderMargin] = useState<number>(4);
    const [previewRole, setPreviewRole] = useState<'student' | 'teacher' | 'staff'>('student');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);

    const handleCloseGuide = () => {
        try {
            localStorage.setItem('wiskul_id_builder_tour_seen', 'true');
        } catch (err) {}
        setIsGuideOpen(false);
    };

    // Sync state when modal opens or editing template changes
    useEffect(() => {
        if (isOpen) {
            // First-time user onboarding tour trigger
            try {
                const tourSeen = localStorage.getItem('wiskul_id_builder_tour_seen');
                if (!tourSeen) {
                    setIsGuideOpen(true);
                }
            } catch (err) {}

            if (editingTemplate) {
                const conf = editingTemplate.config || {};
                setFormData({
                    name: editingTemplate.name,
                    presetId: conf.presetId || 'wiskul-lion-executive',
                    format: editingTemplate.format,
                    printSides: conf.printSides || 'single',
                    headerStyle: conf.headerStyle || 'curved-wave',
                    primaryColor: conf.primaryColor || '#1E3A8A',
                    secondaryColor: conf.secondaryColor || '#F59E0B',
                    backgroundColor: conf.backgroundColor || '#FFFFFF',
                    textColor: conf.textColor || '#0F172A',
                    photoShape: conf.photoShape || 'circle',
                    photoBorderColor: conf.photoBorderColor || conf.primaryColor || '#1E3A8A',
                    photoBorderWidth: conf.photoBorderWidth ?? 3,
                    cardTitle: conf.cardTitle || 'STUDENT ID CARD',
                    idLabel: conf.idLabel || 'ID NO',
                    dobLabel: conf.dobLabel || 'D.O.B',
                    gradeLabel: conf.gradeLabel || 'GRADE',
                    expiryLabel: conf.expiryLabel || 'EXPIRES',
                    customSchoolName: conf.customSchoolName || 'WI SKUL ACADEMY',
                    logoEmblem: conf.logoEmblem || 'graduation-cap',
                    visibleFields: {
                        showName: conf.visibleFields?.showName !== false,
                        showTitle: conf.visibleFields?.showTitle !== false,
                        showRole: conf.visibleFields?.showRole !== false,
                        showId: conf.visibleFields?.showId !== false,
                        showDob: conf.visibleFields?.showDob !== false,
                        showGrade: conf.visibleFields?.showGrade !== false,
                        showExpiry: conf.visibleFields?.showExpiry !== false,
                        showSchoolName: conf.visibleFields?.showSchoolName !== false,
                        showLogo: conf.visibleFields?.showLogo !== false,
                    },
                    fontFamily: conf.fontFamily || 'Helvetica, sans-serif',
                    fontSize: conf.fontSize || 12,
                    showBarcode: conf.showBarcode === true,
                    showQrCode: conf.showQrCode !== false,
                    logoPosition: conf.logoPosition || 'top-left',
                    logoUrl: editingTemplate.logoUrl || conf.logoUrl || '',
                    defaultForRoles: editingTemplate.defaultForRoles || [],
                    layoutConfig: (conf.layoutConfig || getDefaultLayout(editingTemplate.format)) as any,
                });
            } else {
                setFormData({
                    name: '',
                    presetId: 'wiskul-lion-executive',
                    format: 'pvc',
                    printSides: 'single',
                    headerStyle: 'curved-wave',
                    primaryColor: '#991B1B',
                    secondaryColor: '#DC2626',
                    backgroundColor: '#FFFFFF',
                    textColor: '#0F172A',
                    photoShape: 'circle',
                    photoBorderColor: '#991B1B',
                    photoBorderWidth: 3,
                    cardTitle: 'STUDENT ID CARD',
                    idLabel: 'ID NO',
                    dobLabel: 'D.O.B',
                    gradeLabel: 'GRADE',
                    expiryLabel: 'EXPIRES',
                    customSchoolName: 'WI SKUL ACADEMY',
                    logoEmblem: 'graduation-cap',
                    visibleFields: {
                        showName: true,
                        showTitle: true,
                        showRole: true,
                        showId: true,
                        showDob: true,
                        showGrade: true,
                        showExpiry: true,
                        showSchoolName: true,
                        showLogo: true,
                    },
                    fontFamily: 'Helvetica, sans-serif',
                    fontSize: 12,
                    showBarcode: false,
                    showQrCode: true,
                    logoPosition: 'top-left',
                    logoUrl: '',
                    defaultForRoles: [],
                    layoutConfig: getDefaultLayout('pvc') as any,
                });
            }
            setActiveTab('general');
            setSelectedElement(null);
            setPreviewSide('front');
        }
    }, [editingTemplate, isOpen]);

    // Keyboard Arrow Keys Nudge Positioning
    useEffect(() => {
        if (!isOpen || !selectedElement) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const activeTag = (document.activeElement?.tagName || '').toLowerCase();
            if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
                return;
            }

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                const step = e.shiftKey ? 5 : 1; // 1mm precision step, 5mm fast step with Shift

                let deltaX = 0;
                let deltaY = 0;
                if (e.key === 'ArrowLeft') deltaX = -step;
                if (e.key === 'ArrowRight') deltaX = step;
                if (e.key === 'ArrowUp') deltaY = -step;
                if (e.key === 'ArrowDown') deltaY = step;

                const layout = formData.layoutConfig as any;
                let currentX = 10;
                let currentY = 10;

                if (selectedElement.startsWith('custom_')) {
                    const el = (layout.customElements || []).find((c: CanvasElement) => c.id === selectedElement);
                    if (el) {
                        currentX = el.x;
                        currentY = el.y;
                    }
                } else {
                    const posKey = selectedElement === 'logo' ? 'logoPositionConfig' : selectedElement === 'title' ? 'titlePosition' : `${selectedElement}Position`;
                    const posObj = layout[posKey];
                    if (posObj) {
                        currentX = posObj.x;
                        currentY = posObj.y;
                    }
                }

                const newX = Math.max(0, Math.min(100, currentX + deltaX));
                const newY = Math.max(0, Math.min(150, currentY + deltaY));
                handlePositionChange(selectedElement, parseFloat(newX.toFixed(1)), parseFloat(newY.toFixed(1)));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, selectedElement, formData.layoutConfig]);

    // Dynamic position change handler during canvas drag
    const handlePositionChange = (key: string, newX: number, newY: number) => {
        setFormData(prev => {
            const nextLayout = { ...prev.layoutConfig } as any;
            if (key.startsWith('custom_')) {
                const updatedCustoms = (nextLayout.customElements || []).map((el: CanvasElement) =>
                    el.id === key ? { ...el, x: newX, y: newY } : el
                );
                nextLayout.customElements = updatedCustoms;
            } else {
                const posKey = key === 'logo' ? 'logoPositionConfig' : key === 'title' ? 'titlePosition' : `${key}Position`;
                nextLayout[posKey] = { ...(nextLayout[posKey] || { side: 'front' }), x: newX, y: newY };
            }
            return { ...prev, layoutConfig: nextLayout };
        });
    };

    // Dynamic element-specific styling handler
    const handleUpdateElementStyle = (field: 'color' | 'bgColor' | 'fontSize' | 'fontFamily', value: any) => {
        if (!selectedElement) return;

        setFormData(prev => {
            const nextLayout = { ...prev.layoutConfig } as any;

            if (selectedElement.startsWith('custom_')) {
                nextLayout.customElements = (nextLayout.customElements || []).map((el: CanvasElement) =>
                    el.id === selectedElement ? { ...el, [field]: value } : el
                );
            } else {
                const posKey = selectedElement === 'logo' ? 'logoPositionConfig' : selectedElement === 'title' ? 'titlePosition' : `${selectedElement}Position`;
                const currentPos = nextLayout[posKey] || { side: 'front' };
                nextLayout[posKey] = { ...currentPos, [field]: value };
            }

            return { ...prev, layoutConfig: nextLayout };
        });
    };

    const getSelectedElementStyle = (field: 'color' | 'bgColor' | 'fontSize' | 'fontFamily') => {
        if (!selectedElement) return undefined;
        if (selectedElement.startsWith('custom_')) {
            const found = (formData.layoutConfig.customElements || []).find((el: CanvasElement) => el.id === selectedElement);
            return found ? (found as any)[field] : undefined;
        } else {
            const posKey = selectedElement === 'logo' ? 'logoPositionConfig' : selectedElement === 'title' ? 'titlePosition' : `${selectedElement}Position`;
            const posObj = (formData.layoutConfig as any)?.[posKey];
            return posObj ? posObj[field] : undefined;
        }
    };

    // Add new custom element to canvas
    const handleAddCustomElement = (type: 'text' | 'badge') => {
        const newEl: CanvasElement = {
            id: `custom_${Date.now()}`,
            type,
            label: type === 'badge' ? 'SECURITY VERIFIED' : 'CUSTOM TEXT LINE',
            sublabel: type === 'text' ? 'NOTE' : undefined,
            x: 30,
            y: 40,
            fontSize: 10,
            color: '#0F172A',
            bgColor: type === 'badge' ? formData.primaryColor : undefined,
            side: previewSide === 'both' ? 'front' : previewSide,
            isCustom: true,
        };

        setFormData(prev => ({
            ...prev,
            layoutConfig: {
                ...prev.layoutConfig,
                customElements: [...(prev.layoutConfig.customElements || []), newEl],
            },
        }));
        setSelectedElement(newEl.id);
        showToast.success(`Added new custom ${type} element to canvas`);
    };

    // Duplicate selected element
    const handleDuplicateSelected = () => {
        if (!selectedElement) return;

        if (selectedElement.startsWith('custom_')) {
            const existing = (formData.layoutConfig.customElements || []).find((el: CanvasElement) => el.id === selectedElement);
            if (existing) {
                const cloned: CanvasElement = {
                    ...existing,
                    id: `custom_${Date.now()}`,
                    x: Math.min(75, existing.x + 5),
                    y: Math.min(75, existing.y + 5),
                };
                setFormData(prev => ({
                    ...prev,
                    layoutConfig: {
                        ...prev.layoutConfig,
                        customElements: [...(prev.layoutConfig.customElements || []), cloned],
                    },
                }));
                setSelectedElement(cloned.id);
                showToast.success('Duplicated custom element');
            }
        } else {
            // Clone built-in field into a custom element
            const cloned: CanvasElement = {
                id: `custom_${Date.now()}`,
                type: selectedElement === 'role' ? 'badge' : 'text',
                label: selectedElement === 'name' ? 'Morgan Maxwell' : selectedElement === 'title' ? formData.cardTitle : 'EXTRA DETAILS',
                x: 35,
                y: 45,
                fontSize: 10,
                color: formData.textColor,
                side: previewSide === 'both' ? 'front' : previewSide,
                isCustom: true,
            };
            setFormData(prev => ({
                ...prev,
                layoutConfig: {
                    ...prev.layoutConfig,
                    customElements: [...(prev.layoutConfig.customElements || []), cloned],
                },
            }));
            setSelectedElement(cloned.id);
            showToast.success(`Cloned ${selectedElement} field`);
        }
    };

    // Delete or hide selected element
    const handleDeleteSelected = () => {
        if (!selectedElement) return;

        if (selectedElement.startsWith('custom_')) {
            setFormData(prev => ({
                ...prev,
                layoutConfig: {
                    ...prev.layoutConfig,
                    customElements: (prev.layoutConfig.customElements || []).filter((el: CanvasElement) => el.id !== selectedElement),
                },
            }));
            setSelectedElement(null);
            showToast.success('Removed custom element');
        } else {
            // Hide built-in field
            if (selectedElement === 'name') toggleFieldVisibility('showName');
            else if (selectedElement === 'title') toggleFieldVisibility('showTitle');
            else if (selectedElement === 'role') toggleFieldVisibility('showRole');
            else if (selectedElement === 'id') toggleFieldVisibility('showId');
            else if (selectedElement === 'barcode') setFormData(prev => ({ ...prev, showBarcode: false }));
            else if (selectedElement === 'qrCode') setFormData(prev => ({ ...prev, showQrCode: false }));
            setSelectedElement(null);
            showToast.success(`Hidden ${selectedElement} element from canvas`);
        }
    };

    const smartAutoCollapse = () => {
        setIsSettingsOpen(false);
    };

    // Format switch
    const handleFormatChange = (fmt: CardFormat) => {
        setFormData(prev => ({
            ...prev,
            format: fmt,
            layoutConfig: getDefaultLayout(fmt),
        }));
        setSelectedElement(null);
        smartAutoCollapse();
    };

    // Preset selection
    const handleApplyPreset = (preset: typeof CANVA_TEMPLATES[0]) => {
        setFormData(prev => ({
            ...prev,
            presetId: preset.id,
            format: preset.format,
            headerStyle: preset.headerStyle,
            primaryColor: preset.primaryColor,
            secondaryColor: preset.secondaryColor,
            backgroundColor: preset.backgroundColor,
            textColor: preset.textColor,
            photoShape: preset.photoShape,
            photoBorderColor: preset.photoBorderColor,
            photoBorderWidth: preset.photoBorderWidth,
            cardTitle: preset.cardTitle,
            fontFamily: preset.fontFamily,
            fontSize: preset.fontSize,
            logoPosition: preset.logoPosition,
            layoutConfig: JSON.parse(JSON.stringify(preset.layoutConfig)),
        }));
        setSelectedElement(null);
        showToast.success(`Applied template "${preset.name}"`);
        smartAutoCollapse();
    };

    // Preset dropdown handler
    const handleDropdownSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const found = CANVA_TEMPLATES.find(t => t.id === e.target.value);
        if (found) {
            handleApplyPreset(found);
        }
    };

    // Toggle a specific text field ON/OFF
    const toggleFieldVisibility = (fieldKey: keyof typeof formData.visibleFields) => {
        setFormData(prev => ({
            ...prev,
            visibleFields: {
                ...prev.visibleFields,
                [fieldKey]: !prev.visibleFields[fieldKey],
            },
        }));
    };

    // Get user sample data for preview
    const getPreviewUser = (): VisualCardUserData => {
        const school = formData.customSchoolName || 'WI SKUL ACADEMY';
        if (previewRole === 'student') {
            return {
                name: 'Alice Smith',
                idNumber: 'STU-1092-2026',
                role: 'Student',
                dob: '12/11/2002',
                departmentOrGrade: 'Grade 12 / Science',
                address: '123 Anywhere St., Any City',
                expiresAt: '31/08/2027',
                schoolName: school,
            };
        } else if (previewRole === 'teacher') {
            return {
                name: 'Olivia Wilson',
                idNumber: 'TCH-5401-2024',
                role: 'Teacher',
                dob: '16/12/1989',
                departmentOrGrade: 'Mathematics Dept.',
                address: '456 Campus Ave., University Park',
                expiresAt: '20/12/2028',
                schoolName: school,
            };
        } else {
            return {
                name: 'Richard Sanchez',
                idNumber: 'STF-3011-2025',
                role: 'Staff',
                dob: '07/06/1985',
                departmentOrGrade: 'Administration',
                address: '789 Central Blvd., Tech Quarter',
                expiresAt: '15/05/2027',
                schoolName: school,
            };
        }
    };

    // Element alignment snap
    const alignElement = (alignment: 'left' | 'center' | 'right') => {
        if (!selectedElement) return;
        const posKey = `${selectedElement}Position`;
        const layout = formData.layoutConfig as any;
        const configItem = layout[posKey];
        if (!configItem) return;

        const isPVC = formData.format === 'pvc';
        const cardWidthMm = isPVC ? 85.6 : 101.6;
        const width = configItem.width || configItem.size || (selectedElement === 'barcode' ? 30 : 25);
        let alignedX = configItem.x;

        if (alignment === 'left') {
            alignedX = borderMargin;
        } else if (alignment === 'center') {
            alignedX = (cardWidthMm - width) / 2;
        } else if (alignment === 'right') {
            alignedX = cardWidthMm - borderMargin - width;
        }

        setFormData(prev => {
            const nextLayout = { ...prev.layoutConfig } as any;
            nextLayout[posKey] = { ...nextLayout[posKey], x: parseFloat(alignedX.toFixed(1)) };
            return { ...prev, layoutConfig: nextLayout };
        });
        showToast.success(`Aligned ${selectedElement} to ${alignment}`);
    };

    // Role toggle
    const handleRoleToggle = (role: UserRole) => {
        setFormData(prev => ({
            ...prev,
            defaultForRoles: prev.defaultForRoles.includes(role)
                ? prev.defaultForRoles.filter(r => r !== role)
                : [...prev.defaultForRoles, role],
        }));
    };

    // Logo image upload (with 100% reliable base64 Data URL persistence)
    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingLogo(true);
        try {
            const base64Data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error('Failed to read image file'));
                reader.readAsDataURL(file);
            });

            setFormData(prev => ({
                ...prev,
                logoUrl: base64Data,
                layoutConfig: {
                    ...prev.layoutConfig,
                    logoUrl: base64Data,
                },
            }));
            showToast.success('School logo loaded successfully');
        } catch (err: any) {
            showToast.error('Failed to load logo image file');
        } finally {
            setIsUploadingLogo(false);
        }
    };

    // Form submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            showToast.error('Please enter a template name');
            return;
        }

        setIsSubmitting(true);
        try {
            const templatePayload = {
                name: formData.name,
                format: formData.format,
                logoUrl: formData.logoUrl || undefined,
                config: {
                    presetId: formData.presetId,
                    headerStyle: formData.headerStyle,
                    primaryColor: formData.primaryColor,
                    secondaryColor: formData.secondaryColor,
                    backgroundColor: formData.backgroundColor,
                    textColor: formData.textColor,
                    photoShape: formData.photoShape,
                    photoBorderColor: formData.photoBorderColor,
                    photoBorderWidth: formData.photoBorderWidth,
                    cardTitle: formData.cardTitle,
                    idLabel: formData.idLabel,
                    dobLabel: formData.dobLabel,
                    gradeLabel: formData.gradeLabel,
                    expiryLabel: formData.expiryLabel,
                    customSchoolName: formData.customSchoolName,
                    logoUrl: formData.logoUrl,
                    logoEmblem: formData.logoEmblem,
                    visibleFields: formData.visibleFields,
                    fontFamily: formData.fontFamily,
                    fontSize: formData.fontSize,
                    showBarcode: formData.showBarcode,
                    showQrCode: formData.showQrCode,
                    logoPosition: formData.logoPosition,
                    layoutConfig: formData.layoutConfig,
                },
                defaultForRoles: formData.defaultForRoles,
            };

            const targetId = editingTemplate?.id || (editingTemplate as any)?.templateId;
            const isRealUuid = Boolean(targetId && targetId !== 'undefined' && typeof targetId === 'string' && /^[0-9a-fA-F-]{36}$/.test(targetId));

            let res;
            if (editingTemplate && isRealUuid) {
                res = await idCardService.updateTemplate(targetId, templatePayload);
            } else {
                res = await idCardService.createTemplate(templatePayload);
            }

            if (res.success !== false) {
                showToast.success(editingTemplate ? 'Template updated successfully' : 'Template created successfully');
                onSuccess();
                onClose();
            } else {
                showToast.apiError(res.error);
            }
        } catch (err: any) {
            showToast.error(err.message || 'Failed to save card template');
        } finally {
            setIsSubmitting(false);
        }
    };

    const previewUser = getPreviewUser();

    // Get selected custom element object if custom
    const selectedCustomElement = selectedElement?.startsWith('custom_')
        ? (formData.layoutConfig.customElements || []).find((el: CanvasElement) => el.id === selectedElement)
        : null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="xl">
            <div className="flex flex-col h-[85vh] max-h-[850px] overflow-hidden bg-gray-50 dark:bg-gray-900 rounded-xl">
                {/* Modal Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-4 sm:px-6 py-3.5 sm:py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <div>
                        <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Sparkles className="text-blue-500 shrink-0" size={20} />
                            <span>{editingTemplate ? 'Edit Card Template' : 'Visual ID Template Studio'}</span>
                        </h2>
                        <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">Design Canva-grade premium ID cards with live drag-and-drop editor</p>
                    </div>

                    {/* Top Select Dropdown Opt */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <label htmlFor="template-select-dropdown" className="text-xs font-semibold text-gray-600 dark:text-gray-300 shrink-0">Preset:</label>
                        <select
                            id="template-select-dropdown"
                            value={formData.presetId}
                            onChange={handleDropdownSelect}
                            className="w-full sm:w-auto max-w-[280px] text-xs font-bold px-2.5 py-1.5 border border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-lg shadow-xs focus:ring-2 focus:ring-blue-500 truncate"
                        >
                            {CANVA_TEMPLATES.map(t => (
                                <option key={t.id} value={t.id}>{t.shortName || t.name} ({t.format.toUpperCase()})</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Workspace Responsive Split Layout */}
                <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden min-h-0">
                    {/* Left Pane (Settings Controls / Collapsible Menu Dock) */}
                    {isSettingsOpen ? (
                        <div className="w-full lg:w-[380px] xl:w-[400px] border-t lg:border-t-0 lg:border-r border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-800 shrink-0 transition-all duration-300 order-2 lg:order-1">
                            {/* Settings Top Header Bar */}
                            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-100 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                                    <SlidersHorizontal size={13} className="text-blue-500" /> Settings Controls
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setIsSettingsOpen(false)}
                                    title="Collapse Settings Menu to Expand Canvas"
                                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 flex items-center gap-1 text-xs font-semibold"
                                >
                                    <ChevronLeft size={16} />
                                    <span>Collapse</span>
                                </button>
                            </div>

                            {/* Settings Tabs */}
                            <div className="flex border-b border-gray-200 dark:border-gray-700 text-xs font-bold">
                                {(['general', 'style', 'layout'] as const).map(tab => (
                                    <button
                                        key={tab}
                                        type="button"
                                        onClick={() => setActiveTab(tab)}
                                        className={`flex-1 py-3 text-center border-b-2 capitalize transition-colors flex items-center justify-center gap-1.5 ${
                                            activeTab === tab
                                                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                                                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'
                                        }`}
                                    >
                                        {tab === 'general' && <Layout size={14} />}
                                        {tab === 'style' && <Palette size={14} />}
                                        {tab === 'layout' && <Type size={14} />}
                                        <span>{tab === 'layout' ? 'Fields & Text' : tab}</span>
                                    </button>
                                ))}
                            </div>

                        {/* Tab Content */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            {/* GENERAL TAB */}
                            {activeTab === 'general' && (
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="name-input" className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase">Template Name</label>
                                        <input
                                            id="name-input"
                                            type="text"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="e.g., Crimson Director / Executive"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase">Format Layout & Orientation</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleFormatChange('pvc')}
                                                className={`px-3 py-2 border rounded-lg text-xs font-medium text-center transition-all ${
                                                    formData.format === 'pvc'
                                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold'
                                                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100'
                                                }`}
                                            >
                                                Horizontal PVC (85.6 × 54mm)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleFormatChange('badge')}
                                                className={`px-3 py-2 border rounded-lg text-xs font-medium text-center transition-all ${
                                                    formData.format === 'badge'
                                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold'
                                                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100'
                                                }`}
                                            >
                                                Vertical Badge (101.6 × 152.4mm)
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase">Card Printing Faces (Single / Double Sided)</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, printSides: 'single' })}
                                                className={`px-3 py-2 border rounded-lg text-xs font-medium text-center transition-all ${
                                                    formData.printSides === 'single'
                                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold'
                                                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100'
                                                }`}
                                            >
                                                Single-Sided (Front Only - Standard)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, printSides: 'double' })}
                                                className={`px-3 py-2 border rounded-lg text-xs font-medium text-center transition-all ${
                                                    formData.printSides === 'double'
                                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold'
                                                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100'
                                                }`}
                                            >
                                                Double-Sided (Front + Back)
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase">Default Role Assignment</label>
                                        <div className="flex flex-wrap gap-2">
                                            {(['student', 'teacher', 'staff', 'principal'] as const).map(role => {
                                                const isActive = formData.defaultForRoles.includes(role);
                                                return (
                                                    <button
                                                        key={role}
                                                        type="button"
                                                        onClick={() => handleRoleToggle(role)}
                                                        className={`px-3 py-1.5 border rounded-full text-xs font-medium capitalize transition-all ${
                                                            isActive
                                                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 font-bold'
                                                                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
                                                        }`}
                                                    >
                                                        {role}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Logo image upload */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase">School Logo</label>
                                        <div className="flex items-center gap-3">
                                            <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-xs font-medium text-gray-600 dark:text-gray-300">
                                                <Upload size={14} />
                                                <span>Upload Logo</span>
                                                <input type="file" onChange={handleLogoUpload} accept="image/png, image/jpeg" className="hidden" />
                                            </label>
                                            {isUploadingLogo && <Loader2 size={16} className="animate-spin text-blue-500" />}
                                            {formData.logoUrl && (
                                                <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 py-1 px-2 rounded border dark:border-gray-600">
                                                    <span className="truncate max-w-[120px]">Logo Attached</span>
                                                    <button type="button" onClick={() => setFormData({ ...formData, logoUrl: '' })} className="text-red-500 hover:text-red-700 font-bold ml-1">×</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STYLE TAB */}
                            {activeTab === 'style' && (
                                <div className="space-y-4">
                                    {selectedElement ? (
                                        /* ── SELECTED ELEMENT STYLING PANEL ── */
                                        <div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-2 border-blue-400 dark:border-blue-600 rounded-xl space-y-3 shadow-sm">
                                            <div className="flex items-center justify-between border-b border-blue-200 dark:border-blue-800/60 pb-2">
                                                <div className="flex items-center gap-1.5 text-xs font-black text-blue-900 dark:text-blue-200 uppercase tracking-wide">
                                                    <Palette size={14} className="text-blue-600 dark:text-blue-400" />
                                                    <span>Styling Selected: <span className="underline text-blue-600 dark:text-blue-300">{selectedElement}</span></span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedElement(null)}
                                                    className="text-[11px] font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white bg-white dark:bg-gray-800 px-2 py-0.5 rounded border shadow-xs"
                                                >
                                                    Clear Selection (Edit General Card)
                                                </button>
                                            </div>

                                            {/* Element Specific Colors */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase">Selected Text Color</label>
                                                    <div className="flex gap-2 items-center">
                                                        <input
                                                            type="color"
                                                            value={getSelectedElementStyle('color') || formData.textColor}
                                                            onChange={e => handleUpdateElementStyle('color', e.target.value)}
                                                            className="w-10 h-8 rounded border cursor-pointer"
                                                        />
                                                        <span className="font-mono text-xs uppercase font-bold">{getSelectedElementStyle('color') || formData.textColor}</span>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase">Background / Pill Fill</label>
                                                    <div className="flex gap-2 items-center">
                                                        <input
                                                            type="color"
                                                            value={getSelectedElementStyle('bgColor') || formData.primaryColor}
                                                            onChange={e => handleUpdateElementStyle('bgColor', e.target.value)}
                                                            className="w-10 h-8 rounded border cursor-pointer"
                                                        />
                                                        <span className="font-mono text-xs uppercase font-bold">{getSelectedElementStyle('bgColor') || 'Default'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Element Specific Typography */}
                                            <div className="grid grid-cols-2 gap-3 pt-1">
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 uppercase">Element Font Family</label>
                                                    <select
                                                        value={getSelectedElementStyle('fontFamily') || formData.fontFamily}
                                                        onChange={e => handleUpdateElementStyle('fontFamily', e.target.value)}
                                                        className="w-full text-xs px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none"
                                                    >
                                                        {PRESET_FONTS.map(f => (
                                                            <option key={f.value} value={f.value}>{f.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 uppercase">Font Size (pt)</label>
                                                    <input
                                                        type="number"
                                                        min="6"
                                                        max="28"
                                                        value={getSelectedElementStyle('fontSize') || (selectedElement === 'name' ? 13 : selectedElement === 'role' ? 9 : 10)}
                                                        onChange={e => handleUpdateElementStyle('fontSize', parseInt(e.target.value) || 10)}
                                                        className="w-full text-xs px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        /* ── GENERAL CARD CANVAS STYLING ── */
                                        <>
                                            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide bg-gray-100 dark:bg-gray-800 py-1.5 px-3 rounded-lg border dark:border-gray-700 flex justify-between items-center">
                                                <span>General Card Canvas Styles</span>
                                                <span className="text-[10px] text-blue-600 dark:text-blue-400">Click any element on canvas to style it specifically</span>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase">Header & Vector Graphic Style</label>
                                                <select
                                                    value={formData.headerStyle}
                                                    onChange={e => setFormData({ ...formData, headerStyle: e.target.value as any })}
                                                    className="w-full text-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none"
                                                >
                                                    <option value="curved-wave">Curved Wave & Bottom Arc (Crimson / Orbit)</option>
                                                    <option value="dual-strip">Dual-Tone Curved Wave (Fauget Orange-Navy)</option>
                                                    <option value="sidebar-left">Left Vertical Accent Bar (Farget Slate)</option>
                                                    <option value="top-banner">Top Solid Banner (Academic Classic)</option>
                                                    <option value="arch-frame">Curved Arch Frame (Teacher Green Arch)</option>
                                                    <option value="angled-split">Angled Split Vectors (Salford Maroon)</option>
                                                    <option value="minimal-clean">Minimalist Clean Line</option>
                                                </select>
                                            </div>

                                            {/* Color Pickers Grid */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase">Primary Color</label>
                                                    <div className="flex gap-2 items-center">
                                                        <input
                                                            type="color"
                                                            value={formData.primaryColor}
                                                            onChange={e => setFormData({ ...formData, primaryColor: e.target.value })}
                                                            className="w-10 h-8 rounded border cursor-pointer"
                                                        />
                                                        <span className="font-mono text-xs uppercase">{formData.primaryColor}</span>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase">Secondary Accent</label>
                                                    <div className="flex gap-2 items-center">
                                                        <input
                                                            type="color"
                                                            value={formData.secondaryColor}
                                                            onChange={e => setFormData({ ...formData, secondaryColor: e.target.value })}
                                                            className="w-10 h-8 rounded border cursor-pointer"
                                                        />
                                                        <span className="font-mono text-xs uppercase">{formData.secondaryColor}</span>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase">Card Background</label>
                                                    <div className="flex gap-2 items-center">
                                                        <input
                                                            type="color"
                                                            value={formData.backgroundColor}
                                                            onChange={e => setFormData({ ...formData, backgroundColor: e.target.value })}
                                                            className="w-10 h-8 rounded border cursor-pointer"
                                                        />
                                                        <span className="font-mono text-xs uppercase">{formData.backgroundColor}</span>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase">Text Color</label>
                                                    <div className="flex gap-2 items-center">
                                                        <input
                                                            type="color"
                                                            value={formData.textColor}
                                                            onChange={e => setFormData({ ...formData, textColor: e.target.value })}
                                                            className="w-10 h-8 rounded border cursor-pointer"
                                                        />
                                                        <span className="font-mono text-xs uppercase">{formData.textColor}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Photo Frame Geometry & Border */}
                                            <div className="space-y-2">
                                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Photo Frame Geometry</label>
                                                <div className="grid grid-cols-4 gap-1.5 mb-2">
                                                    {(['circle', 'rounded', 'arch', 'square'] as const).map(shape => (
                                                        <button
                                                            key={shape}
                                                            type="button"
                                                            onClick={() => setFormData({ ...formData, photoShape: shape })}
                                                            className={`py-1.5 px-2 text-xs border rounded-lg capitalize font-semibold transition-all ${
                                                                formData.photoShape === shape
                                                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                                                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                                                            }`}
                                                        >
                                                            {shape}
                                                        </button>
                                                    ))}
                                                </div>

                                                <div className="grid grid-cols-2 gap-3 pt-1">
                                                    <div>
                                                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase">Photo Border Color</label>
                                                        <div className="flex gap-2 items-center">
                                                            <input
                                                                type="color"
                                                                value={formData.photoBorderColor}
                                                                onChange={e => setFormData({ ...formData, photoBorderColor: e.target.value })}
                                                                className="w-10 h-8 rounded border cursor-pointer"
                                                            />
                                                            <span className="font-mono text-xs uppercase">{formData.photoBorderColor}</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase">Border Width ({formData.photoBorderWidth}px)</label>
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max="8"
                                                            value={formData.photoBorderWidth}
                                                            onChange={e => setFormData({ ...formData, photoBorderWidth: parseInt(e.target.value) || 0 })}
                                                            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Typography & Font */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase">Font Family</label>
                                                    <select
                                                        value={formData.fontFamily}
                                                        onChange={e => setFormData({ ...formData, fontFamily: e.target.value })}
                                                        className="w-full text-xs px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none"
                                                    >
                                                        {PRESET_FONTS.map(f => (
                                                            <option key={f.value} value={f.value}>{f.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase">Font Size (pt)</label>
                                                    <input
                                                        type="number"
                                                        min="8"
                                                        max="20"
                                                        value={formData.fontSize}
                                                        onChange={e => setFormData({ ...formData, fontSize: parseInt(e.target.value) || 12 })}
                                                        className="w-full text-xs px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* FIELDS & TEXT CUSTOMIZATION TAB */}
                            {activeTab === 'layout' && (
                                <div className="space-y-4">
                                    {/* "+ Add New Element" Floating Bar */}
                                    <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800/40 rounded-xl space-y-2">
                                        <label className="block text-xs font-bold text-blue-900 dark:text-blue-300 uppercase flex items-center justify-between">
                                            <span>Add Canvas Elements</span>
                                            <span className="text-[10px] text-blue-600 dark:text-blue-400">Canva Customizer</span>
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleAddCustomElement('text')}
                                                className="py-2 px-3 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 hover:bg-blue-50 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
                                            >
                                                <Plus size={14} /> + Add Text Box
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleAddCustomElement('badge')}
                                                className="py-2 px-3 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 hover:bg-blue-50 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
                                            >
                                                <Plus size={14} /> + Add Custom Badge
                                            </button>
                                        </div>
                                    </div>

                                    {/* Built-in Field Controls */}
                                    <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl space-y-3">
                                        <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 uppercase">Text Contents Customizer</label>

                                        {/* Card Title Subhead */}
                                        <div className="space-y-1 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center justify-between text-xs font-semibold text-gray-800 dark:text-gray-200">
                                                <span>Card Subtitle / Header</span>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleFieldVisibility('showTitle')}
                                                    className={`p-1 rounded ${formData.visibleFields.showTitle ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}
                                                >
                                                    {formData.visibleFields.showTitle ? <Eye size={15} /> : <EyeOff size={15} />}
                                                </button>
                                            </div>
                                            {formData.visibleFields.showTitle && (
                                                <input
                                                    type="text"
                                                    value={formData.cardTitle}
                                                    onChange={e => setFormData({ ...formData, cardTitle: e.target.value })}
                                                    className="w-full px-2.5 py-1 text-xs border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none"
                                                    placeholder="e.g. STUDENT ID CARD"
                                                />
                                            )}
                                        </div>

                                        {/* Member Name */}
                                        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold">
                                            <span>Member Name</span>
                                            <button
                                                type="button"
                                                onClick={() => toggleFieldVisibility('showName')}
                                                className={`p-1 rounded ${formData.visibleFields.showName ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}
                                            >
                                                {formData.visibleFields.showName ? <Eye size={15} /> : <EyeOff size={15} />}
                                            </button>
                                        </div>

                                        {/* Role Badge */}
                                        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold">
                                            <span>Role Tag Badge</span>
                                            <button
                                                type="button"
                                                onClick={() => toggleFieldVisibility('showRole')}
                                                className={`p-1 rounded ${formData.visibleFields.showRole ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}
                                            >
                                                {formData.visibleFields.showRole ? <Eye size={15} /> : <EyeOff size={15} />}
                                            </button>
                                        </div>

                                        {/* ID Number */}
                                        <div className="space-y-1 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center justify-between text-xs font-semibold text-gray-800 dark:text-gray-200">
                                                <span>ID Number Field</span>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleFieldVisibility('showId')}
                                                    className={`p-1 rounded ${formData.visibleFields.showId ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}
                                                >
                                                    {formData.visibleFields.showId ? <Eye size={15} /> : <EyeOff size={15} />}
                                                </button>
                                            </div>
                                            {formData.visibleFields.showId && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-gray-500 w-16">Label Text:</span>
                                                    <input
                                                        type="text"
                                                        value={formData.idLabel}
                                                        onChange={e => setFormData({ ...formData, idLabel: e.target.value })}
                                                        className="flex-1 px-2 py-1 text-xs border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                                        placeholder="ID NO"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Date of Birth */}
                                        <div className="space-y-1 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center justify-between text-xs font-semibold text-gray-800 dark:text-gray-200">
                                                <span>Date of Birth (D.O.B)</span>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleFieldVisibility('showDob')}
                                                    className={`p-1 rounded ${formData.visibleFields.showDob ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}
                                                >
                                                    {formData.visibleFields.showDob ? <Eye size={15} /> : <EyeOff size={15} />}
                                                </button>
                                            </div>
                                            {formData.visibleFields.showDob && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-gray-500 w-16">Label Text:</span>
                                                    <input
                                                        type="text"
                                                        value={formData.dobLabel}
                                                        onChange={e => setFormData({ ...formData, dobLabel: e.target.value })}
                                                        className="flex-1 px-2 py-1 text-xs border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                                        placeholder="D.O.B"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Grade / Dept */}
                                        <div className="space-y-1 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center justify-between text-xs font-semibold text-gray-800 dark:text-gray-200">
                                                <span>Grade / Department</span>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleFieldVisibility('showGrade')}
                                                    className={`p-1 rounded ${formData.visibleFields.showGrade ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}
                                                >
                                                    {formData.visibleFields.showGrade ? <Eye size={15} /> : <EyeOff size={15} />}
                                                </button>
                                            </div>
                                            {formData.visibleFields.showGrade && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-gray-500 w-16">Label Text:</span>
                                                    <input
                                                        type="text"
                                                        value={formData.gradeLabel}
                                                        onChange={e => setFormData({ ...formData, gradeLabel: e.target.value })}
                                                        className="flex-1 px-2 py-1 text-xs border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                                        placeholder="GRADE"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Expiry Date */}
                                        <div className="space-y-1 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center justify-between text-xs font-semibold text-gray-800 dark:text-gray-200">
                                                <span>Expiration Date</span>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleFieldVisibility('showExpiry')}
                                                    className={`p-1 rounded ${formData.visibleFields.showExpiry ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}
                                                >
                                                    {formData.visibleFields.showExpiry ? <Eye size={15} /> : <EyeOff size={15} />}
                                                </button>
                                            </div>
                                            {formData.visibleFields.showExpiry && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-gray-500 w-16">Label Text:</span>
                                                    <input
                                                        type="text"
                                                        value={formData.expiryLabel}
                                                        onChange={e => setFormData({ ...formData, expiryLabel: e.target.value })}
                                                        className="flex-1 px-2 py-1 text-xs border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                                        placeholder="EXPIRES"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Collapsed Vertical Icon Menu Dock Bar */
                    <div className="w-full lg:w-14 bg-white dark:bg-gray-800 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 flex lg:flex-col items-center justify-between p-2 gap-2 shrink-0 transition-all duration-300">
                        <div className="flex lg:flex-col items-center gap-2">
                            <button
                                type="button"
                                onClick={() => { setActiveTab('general'); setIsSettingsOpen(true); }}
                                title="General Settings (Format, Orientation & Templates)"
                                className={`p-2.5 rounded-xl border transition-all ${
                                    activeTab === 'general' ? 'bg-blue-600 text-white shadow-md border-blue-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                                }`}
                            >
                                <Layout size={18} />
                            </button>

                            <button
                                type="button"
                                onClick={() => { setActiveTab('style'); setIsSettingsOpen(true); }}
                                title="Style Settings (Colors, Fonts & Photo Borders)"
                                className={`p-2.5 rounded-xl border transition-all ${
                                    activeTab === 'style' ? 'bg-blue-600 text-white shadow-md border-blue-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                                }`}
                            >
                                <Palette size={18} />
                            </button>

                            <button
                                type="button"
                                onClick={() => { setActiveTab('layout'); setIsSettingsOpen(true); }}
                                title="Fields & Text Settings (Card Labels & Custom Badges)"
                                className={`p-2.5 rounded-xl border transition-all ${
                                    activeTab === 'layout' ? 'bg-blue-600 text-white shadow-md border-blue-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                                }`}
                            >
                                <Type size={18} />
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsSettingsOpen(true)}
                            title="Expand Settings Panel"
                            className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 transition-all flex items-center justify-center"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                )}

                    {/* Right Pane (Live Visual Renderer Preview & Floating Canva Action Bar) */}
                    <div className="flex-1 flex flex-col bg-slate-100 dark:bg-slate-950 p-4 sm:p-6 overflow-y-auto items-center justify-start relative w-full h-full min-h-[380px] lg:min-h-0 order-1 lg:order-2">
                        {/* Front / Back View & Role Switcher Toolbar */}
                        <div className="mb-4 flex flex-wrap items-center justify-center gap-3 bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            {/* Card Sides Switcher */}
                            <div className="flex items-center gap-1 border-r pr-3 border-gray-200 dark:border-gray-700 flex-wrap">
                                <span className="text-[10px] font-bold uppercase text-gray-400 mr-1">Face:</span>
                                <button
                                    type="button"
                                    onClick={() => setPreviewSide('front')}
                                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                                        previewSide === 'front' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                    }`}
                                >
                                    Front View
                                </button>
                                {formData.printSides === 'double' ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewSide('back')}
                                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                                                previewSide === 'back' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                            }`}
                                        >
                                            Back View
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewSide('both')}
                                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                                                previewSide === 'both' ? 'bg-purple-600 text-white shadow-sm font-black' : 'text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30'
                                            }`}
                                        >
                                            <Layers size={13} />
                                            <span>Both Sides</span>
                                        </button>
                                    </>
                                ) : (
                                    <span className="text-[10px] bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded font-semibold border border-amber-200 dark:border-amber-800">
                                        Single-Sided (Front Only)
                                    </span>
                                )}
                            </div>

                            {/* Sample Role Switcher */}
                            <div className="flex items-center gap-1 border-r pr-3 border-gray-200 dark:border-gray-700">
                                <span className="text-[10px] font-bold uppercase text-gray-400 mr-1">Role Preview:</span>
                                {(['student', 'teacher', 'staff'] as const).map(role => (
                                    <button
                                        key={role}
                                        type="button"
                                        onClick={() => setPreviewRole(role)}
                                        className={`px-2.5 py-1 text-xs font-bold capitalize rounded-lg transition-all ${
                                            previewRole === role
                                                ? 'bg-emerald-600 text-white shadow-sm font-black'
                                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                    >
                                        {role}
                                    </button>
                                ))}
                            </div>

                            {/* Smart Directions Guide Button */}
                            <button
                                type="button"
                                onClick={() => setIsGuideOpen(true)}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg border border-blue-200 dark:border-blue-800 shadow-2xs transition-all"
                            >
                                <HelpCircle size={14} />
                                <span>How-To Guide</span>
                            </button>
                        </div>

                        {/* Floating Canva Object Action Bar (Appears when any element is clicked/selected) */}
                        {selectedElement && (
                            <div className="mb-4 w-full max-w-[460px] bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800/60 p-3 rounded-xl shadow-lg space-y-2 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center justify-between border-b pb-2 dark:border-gray-700">
                                    <span className="text-xs font-bold text-blue-900 dark:text-blue-300 capitalize flex items-center gap-1.5">
                                        <Move size={14} className="text-blue-500" />
                                        Editing Canvas Element: <code className="bg-blue-50 dark:bg-blue-900/50 px-1.5 py-0.5 rounded text-blue-600">{selectedElement}</code>
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={handleDuplicateSelected}
                                            title="Duplicate Element"
                                            className="p-1.5 text-xs bg-gray-100 hover:bg-blue-50 text-gray-700 hover:text-blue-600 rounded-md border"
                                        >
                                            <Copy size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDeleteSelected}
                                            title="Delete / Hide Element"
                                            className="p-1.5 text-xs bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-600 rounded-md border"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedElement(null)}
                                            className="text-xs text-gray-400 hover:text-gray-600 font-bold ml-1"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>

                                 {/* School Name Inline Text Editor */}
                                {selectedElement === 'schoolName' && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 w-24 flex-shrink-0">School Name:</span>
                                        <input
                                            type="text"
                                            value={formData.customSchoolName || ''}
                                            onChange={e => setFormData(prev => ({ ...prev, customSchoolName: e.target.value }))}
                                            className="flex-1 px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                                            placeholder="Enter school name..."
                                        />
                                    </div>
                                )}

                                {/* Badge Logo Upload & Emblem Picker */}
                                {selectedElement === 'logo' && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 w-24 flex-shrink-0">School Logo:</span>
                                            <label className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 border border-dashed border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100/50 cursor-pointer text-xs font-bold text-blue-600 dark:text-blue-300 transition-all">
                                                <Upload size={14} />
                                                <span>{formData.logoUrl ? 'Change Uploaded Logo Image' : 'Upload School Logo Image'}</span>
                                                <input type="file" onChange={handleLogoUpload} accept="image/png, image/jpeg, image/svg+xml" className="hidden" />
                                            </label>
                                            {formData.logoUrl && (
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, logoUrl: '' }))}
                                                    className="px-2 py-1 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300 text-xs font-bold rounded hover:bg-red-200"
                                                    title="Remove Logo"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Card Subtitle Inline Editor */}
                                {selectedElement === 'title' && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 w-24 flex-shrink-0">Card Subtitle:</span>
                                        <input
                                            type="text"
                                            value={formData.cardTitle || ''}
                                            onChange={e => setFormData(prev => ({ ...prev, cardTitle: e.target.value }))}
                                            className="flex-1 px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                                            placeholder="Card header subtitle..."
                                        />
                                    </div>
                                )}

                                {/* ID Grid Field Labels Editor */}
                                {selectedElement === 'id' && (
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-semibold text-gray-500 w-16">ID Label:</span>
                                            <input
                                                type="text"
                                                value={formData.idLabel || ''}
                                                onChange={e => setFormData(prev => ({ ...prev, idLabel: e.target.value }))}
                                                className="flex-1 px-2 py-0.5 border rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-semibold text-gray-500 w-16">DOB Label:</span>
                                            <input
                                                type="text"
                                                value={formData.dobLabel || ''}
                                                onChange={e => setFormData(prev => ({ ...prev, dobLabel: e.target.value }))}
                                                className="flex-1 px-2 py-0.5 border rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-semibold text-gray-500 w-16">Grade:</span>
                                            <input
                                                type="text"
                                                value={formData.gradeLabel || ''}
                                                onChange={e => setFormData(prev => ({ ...prev, gradeLabel: e.target.value }))}
                                                className="flex-1 px-2 py-0.5 border rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-semibold text-gray-500 w-16">Expires:</span>
                                            <input
                                                type="text"
                                                value={formData.expiryLabel || ''}
                                                onChange={e => setFormData(prev => ({ ...prev, expiryLabel: e.target.value }))}
                                                className="flex-1 px-2 py-0.5 border rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Custom Element Inline Label Editor */}
                                {selectedCustomElement && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 w-24 flex-shrink-0">Text Label:</span>
                                        <input
                                            type="text"
                                            value={selectedCustomElement.label}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setFormData(prev => ({
                                                    ...prev,
                                                    layoutConfig: {
                                                        ...prev.layoutConfig,
                                                        customElements: (prev.layoutConfig.customElements || []).map((el: CanvasElement) =>
                                                            el.id === selectedElement ? { ...el, label: val } : el
                                                        ),
                                                    },
                                                }));
                                            }}
                                            className="flex-1 px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                                            placeholder="Enter text..."
                                        />
                                    </div>
                                )}

                                {/* Alignment Buttons */}
                                <div className="flex items-center justify-between gap-2 pt-1">
                                    <span className="text-[10px] text-gray-500 font-semibold uppercase">Snap Align:</span>
                                    <div className="flex gap-1 flex-1 justify-end">
                                        <button type="button" onClick={() => alignElement('left')} className="py-1 px-2 border rounded text-xs flex items-center gap-1 hover:bg-gray-50 dark:hover:bg-gray-700">
                                            <AlignLeft size={12} /> Left
                                        </button>
                                        <button type="button" onClick={() => alignElement('center')} className="py-1 px-2 border rounded text-xs flex items-center gap-1 hover:bg-gray-50 dark:hover:bg-gray-700">
                                            <AlignCenter size={12} /> Center
                                        </button>
                                        <button type="button" onClick={() => alignElement('right')} className="py-1 px-2 border rounded text-xs flex items-center gap-1 hover:bg-gray-50 dark:hover:bg-gray-700">
                                            <AlignRight size={12} /> Right
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Preview Card Canvas */}
                        <div className="transform scale-100 transition-all duration-300 w-full flex justify-center">
                            {formData.printSides === 'double' && previewSide === 'both' ? (
                                <div className="flex flex-col lg:flex-row items-center justify-center gap-6 w-full max-w-4xl py-2">
                                    {/* Front Side Card */}
                                    <div className="flex flex-col items-center gap-2 w-full max-w-[380px]">
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/60 px-3 py-0.5 rounded-full border border-blue-300 dark:border-blue-700 shadow-xs">
                                            Front Face
                                        </span>
                                        <div className="w-full flex justify-center">
                                            <VisualIdCardRenderer
                                                config={{
                                                    presetId: formData.presetId,
                                                    printSides: formData.printSides,
                                                    headerStyle: formData.headerStyle,
                                                    primaryColor: formData.primaryColor,
                                                    secondaryColor: formData.secondaryColor,
                                                    backgroundColor: formData.backgroundColor,
                                                    textColor: formData.textColor,
                                                    photoShape: formData.photoShape,
                                                    photoBorderColor: formData.photoBorderColor,
                                                    photoBorderWidth: formData.photoBorderWidth,
                                                    cardTitle: formData.cardTitle,
                                                    idLabel: formData.idLabel,
                                                    dobLabel: formData.dobLabel,
                                                    gradeLabel: formData.gradeLabel,
                                                    expiryLabel: formData.expiryLabel,
                                                    customSchoolName: formData.customSchoolName,
                                                    logoEmblem: formData.logoEmblem,
                                                    visibleFields: formData.visibleFields,
                                                    fontFamily: formData.fontFamily,
                                                    fontSize: formData.fontSize,
                                                    showBarcode: formData.showBarcode,
                                                    showQrCode: formData.showQrCode,
                                                    logoPosition: formData.logoPosition,
                                                    layoutConfig: formData.layoutConfig,
                                                }}
                                                format={formData.format}
                                                user={previewUser}
                                                logoUrl={formData.logoUrl}
                                                side="front"
                                                selectedElement={selectedElement}
                                                onClickElement={(key) => setSelectedElement(key)}
                                                onPositionChange={handlePositionChange}
                                            />
                                        </div>
                                    </div>

                                    {/* Back Side Card */}
                                    <div className="flex flex-col items-center gap-2 w-full max-w-[380px]">
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/60 px-3 py-0.5 rounded-full border border-purple-300 dark:border-purple-700 shadow-xs">
                                            Back Face
                                        </span>
                                        <div className="w-full flex justify-center">
                                            <VisualIdCardRenderer
                                                config={{
                                                    presetId: formData.presetId,
                                                    printSides: formData.printSides,
                                                    headerStyle: formData.headerStyle,
                                                    primaryColor: formData.primaryColor,
                                                    secondaryColor: formData.secondaryColor,
                                                    backgroundColor: formData.backgroundColor,
                                                    textColor: formData.textColor,
                                                    photoShape: formData.photoShape,
                                                    photoBorderColor: formData.photoBorderColor,
                                                    photoBorderWidth: formData.photoBorderWidth,
                                                    cardTitle: formData.cardTitle,
                                                    idLabel: formData.idLabel,
                                                    dobLabel: formData.dobLabel,
                                                    gradeLabel: formData.gradeLabel,
                                                    expiryLabel: formData.expiryLabel,
                                                    customSchoolName: formData.customSchoolName,
                                                    logoEmblem: formData.logoEmblem,
                                                    visibleFields: formData.visibleFields,
                                                    fontFamily: formData.fontFamily,
                                                    fontSize: formData.fontSize,
                                                    showBarcode: formData.showBarcode,
                                                    showQrCode: formData.showQrCode,
                                                    logoPosition: formData.logoPosition,
                                                    layoutConfig: formData.layoutConfig,
                                                }}
                                                format={formData.format}
                                                user={previewUser}
                                                logoUrl={formData.logoUrl}
                                                side="back"
                                                selectedElement={selectedElement}
                                                onClickElement={(key) => setSelectedElement(key)}
                                                onPositionChange={handlePositionChange}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className={`w-full ${formData.format === 'pvc' ? 'max-w-[420px]' : 'max-w-[300px]'} flex justify-center`}>
                                    <VisualIdCardRenderer
                                        config={{
                                            presetId: formData.presetId,
                                            printSides: formData.printSides,
                                            headerStyle: formData.headerStyle,
                                            primaryColor: formData.primaryColor,
                                            secondaryColor: formData.secondaryColor,
                                            backgroundColor: formData.backgroundColor,
                                            textColor: formData.textColor,
                                            photoShape: formData.photoShape,
                                            photoBorderColor: formData.photoBorderColor,
                                            photoBorderWidth: formData.photoBorderWidth,
                                            cardTitle: formData.cardTitle,
                                            idLabel: formData.idLabel,
                                            dobLabel: formData.dobLabel,
                                            gradeLabel: formData.gradeLabel,
                                            expiryLabel: formData.expiryLabel,
                                            customSchoolName: formData.customSchoolName,
                                            logoEmblem: formData.logoEmblem,
                                            visibleFields: formData.visibleFields,
                                            fontFamily: formData.fontFamily,
                                            fontSize: formData.fontSize,
                                            showBarcode: formData.showBarcode,
                                            showQrCode: formData.showQrCode,
                                            logoPosition: formData.logoPosition,
                                            layoutConfig: formData.layoutConfig,
                                        }}
                                        format={formData.format}
                                        user={previewUser}
                                        logoUrl={formData.logoUrl}
                                        side={previewSide === 'both' ? 'front' : previewSide}
                                        selectedElement={selectedElement}
                                        onClickElement={(key) => setSelectedElement(key)}
                                        onPositionChange={handlePositionChange}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="flex justify-between items-center px-6 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                        {isSubmitting ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                        {editingTemplate ? 'Update Card Template' : 'Save & Publish Template'}
                    </Button>
                </div>
            </div>

            {/* Smart Template Customization & Setup Directions Guide Modal */}
            {isGuideOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="px-6 py-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-400/30">
                                    <Sparkles size={20} className="text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-base tracking-tight">WiSkul ID Card Builder & Customization Guide</h3>
                                    <p className="text-xs text-blue-200">How to setup, customize, and publish professional Sierra Leone school ID templates</p>
                                </div>
                            </div>
                            <button
                                onClick={handleCloseGuide}
                                className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white text-lg font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Content Body */}
                        <div className="p-6 overflow-y-auto space-y-4 text-xs text-gray-700 dark:text-gray-300">
                            {/* Step 1 */}
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex gap-3.5 items-start">
                                <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-black flex items-center justify-center flex-shrink-0 text-xs shadow-sm">1</div>
                                <div className="space-y-1">
                                    <h4 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5">
                                        <BookOpen size={15} className="text-blue-500" /> Choose Cultural Sierra Leone Presets
                                    </h4>
                                    <p className="text-gray-600 dark:text-gray-400">
                                        Start by selecting from 14 WiSkul preset themes (e.g. <i>WiSkul Classic - Lion Mountain Executive</i>, <i>Kakua Gold Crest</i>, <i>Cotton Tree VIP</i>). Each preset comes pre-formatted for standard PVC horizontal cards or vertical lanyard badges.
                                    </p>
                                </div>
                            </div>

                            {/* Step 2 */}
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex gap-3.5 items-start">
                                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center flex-shrink-0 text-xs shadow-sm">2</div>
                                <div className="space-y-1">
                                    <h4 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5">
                                        <Move size={15} className="text-emerald-500" /> Interactive Drag & Magnetic Alignment
                                    </h4>
                                    <p className="text-gray-600 dark:text-gray-400">
                                        Click <b>ANY</b> element directly on the live card canvas (Photo, Name, Logo, Subtitle, or ID Table) and drag it to reposition. Magnetic guidelines automatically appear to snap elements in perfect alignment.
                                    </p>
                                </div>
                            </div>

                            {/* Step 3 */}
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex gap-3.5 items-start">
                                <div className="w-7 h-7 rounded-full bg-purple-600 text-white font-black flex items-center justify-center flex-shrink-0 text-xs shadow-sm">3</div>
                                <div className="space-y-1">
                                    <h4 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5">
                                        <Layers size={15} className="text-purple-500" /> Single-Sided vs. Double-Sided Printing
                                    </h4>
                                    <p className="text-gray-600 dark:text-gray-400">
                                        In the <b>General Tab</b>, pick <b>Single-Sided</b> (all credentials cleanly fitted on 1 face without QR clutter) or <b>Double-Sided</b> (Front face + Back face with magnetic stripe & verification QR). Toggle <i>"Both Sides"</i> in the toolbar to see front & back stacked together!
                                    </p>
                                </div>
                            </div>

                            {/* Step 4 */}
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex gap-3.5 items-start">
                                <div className="w-7 h-7 rounded-full bg-amber-600 text-white font-black flex items-center justify-center flex-shrink-0 text-xs shadow-sm">4</div>
                                <div className="space-y-1">
                                    <h4 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5">
                                        <Palette size={15} className="text-amber-500" /> Custom School Brand Styling & Colors
                                    </h4>
                                    <p className="text-gray-600 dark:text-gray-400">
                                        Use the <b>Style Tab</b> to change your primary brand color, background theme (Pure White, Warm Cream, Cool Sky, Onyx Black), photo border thickness, and font sizes.
                                    </p>
                                </div>
                            </div>

                            {/* Step 5 */}
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex gap-3.5 items-start">
                                <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-black flex items-center justify-center flex-shrink-0 text-xs shadow-sm">5</div>
                                <div className="space-y-1">
                                    <h4 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5">
                                        <UserCheck size={15} className="text-blue-500" /> Role Switcher Live Inspection
                                    </h4>
                                    <p className="text-gray-600 dark:text-gray-400">
                                        Use the <b>Role Preview</b> buttons above the card (<i>Student</i>, <i>Teacher</i>, <i>Staff</i>) to test how real student, faculty, and administrative badges render before clicking <b>Save & Publish Template</b>.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            <span className="text-gray-500 font-semibold text-[11px]">WiSkul Identity System Help</span>
                            <Button onClick={handleCloseGuide} className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-5">
                                Got It, Let's Build!
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};
