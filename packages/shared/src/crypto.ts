import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import type { AccessTokenClaims, ServiceTokenClaims, TokenClaims } from './types.js';

export function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, 10);
}

export function comparePassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateRandomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function signAccessToken(claims: Omit<AccessTokenClaims, 'jti' | 'token_use'>): string {
  const privateKey = config.keys.getPrivateKey();
  const jti = crypto.randomUUID();
  const payload: AccessTokenClaims = {
    ...claims,
    token_use: 'access',
    jti,
  };

  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: config.security.accessTokenTtl as jwt.SignOptions['expiresIn'],
    issuer: config.security.jwtIssuer,
    audience: config.security.jwtAudience,
  });
}

export function signServiceToken(claims: Omit<ServiceTokenClaims, 'jti' | 'token_use'>): string {
  const privateKey = config.keys.getPrivateKey();
  const jti = crypto.randomUUID();
  const payload: ServiceTokenClaims = {
    ...claims,
    token_use: 'service',
    jti,
  };

  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: config.security.serviceTokenTtl as jwt.SignOptions['expiresIn'],
    issuer: config.security.jwtIssuer,
    audience: 'transcript-service',
  });
}

export function verifyToken(token: string, expectedAudience?: string | string[]): TokenClaims {
  const publicKey = config.keys.getPublicKey();
  const audiences: [string | RegExp, ...(string | RegExp)[]] | string | RegExp = expectedAudience
    ? (Array.isArray(expectedAudience)
        ? (expectedAudience as [string, ...string[]])
        : expectedAudience)
    : [config.security.jwtAudience, 'transcript-service'];

  const decoded = jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer: config.security.jwtIssuer,
    audience: audiences,
  }) as unknown as TokenClaims;

  return decoded;
}

export function safeTimingCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function calculateGradeLetter(score: number): string {
  if (score >= 85) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 75) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 65) return 'B-';
  if (score >= 60) return 'C+';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'E';
}

export function gradeLetterToPoint(gradeLetter: string): number {
  switch (gradeLetter) {
    case 'A': return 4.0;
    case 'A-': return 3.7;
    case 'B+': return 3.3;
    case 'B': return 3.0;
    case 'B-': return 2.7;
    case 'C+': return 2.3;
    case 'C': return 2.0;
    case 'D': return 1.0;
    default: return 0.0;
  }
}
