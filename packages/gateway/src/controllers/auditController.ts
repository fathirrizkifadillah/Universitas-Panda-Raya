import type { Request, Response } from 'express';
import { query } from '../../../database/src/client.js';

export async function getAuditTrailHandler(req: Request, res: Response): Promise<void> {
  const limit = Math.min(Number.parseInt((req.query.limit as string) || '50', 10), 100);
  const offset = Math.max(Number.parseInt((req.query.offset as string) || '0', 10), 0);

  const auditResults = await query(`
    SELECT
      id,
      occurred_at as "occurredAt",
      subject_id as "subjectId",
      subject_type as "subjectType",
      method,
      path,
      device_id as "deviceId",
      decision,
      reason_code as "reasonCode",
      request_id as "requestId"
    FROM audit_events
    ORDER BY occurred_at DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);

  const totalResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM audit_events');

  res.status(200).json({
    success: true,
    data: {
      total: Number.parseInt(totalResult.rows[0].count, 10),
      limit,
      offset,
      events: auditResults.rows,
    },
  });
}
