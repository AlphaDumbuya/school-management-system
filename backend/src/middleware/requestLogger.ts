import { Request, Response, NextFunction } from 'express';
import { logger } from '@utils/logger';

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = Date.now();

  // Log request
  logger.http(`${req.method} ${req.path}`);

  // Log response when it's sent
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const statusColor =
      status >= 500
        ? 'red'
        : status >= 400
          ? 'yellow'
          : status >= 300
            ? 'cyan'
            : 'green';

    logger.http(
      `${req.method} ${req.path} - ${status} - ${duration}ms`
    );
  });

  next();
};
