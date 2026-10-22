import { describe, it, expect, beforeAll } from 'vitest';
import {
  signAccessToken,
  signServiceToken,
  verifyToken,
  hashToken,
  hashPassword,
  comparePassword,
  safeTimingCompare,
  calculateGradeLetter,
  gradeLetterToPoint,
} from '../../packages/shared/src/crypto.js';
import { generateKeys } from '../../scripts/generate-keys.js';

describe('Unit: Cryptography & Token Lifecycle', () => {
  beforeAll(() => {
    generateKeys();
  });

  it('signs and verifies a valid RS256 access token', () => {
    const token = signAccessToken({
      sub: 'user-uuid-123',
      role: 'mahasiswa',
      nim: '2207051001',
      username: 'mahasiswa1',
      fullName: 'Ahmad Fauzi',
    });

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const verified = verifyToken(token);
    expect(verified.sub).toBe('user-uuid-123');
    expect(verified.role).toBe('mahasiswa');
    expect(verified.token_use).toBe('access');
  });

  it('signs and verifies an RS256 service token with restricted audience', () => {
    const serviceToken = signServiceToken({
      sub: 'grades-service',
      role: 'service',
      scope: 'sync:transcripts',
    });

    const verified = verifyToken(serviceToken, 'transcript-service');
    expect(verified.sub).toBe('grades-service');
    expect(verified.role).toBe('service');
    expect(verified.token_use).toBe('service');
  });

  it('rejects tampered token signature', () => {
    const validToken = signAccessToken({
      sub: 'user-uuid-123',
      role: 'mahasiswa',
      username: 'mahasiswa1',
      fullName: 'Ahmad Fauzi',
    });

    // Tamper with payload (middle segment)
    const parts = validToken.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'user-uuid-123', role: 'admin' })).toString('base64url');
    const forgedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    expect(() => verifyToken(forgedToken)).toThrow();
  });

  it('hashes and compares passwords securely with bcrypt', async () => {
    const password = 'SuperSecretPassword123!';
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(await comparePassword(password, hash)).toBe(true);
    expect(await comparePassword('WrongPassword', hash)).toBe(false);
  });

  it('hashes tokens deterministically with SHA-256', () => {
    const token = 'random_opaque_refresh_token_string';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('performs constant-time safe comparison of secrets', () => {
    const secret = 'shared_gateway_secret_9988';
    expect(safeTimingCompare(secret, secret)).toBe(true);
    expect(safeTimingCompare(secret, 'wrong_secret')).toBe(false);
    expect(safeTimingCompare('', secret)).toBe(false);
  });

  it('converts academic numeric scores to letter grades correctly', () => {
    expect(calculateGradeLetter(95)).toBe('A');
    expect(calculateGradeLetter(85)).toBe('A');
    expect(calculateGradeLetter(82)).toBe('A-');
    expect(calculateGradeLetter(77)).toBe('B+');
    expect(calculateGradeLetter(72)).toBe('B');
    expect(calculateGradeLetter(67)).toBe('B-');
    expect(calculateGradeLetter(62)).toBe('C+');
    expect(calculateGradeLetter(57)).toBe('C');
    expect(calculateGradeLetter(45)).toBe('D');
    expect(calculateGradeLetter(30)).toBe('E');
  });

  it('maps letter grades to numerical quality points', () => {
    expect(gradeLetterToPoint('A')).toBe(4.0);
    expect(gradeLetterToPoint('A-')).toBe(3.7);
    expect(gradeLetterToPoint('B+')).toBe(3.3);
    expect(gradeLetterToPoint('B')).toBe(3.0);
    expect(gradeLetterToPoint('C')).toBe(2.0);
    expect(gradeLetterToPoint('E')).toBe(0.0);
  });
});
