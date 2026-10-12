import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, attachUserContext } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import multer from 'multer';
import path from 'path';
import fileStorageService from '@services/fileStorageService';

const router = Router();

// ── Multer Config (in-memory: we hand the buffer to the storage service) ──────
// Files are held in memory then persisted via fileStorageService, which uses S3
// when configured and local disk otherwise. Local disk is EPHEMERAL on
// serverless (Vercel), so configure S3 in production — see docs/VERCEL_DEPLOYMENT.
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed. Accepted: JPEG, PNG, GIF, WebP, PDF, DOC, DOCX'));
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// Map a mime type to a storage folder so a tenant's files stay grouped.
function folderFor(mime: string): string {
  if (mime.startsWith('image/')) return 'photos';
  return 'documents';
}

/**
 * POST /api/v1/uploads
 * Upload a single file (photo, document, etc.). Persists via the durable
 * storage service (S3 in production) under a per-tenant folder and returns the
 * public URL. Falls back to a base64 data URL only if durable storage fails, so
 * the user is never blocked.
 */
router.post('/', authenticate, attachUserContext, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400, 'NO_FILE');
    }
    const tenantId = (req as any).user?.tenant_id || 'shared';
    const ext = path.extname(req.file.originalname) || '';

    // Local-disk storage is not shared or durable (see fileStorageService.isLocal),
    // so a stored "http://localhost:3000/storage/..." photo breaks everywhere else.
    // Keep images inline (the uploader already shrinks them to ~100 KB) and only
    // use disk for documents.
    if (fileStorageService.isLocal() && req.file.mimetype.startsWith('image/')) {
      return res.json({
        message: 'File uploaded (inline)',
        data: {
          filename: `inline${ext}`,
          originalName: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          url: `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`,
        },
      });
    }

    try {
      const result = await fileStorageService.uploadFile(req.file.buffer, {
        // Tenant-scoped folder keeps each school's uploads separate.
        folder: `tenants/${tenantId}/${folderFor(req.file.mimetype)}`,
        contentType: req.file.mimetype,
        maxSize: 5 * 1024 * 1024,
      });

      res.json({
        message: 'File uploaded successfully',
        data: {
          filename: result.filename,
          originalName: req.file.originalname,
          mimetype: result.contentType,
          size: result.size,
          url: result.url,
        },
      });
      logger.info(`File uploaded (tenant ${tenantId}): ${req.file.originalname} → ${result.url}`);
    } catch (storageErr) {
      // Durable storage unavailable/misconfigured — degrade to an inline data
      // URL so the upload still succeeds (fine for small images like logos/photos).
      logger.warn(`Durable upload failed, falling back to data URL: ${(storageErr as Error).message}`);
      const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      res.json({
        message: 'File uploaded (inline fallback)',
        data: {
          filename: `inline${ext}`,
          originalName: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          url: dataUrl,
        },
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/uploads/multiple
 * Upload multiple files (max 10)
 */
router.post('/multiple', authenticate, attachUserContext, upload.array('files', 10), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      throw new AppError('No files uploaded', 400, 'NO_FILES');
    }
    const tenantId = (req as any).user?.tenant_id || 'shared';

    const uploadedFiles = await Promise.all(files.map(async (f) => {
      if (fileStorageService.isLocal() && f.mimetype.startsWith('image/')) {
        return { filename: 'inline', originalName: f.originalname, mimetype: f.mimetype, size: f.size, url: `data:${f.mimetype};base64,${f.buffer.toString('base64')}` };
      }
      try {
        const result = await fileStorageService.uploadFile(f.buffer, {
          folder: `tenants/${tenantId}/${folderFor(f.mimetype)}`,
          contentType: f.mimetype,
          maxSize: 5 * 1024 * 1024,
        });
        return { filename: result.filename, originalName: f.originalname, mimetype: result.contentType, size: result.size, url: result.url };
      } catch {
        const dataUrl = `data:${f.mimetype};base64,${f.buffer.toString('base64')}`;
        return { filename: 'inline', originalName: f.originalname, mimetype: f.mimetype, size: f.size, url: dataUrl };
      }
    }));

    res.json({
      message: `${files.length} files uploaded successfully`,
      data: uploadedFiles,
    });

    logger.info(`${files.length} files uploaded (tenant ${tenantId})`);
  } catch (error) {
    next(error);
  }
});

// NOTE: the old GET /:filename disk-serving route was removed. Files are now
// served from their storage URL — an S3/CDN URL in production, or the
// fileStorageService local static mount (/storage) in local dev — not from an
// ephemeral per-function upload directory.

export default router;
