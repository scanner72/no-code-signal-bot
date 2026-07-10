import { EncryptionService } from './encryption.service';
import { randomBytes } from 'crypto';

describe('EncryptionService', () => {
  const key = randomBytes(32).toString('base64');

  const withKey = (k?: string) => {
    const prev = process.env.CONNECTIONS_ENC_KEY;
    if (k === undefined) delete process.env.CONNECTIONS_ENC_KEY;
    else process.env.CONNECTIONS_ENC_KEY = k;
    const svc = new EncryptionService();
    process.env.CONNECTIONS_ENC_KEY = prev;
    return svc;
  };

  it('roundtrips plaintext', () => {
    const svc = withKey(key);
    const secret = JSON.stringify({ botToken: '123456:ABC-def_GHI' });
    const encrypted = svc.encrypt(secret);
    expect(encrypted).not.toContain('123456');
    expect(encrypted.startsWith('v1:')).toBe(true);
    expect(svc.decrypt(encrypted)).toBe(secret);
  });

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const svc = withKey(key);
    expect(svc.encrypt('same')).not.toBe(svc.encrypt('same'));
  });

  it('accepts hex keys too', () => {
    const svc = withKey(randomBytes(32).toString('hex'));
    expect(svc.isConfigured()).toBe(true);
    expect(svc.decrypt(svc.encrypt('x'))).toBe('x');
  });

  it('is unconfigured without a key and refuses to encrypt', () => {
    const svc = withKey(undefined);
    expect(svc.isConfigured()).toBe(false);
    expect(() => svc.encrypt('x')).toThrow();
  });

  it('rejects a wrong-size key', () => {
    const svc = withKey(Buffer.from('short').toString('base64'));
    expect(svc.isConfigured()).toBe(false);
  });

  it('fails to decrypt with a different key', () => {
    const a = withKey(key);
    const b = withKey(randomBytes(32).toString('base64'));
    const encrypted = a.encrypt('secret');
    expect(() => b.decrypt(encrypted)).toThrow();
  });

  it('rejects malformed payloads', () => {
    const svc = withKey(key);
    expect(() => svc.decrypt('garbage')).toThrow();
  });
});
