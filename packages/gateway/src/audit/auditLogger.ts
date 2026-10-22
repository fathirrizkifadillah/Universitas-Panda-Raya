import { query } from '../../../database/src/client.js';
import type { AuditDecision, SubjectType } from '../../../shared/src/types.js';

export interface AuditLogParams {
  subjectId: string;
  subjectType: SubjectType;
  method: string;
  path: string;
  deviceId: string;
  decision: AuditDecision;
  reasonCode: string;
  requestId: string;
}

export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  try {
    // Redact any possible token/password in path or subject
    const sanitizedPath = params.path.split('?')[0]; // strip query strings
    const sanitizedSubjectId = params.subjectId.length > 100 ? params.subjectId.slice(0, 100) : params.subjectId;
    const sanitizedDeviceId = params.deviceId.length > 100 ? params.deviceId.slice(0, 100) : params.deviceId;

    await query(`
      INSERT INTO audit_events (
        occurred_at, subject_id, subject_type, method, path,
        device_id, decision, reason_code, request_id
      )
      VALUES (NOW(), $1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      sanitizedSubjectId || 'anonymous',
      params.subjectType || 'anonymous',
      params.method.toUpperCase(),
      sanitizedPath,
      sanitizedDeviceId || 'none',
      params.decision,
      params.reasonCode,
      params.requestId || 'unknown',
    ]);
  } catch (error) {
    console.error('[AUDIT ERROR] Failed to record audit log event:', error);
  }
}
