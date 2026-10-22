import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startGatewayServer } from '../../packages/gateway/src/server.js';
import { startNilaiServer } from '../../packages/service-nilai/src/server.js';
import { startTranskripServer } from '../../packages/service-transkrip/src/server.js';
import { runSeed } from '../../packages/database/src/seed.js';
import { pool, query } from '../../packages/database/src/client.js';
import { generateKeys } from '../../scripts/generate-keys.js';
import { signAccessToken } from '../../packages/shared/src/crypto.js';

describe('Integration: Zero Trust Business Workflow & Microservices Sync', () => {
  let gatewayServer: any;
  let nilaiServer: any;
  let transkripServer: any;

  let mahasiswa1Token: string;
  let dosen1Token: string;
  let dosen2Token: string;
  let adminToken: string;

  let mhs1Id: string;
  let dosen1Id: string;
  let classAId: string;
  let classBId: string;
  let gradeAId: string;
  let gradeBId: string;

  beforeAll(async () => {
    generateKeys();
    await runSeed();

    // Start all 3 HTTP microservices on their designated ports (ignore if already running)
    nilaiServer = startNilaiServer();
    nilaiServer.on('error', () => {});
    transkripServer = startTranskripServer();
    transkripServer.on('error', () => {});
    gatewayServer = startGatewayServer();
    gatewayServer.on('error', () => {});

    // Fetch seed IDs
    const usersRes = await query<{ id: string; username: string; nim_nip: string; role: any }>(
      'SELECT id, username, nim_nip, role FROM users'
    );
    const uMap = new Map(usersRes.rows.map(u => [u.username, u]));

    const mhs1 = uMap.get('mahasiswa1')!;
    const dos1 = uMap.get('dosen1')!;
    const dos2 = uMap.get('dosen2')!;
    const adm = uMap.get('admin1')!;

    mhs1Id = mhs1.id;
    dosen1Id = dos1.id;

    mahasiswa1Token = signAccessToken({
      sub: mhs1.id,
      role: 'mahasiswa',
      nim: mhs1.nim_nip,
      username: mhs1.username,
      fullName: 'Ahmad Fauzi',
    });

    dosen1Token = signAccessToken({
      sub: dos1.id,
      role: 'dosen',
      nip: dos1.nim_nip,
      username: dos1.username,
      fullName: 'Dr. Budi Santoso',
    });

    dosen2Token = signAccessToken({
      sub: dos2.id,
      role: 'dosen',
      nip: dos2.nim_nip,
      username: dos2.username,
      fullName: 'Siti Rahmawati',
    });

    adminToken = signAccessToken({
      sub: adm.id,
      role: 'admin',
      username: adm.username,
      fullName: 'Administrator',
    });

    const classesRes = await query<{ id: string; section: string }>('SELECT id, section FROM classes');
    classAId = classesRes.rows.find(c => c.section === 'A')!.id;
    classBId = classesRes.rows.find(c => c.section === 'B')!.id;

    const gradesRes = await query<{ id: string; class_id: string; student_id: string }>('SELECT id, class_id, student_id FROM grades');
    gradeAId = gradesRes.rows.find(g => g.class_id === classAId && g.student_id === mhs1Id)!.id;
    gradeBId = gradesRes.rows.find(g => g.class_id === classBId && g.student_id === mhs1Id)!.id;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => gatewayServer.close(() => resolve()));
    await new Promise<void>((resolve) => nilaiServer.close(() => resolve()));
    await new Promise<void>((resolve) => transkripServer.close(() => resolve()));
    await pool.end();
  });

  it('1. Mahasiswa views own grades through Gateway', async () => {
    const res = await request('http://localhost:3000')
      .get('/nilai')
      .set('Authorization', `Bearer ${mahasiswa1Token}`)
      .set('X-Device-ID', 'dev-mhs1-thinkpad-01');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    // Mahasiswa 1 enrolled in 2 courses
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data[0].score).toBeDefined();
    expect(res.body.data[0].gradeLetter).toBeDefined();
  });

  it('2. Dosen 1 views their classes through Gateway', async () => {
    const res = await request('http://localhost:3000')
      .get('/nilai')
      .set('Authorization', `Bearer ${dosen1Token}`)
      .set('X-Device-ID', 'dev-dosen1-laptop-01');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1); // Dosen 1 teaches Class A
    expect(res.body.data[0].section).toBe('A');
    expect(res.body.data[0].students.length).toBeGreaterThan(0);
  });

  it('3. Dosen 1 attempting to edit grade in Class B (taught by Dosen 2) is denied', async () => {
    const res = await request('http://localhost:3000')
      .put(`/nilai/${gradeBId}`) // Grade in Class B
      .set('Authorization', `Bearer ${dosen1Token}`)
      .set('X-Device-ID', 'dev-dosen1-laptop-01')
      .set('X-Mock-Time', '2026-10-23T03:00:00Z') // 10:00 WIB (within window)
      .send({ score: 99.0 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('NOT_CLASS_LECTURER');
  });

  it('4. Dosen 1 updates grade in Class A with valid score during open access window', async () => {
    const res = await request('http://localhost:3000')
      .put(`/nilai/${gradeAId}`)
      .set('Authorization', `Bearer ${dosen1Token}`)
      .set('X-Device-ID', 'dev-dosen1-laptop-01')
      .set('X-Mock-Time', '2026-10-23T03:00:00Z') // 10:00 WIB
      .send({ score: 95.0 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.score).toBe(95.0);
    expect(res.body.data.gradeLetter).toBe('A');
  });

  it('5. Dosen 1 finalizes Class A -> triggers Service Token and Transcript sync', async () => {
    const res = await request('http://localhost:3000')
      .post(`/kelas/${classAId}/finalisasi`)
      .set('Authorization', `Bearer ${dosen1Token}`)
      .set('X-Device-ID', 'dev-dosen1-laptop-01')
      .set('X-Mock-Time', '2026-10-23T03:00:00Z');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isFinalized).toBe(true);
    expect(res.body.data.syncedDirectly).toBe(true);
  });

  it('6. Gradebook in Class A is locked after finalization (read-only)', async () => {
    const res = await request('http://localhost:3000')
      .put(`/nilai/${gradeAId}`)
      .set('Authorization', `Bearer ${dosen1Token}`)
      .set('X-Device-ID', 'dev-dosen1-laptop-01')
      .set('X-Mock-Time', '2026-10-23T03:00:00Z')
      .send({ score: 80.0 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('CLASS_FINALIZED');
  });

  it('7. Re-finalizing already finalized class is rejected with 409 conflict', async () => {
    const res = await request('http://localhost:3000')
      .post(`/kelas/${classAId}/finalisasi`)
      .set('Authorization', `Bearer ${dosen1Token}`)
      .set('X-Device-ID', 'dev-dosen1-laptop-01')
      .set('X-Mock-Time', '2026-10-23T03:00:00Z');

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ALREADY_FINALIZED');
  });

  it('8. Mahasiswa 1 views transcript through Gateway -> sees synced final grade and GPA', async () => {
    const res = await request('http://localhost:3000')
      .get('/transkrip/2207051001')
      .set('Authorization', `Bearer ${mahasiswa1Token}`)
      .set('X-Device-ID', 'dev-mhs1-thinkpad-01');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary.totalCredits).toBe(3);
    expect(res.body.data.summary.gpa).toBe(4.0); // 95 is A -> 4.0
    expect(res.body.data.entries[0].score).toBe(95);
    expect(res.body.data.entries[0].gradeLetter).toBe('A');
  });

  it('9. Admin views Mahasiswa 1 transcript through Gateway', async () => {
    const res = await request('http://localhost:3000')
      .get('/transkrip/2207051001')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Device-ID', 'dev-admin-chrome-01');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.student.nim).toBe('2207051001');
  });
});
