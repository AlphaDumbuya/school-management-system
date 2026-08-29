/**
 * Shared helpers for exporting an ID card to a faithful, card-sized PDF.
 * Re-exports the exporter component and provides a single mapper that turns
 * a card record (from list or getCardById) into renderer-ready export data.
 */

import { CardExportData } from './CardPdfExporter';
import { TemplateConfig } from '@services/idCardService';

export { CardPdfExporter } from './CardPdfExporter';
export type { CardPdfExporterHandle, CardExportData } from './CardPdfExporter';

const DEFAULT_CONFIG: Partial<TemplateConfig> = {
  headerStyle: 'curved-wave',
  primaryColor: '#1E3A8A',
  secondaryColor: '#EA580C',
  backgroundColor: '#FFFFFF',
  textColor: '#0F172A',
  photoShape: 'circle',
  cardTitle: 'IDENTIFICATION CARD',
};

function fmt(d?: string | null) {
  if (!d) return undefined;
  const date = new Date(d);
  return isNaN(date.getTime())
    ? undefined
    : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Build export data from a card object. Accepts both the lightweight list
 * shape and the richer getCardById shape.
 */
export function buildCardExportData(card: any, output: 'pdf' | 'png' | 'jpg' = 'pdf'): CardExportData {
  const user = card.user || {};
  const name = user.firstName || user.lastName
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
    : 'ID Holder';

  const config = (card.template?.config && Object.keys(card.template.config).length > 0
    ? card.template.config
    : DEFAULT_CONFIG) as TemplateConfig;

  const ext = output === 'pdf' ? 'pdf' : output === 'jpg' ? 'jpg' : 'png';

  return {
    config,
    format: card.format || 'pvc',
    logoUrl: card.template?.logoUrl || card.template?.config?.logoUrl,
    fileName: `id-card-${(name || card.cardNumber || card.id).replace(/\s+/g, '_')}.${ext}`,
    output,
    user: {
      name,
      idNumber: user.memberId || card.cardNumber,
      role: user.role ? String(user.role).toUpperCase() : 'STUDENT',
      photoUrl: user.photoUrl,
      dob: fmt(user.dob),
      departmentOrGrade: user.departmentOrGrade || undefined,
      expiresAt: fmt(card.expiresAt),
      issuedAt: fmt(card.issuedAt),
      schoolName: card.template?.config?.customSchoolName,
      qrImageUrl: card.qrImageUrl || undefined,
    },
  };
}
