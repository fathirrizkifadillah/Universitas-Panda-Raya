import express from 'express';
import helmet from 'helmet';
import { config } from '../../shared/src/config.js';
import { verifyInternalAccess } from './middleware/verifyInternalAccess.js';
import { transkripRouter } from './routes/transkripRoutes.js';
import { pool } from '../../database/src/client.js';

export function createTranskripApp(): express.Application {
  const app = express();

  app.use(helmet());
  app.use(express.json());

  // Health and Readiness
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'service-transkrip', timestamp: new Date().toISOString() });
  });

  app.get('/ready', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.status(200).json({ status: 'ready', database: 'connected' });
    } catch (err: any) {
      res.status(503).json({ status: 'unready', error: 'database_unavailable' });
    }
  });

  // Protect all domain routes
  app.use(verifyInternalAccess);
  app.use(transkripRouter);

  return app;
}

export function startTranskripServer() {
  const app = createTranskripApp();
  const port = config.services.transkrip.port;

  const server = app.listen(port, () => {
    console.log(`[SERVICE TRANSKRIP] Running on port ${port} in ${config.env} mode`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[SERVICE TRANSKRIP] Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      console.log('[SERVICE TRANSKRIP] HTTP server closed.');
      await pool.end();
      console.log('[SERVICE TRANSKRIP] Database pool closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  startTranskripServer();
}
