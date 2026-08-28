/**
 * Request validation middleware
 * Validates req.body / req.query / req.params against a Zod schema and
 * replaces the request property with the parsed (and coerced) value.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from './errorHandler.js';

type Source = 'body' | 'query' | 'params';

function formatZodError(error: ZodError): string {
  return error.errors
    .map((e) => {
      const path = e.path.join('.');
      return path ? `${path}: ${e.message}` : e.message;
    })
    .join('; ');
}

/**
 * Validate a request property against a schema.
 * On success, the parsed result is written back to the request.
 * On failure, responds with a 400 validation error.
 */
export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(
        new AppError(`Validation failed — ${formatZodError(result.error)}`, 400, 'VALIDATION_ERROR')
      );
    }
    // Write parsed/coerced values back so downstream handlers use clean data.
    (req as any)[source] = result.data;
    next();
  };
}

export default validate;
