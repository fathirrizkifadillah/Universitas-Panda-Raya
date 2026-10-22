export type UserRole = 'mahasiswa' | 'dosen' | 'admin';

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  nimNip: string;
}

export interface Device {
  device_id: string;
  label: string;
  is_active: boolean;
  last_seen_at?: string;
}

export interface GradeItem {
  gradeId: string;
  classId: string;
  courseCode: string;
  courseName: string;
  credits: number;
  term: string;
  section: string;
  lecturerName: string;
  score: number;
  gradeLetter: string;
  isFinalized: boolean;
  updatedAt: string;
}

export interface StudentGrade {
  gradeId: string;
  studentId: string;
  nim: string;
  fullName: string;
  score: number;
  gradeLetter: string;
  updatedAt: string;
}

export interface LecturerClass {
  classId: string;
  courseCode: string;
  courseName: string;
  credits: number;
  term: string;
  section: string;
  isFinalized: boolean;
  finalizedAt?: string | null;
  students: StudentGrade[];
}

export interface TranscriptEntry {
  id: string;
  courseCode: string;
  courseName: string;
  credits: number;
  score: number;
  gradeLetter: string;
  gradePoint: number;
  term: string;
  syncedAt: string;
}

export interface TranscriptData {
  student: {
    id: string;
    nim: string;
    fullName: string;
  };
  summary: {
    totalCredits: number;
    gpa: number;
    totalCourses: number;
  };
  entries: TranscriptEntry[];
}

export interface AuditEventItem {
  id: string;
  occurredAt: string;
  subjectId: string;
  subjectType: string;
  method: string;
  path: string;
  deviceId: string;
  decision: 'ALLOW' | 'DENY';
  reasonCode: string;
  requestId: string;
}
