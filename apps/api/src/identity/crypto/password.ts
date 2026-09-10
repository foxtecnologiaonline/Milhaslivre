import { pbkdf2 as pbkdf2Callback, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const pbkdf2 = promisify(pbkdf2Callback);

const ITERATIONS = 100_000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST)) as Buffer;
  return `${ITERATIONS}:${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [iterationsRaw, salt, hashHex] = stored.split(':');
  if (!iterationsRaw || !salt || !hashHex) return false;

  const iterations = Number(iterationsRaw);
  const expected = Buffer.from(hashHex, 'hex');
  const derived = (await pbkdf2(password, salt, iterations, expected.length, DIGEST)) as Buffer;

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
