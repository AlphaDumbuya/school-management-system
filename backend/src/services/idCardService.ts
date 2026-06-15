import { Knex } from 'knex';
import PDFDocument from 'pdfkit';
import { logger } from '../utils/logger.js';
import { QrCodeService } from './qrCodeService.js';
import { BarcodeService } from './barcodeService.js';
import { TemplateService } from './templateService.js';
import * as crypto from 'crypto';

/**
 * ID Card Service
 * Phase 2.1: Identity Management Module
 * 
 * Orchestrates ID card generation workflow including user data retrieval,
 * QR code and barcode generation, template application, and PDF creation.
 * Manages card metadata storage and lifecycle integration.
 */

export interface CardGenerationOptions {
  templateId?: string;  // Optional, uses default if not provided
  format: 'pvc' | 'badge';
  expirationDate?: Date;  // Optional, defaults to 1 year
  issuedBy: string;
}

export interface CardResult {
  cardId: string;
  userId: string;
  cardNumber: string;
  qrCode: string;
  barcode: string;
  pdfUrl: string;
  issuedAt: Date;
  expiresAt: Date;
}

export interface Card {
  id: string;
  tenantId: string;
  userId: string;
  templateId: string;
  cardNumber: string;
  format: 'pvc' | 'badge';
  status: 'active' | 'expired' | 'lost' | 'revoked' | 'suspended';
  pdfUrl?: string;
  issuedAt: Date;
  expiresAt: Date;
  issuedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class IdCardService {
  private qrCodeService: QrCodeService;
  private barcodeService: BarcodeService;
  private templateService: TemplateService;

  constructor(private db: Knex) {
    this.qrCodeService = new QrCodeService(db);
    this.barcodeService = new BarcodeService();
    this.templateService = new TemplateService(db);
  }

  /**
   * Generate an ID card for a user
   * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
   */
  async generateCard(
    userId: string,
    tenantId: string,
    options: CardGenerationOptions
  ): Promise<CardResult> {
    try {
      // Check if user already has an active card
      const existingCard = await this.db('id_cards')
        .where({ user_id: userId, status: 'active' })
        .first();

      if (existingCard) {
        throw new Error(`User ${userId} already has an active card`);
      }

      // Retrieve user information
      const user = await this.db('users')
        .where({ id: userId, tenant_id: tenantId })
        .first();

      if (!user) {
        throw new Error(`User ${userId} not found for tenant ${tenantId}`);
      }

      // Get user type-specific information (student_id or teacher_id)
      let userIdentifier = userId;
      if (user.role === 'student') {
        const student = await this.db('students')
          .where({ user_id: userId })
          .first();
        userIdentifier = student?.student_id || userId;
      } else if (user.role === 'teacher') {
        const teacher = await this.db('teachers')
          .where({ user_id: userId })
          .first();
        userIdentifier = teacher?.teacher_id || userId;
      }

      // Get or create default template
      let template;
      if (options.templateId) {
        template = await this.templateService.getTemplateById(options.templateId);
      } else {
        template = await this.templateService.getDefaultTemplate(
          tenantId,
          user.role as any
        );
      }

      // Calculate expiration date (1 year from now if not specified)
      const issuedAt = new Date();
      const expiresAt = options.expirationDate || new Date();
      if (!options.expirationDate) {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      }

      // Generate QR code
      const qrCodeData = await this.qrCodeService.generateQrCode(
        userId,
        tenantId,
        expiresAt
      );

      // Generate barcode
      const barcodeData = await this.barcodeService.generateBarcode(userIdentifier);

      // Generate unique card number
      const cardNumber = this.generateCardNumber(tenantId);

      // Create card record
      const [card] = await this.db('id_cards')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          template_id: template.templateId,
          card_number: cardNumber,
          format: options.format,
          status: 'active',
          issued_at: issuedAt,
          expires_at: expiresAt,
          issued_by: options.issuedBy,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');

      // Link QR code to card
      await this.db('qr_codes')
        .where({ id: qrCodeData.qrCodeId })
        .update({ card_id: card.id });

      // Generate PDF
      const pdfBuffer = await this.generateCardPDF(
        user,
        userIdentifier,
        card,
        template,
        qrCodeData,
        barcodeData,
        tenantId
      );

      // Save PDF (in real implementation, upload to storage)
      const pdfUrl = await this.savePDF(pdfBuffer, card.id, tenantId);

      // Update card with PDF URL
      await this.db('id_cards')
        .where({ id: card.id })
        .update({ pdf_url: pdfUrl });

      // Log audit trail
      await this.db('card_audit_log').insert({
        card_id: card.id,
        action: 'issued',
        new_status: 'active',
        performed_by: options.issuedBy,
        reason: 'Initial card generation',
        performed_at: new Date(),
      });

      logger.info(`Generated ID card ${card.id} for user ${userId}`, {
        cardNumber,
        qrCodeId: qrCodeData.qrCodeId,
      });

      return {
        cardId: card.id,
        userId,
        cardNumber,
        qrCode: qrCodeData.content,
        barcode: barcodeData.content,
        pdfUrl,
        issuedAt,
        expiresAt,
      };
    } catch (error) {
      logger.error('Failed to generate card', { userId, tenantId, error });
      throw error;
    }
  }

  /**
   * Regenerate an existing card
   * Requirements: 1.1
   */
  async regenerateCard(cardId: string): Promise<CardResult> {
    try {
      const existingCard = await this.db('id_cards')
        .where({ id: cardId })
        .first();

      if (!existingCard) {
        throw new Error(`Card ${cardId} not found`);
      }

      // Get user
      const user = await this.db('users')
        .where({ id: existingCard.user_id })
        .first();

      // Get user identifier
      let userIdentifier = existingCard.user_id;
      if (user.role === 'student') {
        const student = await this.db('students')
          .where({ user_id: existingCard.user_id })
          .first();
        userIdentifier = student?.student_id || existingCard.user_id;
      } else if (user.role === 'teacher') {
        const teacher = await this.db('teachers')
          .where({ user_id: existingCard.user_id })
          .first();
        userIdentifier = teacher?.teacher_id || existingCard.user_id;
      }

      // Get template
      const template = await this.templateService.getTemplateById(
        existingCard.template_id
      );

      // Get QR code
      const qrCode = await this.db('qr_codes')
        .where({ card_id: cardId })
        .orderBy('created_at', 'desc')
        .first();

      // Get barcode
      const barcodeData = await this.barcodeService.generateBarcode(userIdentifier);

      // Regenerate PDF
      const pdfBuffer = await this.generateCardPDF(
        user,
        userIdentifier,
        existingCard,
        template,
        {
          qrCodeId: qrCode.id,
          content: qrCode.content,
          imageDataUrl: qrCode.image_url,
          securityHash: qrCode.security_hash,
        },
        barcodeData,
        existingCard.tenant_id
      );

      // Save new PDF
      const pdfUrl = await this.savePDF(pdfBuffer, cardId, existingCard.tenant_id);

      // Update card with new PDF URL
      await this.db('id_cards')
        .where({ id: cardId })
        .update({
          pdf_url: pdfUrl,
          updated_at: new Date(),
        });

      // Log regeneration
      await this.db('card_audit_log').insert({
        card_id: cardId,
        action: 'regenerated',
        performed_by: existingCard.issued_by,
        reason: 'Card regenerated',
        performed_at: new Date(),
      });

      logger.info(`Regenerated card ${cardId}`);

      return {
        cardId,
        userId: existingCard.user_id,
        cardNumber: existingCard.card_number,
        qrCode: qrCode.content,
        barcode: barcodeData.content,
        pdfUrl,
        issuedAt: existingCard.issued_at,
        expiresAt: existingCard.expires_at,
      };
    } catch (error) {
      logger.error('Failed to regenerate card', { cardId, error });
      throw error;
    }
  }

  /**
   * Get card by ID
   */
  async getCardById(cardId: string): Promise<Card> {
    try {
      const card = await this.db('id_cards')
        .where({ id: cardId })
        .first();

      if (!card) {
        throw new Error(`Card ${cardId} not found`);
      }

      return this.mapCardFromDb(card);
    } catch (error) {
      logger.error('Failed to get card', { cardId, error });
      throw error;
    }
  }

  /**
   * Get all cards for a user
   */
  async getCardsByUserId(userId: string): Promise<Card[]> {
    try {
      const cards = await this.db('id_cards')
        .where({ user_id: userId })
        .orderBy('issued_at', 'desc');

      return cards.map((c: any) => this.mapCardFromDb(c));
    } catch (error) {
      logger.error('Failed to get cards for user', { userId, error });
      throw error;
    }
  }

  /**
   * Preview card before generation
   * Requirements: 11.4
   */
  async previewCard(
    userId: string,
    tenantId: string,
    templateId: string
  ): Promise<Buffer> {
    try {
      // Get user
      const user = await this.db('users')
        .where({ id: userId, tenant_id: tenantId })
        .first();

      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Get template
      const template = await this.templateService.getTemplateById(templateId);

      // Create mock card data for preview
      const mockCard = {
        card_number: 'PREVIEW-001',
        format: template.format,
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      };

      // Generate mock QR code
      const mockQrData = {
        qrCodeId: 'preview',
        content: 'PREVIEW QR CODE',
        imageDataUrl: 'data:image/png;base64,...', // Placeholder
        securityHash: 'preview-hash',
      };

      // Generate mock barcode
      let userIdentifier = userId;
      if (user.role === 'student') {
        const student = await this.db('students').where({ user_id: userId }).first();
        userIdentifier = student?.student_id || userId;
      } else if (user.role === 'teacher') {
        const teacher = await this.db('teachers').where({ user_id: userId }).first();
        userIdentifier = teacher?.teacher_id || userId;
      }

      const mockBarcodeData = await this.barcodeService.generateBarcode(userIdentifier);

      // Generate PDF
      const pdfBuffer = await this.generateCardPDF(
        user,
        userIdentifier,
        mockCard,
        template,
        mockQrData,
        mockBarcodeData,
        tenantId
      );

      logger.info(`Generated preview for user ${userId} with template ${templateId}`);

      return pdfBuffer;
    } catch (error) {
      logger.error('Failed to generate preview', { userId, templateId, error });
      throw error;
    }
  }

  /**
   * Generate card PDF
   * Requirements: 1.1, 1.4, 1.5, 1.6
   */
  private async generateCardPDF(
    user: any,
    userIdentifier: string,
    card: any,
    template: any,
    qrCodeData: any,
    barcodeData: any,
    tenantId: string
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        // Determine card dimensions
        const dimensions =
          card.format === 'pvc'
            ? { width: 243, height: 153 } // 85.6mm x 53.98mm at 72 DPI
            : { width: 288, height: 432 }; // 4" x 6" at 72 DPI

        const doc = new PDFDocument({
          size: [dimensions.width, dimensions.height],
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Apply background color
        doc
          .rect(0, 0, dimensions.width, dimensions.height)
          .fill(template.config.backgroundColor);

        // Add school logo (if available)
        if (template.logoUrl) {
          // In real implementation, load and draw the logo
          // doc.image(logoPath, x, y, { width, height });
        }

        // Set text color
        doc.fillColor(template.config.textColor);

        // Add user photo or placeholder
        const photoY = template.config.layoutConfig.photoPosition.y;
        const photoX = template.config.layoutConfig.photoPosition.x;
        
        if (user.photo_url) {
          // In real implementation, load and draw the photo
          // doc.image(photoPath, photoX, photoY, { width, height });
        } else {
          // Draw placeholder
          doc
            .rect(photoX, photoY, 60, 80)
            .stroke('#cccccc');
          doc
            .fontSize(8)
            .text('No Photo', photoX, photoY + 35, { width: 60, align: 'center' });
        }

        // Add user name
        const userName = `${user.first_name} ${user.last_name}`;
        doc
          .fontSize(template.config.fontSize || 12)
          .font('Helvetica-Bold')
          .text(
            userName,
            template.config.layoutConfig.namePosition.x,
            template.config.layoutConfig.namePosition.y,
            { width: 150 }
          );

        // Add role
        doc
          .fontSize((template.config.fontSize || 12) - 2)
          .font('Helvetica')
          .text(
            user.role.toUpperCase(),
            template.config.layoutConfig.rolePosition.x,
            template.config.layoutConfig.rolePosition.y
          );

        // Add ID number
        doc
          .fontSize((template.config.fontSize || 12) - 2)
          .text(
            `ID: ${userIdentifier}`,
            template.config.layoutConfig.idPosition.x,
            template.config.layoutConfig.idPosition.y
          );

        // Add card number
        doc
          .fontSize(8)
          .text(
            `Card #: ${card.card_number}`,
            10,
            dimensions.height - 20
          );

        // Add QR code (if available as data URL)
        if (qrCodeData.imageDataUrl) {
          // In real implementation, decode base64 and draw QR code image
          // const qrBuffer = Buffer.from(qrCodeData.imageDataUrl.split(',')[1], 'base64');
          // doc.image(qrBuffer, qrX, qrY, { width: qrSize });
        }

        // Add barcode placeholder
        doc
          .fontSize(8)
          .text(
            barcodeData.content,
            template.config.layoutConfig.barcodePosition.x,
            template.config.layoutConfig.barcodePosition.y,
            { width: 100, align: 'center' }
          );

        // Add expiration date
        const expiresText = `Expires: ${new Date(card.expires_at).toLocaleDateString()}`;
        doc
          .fontSize(7)
          .text(expiresText, dimensions.width - 80, dimensions.height - 15);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate unique card number
   */
  private generateCardNumber(tenantId: string): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `CARD-${timestamp}-${random}`;
  }

  /**
   * Save PDF to storage
   */
  private async savePDF(
    pdfBuffer: Buffer,
    cardId: string,
    tenantId: string
  ): Promise<string> {
    // In real implementation, upload to S3 or local storage
    // For now, return a placeholder URL
    const pdfUrl = `/uploads/cards/${tenantId}/${cardId}.pdf`;
    logger.info(`PDF saved for card ${cardId}`, { pdfUrl });
    return pdfUrl;
  }

  /**
   * Map database row to Card object
   */
  private mapCardFromDb(row: any): Card {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      templateId: row.template_id,
      cardNumber: row.card_number,
      format: row.format,
      status: row.status,
      pdfUrl: row.pdf_url,
      issuedAt: new Date(row.issued_at),
      expiresAt: new Date(row.expires_at),
      issuedBy: row.issued_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
