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

  // 1. Seed Users (2 Admin, 4 Dosen, 6 Mahasiswa)
  const users = [
    // Administrators
    { id: crypto.randomUUID(), username: 'admin1', email: 'admin@unsil.ac.id', fullName: 'Administrator Pusat', role: 'admin', nimNip: 'ADM001', hash: adminPasswordHash },
    { id: crypto.randomUUID(), username: 'admin2', email: 'admin2@unsil.ac.id', fullName: 'Administrator Akademik', role: 'admin', nimNip: 'ADM002', hash: adminPasswordHash },

    // Dosen (Lecturers)
    { id: crypto.randomUUID(), username: 'dosen1', email: 'dosen1@unsil.ac.id', fullName: 'Dr. Budi Santoso, M.Kom.', role: 'dosen', nimNip: '198001012005011001', hash: dosenPasswordHash },
    { id: crypto.randomUUID(), username: 'dosen2', email: 'dosen2@unsil.ac.id', fullName: 'Siti Rahmawati, M.T.', role: 'dosen', nimNip: '198505122008122002', hash: dosenPasswordHash },
    { id: crypto.randomUUID(), username: 'dosen3', email: 'dosen3@unsil.ac.id', fullName: 'Ir. Hendra Gunawan, Ph.D.', role: 'dosen', nimNip: '197803152003121003', hash: dosenPasswordHash },
    { id: crypto.randomUUID(), username: 'dosen4', email: 'dosen4@unsil.ac.id', fullName: 'Dian Kusuma, M.Cs.', role: 'dosen', nimNip: '199002202015042004', hash: dosenPasswordHash },

    // Mahasiswa (Students)
    { id: crypto.randomUUID(), username: 'mahasiswa1', email: 'mhs1@unsil.ac.id', fullName: 'Ahmad Fauzi', role: 'mahasiswa', nimNip: '2207051001', hash: mhsPasswordHash },
    { id: crypto.randomUUID(), username: 'mahasiswa2', email: 'mhs2@unsil.ac.id', fullName: 'Bella Safitri', role: 'mahasiswa', nimNip: '2207051002', hash: mhsPasswordHash },
    { id: crypto.randomUUID(), username: 'mahasiswa3', email: 'mhs3@unsil.ac.id', fullName: 'Cahyo Wibowo', role: 'mahasiswa', nimNip: '2207051003', hash: mhsPasswordHash },
    { id: crypto.randomUUID(), username: 'mahasiswa4', email: 'mhs4@unsil.ac.id', fullName: 'Dewi Lestari', role: 'mahasiswa', nimNip: '2207051004', hash: mhsPasswordHash },
    { id: crypto.randomUUID(), username: 'mahasiswa5', email: 'mhs5@unsil.ac.id', fullName: 'Eko Prasetyo', role: 'mahasiswa', nimNip: '2207051005', hash: mhsPasswordHash },
    { id: crypto.randomUUID(), username: 'mahasiswa6', email: 'mhs6@unsil.ac.id', fullName: 'Fani Anggraini', role: 'mahasiswa', nimNip: '2207051006', hash: mhsPasswordHash },
  ];

  const userMap = new Map<string, string>();
  for (const u of users) {
    userMap.set(u.username, u.id);
    await query(`
      INSERT INTO users (id, username, email, full_name, role, nim_nip, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [u.id, u.username, u.email, u.fullName, u.role, u.nimNip, u.hash]);
  }

  // 2. Seed Devices (1 registered device per user)
  const devices = [
    { id: crypto.randomUUID(), userId: userMap.get('admin1')!, deviceId: 'dev-admin-chrome-01', label: 'Admin 1 ThinkPad Chrome' },
    { id: crypto.randomUUID(), userId: userMap.get('admin2')!, deviceId: 'dev-admin-laptop-02', label: 'Admin 2 Dell Latitude Edge' },

    { id: crypto.randomUUID(), userId: userMap.get('dosen1')!, deviceId: 'dev-dosen1-laptop-01', label: 'Dosen 1 Dell XPS Edge' },
    { id: crypto.randomUUID(), userId: userMap.get('dosen2')!, deviceId: 'dev-dosen2-macbook-02', label: 'Dosen 2 MacBook Pro Safari' },
    { id: crypto.randomUUID(), userId: userMap.get('dosen3')!, deviceId: 'dev-dosen3-thinkpad-03', label: 'Dosen 3 ThinkPad X1 Linux' },
    { id: crypto.randomUUID(), userId: userMap.get('dosen4')!, deviceId: 'dev-dosen4-desktop-04', label: 'Dosen 4 PC Lab Windows' },

    { id: crypto.randomUUID(), userId: userMap.get('mahasiswa1')!, deviceId: 'dev-mhs1-thinkpad-01', label: 'Mahasiswa 1 Firefox Linux' },
    { id: crypto.randomUUID(), userId: userMap.get('mahasiswa2')!, deviceId: 'dev-mhs2-laptop-02', label: 'Mahasiswa 2 Windows Chrome' },
    { id: crypto.randomUUID(), userId: userMap.get('mahasiswa3')!, deviceId: 'dev-mhs3-desktop-03', label: 'Mahasiswa 3 Desktop Windows' },
    { id: crypto.randomUUID(), userId: userMap.get('mahasiswa4')!, deviceId: 'dev-mhs4-laptop-04', label: 'Mahasiswa 4 Asus Zenbook' },
    { id: crypto.randomUUID(), userId: userMap.get('mahasiswa5')!, deviceId: 'dev-mhs5-phone-05', label: 'Mahasiswa 5 Samsung Galaxy' },
    { id: crypto.randomUUID(), userId: userMap.get('mahasiswa6')!, deviceId: 'dev-mhs6-mac-06', label: 'Mahasiswa 6 MacBook Air' },
  ];

  for (const d of devices) {
    await query(`
      INSERT INTO devices (id, user_id, device_id, label, is_active)
      VALUES ($1, $2, $3, $4, TRUE)
    `, [d.id, d.userId, d.deviceId, d.label]);
  }

  // 3. Seed Courses (4 Courses)
  const courses = [
    { id: crypto.randomUUID(), code: 'IF3101', name: 'Keamanan Informasi', credits: 3 },
    { id: crypto.randomUUID(), code: 'IF2204', name: 'Basis Data Lanjut', credits: 3 },
    { id: crypto.randomUUID(), code: 'IF3105', name: 'Rekayasa Perangkat Lunak', credits: 3 },
    { id: crypto.randomUUID(), code: 'IF2208', name: 'Jaringan Komputer Lanjut', credits: 3 },
  ];

  const courseMap = new Map<string, string>();
  for (const c of courses) {
    courseMap.set(c.code, c.id);
    await query(`
      INSERT INTO courses (id, code, name, credits)
      VALUES ($1, $2, $3, $4)
    `, [c.id, c.code, c.name, c.credits]);
  }

  // 4. Seed Classes (4 Classes taught by 4 different lecturers)
  const classA = { id: crypto.randomUUID(), courseId: courseMap.get('IF3101')!, lecturerId: userMap.get('dosen1')!, term: 'Ganjil 2026/2027', section: 'A' };
  const classB = { id: crypto.randomUUID(), courseId: courseMap.get('IF2204')!, lecturerId: userMap.get('dosen2')!, term: 'Ganjil 2026/2027', section: 'B' };
  const classC = { id: crypto.randomUUID(), courseId: courseMap.get('IF3105')!, lecturerId: userMap.get('dosen3')!, term: 'Ganjil 2026/2027', section: 'C' };
  const classD = { id: crypto.randomUUID(), courseId: courseMap.get('IF2208')!, lecturerId: userMap.get('dosen4')!, term: 'Ganjil 2026/2027', section: 'D' };

  for (const cl of [classA, classB, classC, classD]) {
    await query(`
      INSERT INTO classes (id, course_id, lecturer_id, term, section, is_finalized)
      VALUES ($1, $2, $3, $4, $5, FALSE)
    `, [cl.id, cl.courseId, cl.lecturerId, cl.term, cl.section]);
  }

  // 5. Seed Enrollments
  const enrollments = [
    // Class A (IF3101 - Dosen 1)
    { id: crypto.randomUUID(), classId: classA.id, studentId: userMap.get('mahasiswa1')! },
    { id: crypto.randomUUID(), classId: classA.id, studentId: userMap.get('mahasiswa2')! },
    { id: crypto.randomUUID(), classId: classA.id, studentId: userMap.get('mahasiswa3')! },
    { id: crypto.randomUUID(), classId: classA.id, studentId: userMap.get('mahasiswa4')! },

    // Class B (IF2204 - Dosen 2)
    { id: crypto.randomUUID(), classId: classB.id, studentId: userMap.get('mahasiswa1')! },
    { id: crypto.randomUUID(), classId: classB.id, studentId: userMap.get('mahasiswa2')! },
    { id: crypto.randomUUID(), classId: classB.id, studentId: userMap.get('mahasiswa5')! },
    { id: crypto.randomUUID(), classId: classB.id, studentId: userMap.get('mahasiswa6')! },

    // Class C (IF3105 - Dosen 3)
    { id: crypto.randomUUID(), classId: classC.id, studentId: userMap.get('mahasiswa3')! },
    { id: crypto.randomUUID(), classId: classC.id, studentId: userMap.get('mahasiswa4')! },
    { id: crypto.randomUUID(), classId: classC.id, studentId: userMap.get('mahasiswa5')! },
    { id: crypto.randomUUID(), classId: classC.id, studentId: userMap.get('mahasiswa6')! },

    // Class D (IF2208 - Dosen 4)
    { id: crypto.randomUUID(), classId: classD.id, studentId: userMap.get('mahasiswa1')! },
    { id: crypto.randomUUID(), classId: classD.id, studentId: userMap.get('mahasiswa3')! },
    { id: crypto.randomUUID(), classId: classD.id, studentId: userMap.get('mahasiswa5')! },
    { id: crypto.randomUUID(), classId: classD.id, studentId: userMap.get('mahasiswa6')! },
  ];

  for (const en of enrollments) {
    await query(`
      INSERT INTO enrollments (id, class_id, student_id)
      VALUES ($1, $2, $3)
    `, [en.id, en.classId, en.studentId]);
  }

  // 6. Seed Initial Grades
  const grades = [
    // Class A (Keamanan Informasi)
    { id: crypto.randomUUID(), classId: classA.id, studentId: userMap.get('mahasiswa1')!, score: 85.50, updatedBy: userMap.get('dosen1')! },
    { id: crypto.randomUUID(), classId: classA.id, studentId: userMap.get('mahasiswa2')!, score: 91.00, updatedBy: userMap.get('dosen1')! },
    { id: crypto.randomUUID(), classId: classA.id, studentId: userMap.get('mahasiswa3')!, score: 74.00, updatedBy: userMap.get('dosen1')! },
    { id: crypto.randomUUID(), classId: classA.id, studentId: userMap.get('mahasiswa4')!, score: 88.00, updatedBy: userMap.get('dosen1')! },

    // Class B (Basis Data Lanjut)
    { id: crypto.randomUUID(), classId: classB.id, studentId: userMap.get('mahasiswa1')!, score: 79.00, updatedBy: userMap.get('dosen2')! },
    { id: crypto.randomUUID(), classId: classB.id, studentId: userMap.get('mahasiswa2')!, score: 88.50, updatedBy: userMap.get('dosen2')! },
    { id: crypto.randomUUID(), classId: classB.id, studentId: userMap.get('mahasiswa5')!, score: 82.00, updatedBy: userMap.get('dosen2')! },
    { id: crypto.randomUUID(), classId: classB.id, studentId: userMap.get('mahasiswa6')!, score: 90.00, updatedBy: userMap.get('dosen2')! },

    // Class C (Rekayasa Perangkat Lunak)
    { id: crypto.randomUUID(), classId: classC.id, studentId: userMap.get('mahasiswa3')!, score: 84.00, updatedBy: userMap.get('dosen3')! },
    { id: crypto.randomUUID(), classId: classC.id, studentId: userMap.get('mahasiswa4')!, score: 76.50, updatedBy: userMap.get('dosen3')! },
    { id: crypto.randomUUID(), classId: classC.id, studentId: userMap.get('mahasiswa5')!, score: 89.00, updatedBy: userMap.get('dosen3')! },
    { id: crypto.randomUUID(), classId: classC.id, studentId: userMap.get('mahasiswa6')!, score: 93.00, updatedBy: userMap.get('dosen3')! },

    // Class D (Jaringan Komputer Lanjut)
    { id: crypto.randomUUID(), classId: classD.id, studentId: userMap.get('mahasiswa1')!, score: 87.00, updatedBy: userMap.get('dosen4')! },
    { id: crypto.randomUUID(), classId: classD.id, studentId: userMap.get('mahasiswa3')!, score: 78.00, updatedBy: userMap.get('dosen4')! },
    { id: crypto.randomUUID(), classId: classD.id, studentId: userMap.get('mahasiswa5')!, score: 85.00, updatedBy: userMap.get('dosen4')! },
    { id: crypto.randomUUID(), classId: classD.id, studentId: userMap.get('mahasiswa6')!, score: 91.50, updatedBy: userMap.get('dosen4')! },
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
  console.log(`[SEED] Users created: 2 admin, 4 dosen, 6 mahasiswa (Total 12 users).`);
  console.log(`[SEED] Classes created: 4 Classes (A: IF3101, B: IF2204, C: IF3105, D: IF2208).`);
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
