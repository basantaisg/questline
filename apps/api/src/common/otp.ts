import { createHash, randomInt, timingSafeEqual } from 'crypto';

/** How long a freshly issued code stays usable. */
export const OTP_TTL_MS = 5 * 60 * 1000;

/** Wrong guesses allowed before the code is burned and must be re-requested. */
export const OTP_MAX_ATTEMPTS = 5;

/**
 * Cryptographically random 6-digit code. `randomInt` is rejection-sampled, so
 * every value in [0, 999999] is equally likely — unlike `Math.random()`, which
 * is neither uniform under modulo nor unpredictable.
 */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Codes are stored hashed: a database leak must not hand over live codes. */
export const hashOtp = (code: string) => createHash('sha256').update(code).digest('hex');

/** Constant-time compare of the two hex digests — no early-exit timing leak. */
export function otpMatches(code: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashOtp(code), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

export const otpExpiry = () => new Date(Date.now() + OTP_TTL_MS);
