import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// AES-256-GCM for connection secrets. Key comes from CONNECTIONS_ENC_KEY
// (32 bytes, base64 or hex). Without a key the service refuses to encrypt so
// secrets are never silently stored in plaintext.
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer | null;

  constructor() {
    this.key = EncryptionService.parseKey(process.env.CONNECTIONS_ENC_KEY);
    if (!this.key) {
      this.logger.warn('CONNECTIONS_ENC_KEY is not set — saving connections is disabled until it is configured (32 bytes, base64 or hex).');
    }
  }

  static parseKey(raw?: string): Buffer | null {
    if (!raw) return null;
    const trimmed = raw.trim();
    for (const enc of ['base64', 'hex'] as const) {
      try {
        const buf = Buffer.from(trimmed, enc);
        if (buf.length === 32) return buf;
      } catch { /* try next encoding */ }
    }
    return null;
  }

  isConfigured(): boolean {
    return this.key !== null;
  }

  encrypt(plaintext: string): string {
    if (!this.key) throw new Error('CONNECTIONS_ENC_KEY is not configured');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decrypt(payload: string): string {
    if (!this.key) throw new Error('CONNECTIONS_ENC_KEY is not configured');
    const [version, ivB64, tagB64, dataB64] = payload.split(':');
    if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) throw new Error('Malformed encrypted payload');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  }
}
