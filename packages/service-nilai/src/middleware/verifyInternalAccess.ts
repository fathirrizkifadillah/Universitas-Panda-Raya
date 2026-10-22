import type { Request, Response, NextFunction } from 'express';
import { config } from '../../../shared/src/config.js';
import { safeTimingCompare, verifyToken } from '../../../shared/src/crypto.js';
import type { TokenClaims } from '../../../shared/src/types.js';

declare global {
  namespace Express {
    interface Request {
      userClaims?: TokenClaims;
    }
  }
}

export function verifyInternalAccess(req: Request, res: Response, next: NextFunction): void {
  // 1. Verify Gateway Secret
  const incomingSecret = req.headers['x-gateway-secret'] as string | undefined;

  if (!incomingSecret || !safeTimingCompare(incomingSecret, config.security.gatewaySecret)) {
    res.status(403).json({
      success: false,
      error: 'FORBIDDEN_GATEWAY_SECRET_REQUIRED',
      message: 'Akses langsung ditolak. Layanan ini hanya dapat diakses melalui API Gateway resmi.',
    });
    return;
  }

  // 2. Defense-in-depth: Verify Token signature independently at the service level
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED_TOKEN_REQUIRED',
      message: 'Token otentikasi wajib disertakan meskipun membawa gateway secret.',
    });
    return;
  }

  const rawToken = authHeader.slice(7).trim();
  try {
    const claims = verifyToken(rawToken);
    req.userClaims = claims;
    next();
  } catch (error: any) {
    res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN_SIGNATURE',
      message: 'Token tidak valid atau tanda tangan kriptografis gagal diverifikasi oleh service.',
    });
  }
}
