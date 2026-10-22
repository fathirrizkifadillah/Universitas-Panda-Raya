import type { Request, Response } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { config } from '../../../shared/src/config.js';

export function createServiceProxy(targetUrl: string) {
  return createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    headers: {
      'X-Gateway-Secret': config.security.gatewaySecret,
    },
    on: {
      proxyReq: (proxyReq, req: any) => {
        // Enforce server-side X-Gateway-Secret header
        proxyReq.setHeader('X-Gateway-Secret', config.security.gatewaySecret);

        // Preserve request ID
        if (req.requestId) {
          proxyReq.setHeader('X-Request-ID', req.requestId);
        }

        // Restream request body if already parsed by express.json()
        fixRequestBody(proxyReq, req);
      },
      error: (err, _req, res) => {
        console.error('[GATEWAY PROXY ERROR] Failed to connect to downstream service:', err.message);
        const expressRes = res as Response;
        if (!expressRes.headersSent) {
          expressRes.status(503).json({
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            message: 'Layanan internal sementara tidak dapat dihubungi. Silakan coba beberapa saat lagi.',
          });
        }
      },
    },
  });
}
