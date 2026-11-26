import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);

const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateSecureId(prefix = ''): string {
  const raw = crypto.randomBytes(12).toString('base64url');
  return prefix ? `${prefix}_${raw}` : raw;
}

/**
 * Generates a cryptographically shuffled 6-digit numeric workspace join code (100000-999999).
 */
export function generateSixDigitJoinCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

/**
 * Generates an invitation token with a readable join-code prefix and high-entropy secret.
 * Format: UNITE-XXXX-XXXXXXXXXXXXXXXXXXXX
 */
export function generateInvitationToken(): {
  rawToken: string;
  tokenHash: string;
  codePrefix: string;
} {
  const prefixChars = Array.from({ length: 4 }, () => {
    const idx = crypto.randomInt(0, JOIN_CODE_ALPHABET.length);
    return JOIN_CODE_ALPHABET[idx]!;
  }).join('');
  const secretPart = crypto.randomBytes(16).toString('base64url');
  const rawToken = `UNITE-${prefixChars}-${secretPart}`;
  return {
    rawToken,
    tokenHash: hashToken(rawToken),
    codePrefix: `UNITE-${prefixChars}`,
  };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

export function extractTokenFromInviteInput(input: string): string {
  const trimmed = input.trim();
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const url = new URL(trimmed);
      const queryCode = url.searchParams.get('code') || url.searchParams.get('invite');
      if (queryCode) return queryCode.trim();
      const parts = url.pathname.split('/').filter(Boolean);
      const last = parts[parts.length - 1];
      if (last) return decodeURIComponent(last).trim();
    }
  } catch {
    // Fall through to treating input as a raw code
  }
  return trimmed;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  if (expected.length !== derived.length) return false;
  return crypto.timingSafeEqual(expected, derived);
}

