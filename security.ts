import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/**
 * Password + session helpers.
 * - Passwords are stored as "scrypt$<saltHex>$<hashHex>".
 * - Legacy rows that still hold a plaintext password are accepted once and
 *   must be re-hashed by the caller (see needsRehash).
 * - Staff sessions are HMAC-signed tokens: "SRS1.<payloadB64url>.<sigB64url>".
 *   The password never appears in the token.
 */

const SCRYPT_PREFIX = 'scrypt$';

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(String(plain), salt, 64);
  return `${SCRYPT_PREFIX}${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function isHashed(stored: string | null | undefined): boolean {
  return !!stored && stored.startsWith(SCRYPT_PREFIX);
}

export function verifyPassword(plain: string, stored: string | null | undefined): boolean {
  if (!stored || !plain) return false;
  if (isHashed(stored)) {
    const [, saltHex, hashHex] = stored.split('$');
    if (!saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(String(plain), Buffer.from(saltHex, 'hex'), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
  // Legacy plaintext value (migrated to a hash on successful login).
  const a = Buffer.from(String(plain));
  const b = Buffer.from(String(stored));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function needsRehash(stored: string | null | undefined): boolean {
  return !!stored && !isHashed(stored);
}

function sessionSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const base = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SQL_PASSWORD || 'soorar-dev-secret';
  return createHash('sha256').update('soorar-session:' + base).digest('hex');
}

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/** Fingerprint of the password hash so changing a password invalidates old tokens. */
function pwFingerprint(stored: string | null | undefined) {
  return createHash('sha256').update(String(stored || '')).digest('base64url').slice(0, 12);
}

export function signStaffToken(uid: string, storedHash: string, ttlDays = 14): string {
  const payload = { uid, pf: pwFingerprint(storedHash), exp: Date.now() + ttlDays * 86400_000 };
  const body = b64u(JSON.stringify(payload));
  const sig = createHmac('sha256', sessionSecret()).update(body).digest('base64url');
  return `SRS1.${body}.${sig}`;
}

export function verifyStaffToken(token: string): { uid: string; pf: string; exp: number } | null {
  if (!token.startsWith('SRS1.')) return null;
  const [, body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', sessionSecret()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.uid || !payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function tokenMatchesPassword(pf: string, storedHash: string | null | undefined) {
  return pf === pwFingerprint(storedHash);
}

/** Short HMAC for signed, unguessable URLs (e.g. private photo links). */
export function signValue(value: string): string {
  return createHmac('sha256', sessionSecret()).update('v:' + value).digest('base64url').slice(0, 22);
}

export function verifySignedValue(value: string, sig: string): boolean {
  const a = Buffer.from(String(sig || ''));
  const b = Buffer.from(signValue(value));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Customer portal session token (same format as staff tokens, uid "cust:<id>"). */
export function signCustomerToken(customerId: number, storedHash: string | null | undefined, ttlDays = 30): string {
  return signStaffToken(`cust:${customerId}`, String(storedHash || ''), ttlDays);
}

/** Random human-friendly temporary password (no ambiguous characters). */
export function generateTempPassword(len = 10): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}
