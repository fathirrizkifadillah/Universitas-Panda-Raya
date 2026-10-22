import mysql from 'mysql2/promise';
import { query, pool } from './client.js';
import { config } from '../../shared/src/config.js';

export async function runMigrations(): Promise<void> {
  console.log(`[MIGRATE] Ensuring database '${config.database.database}' exists...`);

  // 1. Ensure database exists
  const rootConn = await mysql.createConnection({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
  });

  await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${config.database.database}\`;`);
  await rootConn.end();

  console.log(`[MIGRATE] Starting table schema migrations for ${config.database.database}...`);

  // 2. Create tables
  await query(`
    -- 1. Users Table
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      full_name VARCHAR(100) NOT NULL,
      role VARCHAR(20) NOT NULL,
      nim_nip VARCHAR(30) UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_users_username (username),
      INDEX idx_users_role (role),
      INDEX idx_users_nim_nip (nim_nip)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    -- 2. Devices Table (Zero Trust Device Context)
    CREATE TABLE IF NOT EXISTS devices (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      device_id VARCHAR(100) UNIQUE NOT NULL,
      label VARCHAR(100) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_devices_user_id (user_id),
      INDEX idx_devices_device_id (device_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    -- 3. Courses Table
    CREATE TABLE IF NOT EXISTS courses (
      id VARCHAR(36) PRIMARY KEY,
      code VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      credits INT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_courses_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    -- 4. Classes Table
    CREATE TABLE IF NOT EXISTS classes (
      id VARCHAR(36) PRIMARY KEY,
      course_id VARCHAR(36) NOT NULL,
      lecturer_id VARCHAR(36) NOT NULL,
      term VARCHAR(30) NOT NULL,
      section VARCHAR(10) NOT NULL,
      is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
      finalized_by VARCHAR(36) NULL,
      finalized_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_classes_lecturer_id (lecturer_id),
      INDEX idx_classes_course_id (course_id),
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT,
      FOREIGN KEY (lecturer_id) REFERENCES users(id) ON DELETE RESTRICT,
      FOREIGN KEY (finalized_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    -- 5. Enrollments Table
    CREATE TABLE IF NOT EXISTS enrollments (
      id VARCHAR(36) PRIMARY KEY,
      class_id VARCHAR(36) NOT NULL,
      student_id VARCHAR(36) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_enrollment (class_id, student_id),
      INDEX idx_enrollments_student_id (student_id),
      INDEX idx_enrollments_class_id (class_id),
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    -- 6. Grades Table
    CREATE TABLE IF NOT EXISTS grades (
      id VARCHAR(36) PRIMARY KEY,
      class_id VARCHAR(36) NOT NULL,
      student_id VARCHAR(36) NOT NULL,
      score DECIMAL(5, 2) NOT NULL,
      updated_by VARCHAR(36) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_grade_student_class (class_id, student_id),
      INDEX idx_grades_student_id (student_id),
      INDEX idx_grades_class_id (class_id),
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (updated_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    -- 7. Transcript Entries Table (Populated via Service Nilai -> Service Transkrip sync)
    CREATE TABLE IF NOT EXISTS transcript_entries (
      id VARCHAR(36) PRIMARY KEY,
      student_id VARCHAR(36) NOT NULL,
      class_id VARCHAR(36) NOT NULL,
      course_id VARCHAR(36) NOT NULL,
      score DECIMAL(5, 2) NOT NULL,
      grade_letter VARCHAR(4) NOT NULL,
      credits INT NOT NULL,
      synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      source_version INT NOT NULL DEFAULT 1,
      UNIQUE KEY uq_transcript_student_class (student_id, class_id),
      INDEX idx_transcripts_student_id (student_id),
      INDEX idx_transcripts_course_id (course_id),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    -- 8. Refresh Sessions Table (Zero Trust Session Revocation & Rotation)
    CREATE TABLE IF NOT EXISTS refresh_sessions (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      token_hash VARCHAR(64) UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME NULL,
      replaced_by_id VARCHAR(36) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_refresh_token_hash (token_hash),
      INDEX idx_refresh_user_id (user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    -- 9. Service Clients Table (Internal Service Auth)
    CREATE TABLE IF NOT EXISTS service_clients (
      id VARCHAR(36) PRIMARY KEY,
      client_id VARCHAR(50) UNIQUE NOT NULL,
      secret_hash VARCHAR(255) NOT NULL,
      allowed_scope VARCHAR(100) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_service_clients_client_id (client_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    -- 10. Audit Events Table (PEP Audit Trail)
    CREATE TABLE IF NOT EXISTS audit_events (
      id VARCHAR(36) PRIMARY KEY,
      occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      subject_id VARCHAR(100) NOT NULL,
      subject_type VARCHAR(20) NOT NULL,
      method VARCHAR(10) NOT NULL,
      path VARCHAR(255) NOT NULL,
      device_id VARCHAR(100) NOT NULL,
      decision VARCHAR(10) NOT NULL,
      reason_code VARCHAR(100) NOT NULL,
      request_id VARCHAR(100) NOT NULL,
      INDEX idx_audit_occurred_at (occurred_at DESC),
      INDEX idx_audit_subject_id (subject_id),
      INDEX idx_audit_decision (decision),
      INDEX idx_audit_request_id (request_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    -- 11. Outbox Events Table (Nilai Plus: Reliable Event Sync)
    CREATE TABLE IF NOT EXISTS outbox_events (
      id VARCHAR(36) PRIMARY KEY,
      event_type VARCHAR(50) NOT NULL,
      aggregate_id VARCHAR(36) NOT NULL,
      payload JSON NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      attempts INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME NULL,
      INDEX idx_outbox_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  console.log('[MIGRATE] Schema migrations executed successfully in MySQL!');
}

if (process.argv[1]?.includes('migrate')) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => {
      console.error('[MIGRATE ERROR]', err);
      process.exit(1);
    });
}
