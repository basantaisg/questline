/**
 * One-shot backfill to run once, right after the OTP columns are pushed.
 *
 * `users.is_verified` lands with a `false` default, so every account that
 * existed before email verification shipped would suddenly be treated as
 * unverified and blocked from signing in. Those accounts predate the rule and
 * were never asked for a code, so they are grandfathered in as verified.
 *
 *   node scripts/backfill-verified.mjs
 *
 * Idempotent: rows already verified are left alone, and accounts created after
 * this runs are untouched because they have a pending OTP.
 */
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const sql = neon(url);

// `otp_code is null` is the guard that makes this safe to re-run: an account
// mid-signup has a pending code and must still prove its mailbox.
const rows = await sql.query(
  `update users
      set is_verified = true
    where is_verified = false
      and otp_code is null
   returning email`,
);

console.log(`Grandfathered ${rows.length} pre-existing account(s) as verified.`);
for (const row of rows) console.log('  ✓', row.email);
