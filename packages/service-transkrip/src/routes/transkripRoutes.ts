import { Router } from 'express';
import crypto from 'node:crypto';
import { query, getClient } from '../../../database/src/client.js';
import { gradeLetterToPoint } from '../../../shared/src/crypto.js';
import type { ServiceTokenClaims } from '../../../shared/src/types.js';

export const transkripRouter = Router();

// GET /transkrip/:nim
transkripRouter.get('/transkrip/:nim', async (req, res) => {
  const nim = req.params.nim;

  // 1. Fetch student
  const studentResult = await query<{
    id: string;
    nim_nip: string;
    full_name: string;
  }>('SELECT id, nim_nip, full_name FROM users WHERE nim_nip = $1 AND role = $2', [nim, 'mahasiswa']);

  if (studentResult.rows.length === 0) {
    res.status(404).json({
      success: false,
      error: 'STUDENT_NOT_FOUND',
      message: `Mahasiswa dengan NIM ${nim} tidak ditemukan`,
    });
    return;
  }

  const student = studentResult.rows[0];

  // 2. Fetch transcript entries
  const entriesResult = await query<{
    id: string;
    course_id: string;
    course_code: string;
    course_name: string;
    credits: number;
    score: string;
    grade_letter: string;
    synced_at: Date;
    term: string;
  }>(`
    SELECT
      t.id,
      t.course_id,
      c.code as course_code,
      c.name as course_name,
      t.credits,
      t.score,
      t.grade_letter,
      t.synced_at,
      cl.term
    FROM transcript_entries t
    JOIN courses c ON c.id = t.course_id
    JOIN classes cl ON cl.id = t.class_id
    WHERE t.student_id = $1
    ORDER BY c.code ASC
  `, [student.id]);

  // 3. Calculate summary metrics (Total SKS & IPK)
  let totalCredits = 0;
  let totalQualityPoints = 0;

  const entries = entriesResult.rows.map(entry => {
    const credits = Number(entry.credits);
    const score = Number(entry.score);
    const point = gradeLetterToPoint(entry.grade_letter);

    totalCredits += credits;
    totalQualityPoints += point * credits;

    return {
      id: entry.id,
      courseCode: entry.course_code,
      courseName: entry.course_name,
      credits,
      score,
      gradeLetter: entry.grade_letter,
      gradePoint: point,
      term: entry.term,
      syncedAt: entry.synced_at,
    };
  });

  const gpa = totalCredits > 0 ? Number((totalQualityPoints / totalCredits).toFixed(2)) : 0.00;

  res.status(200).json({
    success: true,
    data: {
      student: {
        id: student.id,
        nim: student.nim_nip,
        fullName: student.full_name,
      },
      summary: {
        totalCredits,
        gpa,
        totalCourses: entries.length,
      },
      entries,
    },
  });
});

// POST /transkrip/sinkron (Idempotent sync endpoint, service token only)
transkripRouter.post('/transkrip/sinkron', async (req, res) => {
  const userClaims = req.userClaims as ServiceTokenClaims;

  // Strict check: only service tokens are allowed here!
  if (!userClaims || userClaims.role !== 'service' || userClaims.token_use !== 'service') {
    res.status(403).json({
      success: false,
      error: 'FORBIDDEN_CALLER',
      message: 'Hanya Service Nilai dengan token service yang diizinkan memanggil endpoint sinkronisasi transkrip',
    });
    return;
  }

  const { classId, courseId, entries } = req.body || {};

  if (!classId || !courseId || !Array.isArray(entries)) {
    res.status(400).json({
      success: false,
      error: 'INVALID_PAYLOAD',
      message: 'classId, courseId, dan entries (array) wajib disertakan',
    });
    return;
  }

  // Fetch course credits
  const courseRes = await query<{ credits: number }>('SELECT credits FROM courses WHERE id = $1', [courseId]);
  if (courseRes.rows.length === 0) {
    res.status(404).json({ success: false, error: 'COURSE_NOT_FOUND', message: 'Mata kuliah tidak ditemukan' });
    return;
  }
  const credits = courseRes.rows[0].credits;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    let processedCount = 0;

    for (const item of entries) {
      const studentId = item.studentId;
      const score = Number(item.score);
      const gradeLetter = item.gradeLetter;

      // Idempotent UPSERT per student and class (MySQL syntax)
      const entryId = crypto.randomUUID();
      await client.query(`
        INSERT INTO transcript_entries (
          id, student_id, class_id, course_id, score, grade_letter, credits, synced_at, source_version
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 1)
        ON DUPLICATE KEY UPDATE
          score = VALUES(score),
          grade_letter = VALUES(grade_letter),
          credits = VALUES(credits),
          synced_at = NOW(),
          source_version = transcript_entries.source_version + 1;
      `, [entryId, studentId, classId, courseId, score, gradeLetter, credits]);

      processedCount++;
    }

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Sinkronisasi transkrip berhasil diproses secara idempoten',
      data: {
        classId,
        processedCount,
      },
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[SERVICE TRANSKRIP SYNC ERROR]', err);
    res.status(500).json({ success: false, error: 'SYNC_ERROR', message: 'Gagal memproses sinkronisasi transkrip' });
  } finally {
    client.release();
  }
});
