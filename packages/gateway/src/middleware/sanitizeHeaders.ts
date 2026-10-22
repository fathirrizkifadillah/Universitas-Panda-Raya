import type { Request, Response, NextFunction } from 'express';

export function sanitizeHeadersMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // Always strip any client-provided X-Gateway-Secret header from inbound requests
  if (req.headers['x-gateway-secret']) {
    delete req.headers['x-gateway-secret'];
  }
  next();
}
