import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { query } from '../../../database/src/client.js';
import {
  comparePassword,
  hashToken,
  generateRandomToken,
  signAccessToken,
  signServiceToken,
  safeTimingCompare,
} from '../../../shared/src/crypto.js';
import { logAuditEvent } from '../audit/auditLogger.js';
import type { AccessTokenClaims, UserRole } from '../../../shared/src/types.js';

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body || {};
  const deviceId = (req.headers['x-device-id'] as string) || '';
  const requestId = req.requestId;

  if (!username || !password) {
    res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Username dan password wajib diisi',
    });
    return;
  }

  if (!deviceId) {
    await logAuditEvent({
      subjectId: username,
      subjectType: 'anonymous',
      method: req.method,
      path: req.path,
      deviceId: 'missing',
      decision: 'DENY',
      reasonCode: 'MISSING_DEVICE_HEADER',
      requestId,
    });

    res.status(403).json({
      success: false,
      error: 'MISSING_DEVICE_ID',
      message: 'Header X-Device-ID wajib disertakan saat login',
    });
    return;
  }

  // 1. Fetch user by username
  const userResult = await query<{
    id: string;
    username: string;
    email: string;
    full_name: string;
    role: UserRole;
    nim_nip: string;
    password_hash: string;
    is_active: boolean;
  }>(`
    SELECT id, username, email, full_name, role, nim_nip, password_hash, is_active
    FROM users
    WHERE username = $1
  `, [username]);

  if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
    await logAuditEvent({
      subjectId: username,
      subjectType: 'anonymous',
      method: req.method,
      path: req.path,
      deviceId,
      decision: 'DENY',
      reasonCode: 'INVALID_CREDENTIALS',
      requestId,
    });

    res.status(401).json({
      success: false,
      error: 'INVALID_CREDENTIALS',
      message: 'Kredensial login tidak valid',
    });
    return;
  }

  const user = userResult.rows[0];

  // 2. Verify password with bcrypt
  const isMatch = await comparePassword(password, user.password_hash);
  if (!isMatch) {
    await logAuditEvent({
      subjectId: user.id,
      subjectType: 'user',
      method: req.method,
      path: req.path,
      deviceId,
      decision: 'DENY',
      reasonCode: 'INVALID_PASSWORD',
      requestId,
    });

    res.status(401).json({
      success: false,
      error: 'INVALID_CREDENTIALS',
      message: 'Kredensial login tidak valid',
    });
    return;
  }

  // 3. Verify registered device for this user
  const deviceResult = await query<{
    id: string;
    is_active: boolean;
  }>(`
    SELECT id, is_active
    FROM devices
    WHERE user_id = $1 AND device_id = $2
  `, [user.id, deviceId]);

  if (deviceResult.rows.length === 0 || !deviceResult.rows[0].is_active) {
    await logAuditEvent({
      subjectId: user.id,
      subjectType: 'user',
      method: req.method,
      path: req.path,
      deviceId,
      decision: 'DENY',
      reasonCode: 'UNREGISTERED_DEVICE',
      requestId,
    });

    res.status(403).json({
      success: false,
      error: 'DEVICE_NOT_REGISTERED',
      message: 'Perangkat ini tidak terdaftar atau belum diotorisasi untuk akun Anda',
    });
    return;
  }

  // Update last seen
  await query('UPDATE devices SET last_seen_at = NOW() WHERE id = $1', [deviceResult.rows[0].id]);

  // 4. Generate RS256 Access JWT (TTL: 10m)
  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    nim: user.role === 'mahasiswa' ? user.nim_nip : undefined,
    nip: user.role === 'dosen' ? user.nim_nip : undefined,
    username: user.username,
    fullName: user.full_name,
  });

  // 5. Generate Opaque Refresh Token (TTL: 1d) & Hash in DB
  const rawRefreshToken = generateRandomToken(48);
  const refreshTokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day

  const sessionId = crypto.randomUUID();
  await query(`
    INSERT INTO refresh_sessions (id, user_id, token_hash, expires_at)
    VALUES ($1, $2, $3, $4)
  `, [sessionId, user.id, refreshTokenHash, expiresAt]);

  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const sameSiteMode: 'none' | 'strict' = isHttps ? 'none' : 'strict';

  // Set secure HttpOnly cookie
  res.cookie('refreshToken', rawRefreshToken, {
    httpOnly: true,
    sameSite: sameSiteMode,
    secure: isHttps || process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });

  await logAuditEvent({
    subjectId: user.id,
    subjectType: 'user',
    method: req.method,
    path: req.path,
    deviceId,
    decision: 'ALLOW',
    reasonCode: 'LOGIN_SUCCESS',
    requestId,
  });

  res.status(200).json({
    success: true,
    message: 'Login berhasil',
    data: {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        nimNip: user.nim_nip,
      },
    },
  });
}

export async function refreshHandler(req: Request, res: Response): Promise<void> {
  const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;
  const requestId = req.requestId;

  if (!rawToken) {
    res.status(401).json({
      success: false,
      error: 'MISSING_REFRESH_TOKEN',
      message: 'Refresh token tidak ditemukan pada permintaan',
    });
    return;
  }

  const tokenHash = hashToken(rawToken);

  // Query refresh session
  const sessionResult = await query<{
    id: string;
    user_id: string;
    expires_at: Date;
    revoked_at: Date | null;
  }>(`
    SELECT id, user_id, expires_at, revoked_at
    FROM refresh_sessions
    WHERE token_hash = $1
  `, [tokenHash]);

  if (sessionResult.rows.length === 0) {
    res.status(401).json({
      success: false,
      error: 'REFRESH_TOKEN_INVALID',
      message: 'Sesi refresh token tidak valid',
    });
    return;
  }

  const session = sessionResult.rows[0];

  // Detect token reuse or revocation
  if (session.revoked_at) {
    // Possible token theft / replay attack: Revoke all sessions for this user!
    await query('UPDATE refresh_sessions SET revoked_at = NOW() WHERE user_id = $1', [session.user_id]);

    await logAuditEvent({
      subjectId: session.user_id,
      subjectType: 'user',
      method: req.method,
      path: req.path,
      deviceId: 'unknown',
      decision: 'DENY',
      reasonCode: 'REFRESH_TOKEN_REUSE_DETECTED',
      requestId,
    });

    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const sameSiteMode: 'none' | 'strict' = isHttps ? 'none' : 'strict';

  res.clearCookie('refreshToken', {
    path: '/',
    sameSite: sameSiteMode,
    secure: isHttps || process.env.NODE_ENV === 'production',
  });
    res.status(401).json({
      success: false,
      error: 'REFRESH_TOKEN_REUSE_DETECTED',
      message: 'Terdeteksi penggunaan token lama yang telah dicabut. Seluruh sesi ditutup untuk keamanan.',
    });
    return;
  }

  // Check expiration
  if (new Date(session.expires_at) < new Date()) {
    res.status(401).json({
      success: false,
      error: 'REFRESH_TOKEN_EXPIRED',
      message: 'Sesi telah kedaluwarsa. Silakan login kembali.',
    });
    return;
  }

  // Fetch user
  const userResult = await query<{
    id: string;
    username: string;
    full_name: string;
    role: UserRole;
    nim_nip: string;
    is_active: boolean;
  }>('SELECT id, username, full_name, role, nim_nip, is_active FROM users WHERE id = $1', [session.user_id]);

  if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
    res.status(401).json({
      success: false,
      error: 'USER_INACTIVE',
      message: 'Akun tidak aktif',
    });
    return;
  }

  const user = userResult.rows[0];

  // Rotate token: create new token and revoke old
  const newRawRefreshToken = generateRandomToken(48);
  const newHash = hashToken(newRawRefreshToken);
  const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const newSessionId = crypto.randomUUID();
  await query(`
    INSERT INTO refresh_sessions (id, user_id, token_hash, expires_at)
    VALUES ($1, $2, $3, $4)
  `, [newSessionId, user.id, newHash, newExpiresAt]);

  await query('UPDATE refresh_sessions SET revoked_at = NOW(), replaced_by_id = $1 WHERE id = $2', [
    newSessionId,
    session.id,
  ]);

  // Sign new access token
  const newAccessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    nim: user.role === 'mahasiswa' ? user.nim_nip : undefined,
    nip: user.role === 'dosen' ? user.nim_nip : undefined,
    username: user.username,
    fullName: user.full_name,
  });

  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const sameSiteMode: 'none' | 'strict' = isHttps ? 'none' : 'strict';

  res.cookie('refreshToken', newRawRefreshToken, {
    httpOnly: true,
    sameSite: sameSiteMode,
    secure: isHttps || process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });

  await logAuditEvent({
    subjectId: user.id,
    subjectType: 'user',
    method: req.method,
    path: req.path,
    deviceId: 'session-rotation',
    decision: 'ALLOW',
    reasonCode: 'TOKEN_ROTATION_SUCCESS',
    requestId,
  });

  res.status(200).json({
    success: true,
    data: {
      accessToken: newAccessToken,
    },
  });
}

export async function logoutHandler(req: Request, res: Response): Promise<void> {
  const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;
  const requestId = req.requestId;

  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    await query('UPDATE refresh_sessions SET revoked_at = NOW() WHERE token_hash = $1', [tokenHash]);
  }

  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const sameSiteMode: 'none' | 'strict' = isHttps ? 'none' : 'strict';

  res.clearCookie('refreshToken', {
    path: '/',
    sameSite: sameSiteMode,
    secure: isHttps || process.env.NODE_ENV === 'production',
  });

  await logAuditEvent({
    subjectId: 'session',
    subjectType: 'user',
    method: req.method,
    path: req.path,
    deviceId: 'logout',
    decision: 'ALLOW',
    reasonCode: 'LOGOUT_SUCCESS',
    requestId,
  });

  res.status(200).json({
    success: true,
    message: 'Logout berhasil dan sesi telah dicabut',
  });
}

export async function serviceAuthHandler(req: Request, res: Response): Promise<void> {
  const { clientId, clientSecret } = req.body || {};
  const requestId = req.requestId;

  if (!clientId || !clientSecret) {
    res.status(400).json({
      success: false,
      error: 'MISSING_CLIENT_CREDENTIALS',
      message: 'clientId dan clientSecret wajib disertakan',
    });
    return;
  }

  const clientResult = await query<{
    id: string;
    client_id: string;
    secret_hash: string;
    allowed_scope: string;
    is_active: boolean;
  }>('SELECT id, client_id, secret_hash, allowed_scope, is_active FROM service_clients WHERE client_id = $1', [clientId]);

  if (clientResult.rows.length === 0 || !clientResult.rows[0].is_active) {
    await logAuditEvent({
      subjectId: clientId,
      subjectType: 'service',
      method: req.method,
      path: req.path,
      deviceId: 'internal-service',
      decision: 'DENY',
      reasonCode: 'UNKNOWN_SERVICE_CLIENT',
      requestId,
    });

    res.status(401).json({
      success: false,
      error: 'INVALID_SERVICE_CREDENTIALS',
      message: 'Kredensial service client tidak valid',
    });
    return;
  }

  const client = clientResult.rows[0];
  const isSecretValid = await comparePassword(clientSecret, client.secret_hash);

  if (!isSecretValid) {
    await logAuditEvent({
      subjectId: clientId,
      subjectType: 'service',
      method: req.method,
      path: req.path,
      deviceId: 'internal-service',
      decision: 'DENY',
      reasonCode: 'INVALID_SERVICE_SECRET',
      requestId,
    });

    res.status(401).json({
      success: false,
      error: 'INVALID_SERVICE_CREDENTIALS',
      message: 'Kredensial service client tidak valid',
    });
    return;
  }

  // Issue 5-minute RS256 Service Token
  const serviceToken = signServiceToken({
    sub: 'grades-service',
    role: 'service',
    scope: client.allowed_scope,
  });

  await logAuditEvent({
    subjectId: clientId,
    subjectType: 'service',
    method: req.method,
    path: req.path,
    deviceId: 'internal-service',
    decision: 'ALLOW',
    reasonCode: 'SERVICE_AUTH_SUCCESS',
    requestId,
  });

  res.status(200).json({
    success: true,
    data: {
      serviceToken,
      tokenType: 'Bearer',
      expiresIn: 300,
    },
  });
}

export async function meHandler(req: Request, res: Response): Promise<void> {
  const claims = (req as any).userClaims as AccessTokenClaims;
  if (!claims) {
    res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    return;
  }

  const userResult = await query<{
    id: string;
    username: string;
    email: string;
    full_name: string;
    role: UserRole;
    nim_nip: string;
  }>('SELECT id, username, email, full_name, role, nim_nip FROM users WHERE id = $1', [claims.sub]);

  if (userResult.rows.length === 0) {
    res.status(404).json({ success: false, error: 'USER_NOT_FOUND' });
    return;
  }

  const user = userResult.rows[0];

  const devices = await query<{
    device_id: string;
    label: string;
    is_active: boolean;
    last_seen_at: Date;
  }>('SELECT device_id, label, is_active, last_seen_at FROM devices WHERE user_id = $1', [user.id]);

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        nimNip: user.nim_nip,
      },
      devices: devices.rows,
    },
  });
}
