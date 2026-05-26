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

  logger.error(`[${status}] ${code}: ${message}`);

  res.status(status).json({
    error: {
      status,
      code,
      message,
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
