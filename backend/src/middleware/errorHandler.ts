import { Request, Response, NextFunction } from 'express';
import { logger } from '@utils/logger';

export interface ApiError extends Error {
  status?: number;
  code?: string;
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || 'INTERNAL_ERROR';

  // Always log the real message server-side.
  logger.error(`[${status}] ${code}: ${message}`);

  // In production never echo internal (5xx) error text to the client — it can
  // leak SQL, file paths or provider details. 4xx AppError messages are
  // deliberate, user-facing text and are kept. The code is always kept.
  const clientMessage =
    status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Something went wrong. Please try again.'
      : message;

  res.status(status).json({
    error: {
      status,
      code,
      message: clientMessage,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    },
  });
};

export class AppError extends Error implements ApiError {
  status: number;
  code: string;

  constructor(message: string, status: number = 500, code: string = 'ERROR') {
    super(message);
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
