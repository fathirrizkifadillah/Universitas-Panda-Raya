import express from 'express';
import path from 'node:path';
import { startGatewayServer } from '../packages/gateway/src/server.js';
import { startNilaiServer } from '../packages/service-nilai/src/server.js';
import { startTranskripServer } from '../packages/service-transkrip/src/server.js';
import { runSeed } from '../packages/database/src/seed.js';
import { generateKeys } from './generate-keys.js';

async function main() {
  console.log('[E2E SERVERS] Initializing keys and database seed...');
  generateKeys();
  await runSeed();

  console.log('[E2E SERVERS] Starting backend microservices...');
  startNilaiServer();
  startTranskripServer();
  startGatewayServer();

  console.log('[E2E SERVERS] Starting frontend static server on port 5173...');
  const frontendApp = express();
  const distPath = path.resolve(process.cwd(), 'packages/frontend/dist');
  frontendApp.use(express.static(distPath));
  frontendApp.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  const frontendServer = frontendApp.listen(5173, () => {
    console.log('[E2E SERVERS] Frontend running on http://localhost:5173');
    console.log('[E2E SERVERS] All servers running and ready for Playwright E2E!');
  });

  const shutdown = () => {
    console.log('[E2E SERVERS] Shutting down all servers...');
    frontendServer.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[E2E SERVERS ERROR]', err);
  process.exit(1);
});
