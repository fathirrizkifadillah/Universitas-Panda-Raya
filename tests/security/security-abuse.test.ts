import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../packages/gateway/src/server.js';
import { createNilaiApp } from '../../packages/service-nilai/src/server.js';
import { createTranskripApp } from '../../packages/service-transkrip/src/server.js';
import { runSeed } from '../../packages/database/src/seed.js';
import { pool, query } from '../../packages/database/src/client.js';
import { generateKeys } from '../../scripts/generate-keys.js';
import { signAccessToken, signServiceToken } from '../../packages/shared/src/crypto.js';
import { config } from '../../packages/shared/src/config.js';

describe('Security Negative & Abuse Resistance Suite', () => {
  let gatewayApp: any;
  let nilaiApp: any;
  let transkripApp: any;

  let mahasiswa1Token: string;
  let mahasiswa2Token: string;
  let dosen1Token: string;
  let adminToken: string;
  let serviceToken: string;

  beforeAll(async () => {
    generateKeys();
    await runSeed();
    gatewayApp = createApp();
    nilaiApp = createNilaiApp();
    transkripApp = createTranskripApp();

    // Generate tokens for testing actors
    const usersRes = await query<{ id: string; username: string; role: any; nim_nip: string }>(
      'SELECT id, username, role, nim_nip FROM users'
    );
    const uMap = new Map(usersRes.rows.map(u => [u.username, u]));

    const mhs1 = uMap.get('mahasiswa1')!;
    const mhs2 = uMap.get('mahasiswa2')!;
    const dos1 = uMap.get('dosen1')!;
    const adm = uMap.get('admin1')!;

    mahasiswa1Token = signAccessToken({
      sub: mhs1.id,
      role: 'mahasiswa',
      nim: mhs1.nim_nip,
      username: mhs1.username,
      fullName: 'Ahmad Fauzi',
    });

    mahasiswa2Token = signAccessToken({
      sub: mhs2.id,
      role: 'mahasiswa',
      nim: mhs2.nim_nip,
      username: mhs2.username,
      fullName: 'Bella Safitri',
    });

    dosen1Token = signAccessToken({
      sub: dos1.id,
      role: 'dosen',
      nip: dos1.nim_nip,
      username: dos1.username,
      fullName: 'Dr. Budi Santoso',
    });

    adminToken = signAccessToken({
      sub: adm.id,
      role: 'admin',
      username: adm.username,
      fullName: 'Administrator',
    });

    serviceToken = signServiceToken({
      sub: 'grades-service',
      role: 'service',
      scope: 'sync:transcripts',
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Threat 1: Direct Service Port Access Bypass', () => {
    it('rejects direct request to Service Nilai without X-Gateway-Secret', async () => {
      const res = await request(nilaiApp)
        .get('/nilai')
        .set('Authorization', `Bearer ${mahasiswa1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN_GATEWAY_SECRET_REQUIRED');
    });

    it('rejects direct request to Service Nilai with forged/incorrect X-Gateway-Secret', async () => {
      const res = await request(nilaiApp)
        .get('/nilai')
        .set('X-Gateway-Secret', 'forged_fake_secret_123')
        .set('Authorization', `Bearer ${mahasiswa1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN_GATEWAY_SECRET_REQUIRED');
    });

    it('rejects direct request to Service Transkrip even if secret is valid but JWT token is missing', async () => {
      const res = await request(transkripApp)
        .get('/transkrip/2207051001')
        .set('X-Gateway-Secret', config.security.gatewaySecret);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED_TOKEN_REQUIRED');
    });
  });

  describe('Threat 2: Client Injects Gateway Secret', () => {
    it('strips inbound X-Gateway-Secret sent by client to Gateway PEP', async () => {
      // Client tries to call Gateway PEP with a malicious secret header and no valid JWT
      const res = await request(gatewayApp)
        .get('/nilai')
        .set('X-Gateway-Secret', 'some_attacker_secret');

      // Gateway must reject due to missing JWT token, not pass the fake secret
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('MISSING_AUTHORIZATION_TOKEN');
    });
  });

  describe('Threat 3: IDOR (Insecure Direct Object Reference)', () => {
    it('prevents Mahasiswa 1 from accessing Mahasiswa 2 transcript', async () => {
      const res = await request(gatewayApp)
        .get('/transkrip/2207051002') // Mahasiswa 2 NIM
        .set('Authorization', `Bearer ${mahasiswa1Token}`)
        .set('X-Device-ID', 'dev-mhs1-thinkpad-01');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('IDOR_ATTEMPT_DENIED');
    });

    it('allows Admin to access Mahasiswa 2 transcript', async () => {
      const res = await request(gatewayApp)
        .get('/transkrip/2207051002')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Device-ID', 'dev-admin-chrome-01');

      // Admin has authorization, so policy allows through Gateway
      expect(res.status).not.toBe(403);
    });
  });

  describe('Threat 4: Privilege & Role Escalation', () => {
    it('ignores client attempts to inject role=admin in body or query', async () => {
      const res = await request(gatewayApp)
        .get('/audit?role=admin')
        .set('Authorization', `Bearer ${mahasiswa1Token}`)
        .set('X-Device-ID', 'dev-mhs1-thinkpad-01')
        .send({ role: 'admin' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ADMIN_ROLE_REQUIRED');
    });
  });

  describe('Threat 5: Service Endpoint Isolation', () => {
    it('rejects ordinary user tokens calling /transkrip/sinkron', async () => {
      const res = await request(gatewayApp)
        .post('/transkrip/sinkron')
        .set('Authorization', `Bearer ${dosen1Token}`)
        .set('X-Device-ID', 'dev-dosen1-laptop-01')
        .send({
          classId: 'dummy-class-id',
          courseId: 'dummy-course-id',
          entries: [],
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('SERVICE_TOKEN_REQUIRED');
    });
  });

  describe('Threat 6: SQL Injection Protection', () => {
    it('protects login against SQL injection payloads in username and password', async () => {
      const res = await request(gatewayApp)
        .post('/auth/login')
        .set('X-Device-ID', 'dev-mhs1-thinkpad-01')
        .send({
          username: "' OR '1'='1' --",
          password: "' OR '1'='1' --",
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('Threat 7: Audit Log Leakage Protection', () => {
    it('verifies audit_events records decisions without leaking passwords or tokens', async () => {
      const canarySecret = 'canary_super_secret_password_do_not_leak';
      await request(gatewayApp)
        .post('/auth/login')
        .set('X-Device-ID', 'dev-mhs1-thinkpad-01')
        .send({
          username: 'mahasiswa1',
          password: canarySecret,
        });

      // Query database audit_events for the canary secret
      const leakCheck = await query(
        `SELECT * FROM audit_events WHERE reason_code LIKE $1 OR path LIKE $1`,
        [`%${canarySecret}%`]
      );

      expect(leakCheck.rows).toHaveLength(0);

      // Verify at least one ALLOW and one DENY event exist in audit_events
      const allowEvents = await query("SELECT COUNT(*) FROM audit_events WHERE decision = 'ALLOW'");
      const denyEvents = await query("SELECT COUNT(*) FROM audit_events WHERE decision = 'DENY'");

      expect(Number(allowEvents.rows[0].count)).toBeGreaterThan(0);
      expect(Number(denyEvents.rows[0].count)).toBeGreaterThan(0);
    });
  });
});
