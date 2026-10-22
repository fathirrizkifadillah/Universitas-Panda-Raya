import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from '../../shared/src/config.js';
import { requestContextMiddleware } from './middleware/requestContext.js';
import { sanitizeHeadersMiddleware } from './middleware/sanitizeHeaders.js';
import { evaluatePolicy } from './policy/policyEngine.js';
import { logAuditEvent } from './audit/auditLogger.js';
import {
  loginHandler,
  refreshHandler,
  logoutHandler,
  serviceAuthHandler,
  meHandler,
} from './controllers/authController.js';
import { getAuditTrailHandler } from './controllers/auditController.js';
import { createServiceProxy } from './proxy/serviceProxy.js';
import { pool } from '../../database/src/client.js';

export function createApp(): express.Application {
  const app = express();

  // Basic security hardening
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const allowedExact = [
          config.frontend.url,
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          'http://localhost:4173',
          'http://127.0.0.1:4173',
        ];
        if (
          allowedExact.includes(origin) ||
          origin.endsWith('.vercel.app') ||
          origin.endsWith('.netlify.app') ||
          origin.endsWith('.ngrok-free.app') ||
          origin.endsWith('.ngrok.io') ||
          origin.endsWith('.ngrok-free.dev')
        ) {
          return callback(null, true);
        }
        // In local/demo mode, allow any origin to facilitate tunneling & remote demos
        return callback(null, true);
      },
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-ID', 'X-Request-ID', 'X-Mock-Time'],
      exposedHeaders: ['X-Request-ID'],
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  // Request context & header sanitization
  app.use(requestContextMiddleware);
  app.use(sanitizeHeadersMiddleware);

  // Health and Readiness
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() });
  });

  app.get('/ready', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.status(200).json({ status: 'ready', database: 'connected' });
    } catch (err: any) {
      res.status(503).json({ status: 'unready', error: 'database_unavailable' });
    }
  });

  // Auth Endpoints (PEP Public/Service Entry Points)
  app.post('/auth/login', loginHandler);
  app.post('/auth/refresh', refreshHandler);
  app.post('/auth/logout', logoutHandler);
  app.post('/auth/service', serviceAuthHandler);

  // Policy Enforcement Point (PEP) Middleware for all downstream resources
  app.use(async (req, res, next) => {
    // If request already handled by /auth or health, continue
    if (req.path.startsWith('/auth/') || req.path === '/health' || req.path === '/ready') {
      return next();
    }

    try {
      const { decision, context } = await evaluatePolicy(req);

      if (!decision.allowed) {
        // Log DENY event
        await logAuditEvent({
          subjectId: context.subjectId,
          subjectType: context.subjectType,
          method: req.method,
          path: req.path,
          deviceId: context.deviceId || 'unknown',
          decision: 'DENY',
          reasonCode: decision.reasonCode,
          requestId: req.requestId,
        });

        res.status(decision.httpStatus || 403).json({
          success: false,
          error: decision.reasonCode,
          message: decision.message || 'Akses ditolak oleh kebijakan keamanan Zero Trust',
        });
        return;
      }

      // Log ALLOW event
      await logAuditEvent({
        subjectId: context.subjectId,
        subjectType: context.subjectType,
        method: req.method,
        path: req.path,
        deviceId: context.deviceId || 'internal',
        decision: 'ALLOW',
        reasonCode: decision.reasonCode,
        requestId: req.requestId,
      });

      // Pass userClaims down for internal handlers if needed
      (req as any).userClaims = context.tokenClaims;
      next();
    } catch (err) {
      console.error('[PEP POLICY EVALUATION ERROR]', err);
      res.status(500).json({
        success: false,
        error: 'POLICY_EVALUATION_ERROR',
        message: 'Terjadi kegagalan saat mengevaluasi kebijakan akses',
      });
    }
  });

  // Internal Gateway-handled endpoints
  app.get('/me', meHandler);
  app.get('/audit', getAuditTrailHandler);

  // Proxies to Microservices (Port 3001 & 3002)
  const nilaiProxy = createServiceProxy(config.services.nilai.url);
  const transkripProxy = createServiceProxy(config.services.transkrip.url);

  app.use((req, res, next) => {
    if (req.path.startsWith('/nilai') || req.path.startsWith('/kelas')) {
      return (nilaiProxy as any)(req, res, next);
    }
    if (req.path.startsWith('/transkrip')) {
      return (transkripProxy as any)(req, res, next);
    }
    next();
  });

  // 404 Handler
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: 'RESOURCE_NOT_FOUND',
      message: 'Endpoint tidak ditemukan',
    });
  });

  return app;
}

export function startGatewayServer() {
  const app = createApp();
  const port = config.gateway.port;

  const server = app.listen(port, () => {
    console.log(`[GATEWAY] API Gateway (PEP) running on port ${port} in ${config.env} mode`);
    console.log(`[GATEWAY] Routing /nilai* & /kelas* -> ${config.services.nilai.url}`);
    console.log(`[GATEWAY] Routing /transkrip* -> ${config.services.transkrip.url}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[GATEWAY] Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      console.log('[GATEWAY] HTTP server closed.');
      await pool.end();
      console.log('[GATEWAY] Database pool closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  startGatewayServer();
}
