import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const rootDir = process.cwd();
const keysDir = path.resolve(rootDir, 'keys');
const privateKeyPath = path.join(keysDir, 'private_key.pem');
const publicKeyPath = path.join(keysDir, 'public_key.pem');

export const config = {
  env: process.env.NODE_ENV || 'development',
  gateway: {
    port: Number.parseInt(process.env.GATEWAY_PORT || process.env.PORT || '3000', 10),
    url: process.env.GATEWAY_URL || 'http://localhost:3000',
  },
  services: {
    nilai: {
      port: Number.parseInt(process.env.SERVICE_NILAI_PORT || '3001', 10),
      url: process.env.SERVICE_NILAI_URL || 'http://localhost:3001',
    },
    transkrip: {
      port: Number.parseInt(process.env.SERVICE_TRANSKRIP_PORT || '3002', 10),
      url: process.env.SERVICE_TRANSKRIP_URL || 'http://localhost:3002',
    },
  },
  frontend: {
    port: Number.parseInt(process.env.FRONTEND_PORT || '5173', 10),
    url: process.env.FRONTEND_URL || 'http://localhost:5173',
  },
  security: {
    gatewaySecret: process.env.GATEWAY_SECRET || 'sec_zt_gateway_prod_9f482a17cb6e310d54a28f110cbe77',
    accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '10m',
    refreshTokenTtl: process.env.REFRESH_TOKEN_TTL || '1d',
    serviceTokenTtl: process.env.SERVICE_TOKEN_TTL || '5m',
    jwtIssuer: process.env.JWT_ISSUER || 'zero-trust-gateway',
    jwtAudience: process.env.JWT_AUDIENCE || 'zero-trust-system',
    serviceClientId: process.env.SERVICE_CLIENT_ID || 'grades-service-client',
    serviceClientSecret: process.env.SERVICE_CLIENT_SECRET || 'grades_client_super_secret_key_8820',
  },
  accessWindow: {
    start: process.env.ACCESS_WINDOW_START || '07:00',
    end: process.env.ACCESS_WINDOW_END || '21:00',
    timezone: process.env.ACCESS_TIMEZONE || 'Asia/Jakarta',
  },
  database: {
    host: process.env.PGHOST || '127.0.0.1',
    port: Number.parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '##fathirdatabase$$1014',
    database: process.env.PGDATABASE || 'zero_trust_db',
  },
  keys: {
    privateKeyPath,
    publicKeyPath,
    getPrivateKey(): string {
      if (!fs.existsSync(privateKeyPath)) {
        throw new Error(`RSA Private key not found at ${privateKeyPath}. Please run 'npm run keys:gen' first.`);
      }
      return fs.readFileSync(privateKeyPath, 'utf8');
    },
    getPublicKey(): string {
      if (!fs.existsSync(publicKeyPath)) {
        throw new Error(`RSA Public key not found at ${publicKeyPath}. Please run 'npm run keys:gen' first.`);
      }
      return fs.readFileSync(publicKeyPath, 'utf8');
    },
  },
};
