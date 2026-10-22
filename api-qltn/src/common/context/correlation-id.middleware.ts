import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { RequestContext } from './request-context';

export const CORRELATION_HEADER = 'x-correlation-id';

/** Accept a caller-supplied id only when it is short and made of safe characters. */
const SAFE_ID = /^[A-Za-z0-9._-]{8,100}$/;

/** Gives every request a correlation id (reused from the header when valid) and echoes it back. */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(CORRELATION_HEADER);
  const correlationId = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  RequestContext.run({ correlationId }, next);
}
