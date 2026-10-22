import { query, pool } from './client.js';
import { hashPassword } from '../../shared/src/crypto.js';
import { config } from '../../shared/src/config.js';

export async function runSeed(): Promise<void> {
  console.log('[SEED] Starting deterministic database seeding...');

  // Clean existing data in reverse order of foreign keys
  await query(`
    TRUNCATE TABLE outbox_events, audit_events, transcript_entries, grades,
                   enrollments, classes, courses, refresh_sessions,
                   devices, service_clients, users CASCADE;
  `);

  console.log('[SEED] Truncated old tables.');

  // Password hashes
  const adminPasswordHash = await hashPassword('PasswordAdmin123!');
  const dosenPasswordHash = await hashPassword('PasswordDosen123!');
  const mhsPasswordHash = await hashPassword('PasswordMhs123!');
  const serviceSecretHash = await hashPassword(config.security.serviceClientSecret);

  // 1. Seed Users
  const userResults = await query<{ id: string; username: string; role: string }>(`
    INSERT INTO users (username, email, full_name, role, nim_nip, password_hash)
    VALUES
      ('admin1', 'admin@unsil.ac.id', 'Administrator Pusat', 'admin', 'ADM001', $1),
      ('dosen1', 'dosen1@unsil.ac.id', 'Dr. Budi Santoso, M.Kom.', 'dosen', '198001012005011001', $2),
      ('dosen2', 'dosen2@unsil.ac.id', 'Siti Rahmawati, M.T.', 'dosen', '198505122008122002', $2),
      ('mahasiswa1', 'mhs1@unsil.ac.id', 'Ahmad Fauzi', 'mahasiswa', '2207051001', $3),
      ('mahasiswa2', 'mhs2@unsil.ac.id', 'Bella Safitri', 'mahasiswa', '2207051002', $3),
      ('mahasiswa3', 'mhs3@unsil.ac.id', 'Cahyo Wibowo', 'mahasiswa', '2207051003', $3)
    RETURNING id, username, role;
  `, [adminPasswordHash, dosenPasswordHash, mhsPasswordHash]);

  const userMap = new Map<string, string>();
  for (const u of userResults.rows) {
    userMap.set(u.username, u.id);
  }

  // 2. Seed Devices (1 per user)
  await query(`
    INSERT INTO devices (user_id, device_id, label, is_active)
    VALUES
      ($1, 'dev-admin-chrome-01', 'Admin ThinkPad Chrome', TRUE),
      ($2, 'dev-dosen1-laptop-01', 'Dosen 1 Dell XPS Edge', TRUE),
      ($3, 'dev-dosen2-macbook-02', 'Dosen 2 MacBook Pro Safari', TRUE),
      ($4, 'dev-mhs1-thinkpad-01', 'Mahasiswa 1 Firefox Linux', TRUE),
      ($5, 'dev-mhs2-laptop-02', 'Mahasiswa 2 Windows Chrome', TRUE),
      ($6, 'dev-mhs3-desktop-03', 'Mahasiswa 3 Desktop Windows', TRUE);
  `, [
    userMap.get('admin1')!,
    userMap.get('dosen1')!,
    userMap.get('dosen2')!,
    userMap.get('mahasiswa1')!,
    userMap.get('mahasiswa2')!,
    userMap.get('mahasiswa3')!,
  ]);

  // 3. Seed Courses
  const courseResults = await query<{ id: string; code: string }>(`
    INSERT INTO courses (code, name, credits)
    VALUES
      ('IF3101', 'Keamanan Informasi', 3),
      ('IF2204', 'Basis Data Lanjut', 3)
    RETURNING id, code;
  `);

  const courseMap = new Map<string, string>();
  for (const c of courseResults.rows) {
    courseMap.set(c.code, c.id);
  }

  // 4. Seed Classes (2 different classes taught by 2 different lecturers)
  const classResults = await query<{ id: string; section: string; course_id: string }>(`
    INSERT INTO classes (course_id, lecturer_id, term, section, is_finalized)
    VALUES
      ($1, $2, 'Ganjil 2026/2027', 'A', FALSE),
      ($3, $4, 'Ganjil 2026/2027', 'B', FALSE)
    RETURNING id, section, course_id;
  `, [
    courseMap.get('IF3101')!,
    userMap.get('dosen1')!,
    courseMap.get('IF2204')!,
    userMap.get('dosen2')!,
  ]);

  const classA = classResults.rows.find(r => r.section === 'A')!;
  const classB = classResults.rows.find(r => r.section === 'B')!;

  // 5. Seed Enrollments
  await query(`
    INSERT INTO enrollments (class_id, student_id)
    VALUES
      ($1, $3), -- Mahasiswa 1 in Class A
      ($1, $4), -- Mahasiswa 2 in Class A
      ($1, $5), -- Mahasiswa 3 in Class A
      ($2, $3), -- Mahasiswa 1 in Class B
      ($2, $4); -- Mahasiswa 2 in Class B
  `, [
    classA.id,
    classB.id,
    userMap.get('mahasiswa1')!,
    userMap.get('mahasiswa2')!,
    userMap.get('mahasiswa3')!,
  ]);

  // 6. Seed Initial Grades
  await query(`
    INSERT INTO grades (class_id, student_id, score, updated_by)
    VALUES
      ($1, $3, 85.50, $6), -- Mhs 1 in Class A (Dosen 1)
      ($1, $4, 91.00, $6), -- Mhs 2 in Class A (Dosen 1)
      ($1, $5, 74.00, $6), -- Mhs 3 in Class A (Dosen 1)
      ($2, $3, 79.00, $7), -- Mhs 1 in Class B (Dosen 2)
      ($2, $4, 88.50, $7); -- Mhs 2 in Class B (Dosen 2)
  `, [
    classA.id,
    classB.id,
    userMap.get('mahasiswa1')!,
    userMap.get('mahasiswa2')!,
    userMap.get('mahasiswa3')!,
    userMap.get('dosen1')!,
    userMap.get('dosen2')!,
  ]);

  // 7. Seed Service Client
  await query(`
    INSERT INTO service_clients (client_id, secret_hash, allowed_scope, is_active)
    VALUES ($1, $2, 'sync:transcripts', TRUE);
  `, [config.security.serviceClientId, serviceSecretHash]);

  console.log('[SEED] Deterministic seed finished successfully!');
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
