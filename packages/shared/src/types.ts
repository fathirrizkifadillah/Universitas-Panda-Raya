export type UserRole = 'mahasiswa' | 'dosen' | 'admin' | 'service';

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  nimNip: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Device {
  id: string;
  userId: string;
  deviceId: string;
  label: string;
  isActive: boolean;
  lastSeenAt: Date;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
}

export interface AcademicClass {
  id: string;
  courseId: string;
  courseCode?: string;
  courseName?: string;
  credits?: number;
  lecturerId: string;
  lecturerName?: string;
  term: string;
  section: string;
  isFinalized: boolean;
  finalizedBy?: string | null;
  finalizedAt?: Date | null;
}

export interface Enrollment {
  id: string;
  classId: string;
  studentId: string;
}

export interface Grade {
  id: string;
  classId: string;
  studentId: string;
  studentNim?: string;
  studentName?: string;
  score: number;
  gradeLetter?: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TranscriptEntry {
  id: string;
  studentId: string;
  classId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  credits: number;
  score: number;
  gradeLetter: string;
  syncedAt: Date;
  sourceVersion: number;
}

export interface AccessTokenClaims {
  sub: string;
  role: UserRole;
  nim?: string;
  nip?: string;
  username: string;
  fullName: string;
  token_use: 'access';
  jti: string;
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
}

export interface ServiceTokenClaims {
  sub: string;
  role: 'service';
  token_use: 'service';
  scope: string;
  jti: string;
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
}

export type TokenClaims = AccessTokenClaims | ServiceTokenClaims;

export type AuditDecision = 'ALLOW' | 'DENY';
export type SubjectType = 'user' | 'service' | 'anonymous';

export interface AuditEventRecord {
  id: string;
  occurredAt: Date;
  subjectId: string;
  subjectType: SubjectType;
  method: string;
  path: string;
  deviceId: string;
  decision: AuditDecision;
  reasonCode: string;
  requestId: string;
}

export interface PolicyDecision {
  allowed: boolean;
  reasonCode: string;
  message?: string;
  httpStatus?: number;
}
