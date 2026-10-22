import { query, pool } from './client.js';

export async function runMigrations(): Promise<void> {
  console.log('[MIGRATE] Starting database schema migrations for zero_trust_db...');

  await query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

  await query(`
    -- 1. Users Table
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      full_name VARCHAR(100) NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('mahasiswa', 'dosen', 'admin', 'service')),
      nim_nip VARCHAR(30) UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_nim_nip ON users(nim_nip);

    -- 2. Devices Table (Zero Trust Device Context)
    CREATE TABLE IF NOT EXISTS devices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_id VARCHAR(100) UNIQUE NOT NULL,
      label VARCHAR(100) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
    CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);

    -- 3. Courses Table
    CREATE TABLE IF NOT EXISTS courses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      credits INTEGER NOT NULL CHECK (credits > 0 AND credits <= 6),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(code);

    -- 4. Classes Table
    CREATE TABLE IF NOT EXISTS classes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
      lecturer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      term VARCHAR(30) NOT NULL,
      section VARCHAR(10) NOT NULL,
      is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
      finalized_by UUID REFERENCES users(id) ON DELETE SET NULL,
      finalized_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_classes_lecturer_id ON classes(lecturer_id);
    CREATE INDEX IF NOT EXISTS idx_classes_course_id ON classes(course_id);

    -- 5. Enrollments Table
    CREATE TABLE IF NOT EXISTS enrollments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_enrollment UNIQUE (class_id, student_id)
    );

    CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);
    CREATE INDEX IF NOT EXISTS idx_enrollments_class_id ON enrollments(class_id);

    -- 6. Grades Table
    CREATE TABLE IF NOT EXISTS grades (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      score NUMERIC(5, 2) NOT NULL CHECK (score >= 0.00 AND score <= 100.00),
      updated_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_grade_student_class UNIQUE (class_id, student_id)
    );

    CREATE INDEX IF NOT EXISTS idx_grades_student_id ON grades(student_id);
    CREATE INDEX IF NOT EXISTS idx_grades_class_id ON grades(class_id);

    -- 7. Transcript Entries Table (Populated via Service Nilai -> Service Transkrip sync)
    CREATE TABLE IF NOT EXISTS transcript_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
      score NUMERIC(5, 2) NOT NULL,
      grade_letter VARCHAR(4) NOT NULL,
      credits INTEGER NOT NULL,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      source_version INTEGER NOT NULL DEFAULT 1,
      CONSTRAINT uq_transcript_student_class UNIQUE (student_id, class_id)
    );

    CREATE INDEX IF NOT EXISTS idx_transcripts_student_id ON transcript_entries(student_id);
    CREATE INDEX IF NOT EXISTS idx_transcripts_course_id ON transcript_entries(course_id);

    -- 8. Refresh Sessions Table (Zero Trust Session Revocation & Rotation)
    CREATE TABLE IF NOT EXISTS refresh_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      replaced_by_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_refresh_token_hash ON refresh_sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_refresh_user_id ON refresh_sessions(user_id);

    -- 9. Service Clients Table (Internal Service Auth)
    CREATE TABLE IF NOT EXISTS service_clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id VARCHAR(50) UNIQUE NOT NULL,
      secret_hash VARCHAR(255) NOT NULL,
      allowed_scope VARCHAR(100) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_service_clients_client_id ON service_clients(client_id);

    -- 10. Audit Events Table (PEP Audit Trail)
    CREATE TABLE IF NOT EXISTS audit_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      subject_id VARCHAR(100) NOT NULL,
      subject_type VARCHAR(20) NOT NULL CHECK (subject_type IN ('user', 'service', 'anonymous')),
      method VARCHAR(10) NOT NULL,
      path VARCHAR(255) NOT NULL,
      device_id VARCHAR(100) NOT NULL,
      decision VARCHAR(10) NOT NULL CHECK (decision IN ('ALLOW', 'DENY')),
      reason_code VARCHAR(100) NOT NULL,
      request_id VARCHAR(100) NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_occurred_at ON audit_events(occurred_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_subject_id ON audit_events(subject_id);
    CREATE INDEX IF NOT EXISTS idx_audit_decision ON audit_events(decision);
    CREATE INDEX IF NOT EXISTS idx_audit_request_id ON audit_events(request_id);

    -- 11. Outbox Events Table (Nilai Plus: Reliable Event Sync)
    CREATE TABLE IF NOT EXISTS outbox_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type VARCHAR(50) NOT NULL,
      aggregate_id UUID NOT NULL,
      payload JSONB NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED')),
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_events(status);
  `);

  console.log('[MIGRATE] Schema migrations executed successfully!');
}

if (process.argv[1]?.includes('migrate')) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => {
      console.error('[MIGRATE ERROR]', err);
      process.exit(1);
    });
}
