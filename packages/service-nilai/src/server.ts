import express from 'express';
import helmet from 'helmet';
import { config } from '../../shared/src/config.js';
import { verifyInternalAccess } from './middleware/verifyInternalAccess.js';
import { nilaiRouter } from './routes/nilaiRoutes.js';
import { pool } from '../../database/src/client.js';

export function createNilaiApp(): express.Application {
  const app = express();

  app.use(helmet());
  app.use(express.json());

  // Health and Readiness (unprotected for local monitor)
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'service-nilai', timestamp: new Date().toISOString() });
  });

  app.get('/ready', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.status(200).json({ status: 'ready', database: 'connected' });
    } catch (err: any) {
      res.status(503).json({ status: 'unready', error: 'database_unavailable' });
    }
  });

  // All domain routes require both Gateway Secret and Valid RS256 JWT
  app.use(verifyInternalAccess);
  app.use(nilaiRouter);

  return app;
}

export function startNilaiServer() {
  const app = createNilaiApp();
  const port = config.services.nilai.port;

  const server = app.listen(port, () => {
    console.log(`[SERVICE NILAI] Running on port ${port} in ${config.env} mode`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[SERVICE NILAI] Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      console.log('[SERVICE NILAI] HTTP server closed.');
      await pool.end();
      console.log('[SERVICE NILAI] Database pool closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  startNilaiServer();
}
