import type { Request } from 'express';
import { verifyToken } from '../../../shared/src/crypto.js';
import type { TokenClaims, AccessTokenClaims, ServiceTokenClaims, PolicyDecision } from '../../../shared/src/types.js';
import { query } from '../../../database/src/client.js';
import { isWithinAccessWindow } from './timeEvaluator.js';

export interface EvaluatedContext {
  tokenClaims?: TokenClaims;
  deviceId?: string;
  subjectId: string;
  subjectType: 'user' | 'service' | 'anonymous';
}

export async function evaluatePolicy(req: Request): Promise<{ decision: PolicyDecision; context: EvaluatedContext }> {
  const method = req.method.toUpperCase();
  const path = req.path;
  const authHeader = req.headers.authorization;
  const deviceId = (req.headers['x-device-id'] as string) || '';
  const mockTime = (req.headers['x-mock-time'] as string) || undefined;

  // 1. Public endpoints & preflights
  if (method === 'OPTIONS' || path.startsWith('/auth/') || path === '/health' || path === '/ready') {
    return {
      decision: { allowed: true, reasonCode: 'PUBLIC_ENDPOINT' },
      context: {
        subjectId: 'anonymous',
        subjectType: 'anonymous',
        deviceId,
      },
    };
  }

  // 2. Token verification
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      decision: {
        allowed: false,
        reasonCode: 'MISSING_AUTHORIZATION_TOKEN',
        message: 'Header Authorization Bearer token wajib disertakan',
        httpStatus: 401,
      },
      context: {
        subjectId: 'anonymous',
        subjectType: 'anonymous',
        deviceId,
      },
    };
  }

  const rawToken = authHeader.slice(7).trim();
  let tokenClaims: TokenClaims;

  try {
    tokenClaims = verifyToken(rawToken);
  } catch (error: any) {
    const isExpired = error.name === 'TokenExpiredError';
    return {
      decision: {
        allowed: false,
        reasonCode: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN_SIGNATURE',
        message: isExpired ? 'Token akses telah kedaluwarsa' : 'Tanda tangan token tidak valid',
        httpStatus: 401,
      },
      context: {
        subjectId: 'anonymous',
        subjectType: 'anonymous',
        deviceId,
      },
    };
  }

  // Context setup
  const subjectId = tokenClaims.sub;
  const isServiceToken = tokenClaims.token_use === 'service';
  const subjectType = isServiceToken ? 'service' : 'user';

  const context: EvaluatedContext = {
    tokenClaims,
    deviceId,
    subjectId,
    subjectType,
  };

  // 3. User device verification (Zero Trust context verification)
  if (!isServiceToken) {
    if (!deviceId) {
      return {
        decision: {
          allowed: false,
          reasonCode: 'MISSING_DEVICE_ID',
          message: 'Header X-Device-ID wajib disertakan untuk verifikasi konteks perangkat',
          httpStatus: 403,
        },
        context,
      };
    }

    const deviceResult = await query<{ is_active: boolean }>(
      'SELECT is_active FROM devices WHERE user_id = $1 AND device_id = $2',
      [tokenClaims.sub, deviceId]
    );

    if (deviceResult.rows.length === 0 || !deviceResult.rows[0].is_active) {
      return {
        decision: {
          allowed: false,
          reasonCode: 'UNKNOWN_OR_INACTIVE_DEVICE',
          message: 'Perangkat tidak terdaftar atau telah dinonaktifkan',
          httpStatus: 403,
        },
        context,
      };
    }
  }

  // 4. Endpoint-specific Authorization Policies

  // A. Transcript Synchronization (/transkrip/sinkron)
  if (path === '/transkrip/sinkron') {
    const validSubs = ['grades-service', 'grades-service-client'];
    if (!isServiceToken || tokenClaims.role !== 'service' || !validSubs.includes(tokenClaims.sub)) {
      return {
        decision: {
          allowed: false,
          reasonCode: 'SERVICE_TOKEN_REQUIRED',
          message: 'Hanya Service Nilai dengan token service valid yang dapat menyinkronkan transkrip',
          httpStatus: 403,
        },
        context,
      };
    }

    return {
      decision: { allowed: true, reasonCode: 'SERVICE_SYNC_ALLOWED' },
      context,
    };
  }

  // From here, require user access token (reject service token trying to call user endpoints)
  if (isServiceToken) {
    return {
      decision: {
        allowed: false,
        reasonCode: 'USER_TOKEN_REQUIRED',
        message: 'Endpoint ini memerlukan token akses pengguna',
        httpStatus: 403,
      },
      context,
    };
  }

  const userClaims = tokenClaims as AccessTokenClaims;
  const role = userClaims.role;

  // B. Current Session Info (/me)
  if (path === '/me' && method === 'GET') {
    return {
      decision: { allowed: true, reasonCode: 'SESSION_INFO_ALLOWED' },
      context,
    };
  }

  // C. Audit Trail Viewer (/audit) - Admin Only
  if (path.startsWith('/audit')) {
    if (role !== 'admin') {
      return {
        decision: {
          allowed: false,
          reasonCode: 'ADMIN_ROLE_REQUIRED',
          message: 'Hanya peran admin yang berhak mengakses audit trail',
          httpStatus: 403,
        },
        context,
      };
    }
    return {
      decision: { allowed: true, reasonCode: 'AUDIT_TRAIL_ALLOWED' },
      context,
    };
  }

  // D. Academic Transcript (/transkrip/:nim)
  if (path.startsWith('/transkrip/')) {
    const targetNim = path.split('/')[2];

    if (role === 'admin') {
      return {
        decision: { allowed: true, reasonCode: 'ADMIN_TRANSCRIPT_ALLOWED' },
        context,
      };
    }

    if (role === 'mahasiswa') {
      if (userClaims.nim !== targetNim) {
        return {
          decision: {
            allowed: false,
            reasonCode: 'IDOR_ATTEMPT_DENIED',
            message: 'Akses ditolak: Anda hanya dapat mengakses transkrip milik Anda sendiri',
            httpStatus: 403,
          },
          context,
        };
      }
      return {
        decision: { allowed: true, reasonCode: 'STUDENT_OWN_TRANSCRIPT_ALLOWED' },
        context,
      };
    }

    return {
      decision: {
        allowed: false,
        reasonCode: 'ROLE_NOT_PERMITTED',
        message: 'Peran Anda tidak memiliki hak akses ke transkrip',
        httpStatus: 403,
      },
      context,
    };
  }

  // E. Grades Overview (/nilai) - GET
  if (path === '/nilai' && method === 'GET') {
    if (role === 'mahasiswa' || role === 'dosen') {
      return {
        decision: { allowed: true, reasonCode: 'VIEW_GRADES_ALLOWED' },
        context,
      };
    }
    return {
      decision: {
        allowed: false,
        reasonCode: 'ROLE_NOT_PERMITTED',
        message: 'Peran Anda tidak diizinkan melihat daftar nilai',
        httpStatus: 403,
      },
      context,
    };
  }

  // F. Grade Edit (/nilai/:id) - PUT
  if (path.startsWith('/nilai/') && method === 'PUT') {
    if (role !== 'dosen') {
      return {
        decision: {
          allowed: false,
          reasonCode: 'ROLE_NOT_PERMITTED',
          message: 'Hanya dosen yang dapat mengubah nilai mahasiswa',
          httpStatus: 403,
        },
        context,
      };
    }

    // Access window check (07:00 - 21:00 WIB)
    const timeCheck = isWithinAccessWindow(mockTime);
    if (!timeCheck.isWithinWindow) {
      return {
        decision: {
          allowed: false,
          reasonCode: 'OUTSIDE_ACCESS_WINDOW',
          message: `Perubahan nilai hanya diizinkan pukul ${timeCheck.windowStart} - ${timeCheck.windowEnd} ${timeCheck.timezone}`,
          httpStatus: 403,
        },
        context,
      };
    }

    const gradeId = path.split('/')[2];

    // Query ownership and finalized state
    const gradeCheck = await query<{
      lecturer_id: string;
      is_finalized: boolean;
    }>(`
      SELECT c.lecturer_id, c.is_finalized
      FROM grades g
      JOIN classes c ON c.id = g.class_id
      WHERE g.id = $1
    `, [gradeId]);

    if (gradeCheck.rows.length === 0) {
      return {
        decision: {
          allowed: false,
          reasonCode: 'RESOURCE_NOT_FOUND',
          message: 'Data nilai tidak ditemukan',
          httpStatus: 404,
        },
        context,
      };
    }

    const gradeRow = gradeCheck.rows[0];

    // Check lecturer ownership
    if (gradeRow.lecturer_id !== userClaims.sub) {
      return {
        decision: {
          allowed: false,
          reasonCode: 'NOT_CLASS_LECTURER',
          message: 'Akses ditolak: Anda bukan dosen pengampu untuk kelas ini',
          httpStatus: 403,
        },
        context,
      };
    }

    // Check if class finalized
    if (gradeRow.is_finalized) {
      return {
        decision: {
          allowed: false,
          reasonCode: 'CLASS_FINALIZED',
          message: 'Nilai kelas telah difinalisasi dan tidak dapat diubah lagi',
          httpStatus: 409,
        },
        context,
      };
    }

    return {
      decision: { allowed: true, reasonCode: 'EDIT_GRADE_ALLOWED' },
      context,
    };
  }

  // G. Class Finalization (/kelas/:id/finalisasi) - POST
  if (path.startsWith('/kelas/') && path.endsWith('/finalisasi') && method === 'POST') {
    if (role !== 'dosen') {
      return {
        decision: {
          allowed: false,
          reasonCode: 'ROLE_NOT_PERMITTED',
          message: 'Hanya dosen pengampu yang berhak memfinalisasi kelas',
          httpStatus: 403,
        },
        context,
      };
    }

    const timeCheck = isWithinAccessWindow(mockTime);
    if (!timeCheck.isWithinWindow) {
      return {
        decision: {
          allowed: false,
          reasonCode: 'OUTSIDE_ACCESS_WINDOW',
          message: `Finalisasi nilai hanya diizinkan pukul ${timeCheck.windowStart} - ${timeCheck.windowEnd} ${timeCheck.timezone}`,
          httpStatus: 403,
        },
        context,
      };
    }

    const classId = path.split('/')[2];

    const classCheck = await query<{
      lecturer_id: string;
      is_finalized: boolean;
    }>(`
      SELECT lecturer_id, is_finalized
      FROM classes
      WHERE id = $1
    `, [classId]);

    if (classCheck.rows.length === 0) {
      return {
        decision: {
          allowed: false,
          reasonCode: 'CLASS_NOT_FOUND',
          message: 'Kelas tidak ditemukan',
          httpStatus: 404,
        },
        context,
      };
    }

    const classRow = classCheck.rows[0];

    if (classRow.lecturer_id !== userClaims.sub) {
      return {
        decision: {
          allowed: false,
          reasonCode: 'NOT_CLASS_LECTURER',
          message: 'Akses ditolak: Anda bukan dosen pengampu kelas ini',
          httpStatus: 403,
        },
        context,
      };
    }

    if (classRow.is_finalized) {
      return {
        decision: {
          allowed: false,
          reasonCode: 'ALREADY_FINALIZED',
          message: 'Kelas ini sudah berstatus final',
          httpStatus: 409,
        },
        context,
      };
    }

    return {
      decision: { allowed: true, reasonCode: 'FINALIZE_CLASS_ALLOWED' },
      context,
    };
  }

  // Default Fail-Closed
  return {
    decision: {
      allowed: false,
      reasonCode: 'DEFAULT_DENY_UNMATCHED_POLICY',
      message: 'Akses ditolak secara default oleh Zero Trust Policy Engine',
      httpStatus: 403,
    },
    context,
  };
}
