import { Knex } from 'knex';
import PDFDocument from 'pdfkit';
import { logger } from '../utils/logger.js';
import { QrCodeService } from './qrCodeService.js';
import { BarcodeService } from './barcodeService.js';
import { TemplateService } from './templateService.js';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

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
  /** Public origin for the QR verification URL (e.g. https://app.example.com). */
  baseUrl?: string;
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

      // Retrieve user information (checking both users table and students table)
      let user = await this.db('users')
        .where({ id: userId, tenant_id: tenantId })
        .first();

      if (!user) {
        const student = await this.db('students')
          .where({ id: userId, tenant_id: tenantId })
          .first();

        if (student) {
          if (student.user_id) {
            user = await this.db('users').where({ id: student.user_id }).first();
            if (user) userId = student.user_id;
          }
          if (!user) {
            user = {
              id: student.id,
              first_name: student.first_name,
              last_name: student.last_name,
              role: 'student',
              photo_url: student.photo_url,
              tenant_id: tenantId,
            } as any;
          }
        }
      }

      if (!user) {
        throw new Error(`User or Student ${userId} not found for tenant ${tenantId}`);
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
          user.role as any,
          options.format
        );
      }

      // Calculate expiration date. Defaults to 1 year from issue when not
      // supplied. The DB enforces expires_at > issued_at, so we normalise any
      // provided date and guarantee it is strictly after issue (fall back to
      // +1 year if the caller passes a today/past/invalid expiry).
      const issuedAt = new Date();
      let expiresAt: Date;
      const provided = options.expirationDate ? new Date(options.expirationDate) : null;
      if (provided && !isNaN(provided.getTime()) && provided.getTime() > issuedAt.getTime()) {
        expiresAt = provided;
      } else {
        expiresAt = new Date(issuedAt);
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      }

      // Generate card UUID & unique card number
      const cardId = crypto.randomUUID();
      const cardNumber = this.generateCardNumber(tenantId);

      // Create card record first
      const [card] = await this.db('id_cards')
        .insert({
          id: cardId,
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

      const createdCard = card || { id: cardId };

      // Generate QR code associated directly with cardId
      const qrCodeData = await this.qrCodeService.generateQrCode(
        userId,
        tenantId,
        expiresAt,
        createdCard.id,
        options.baseUrl
      );

      // Generate barcode
      const barcodeData = await this.barcodeService.generateBarcode(userIdentifier);

      // Ensure QR code link
      await this.db('qr_codes')
        .where({ id: qrCodeData.qrCodeId })
        .update({ card_id: createdCard.id })
        .catch(() => {});

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
  async regenerateCard(cardId: string, baseUrl?: string): Promise<CardResult> {
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

      // Invalidate any old QR codes and generate a FRESH one so regenerating a
      // card produces the current scannable short-URL QR (old cards may carry
      // legacy JSON / localhost QRs that never scan). Uses the request origin.
      await this.qrCodeService.invalidateQrCodesByCardId(cardId).catch(() => {});
      const qrCodeData = await this.qrCodeService.generateQrCode(
        existingCard.user_id,
        existingCard.tenant_id,
        new Date(existingCard.expires_at),
        cardId,
        baseUrl,
      );

      // Get barcode
      const barcodeData = await this.barcodeService.generateBarcode(userIdentifier);

      // Regenerate PDF with the fresh QR
      const pdfBuffer = await this.generateCardPDF(
        user,
        userIdentifier,
        existingCard,
        template,
        qrCodeData,
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

  async getCardById(cardId: string): Promise<any> {
    try {
      const card = await this.db('id_cards')
        .select(
          'id_cards.*',
          this.db.raw("COALESCE(users.first_name, students.first_name, 'Member') as first_name"),
          this.db.raw("COALESCE(users.last_name, students.last_name, '') as last_name"),
          this.db.raw("COALESCE(users.email, '') as email"),
          this.db.raw("COALESCE(users.role, 'student') as user_role"),
          this.db.raw("COALESCE(students.photo_url, users.photo_url, NULL) as photo_url"),
          'students.date_of_birth as student_dob',
          'students.student_id as student_reg_id',
          'classes.level as student_grade',
          'classes.name as class_name',
          'teachers.teacher_id as teacher_code',
          'teachers.department as teacher_department',
          'card_templates.name as template_name',
          'card_templates.config as template_config',
          'card_templates.logo_url as template_logo_url',
          'qr.image_url as qr_image_url'
        )
        .leftJoin('students', function () {
          this.on('students.user_id', '=', 'id_cards.user_id')
            .orOn('students.id', '=', 'id_cards.user_id');
        })
        .leftJoin('users', function () {
          this.on('users.id', '=', 'id_cards.user_id')
            .orOn('users.id', '=', 'students.user_id');
        })
        .leftJoin('enrollments', 'enrollments.student_id', 'students.id')
        .leftJoin('classes', 'classes.id', 'enrollments.class_id')
        .leftJoin('teachers', function () {
          this.on('teachers.user_id', '=', 'id_cards.user_id')
            .orOn('teachers.id', '=', 'id_cards.user_id');
        })
        .leftJoin('card_templates', 'card_templates.id', 'id_cards.template_id')
        // Newest scannable QR image for this card (base64 data-URL).
        .leftJoin(
          this.db('qr_codes')
            .distinctOn('card_id')
            .select('card_id', 'image_url')
            .whereNotNull('card_id')
            .orderBy([{ column: 'card_id' }, { column: 'created_at', order: 'desc' }])
            .as('qr'),
          'qr.card_id', 'id_cards.id',
        )
        .where('id_cards.id', cardId)
        .first();

      if (!card) {
        throw new Error(`Card ${cardId} not found`);
      }

      return {
        id: card.id,
        tenantId: card.tenant_id,
        userId: card.user_id,
        templateId: card.template_id,
        cardNumber: card.card_number,
        format: card.format,
        status: card.status,
        pdfUrl: card.pdf_url,
        issuedAt: card.issued_at,
        expiresAt: card.expires_at,
        issuedBy: card.issued_by,
        createdAt: card.created_at,
        updatedAt: card.updated_at,
        user: {
          id: card.user_id,
          firstName: card.first_name || 'Member',
          lastName: card.last_name || '',
          email: card.email || '',
          role: card.user_role || 'student',
          photoUrl: card.photo_url || null,
          dob: card.student_dob || null,
          memberId: card.student_reg_id || card.teacher_code || card.card_number,
          departmentOrGrade: card.class_name || card.student_grade || card.teacher_department || null,
        },
        qrImageUrl: card.qr_image_url || null,
        template: {
          name: card.template_name || 'Unknown',
          config: card.template_config || {},
          logoUrl: card.template_logo_url || null,
        }
      };
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
    return new Promise(async (resolve, reject) => {
      try {
        // Fetch student details for DOB and Grade/Department
        let dobValue = '';
        let departmentOrGradeValue = '';

        if (user.role === 'student') {
          const student = await this.db('students').where({ user_id: user.id }).first();
          if (student) {
            dobValue = student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : '';
            const enrollment = await this.db('enrollments').where({ student_id: student.id }).first();
            if (enrollment) {
              const cls = await this.db('classes').where({ id: enrollment.class_id }).first();
              if (cls) {
                departmentOrGradeValue = cls.name || cls.level || '';
              }
            }
          }
        } else if (user.role === 'teacher') {
          const teacher = await this.db('teachers').where({ user_id: user.id }).first();
          if (teacher) {
            departmentOrGradeValue = teacher.department || '';
          }
        }

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

        // Conversion helper from mm to points (72 DPI). Guard against
        // undefined/NaN coordinates from incomplete template configs — a single
        // bad value must never abort the whole PDF ("unsupported number: NaN").
        const mmToPt = (mm: number) => {
          const n = Number(mm);
          return Number.isFinite(n) ? n * (72 / 25.4) : 0;
        };

        const fontName = template.config.fontFamily === 'Times-Roman' ? 'Times-Roman'
                        : template.config.fontFamily === 'Courier' ? 'Courier'
                        : 'Helvetica';

        // Extractor helpers for element configs, supporting side setting fallbacks
        const photoConf = template.config.layoutConfig?.photoPosition || { x: 5, y: 12, width: 25, height: 30, side: 'front' };
        const nameConf = template.config.layoutConfig?.namePosition || { x: 34, y: 14, side: 'front' };
        const roleConf = template.config.layoutConfig?.rolePosition || { x: 34, y: 24, side: 'front' };
        const idConf = template.config.layoutConfig?.idPosition || { x: 34, y: 31, side: 'front' };
        const qrConf = template.config.layoutConfig?.qrCodePosition || { x: 64, y: 14, size: 16, side: 'back' };
        // Templates may omit an explicit QR size — always fall back to a sane value.
        const qrSize = Number.isFinite(Number(qrConf.size)) && Number(qrConf.size) > 0 ? Number(qrConf.size) : 16;
        const barcodeConf = template.config.layoutConfig?.barcodePosition || { x: 34, y: 38, side: 'back' };

        const titleConf = template.config.layoutConfig?.titlePosition || {
          x: nameConf.x,
          y: nameConf.y + (card.format === 'badge' ? 6 : 5.5),
          side: nameConf.side || 'front',
        };

        const logoConf = template.config.layoutConfig?.logoPositionConfig || { x: 4, y: 3.5, side: 'front' };
        const schoolNameConf = template.config.layoutConfig?.schoolNamePosition || { x: 15, y: 4, side: 'front' };

        const idLabel = template.config.idLabel || 'ID NO';
        const dobLabel = template.config.dobLabel || 'D.O.B';
        const gradeLabel = template.config.gradeLabel || 'GRADE';
        const expiryLabel = template.config.expiryLabel || 'EXPIRES';

        const logoUrl = template.logoUrl || template.config?.logoUrl;
        const schoolNameText = template.config?.customSchoolName || 'GINYARD ACADEMY';

        const vf = {
          showName: template.config.visibleFields?.showName !== false,
          showTitle: template.config.visibleFields?.showTitle !== false,
          showRole: template.config.visibleFields?.showRole !== false,
          showId: template.config.visibleFields?.showId !== false,
          showDob: template.config.visibleFields?.showDob !== false,
          showGrade: template.config.visibleFields?.showGrade !== false,
          showExpiry: template.config.visibleFields?.showExpiry !== false,
          showSchoolName: template.config.visibleFields?.showSchoolName !== false,
          showLogo: template.config.visibleFields?.showLogo !== false,
        };

        const isOnSide = (conf: any, defaultSide: 'front' | 'back', currentSide: 'front' | 'back') => {
          const side = conf.side || defaultSide;
          return side === currentSide;
        };

        // ── PAGE 1: FRONT SIDE ──
        // Apply background color
        doc
          .rect(0, 0, dimensions.width, dimensions.height)
          .fill(template.config.backgroundColor || '#FFFFFF');

        // Set text color
        doc.fillColor(template.config.textColor || '#0F172A');

        // Front School branding / Logo
        if (vf.showLogo && isOnSide(logoConf, 'front', 'front') && logoUrl && logoUrl.startsWith('data:image/')) {
          try {
            const base64Data = logoUrl.split(',')[1];
            if (base64Data) {
              const logoBuffer = Buffer.from(base64Data, 'base64');
              doc.image(logoBuffer, mmToPt(logoConf.x), mmToPt(logoConf.y), { height: mmToPt(8) });
            }
          } catch (logoErr) {
            logger.error('Failed to draw logo on front PDF', logoErr);
          }
        }

        // Front School Name
        if (vf.showSchoolName && isOnSide(schoolNameConf, 'front', 'front')) {
          doc
            .fontSize(template.config.fontSize || 10)
            .font(`${fontName}-Bold`)
            .text(schoolNameText, mmToPt(schoolNameConf.x), mmToPt(schoolNameConf.y));
        }

        // Helper to get PDF path based on shape
        const getPhotoPath = (x: number, y: number, w: number, h: number, shape: string) => {
          if (shape === 'circle' || shape === 'rounded') {
            const r = Math.min(w, h) / 2;
            const cx = x + w / 2;
            const cy = y + h / 2;
            doc.circle(cx, cy, r);
          } else if (shape === 'arch') {
            const r = w / 2;
            doc.moveTo(x, y + h)
              .lineTo(x, y + r)
              .arc(x + r, y + r, r, Math.PI, 2 * Math.PI, false)
              .lineTo(x + w, y + h)
              .closePath();
          } else if (shape === 'hexagon') {
            const cx = x + w / 2;
            const cy = y + h / 2;
            const r = Math.min(w, h) / 2;
            doc.moveTo(cx, cy - r);
            for (let i = 1; i <= 6; i++) {
              const angle = (i * Math.PI) / 3 - Math.PI / 2;
              doc.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
            }
            doc.closePath();
          } else {
            doc.rect(x, y, w, h);
          }
        };

        const photoBorderWidth = template.config.photoBorderWidth !== undefined ? template.config.photoBorderWidth : 2;
        const photoBorderColor = template.config.photoBorderColor || template.config.primaryColor || '#cccccc';

        // Draw Photo if on front
        if (isOnSide(photoConf, 'front', 'front')) {
          const isCircleOrRounded = template.config.photoShape === 'circle' || template.config.photoShape === 'rounded';
          const rawW = mmToPt(photoConf.width || 25);
          const rawH = mmToPt(photoConf.height || 30);
          const photoW = isCircleOrRounded ? Math.min(rawW, rawH) : rawW;
          const photoH = isCircleOrRounded ? Math.min(rawW, rawH) : rawH;
          const photoX = isCircleOrRounded ? mmToPt(photoConf.x) + (rawW - photoW) / 2 : mmToPt(photoConf.x);
          const photoY = isCircleOrRounded ? mmToPt(photoConf.y) + (rawH - photoH) / 2 : mmToPt(photoConf.y);
          
          if (user.photo_url && user.photo_url.startsWith('data:image/')) {
            try {
              const base64Data = user.photo_url.split(',')[1];
              if (base64Data) {
                const photoBuffer = Buffer.from(base64Data, 'base64');
                
                // Draw clipped image
                doc.save();
                getPhotoPath(photoX, photoY, photoW, photoH, template.config.photoShape || 'circle');
                doc.clip();
                doc.image(photoBuffer, photoX, photoY, { width: photoW, height: photoH });
                doc.restore();

                // Draw border over clipped path
                if (photoBorderWidth > 0) {
                  doc.save();
                  getPhotoPath(photoX, photoY, photoW, photoH, template.config.photoShape || 'circle');
                  doc
                    .lineWidth(photoBorderWidth)
                    .stroke(photoBorderColor);
                  doc.restore();
                }
              }
            } catch (photoErr) {
              doc.rect(photoX, photoY, photoW, photoH).stroke('#cccccc');
              doc.fontSize(6).text('Photo Error', photoX, photoY + photoH / 2 - 3, { width: photoW, align: 'center' });
            }
          } else {
            doc.save();
            getPhotoPath(photoX, photoY, photoW, photoH, template.config.photoShape || 'circle');
            doc.stroke('#cccccc');
            doc.restore();
            doc.fontSize(7).text('No Photo', photoX, photoY + photoH / 2 - 3, { width: photoW, align: 'center' });
          }
        }

        // Draw Name if on front
        if (vf.showName && isOnSide(nameConf, 'front', 'front')) {
          const userName = `${user.first_name} ${user.last_name}`;
          doc
            .fontSize(template.config.fontSize || 12)
            .font(`${fontName}-Bold`)
            .text(userName, mmToPt(nameConf.x), mmToPt(nameConf.y), { width: mmToPt(50) });
        }

        // Draw Card Title if on front
        if (vf.showTitle && isOnSide(titleConf, 'front', 'front')) {
          const cardTitleText = template.config.cardTitle || (user.role === 'student' ? 'STUDENT ID CARD' : 'IDENTIFICATION CARD');
          doc
            .fontSize((template.config.fontSize || 12) - 2)
            .font(`${fontName}-Bold`)
            .text(cardTitleText, mmToPt(titleConf.x), mmToPt(titleConf.y));
        }

        // Draw Role if on front
        if (vf.showRole && isOnSide(roleConf, 'front', 'front')) {
          doc
            .fontSize((template.config.fontSize || 12) - 2)
            .font(fontName)
            .text(user.role.toUpperCase(), mmToPt(roleConf.x), mmToPt(roleConf.y));
        }

        // Draw Details Table on front
        let currentYFront = idConf.y;
        const yStepFront = 3.5;

        if (vf.showId && isOnSide(idConf, 'front', 'front')) {
          doc
            .fontSize((template.config.fontSize || 12) - 3)
            .font(fontName)
            .text(`${idLabel}: ${userIdentifier}`, mmToPt(idConf.x), mmToPt(currentYFront));
          currentYFront += yStepFront;
        }

        if (vf.showDob && dobValue && isOnSide(idConf, 'front', 'front')) {
          doc
            .fontSize((template.config.fontSize || 12) - 3)
            .font(fontName)
            .text(`${dobLabel}: ${dobValue}`, mmToPt(idConf.x), mmToPt(currentYFront));
          currentYFront += yStepFront;
        }

        if (vf.showGrade && departmentOrGradeValue && isOnSide(idConf, 'front', 'front')) {
          doc
            .fontSize((template.config.fontSize || 12) - 3)
            .font(fontName)
            .text(`${gradeLabel}: ${departmentOrGradeValue}`, mmToPt(idConf.x), mmToPt(currentYFront));
          currentYFront += yStepFront;
        }

        if (vf.showExpiry && isOnSide(idConf, 'front', 'front')) {
          doc
            .fontSize((template.config.fontSize || 12) - 3)
            .font(fontName)
            .text(`${expiryLabel}: ${new Date(card.expires_at).toLocaleDateString()}`, mmToPt(idConf.x), mmToPt(currentYFront));
        }

        // Draw QR Code if on front
        if (isOnSide(qrConf, 'back', 'front') && qrCodeData.imageDataUrl && qrCodeData.imageDataUrl.startsWith('data:image/')) {
          try {
            const base64Data = qrCodeData.imageDataUrl.split(',')[1];
            if (base64Data) {
              const qrBuffer = Buffer.from(base64Data, 'base64');
              doc.image(qrBuffer, mmToPt(qrConf.x), mmToPt(qrConf.y), { width: mmToPt(qrSize) });
            }
          } catch (qrErr) {
            logger.error('Failed to draw QR code on front', qrErr);
          }
        }

        // Draw Barcode if on front
        if (isOnSide(barcodeConf, 'back', 'front')) {
          doc
            .fontSize(7)
            .font(fontName)
            .text(barcodeData.content, mmToPt(barcodeConf.x), mmToPt(barcodeConf.y), { width: mmToPt(35), align: 'center' });
        }

        // Card number at bottom left of front page
        doc
          .fontSize(6)
          .font(fontName)
          .text(`Card #: ${card.card_number}`, 10, dimensions.height - 12);


        // ── PAGE 2: BACK SIDE (only for double-sided templates) ──
        const isDoubleSided = template.config?.printSides === 'double';
        if (isDoubleSided) {
        doc.addPage({
          size: [dimensions.width, dimensions.height],
          margins: { top: 0, bottom: 0, left: 0, right: 0 }
        });

        // Apply background color to back side
        doc
          .rect(0, 0, dimensions.width, dimensions.height)
          .fill(template.config.backgroundColor || '#FFFFFF');

        // Set text color
        doc.fillColor(template.config.textColor || '#0F172A');

        // Back School branding / Logo
        if (vf.showLogo && isOnSide(logoConf, 'front', 'back') && logoUrl && logoUrl.startsWith('data:image/')) {
          try {
            const base64Data = logoUrl.split(',')[1];
            if (base64Data) {
              const logoBuffer = Buffer.from(base64Data, 'base64');
              doc.image(logoBuffer, mmToPt(logoConf.x), mmToPt(logoConf.y), { height: mmToPt(8) });
            }
          } catch (logoErr) {
            logger.error('Failed to draw logo on back PDF', logoErr);
          }
        }

        // Back School Name
        if (vf.showSchoolName && isOnSide(schoolNameConf, 'front', 'back')) {
          doc
            .fontSize(template.config.fontSize || 10)
            .font(`${fontName}-Bold`)
            .text(schoolNameText, mmToPt(schoolNameConf.x), mmToPt(schoolNameConf.y));
        }

        // Draw Photo if on back
        if (isOnSide(photoConf, 'front', 'back')) {
          const isCircleOrRounded = template.config.photoShape === 'circle' || template.config.photoShape === 'rounded';
          const rawW = mmToPt(photoConf.width || 25);
          const rawH = mmToPt(photoConf.height || 30);
          const photoW = isCircleOrRounded ? Math.min(rawW, rawH) : rawW;
          const photoH = isCircleOrRounded ? Math.min(rawW, rawH) : rawH;
          const photoX = isCircleOrRounded ? mmToPt(photoConf.x) + (rawW - photoW) / 2 : mmToPt(photoConf.x);
          const photoY = isCircleOrRounded ? mmToPt(photoConf.y) + (rawH - photoH) / 2 : mmToPt(photoConf.y);
          
          if (user.photo_url && user.photo_url.startsWith('data:image/')) {
            try {
              const base64Data = user.photo_url.split(',')[1];
              if (base64Data) {
                const photoBuffer = Buffer.from(base64Data, 'base64');
                
                // Draw clipped image
                doc.save();
                getPhotoPath(photoX, photoY, photoW, photoH, template.config.photoShape || 'circle');
                doc.clip();
                doc.image(photoBuffer, photoX, photoY, { width: photoW, height: photoH });
                doc.restore();

                // Draw border over clipped path
                if (photoBorderWidth > 0) {
                  doc.save();
                  getPhotoPath(photoX, photoY, photoW, photoH, template.config.photoShape || 'circle');
                  doc
                    .lineWidth(photoBorderWidth)
                    .stroke(photoBorderColor);
                  doc.restore();
                }
              }
            } catch (photoErr) {
              doc.rect(photoX, photoY, photoW, photoH).stroke('#cccccc');
              doc.fontSize(6).text('Photo Error', photoX, photoY + photoH / 2 - 3, { width: photoW, align: 'center' });
            }
          } else {
            doc.save();
            getPhotoPath(photoX, photoY, photoW, photoH, template.config.photoShape || 'circle');
            doc.stroke('#cccccc');
            doc.restore();
            doc.fontSize(7).text('No Photo', photoX, photoY + photoH / 2 - 3, { width: photoW, align: 'center' });
          }
        }

        // Draw Name if on back
        if (vf.showName && isOnSide(nameConf, 'front', 'back')) {
          const userName = `${user.first_name} ${user.last_name}`;
          doc
            .fontSize(template.config.fontSize || 12)
            .font(`${fontName}-Bold`)
            .text(userName, mmToPt(nameConf.x), mmToPt(nameConf.y), { width: mmToPt(50) });
        }

        // Draw Card Title if on back
        if (vf.showTitle && isOnSide(titleConf, 'front', 'back')) {
          const cardTitleText = template.config.cardTitle || (user.role === 'student' ? 'STUDENT ID CARD' : 'IDENTIFICATION CARD');
          doc
            .fontSize((template.config.fontSize || 12) - 2)
            .font(`${fontName}-Bold`)
            .text(cardTitleText, mmToPt(titleConf.x), mmToPt(titleConf.y));
        }

        // Draw Role if on back
        if (vf.showRole && isOnSide(roleConf, 'front', 'back')) {
          doc
            .fontSize((template.config.fontSize || 12) - 2)
            .font(fontName)
            .text(user.role.toUpperCase(), mmToPt(roleConf.x), mmToPt(roleConf.y));
        }

        // Draw Details Table on back
        let currentYBack = idConf.y;
        const yStepBack = 3.5;

        if (vf.showId && isOnSide(idConf, 'front', 'back')) {
          doc
            .fontSize((template.config.fontSize || 12) - 3)
            .font(fontName)
            .text(`${idLabel}: ${userIdentifier}`, mmToPt(idConf.x), mmToPt(currentYBack));
          currentYBack += yStepBack;
        }

        if (vf.showDob && dobValue && isOnSide(idConf, 'front', 'back')) {
          doc
            .fontSize((template.config.fontSize || 12) - 3)
            .font(fontName)
            .text(`${dobLabel}: ${dobValue}`, mmToPt(idConf.x), mmToPt(currentYBack));
          currentYBack += yStepBack;
        }

        if (vf.showGrade && departmentOrGradeValue && isOnSide(idConf, 'front', 'back')) {
          doc
            .fontSize((template.config.fontSize || 12) - 3)
            .font(fontName)
            .text(`${gradeLabel}: ${departmentOrGradeValue}`, mmToPt(idConf.x), mmToPt(currentYBack));
          currentYBack += yStepBack;
        }

        if (vf.showExpiry && isOnSide(idConf, 'front', 'back')) {
          doc
            .fontSize((template.config.fontSize || 12) - 3)
            .font(fontName)
            .text(`${expiryLabel}: ${new Date(card.expires_at).toLocaleDateString()}`, mmToPt(idConf.x), mmToPt(currentYBack));
        }

        // Draw QR Code if on back
        if (isOnSide(qrConf, 'back', 'back') && qrCodeData.imageDataUrl && qrCodeData.imageDataUrl.startsWith('data:image/')) {
          try {
            const base64Data = qrCodeData.imageDataUrl.split(',')[1];
            if (base64Data) {
              const qrBuffer = Buffer.from(base64Data, 'base64');
              doc.image(qrBuffer, mmToPt(qrConf.x), mmToPt(qrConf.y), { width: mmToPt(qrSize) });
            }
          } catch (qrErr) {
            logger.error('Failed to draw QR code on back', qrErr);
          }
        }

        // Draw Barcode if on back
        if (isOnSide(barcodeConf, 'back', 'back')) {
          doc
            .fontSize(7)
            .font(fontName)
            .text(barcodeData.content, mmToPt(barcodeConf.x), mmToPt(barcodeConf.y), { width: mmToPt(35), align: 'center' });
        }

        // Terms and Conditions text block at the bottom of the reverse page
        const termsY = dimensions.height - (card.format === 'pvc' ? 45 : 85);
        const termsW = dimensions.width - 24;
        doc
          .fontSize(5)
          .font(fontName)
          .text(
            "TERMS AND CONDITIONS\nThis card is the property of the issuing institution. It is non-transferable and must be presented upon request. If found, please return to the administration office.",
            12,
            termsY,
            { width: termsW, align: 'center', lineGap: 1 }
          );

        // Expiration date at bottom right of reverse page
        const expiresText = `Expires: ${new Date(card.expires_at).toLocaleDateString()}`;
        doc
          .fontSize(6)
          .font(fontName)
          .text(expiresText, dimensions.width - 80, dimensions.height - 12, { align: 'right', width: 70 });
        } // end double-sided back page

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
    try {
      const storageDir = process.env.LOCAL_STORAGE_PATH || './storage';
      const targetDir = path.join(storageDir, 'uploads', 'cards', tenantId);
      
      // Ensure directory exists
      await fs.mkdir(targetDir, { recursive: true });
      
      const filePath = path.join(targetDir, `${cardId}.pdf`);
      await fs.writeFile(filePath, pdfBuffer);

      const pdfUrl = `/storage/uploads/cards/${tenantId}/${cardId}.pdf`;
      logger.info(`PDF saved successfully for card ${cardId} to ${filePath}`, { pdfUrl });
      return pdfUrl;
    } catch (err) {
      logger.error(`Failed to save PDF locally for card ${cardId}`, err);
      return `/storage/uploads/cards/${tenantId}/${cardId}.pdf`;
    }
  }

  async deleteCard(cardId: string): Promise<void> {
    try {
      const card = await this.db('id_cards').where({ id: cardId }).first();
      if (!card) {
        throw new Error(`Card ${cardId} not found`);
      }

      // Delete QR codes referencing this card
      await this.db('qr_codes').where({ card_id: cardId }).delete().catch(() => {});

      // Delete card audit logs
      await this.db('card_audit_log').where({ card_id: cardId }).delete().catch(() => {});

      // Delete the actual card
      await this.db('id_cards').where({ id: cardId }).delete();

      logger.info(`Deleted ID card ${cardId}`);
    } catch (error) {
      logger.error('Failed to delete card', { cardId, error });
      throw error;
    }
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
