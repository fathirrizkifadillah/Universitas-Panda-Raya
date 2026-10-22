import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../packages/gateway/src/server.js';
import { runSeed } from '../../packages/database/src/seed.js';
import { pool } from '../../packages/database/src/client.js';
import { generateKeys } from '../../scripts/generate-keys.js';
import { config } from '../../packages/shared/src/config.js';

describe('Integration: Authentication & Token Lifecycle Flow', () => {
  let app: any;

  beforeAll(async () => {
    generateKeys();
    await runSeed();
    app = createApp();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('successfully logs in with valid credentials and registered device', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('X-Device-ID', 'dev-mhs1-thinkpad-01')
      .send({
        username: 'mahasiswa1',
        password: 'PasswordMhs123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.username).toBe('mahasiswa1');
    expect(res.body.data.user.role).toBe('mahasiswa');

    // Verify Set-Cookie header contains HttpOnly refreshToken
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toContain('refreshToken=');
    expect(cookies[0]).toMatch(/HttpOnly/i);
    expect(cookies[0]).toMatch(/SameSite=Strict/i);
  });

  it('rejects login when password is wrong', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('X-Device-ID', 'dev-mhs1-thinkpad-01')
      .send({
        username: 'mahasiswa1',
        password: 'WrongPassword999',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('INVALID_CREDENTIALS');
  });

  it('rejects login when device is not registered for user', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('X-Device-ID', 'unregistered-rogue-device-999')
      .send({
        username: 'mahasiswa1',
        password: 'PasswordMhs123!',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('DEVICE_NOT_REGISTERED');
  });

  it('rejects login when X-Device-ID header is missing', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        username: 'mahasiswa1',
        password: 'PasswordMhs123!',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('MISSING_DEVICE_ID');
  });

  it('handles refresh token rotation and issues a new access token', async () => {
    // 1. Login to get initial refreshToken cookie
    const loginRes = await request(app)
      .post('/auth/login')
      .set('X-Device-ID', 'dev-dosen1-laptop-01')
      .send({
        username: 'dosen1',
        password: 'PasswordDosen123!',
      });

    const cookieHeader = loginRes.headers['set-cookie'][0];
    const initialRefreshToken = cookieHeader.split(';')[0].split('=')[1];

    // 2. Call /auth/refresh with cookie
    const refreshRes = await request(app)
      .post('/auth/refresh')
      .set('Cookie', [`refreshToken=${initialRefreshToken}`]);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.data.accessToken).toBeDefined();

    // 3. Verify a new refresh token cookie was set (rotation)
    const newCookieHeader = refreshRes.headers['set-cookie'][0];
    const newRefreshToken = newCookieHeader.split(';')[0].split('=')[1];
    expect(newRefreshToken).not.toBe(initialRefreshToken);

    // 4. Test Replay Attack: Reusing old rotated refresh token MUST be rejected and trigger family revocation
    const replayRes = await request(app)
      .post('/auth/refresh')
      .set('Cookie', [`refreshToken=${initialRefreshToken}`]);

    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error).toBe('REFRESH_TOKEN_REUSE_DETECTED');
  });

  it('logs out and revokes refresh session', async () => {
    const loginRes = await request(app)
      .post('/auth/login')
      .set('X-Device-ID', 'dev-admin-chrome-01')
      .send({
        username: 'admin1',
        password: 'PasswordAdmin123!',
      });

    const cookieHeader = loginRes.headers['set-cookie'][0];
    const refreshToken = cookieHeader.split(';')[0].split('=')[1];

    const logoutRes = await request(app)
      .post('/auth/logout')
      .set('Cookie', [`refreshToken=${refreshToken}`]);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    // Trying to refresh after logout must fail
    const refreshAfterLogout = await request(app)
      .post('/auth/refresh')
      .set('Cookie', [`refreshToken=${refreshToken}`]);

    expect(refreshAfterLogout.status).toBe(401);
  });

  it('issues service token for valid service client credentials', async () => {
    const res = await request(app)
      .post('/auth/service')
      .send({
        clientId: config.security.serviceClientId,
        clientSecret: config.security.serviceClientSecret,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.serviceToken).toBeDefined();
    expect(res.body.data.expiresIn).toBe(300); // 5 minutes
  });

  it('rejects service token request with invalid secret', async () => {
    const res = await request(app)
      .post('/auth/service')
      .send({
        clientId: config.security.serviceClientId,
        clientSecret: 'wrong_secret_123',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
