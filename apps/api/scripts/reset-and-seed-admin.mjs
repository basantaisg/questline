/**
 * Wipes every row in the QuestLine database and seeds a single admin account.
 *
 * DESTRUCTIVE AND IRREVERSIBLE — there is no backup. Requires --yes to run.
 *
 *   node scripts/reset-and-seed-admin.mjs --yes
 *   node scripts/reset-and-seed-admin.mjs --yes --email a@b.com --username admin
 *
 * The password is generated and printed once; it is never stored in plaintext.
 * Pass --password to supply your own instead.
 */
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

if (!args.includes('--yes')) {
  console.error('Refusing to run without --yes. This deletes ALL data, permanently.');
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const email = flag('email', 'admin@questline.dev').toLowerCase();
const username = flag('username', 'admin');
// 24 url-safe chars — strong enough that it never needs rotating on a whim.
const password = flag('password', randomBytes(18).toString('base64url'));

// Child tables first is unnecessary under TRUNCATE ... CASCADE, but listing
// every table keeps this honest: a table added later and forgotten here would
// survive the "wipe", so the list is the checklist.
const TABLES = [
  'post_reactions',
  'posts',
  'habit_completions',
  'streaks',
  'habits',
  'ai_usage_logs',
  'payments',
  'refresh_tokens',
  'subscriptions',
  'users',
];

const sql = neon(url);

const before = {};
for (const t of TABLES) {
  const [row] = await sql.query(`select count(*)::int as c from ${t}`);
  before[t] = row.c;
}
console.log('Rows before wipe:', before);

await sql.query(`truncate table ${TABLES.join(', ')} restart identity cascade`);
console.log('All tables truncated.');

const passwordHash = await bcrypt.hash(password, 12);
// Seeded out-of-band, so it skips the email OTP flow: an admin that had to
// verify a mailbox it may not own would be locked out of its own instance.
const [admin] = await sql.query(
  `insert into users (email, username, password_hash, role, is_verified)
   values ($1, $2, $3, 'admin', true)
   returning id, email, username, role`,
  [email, username, passwordHash],
);

// Elite subscription with a far-future period so nothing tier-gated in the UI
// reads as locked. The API also bypasses gating on role alone, so this is
// belt-and-braces: the admin is ungated even if the row were removed.
await sql.query(
  `insert into subscriptions (user_id, tier, renews_at)
   values ($1, 'elite', now() + interval '100 years')`,
  [admin.id],
);

const after = {};
for (const t of TABLES) {
  const [row] = await sql.query(`select count(*)::int as c from ${t}`);
  after[t] = row.c;
}

console.log('\nRows after seed:', after);
console.log('\n=== ADMIN CREDENTIALS (shown once) ===');
console.log('  email:    ', admin.email);
console.log('  username: ', admin.username);
console.log('  password: ', password);
console.log('  role:     ', admin.role, '(elite tier, unlimited AI, can delete any post)');
console.log('======================================');
