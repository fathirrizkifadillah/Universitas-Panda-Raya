import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'url';
import { query } from '../../../database/src/client.js';
import type { AuditDecision, SubjectType } from '../../../shared/src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../../');
const logDir = path.join(projectRoot, 'logs');

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
  const timestamp = new Date().toISOString();
  const sanitizedPath = params.path.split('?')[0]; // strip query strings
  const sanitizedSubjectId = params.subjectId.length > 100 ? params.subjectId.slice(0, 100) : params.subjectId;
  const sanitizedDeviceId = params.deviceId.length > 100 ? params.deviceId.slice(0, 100) : params.deviceId;

  // 1. Simpan ke database MySQL / Database (Tabel audit_events)
  try {
    const auditId = crypto.randomUUID();
    await query(`
      INSERT INTO audit_events (
        id, occurred_at, subject_id, subject_type, method, path,
        device_id, decision, reason_code, request_id
      )
      VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      auditId,
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
    console.error('[AUDIT ERROR] Failed to record audit log event to database:', error);
  }

  // 2. Simpan juga ke file log lokal (logs/audit.log)
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logLine = JSON.stringify({
      timestamp,
      decision: params.decision,
      reasonCode: params.reasonCode,
      method: params.method.toUpperCase(),
      path: sanitizedPath,
      subjectId: sanitizedSubjectId,
      subjectType: params.subjectType,
      deviceId: sanitizedDeviceId,
      requestId: params.requestId,
    }) + '\n';
    fs.appendFileSync(path.join(logDir, 'audit.log'), logLine, 'utf8');
  } catch (err) {
    console.error('[AUDIT ERROR] Failed to record audit log to file:', err);
  }
}
