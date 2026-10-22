import { Router } from 'express';
import { query, getClient } from '../../../database/src/client.js';
import { config } from '../../../shared/src/config.js';
import { calculateGradeLetter } from '../../../shared/src/crypto.js';
import type { AccessTokenClaims } from '../../../shared/src/types.js';

export const nilaiRouter = Router();

// GET /nilai
nilaiRouter.get('/nilai', async (req, res) => {
  const userClaims = req.userClaims as AccessTokenClaims;

  if (userClaims.role === 'mahasiswa') {
    // Return all grades for this student
    const gradesResult = await query(`
      SELECT
        g.id as "gradeId",
        g.class_id as "classId",
        c.code as "courseCode",
        c.name as "courseName",
        c.credits,
        cl.term,
        cl.section,
        u.full_name as "lecturerName",
        g.score,
        cl.is_finalized as "isFinalized",
        g.updated_at as "updatedAt"
      FROM grades g
      JOIN classes cl ON cl.id = g.class_id
      JOIN courses c ON c.id = cl.course_id
      JOIN users u ON u.id = cl.lecturer_id
      WHERE g.student_id = $1
      ORDER BY c.code ASC
    `, [userClaims.sub]);

    const enriched = gradesResult.rows.map(row => ({
      ...row,
      gradeLetter: calculateGradeLetter(Number(row.score)),
    }));

    res.status(200).json({
      success: true,
      data: enriched,
    });
    return;
  }

  if (userClaims.role === 'dosen') {
    // Return classes taught by this lecturer with enrolled students & grades
    const classesResult = await query(`
      SELECT
        cl.id as "classId",
        c.code as "courseCode",
        c.name as "courseName",
        c.credits,
        cl.term,
        cl.section,
        cl.is_finalized as "isFinalized",
        cl.finalized_at as "finalizedAt"
      FROM classes cl
      JOIN courses c ON c.id = cl.course_id
      WHERE cl.lecturer_id = $1
      ORDER BY c.code ASC
    `, [userClaims.sub]);

    // For each class, fetch enrolled students and grades
    const classes = [];
    for (const cl of classesResult.rows) {
      const studentsResult = await query(`
        SELECT
          g.id as "gradeId",
          u.id as "studentId",
          u.nim_nip as "nim",
          u.full_name as "fullName",
          g.score,
          g.updated_at as "updatedAt"
        FROM grades g
        JOIN users u ON u.id = g.student_id
        WHERE g.class_id = $1
        ORDER BY u.nim_nip ASC
      `, [cl.classId]);

      const students = studentsResult.rows.map(s => ({
        ...s,
        gradeLetter: calculateGradeLetter(Number(s.score)),
      }));

      classes.push({
        ...cl,
        students,
      });
    }

    res.status(200).json({
      success: true,
      data: classes,
    });
    return;
  }

  res.status(403).json({
    success: false,
    error: 'ROLE_NOT_PERMITTED',
    message: 'Peran tidak diizinkan mengakses data nilai',
  });
});

// PUT /nilai/:id
nilaiRouter.put('/nilai/:id', async (req, res) => {
  const gradeId = req.params.id;
  const { score } = req.body || {};
  const userClaims = req.userClaims as AccessTokenClaims;

  const numScore = Number(score);
  if (isNaN(numScore) || numScore < 0 || numScore > 100) {
    res.status(400).json({
      success: false,
      error: 'INVALID_SCORE',
      message: 'Nilai harus berupa angka numerik valid antara 0.00 hingga 100.00',
    });
    return;
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Lock and check class status
    const gradeCheck = await client.query<{
      class_id: string;
      lecturer_id: string;
      is_finalized: boolean;
    }>(`
      SELECT g.class_id, cl.lecturer_id, cl.is_finalized
      FROM grades g
      JOIN classes cl ON cl.id = g.class_id
      WHERE g.id = $1
      FOR UPDATE
    `, [gradeId]);

    if (gradeCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, error: 'GRADE_NOT_FOUND', message: 'Data nilai tidak ditemukan' });
      return;
    }

    const row = gradeCheck.rows[0];

    if (row.lecturer_id !== userClaims.sub) {
      await client.query('ROLLBACK');
      res.status(403).json({ success: false, error: 'NOT_CLASS_LECTURER', message: 'Anda bukan pengampu kelas ini' });
      return;
    }

    if (row.is_finalized) {
      await client.query('ROLLBACK');
      res.status(409).json({ success: false, error: 'CLASS_FINALIZED', message: 'Kelas telah difinalisasi dan tidak dapat diubah' });
      return;
    }

    const updateRes = await client.query(`
      UPDATE grades
      SET score = $1, updated_by = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING id, score, updated_at
    `, [numScore, userClaims.sub, gradeId]);

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Nilai berhasil disimpan',
      data: {
        gradeId: updateRes.rows[0].id,
        score: Number(updateRes.rows[0].score),
        gradeLetter: calculateGradeLetter(numScore),
        updatedAt: updateRes.rows[0].updated_at,
      },
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[SERVICE NILAI ERROR] Failed to update grade:', err);
    res.status(500).json({ success: false, error: 'DB_ERROR', message: 'Gagal memperbarui nilai' });
  } finally {
    client.release();
  }
});

// POST /kelas/:id/finalisasi
nilaiRouter.post('/kelas/:id/finalisasi', async (req, res) => {
  const classId = req.params.id;
  const userClaims = req.userClaims as AccessTokenClaims;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const classCheck = await client.query<{
      id: string;
      course_id: string;
      lecturer_id: string;
      is_finalized: boolean;
    }>(`
      SELECT id, course_id, lecturer_id, is_finalized
      FROM classes
      WHERE id = $1
      FOR UPDATE
    `, [classId]);

    if (classCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, error: 'CLASS_NOT_FOUND', message: 'Kelas tidak ditemukan' });
      return;
    }

    const cl = classCheck.rows[0];

    if (cl.lecturer_id !== userClaims.sub) {
      await client.query('ROLLBACK');
      res.status(403).json({ success: false, error: 'NOT_CLASS_LECTURER', message: 'Anda bukan pengampu kelas ini' });
      return;
    }

    if (cl.is_finalized) {
      await client.query('ROLLBACK');
      res.status(409).json({ success: false, error: 'ALREADY_FINALIZED', message: 'Kelas telah difinalisasi sebelumnya' });
      return;
    }

    // 1. Update class to finalized
    await client.query(`
      UPDATE classes
      SET is_finalized = TRUE, finalized_by = $1, finalized_at = NOW()
      WHERE id = $2
    `, [userClaims.sub, classId]);

    // 2. Fetch all grades in this class
    const gradesResult = await client.query<{
      student_id: string;
      score: string;
    }>(`
      SELECT student_id, score
      FROM grades
      WHERE class_id = $1
    `, [classId]);

    const syncPayload = {
      classId: cl.id,
      courseId: cl.course_id,
      entries: gradesResult.rows.map(g => ({
        studentId: g.student_id,
        score: Number(g.score),
        gradeLetter: calculateGradeLetter(Number(g.score)),
      })),
    };

    // 3. Record Outbox Event (Transactional Outbox Pattern)
    await client.query(`
      INSERT INTO outbox_events (event_type, aggregate_id, payload, status)
      VALUES ('CLASS_FINALIZED', $1, $2, 'PENDING')
    `, [cl.id, JSON.stringify(syncPayload)]);

    await client.query('COMMIT');

    // 4. Inisiasi Service-to-Service Sync melalui API Gateway (PEP)
    // Sesuai mandat: Service Nilai meminta service token ke Gateway, lalu memanggil endpoint sync lewat Gateway
    let syncSuccess = false;
    let syncErrorMsg = '';

    try {
      const authRes = await fetch(`${config.gateway.url}/auth/service`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: config.security.serviceClientId,
          clientSecret: config.security.serviceClientSecret,
        }),
      });

      if (!authRes.ok) {
        throw new Error(`Failed to obtain service token: HTTP ${authRes.status}`);
      }

      const authData = (await authRes.json()) as any;
      const serviceToken = authData.data.serviceToken;

      // Call /transkrip/sinkron VIA GATEWAY
      const syncRes = await fetch(`${config.gateway.url}/transkrip/sinkron`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceToken}`,
        },
        body: JSON.stringify(syncPayload),
      });

      if (syncRes.ok) {
        syncSuccess = true;
        // Mark outbox event processed
        await query(`
          UPDATE outbox_events
          SET status = 'PROCESSED', processed_at = NOW()
          WHERE aggregate_id = $1 AND event_type = 'CLASS_FINALIZED'
        `, [cl.id]);
      } else {
        const errorText = await syncRes.text();
        syncErrorMsg = `Downstream sync failed with HTTP ${syncRes.status}: ${errorText}`;
        console.error('[SERVICE NILAI SYNC ERROR]', syncErrorMsg);
      }
    } catch (netErr: any) {
      syncErrorMsg = `Downstream sync error: ${netErr.message}`;
      console.warn('[SERVICE NILAI SYNC WARNING] Immediate sync failed. Event stored in outbox for retry:', netErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Kelas berhasil difinalisasi' + (syncSuccess ? ' dan nilai berhasil disinkronkan ke transkrip.' : ' (sinkronisasi dijadwalkan ulang via outbox).'),
      data: {
        classId: cl.id,
        isFinalized: true,
        syncedDirectly: syncSuccess,
        studentsCount: gradesResult.rows.length,
        syncNote: syncErrorMsg || 'Sinkronisasi sukses lewat API Gateway.',
      },
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[SERVICE NILAI FINALISASI ERROR]', err);
    res.status(500).json({ success: false, error: 'DB_ERROR', message: 'Gagal memfinalisasi kelas' });
  } finally {
    client.release();
  }
});
