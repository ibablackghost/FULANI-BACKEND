import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';

const getMasterKey = () => {
  const raw = process.env.MASTER_KEY || process.env.ENCRYPTION_KEY || '';
  if (!raw || raw === 'tobemodified') {
    // Dev fallback — replace MASTER_KEY in .env for production
    return createHash('sha256').update('fulani-dev-master-key').digest();
  }
  return createHash('sha256').update(raw).digest();
};

/** Encrypt plaintext → `iv:tag:ciphertext` (base64 parts). */
export const encryptSecret = (plaintext: string): string => {
  if (!plaintext) return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getMasterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

/** Decrypt `iv:tag:ciphertext`. Returns null if invalid. */
export const decryptSecret = (payload: string): string | null => {
  if (!payload || !payload.includes(':')) return null;
  try {
    const [ivB64, tagB64, dataB64] = payload.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const decipher = createDecipheriv(ALGO, getMasterKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
};

export const isEncryptedPayload = (value: unknown): boolean => {
  if (typeof value !== 'string' || !value) return false;
  const parts = value.split(':');
  return parts.length === 3 && parts.every((p) => p.length > 0);
};
