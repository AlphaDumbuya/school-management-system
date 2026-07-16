import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// ── Multer Config ─────────────────────────────────────────────────────────────

const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed. Accepted: JPEG, PNG, GIF, WebP, PDF, DOC, DOCX'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

/**
 * POST /api/v1/uploads
 * Upload a single file (photo, document, etc.)
 */
router.post('/', authenticate, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400, 'NO_FILE');
    }

    const fileUrl = `/api/v1/uploads/${req.file.filename}`;

    res.json({
      message: 'File uploaded successfully',
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: fileUrl,
      },
    });

    logger.info(`File uploaded: ${req.file.originalname} → ${req.file.filename}`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/uploads/multiple
 * Upload multiple files (max 10)
 */
router.post('/multiple', authenticate, upload.array('files', 10), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      throw new AppError('No files uploaded', 400, 'NO_FILES');
    }

    const uploadedFiles = files.map((f) => ({
      filename: f.filename,
      originalName: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
      url: `/api/v1/uploads/${f.filename}`,
    }));

    res.json({
      message: `${files.length} files uploaded successfully`,
      data: uploadedFiles,
    });

    logger.info(`${files.length} files uploaded`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/uploads/:filename
 * Serve an uploaded file
 */
router.get('/:filename', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(UPLOAD_DIR, filename);
    res.sendFile(filePath, (err) => {
      if (err) {
        res.status(404).json({ error: 'File not found' });
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
