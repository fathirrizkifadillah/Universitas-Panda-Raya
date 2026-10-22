import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const keysDir = path.resolve(process.cwd(), 'keys');
const privateKeyPath = path.join(keysDir, 'private_key.pem');
const publicKeyPath = path.join(keysDir, 'public_key.pem');

export function generateKeys(force = false): { privateKey: string; publicKey: string } {
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }

  if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath) && !force) {
    console.log('[KEYS] RSA 2048-bit keypair already exists. Skipping overwrite.');
    return {
      privateKey: fs.readFileSync(privateKeyPath, 'utf8'),
      publicKey: fs.readFileSync(publicKeyPath, 'utf8'),
    };
  }

  console.log('[KEYS] Generating new RSA 2048-bit asymmetric keypair for RS256 JWT...');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  fs.writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });
  fs.writeFileSync(publicKeyPath, publicKey, { mode: 0o644 });

  console.log(`[KEYS] Private key saved to: ${privateKeyPath}`);
  console.log(`[KEYS] Public key saved to: ${publicKeyPath}`);

  return { privateKey, publicKey };
}

// Direct execution check
if (process.argv[1]?.includes('generate-keys')) {
  const force = process.argv.includes('--force');
  generateKeys(force);
}
