import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
    }
  }
}

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const reqId = (req.headers['x-request-id'] as string) || `req_${crypto.randomBytes(8).toString('hex')}`;
  req.requestId = reqId;
  req.startTime = Date.now();
  res.setHeader('X-Request-ID', reqId);
  next();
}
