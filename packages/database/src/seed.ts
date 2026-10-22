import crypto from 'node:crypto';
import { query, pool } from './client.js';
import { hashPassword } from '../../shared/src/crypto.js';
import { config } from '../../shared/src/config.js';

export async function runSeed(): Promise<void> {
  console.log('[SEED] Starting deterministic database seeding for MySQL...');

  // Clean existing data with foreign key checks temporarily disabled
  await query(`
    SET FOREIGN_KEY_CHECKS = 0;
    TRUNCATE TABLE outbox_events;
    TRUNCATE TABLE audit_events;
    TRUNCATE TABLE transcript_entries;
    TRUNCATE TABLE grades;
    TRUNCATE TABLE enrollments;
    TRUNCATE TABLE classes;
    TRUNCATE TABLE courses;
    TRUNCATE TABLE refresh_sessions;
    TRUNCATE TABLE devices;
    TRUNCATE TABLE service_clients;
    TRUNCATE TABLE users;
    SET FOREIGN_KEY_CHECKS = 1;
  `);

  console.log('[SEED] Truncated old tables.');

  // Password hashes
  const adminPasswordHash = await hashPassword('PasswordAdmin123!');
  const dosenPasswordHash = await hashPassword('PasswordDosen123!');
  const mhsPasswordHash = await hashPassword('PasswordMhs123!');
  const serviceSecretHash = await hashPassword(config.security.serviceClientSecret);

  // 1. Seed Users (Generate explicit deterministic/random UUIDs)
  const users = [
    { id: crypto.randomUUID(), username: 'admin1', email: 'admin@unsil.ac.id', fullName: 'Administrator Pusat', role: 'admin', nimNip: 'ADM001', hash: adminPasswordHash },
    { id: crypto.randomUUID(), username: 'dosen1', email: 'dosen1@unsil.ac.id', fullName: 'Dr. Budi Santoso, M.Kom.', role: 'dosen', nimNip: '198001012005011001', hash: dosenPasswordHash },
    { id: crypto.randomUUID(), username: 'dosen2', email: 'dosen2@unsil.ac.id', fullName: 'Siti Rahmawati, M.T.', role: 'dosen', nimNip: '198505122008122002', hash: dosenPasswordHash },
    { id: crypto.randomUUID(), username: 'mahasiswa1', email: 'mhs1@unsil.ac.id', fullName: 'Ahmad Fauzi', role: 'mahasiswa', nimNip: '2207051001', hash: mhsPasswordHash },
    { id: crypto.randomUUID(), username: 'mahasiswa2', email: 'mhs2@unsil.ac.id', fullName: 'Bella Safitri', role: 'mahasiswa', nimNip: '2207051002', hash: mhsPasswordHash },
    { id: crypto.randomUUID(), username: 'mahasiswa3', email: 'mhs3@unsil.ac.id', fullName: 'Cahyo Wibowo', role: 'mahasiswa', nimNip: '2207051003', hash: mhsPasswordHash },
  ];

  const userMap = new Map<string, string>();
  for (const u of users) {
    userMap.set(u.username, u.id);
    await query(`
      INSERT INTO users (id, username, email, full_name, role, nim_nip, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [u.id, u.username, u.email, u.fullName, u.role, u.nimNip, u.hash]);
  }

  // 2. Seed Devices (1 per user)
  const devices = [
    { id: crypto.randomUUID(), userId: userMap.get('admin1')!, deviceId: 'dev-admin-chrome-01', label: 'Admin ThinkPad Chrome' },
    { id: crypto.randomUUID(), userId: userMap.get('dosen1')!, deviceId: 'dev-dosen1-laptop-01', label: 'Dosen 1 Dell XPS Edge' },
    { id: crypto.randomUUID(), userId: userMap.get('dosen2')!, deviceId: 'dev-dosen2-macbook-02', label: 'Dosen 2 MacBook Pro Safari' },
    { id: crypto.randomUUID(), userId: userMap.get('mahasiswa1')!, deviceId: 'dev-mhs1-thinkpad-01', label: 'Mahasiswa 1 Firefox Linux' },
    { id: crypto.randomUUID(), userId: userMap.get('mahasiswa2')!, deviceId: 'dev-mhs2-laptop-02', label: 'Mahasiswa 2 Windows Chrome' },
    { id: crypto.randomUUID(), userId: userMap.get('mahasiswa3')!, deviceId: 'dev-mhs3-desktop-03', label: 'Mahasiswa 3 Desktop Windows' },
  ];

  for (const d of devices) {
    await query(`
      INSERT INTO devices (id, user_id, device_id, label, is_active)
      VALUES ($1, $2, $3, $4, TRUE)
    `, [d.id, d.userId, d.deviceId, d.label]);
  }

  // 3. Seed Courses
  const courses = [
    { id: crypto.randomUUID(), code: 'IF3101', name: 'Keamanan Informasi', credits: 3 },
    { id: crypto.randomUUID(), code: 'IF2204', name: 'Basis Data Lanjut', credits: 3 },
  ];

  const courseMap = new Map<string, string>();
  for (const c of courses) {
    courseMap.set(c.code, c.id);
    await query(`
      INSERT INTO courses (id, code, name, credits)
      VALUES ($1, $2, $3, $4)
    `, [c.id, c.code, c.name, c.credits]);
  }

  // 4. Seed Classes (2 different classes taught by 2 different lecturers)
  const classA = { id: crypto.randomUUID(), courseId: courseMap.get('IF3101')!, lecturerId: userMap.get('dosen1')!, term: 'Ganjil 2026/2027', section: 'A' };
  const classB = { id: crypto.randomUUID(), courseId: courseMap.get('IF2204')!, lecturerId: userMap.get('dosen2')!, term: 'Ganjil 2026/2027', section: 'B' };

  for (const cl of [classA, classB]) {
    await query(`
      INSERT INTO classes (id, course_id, lecturer_id, term, section, is_finalized)
      VALUES ($1, $2, $3, $4, $5, FALSE)
    `, [cl.id, cl.courseId, cl.lecturerId, cl.term, cl.section]);
  }

  // 5. Seed Enrollments
  const enrollments = [
    { id: crypto.randomUUID(), classId: classA.id, studentId: userMap.get('mahasiswa1')! },
    { id: crypto.randomUUID(), classId: classA.id, studentId: userMap.get('mahasiswa2')! },
    { id: crypto.randomUUID(), classId: classA.id, studentId: userMap.get('mahasiswa3')! },
    { id: crypto.randomUUID(), classId: classB.id, studentId: userMap.get('mahasiswa1')! },
    { id: crypto.randomUUID(), classId: classB.id, studentId: userMap.get('mahasiswa2')! },
  ];

  for (const en of enrollments) {
    await query(`
      INSERT INTO enrollments (id, class_id, student_id)
      VALUES ($1, $2, $3)
    `, [en.id, en.classId, en.studentId]);
  }

  // 6. Seed Initial Grades
  const grades = [
    { id: crypto.randomUUID(), classId: classA.id, studentId: userMap.get('mahasiswa1')!, score: 85.50, updatedBy: userMap.get('dosen1')! },
    { id: crypto.randomUUID(), classId: classA.id, studentId: userMap.get('mahasiswa2')!, score: 91.00, updatedBy: userMap.get('dosen1')! },
    { id: crypto.randomUUID(), classId: classA.id, studentId: userMap.get('mahasiswa3')!, score: 74.00, updatedBy: userMap.get('dosen1')! },
    { id: crypto.randomUUID(), classId: classB.id, studentId: userMap.get('mahasiswa1')!, score: 79.00, updatedBy: userMap.get('dosen2')! },
    { id: crypto.randomUUID(), classId: classB.id, studentId: userMap.get('mahasiswa2')!, score: 88.50, updatedBy: userMap.get('dosen2')! },
  ];

  for (const gr of grades) {
    await query(`
      INSERT INTO grades (id, class_id, student_id, score, updated_by)
      VALUES ($1, $2, $3, $4, $5)
    `, [gr.id, gr.classId, gr.studentId, gr.score, gr.updatedBy]);
  }

  // 7. Seed Service Client
  await query(`
    INSERT INTO service_clients (id, client_id, secret_hash, allowed_scope, is_active)
    VALUES ($1, $2, $3, 'sync:transcripts', TRUE)
  `, [crypto.randomUUID(), config.security.serviceClientId, serviceSecretHash]);

  console.log('[SEED] Deterministic seed finished successfully in MySQL!');
  console.log(`[SEED] Users created: 1 admin, 2 dosen, 3 mahasiswa.`);
  console.log(`[SEED] Classes created: Class A (Keamanan Informasi - Dosen 1), Class B (Basis Data Lanjut - Dosen 2).`);
  console.log(`[SEED] Service client created: ${config.security.serviceClientId}`);
}

if (process.argv[1]?.includes('seed')) {
  runSeed()
    .then(() => pool.end())
    .catch((err) => {
      console.error('[SEED ERROR]', err);
      process.exit(1);
    });
}
