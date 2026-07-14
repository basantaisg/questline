'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/auth';

export default function SignupPage() {
  const { me, loading, signup } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in? Straight to the dashboard.
  useEffect(() => {
    if (!loading && me && !busy) router.replace('/dashboard');
  }, [loading, me, busy, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // No session comes back — the account stays inert until the emailed code
      // is confirmed on /verify.
      const pending = await signup(email, username, password);
      router.push(`/verify?email=${encodeURIComponent(pending.email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
      setBusy(false);
    }
  };

  const field =
    'mt-2 w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-base outline-none transition-colors duration-200 focus:border-neon-cyan/60';
  const label = 'mt-4 block font-mono text-xs uppercase tracking-widest text-ink-muted';

  return (
    <>
      <Navbar />
      <main className="flex min-h-screen items-center justify-center px-4 pt-20">
        <motion.form
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          onSubmit={submit}
          className="glass w-full max-w-md rounded-2xl p-8"
        >
          <h1 className="font-display text-2xl font-600">
            Create your <span className="neon-magenta-text">character</span>
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Level 1. Zero XP. Infinite potential. We&apos;ll email you a code to confirm
            your address.
          </p>

          <label className={label} htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} className={field} />

          <label className={label} htmlFor="username">Username</label>
          <input id="username" type="text" required minLength={3} maxLength={32}
            pattern="[a-zA-Z0-9_]+" autoComplete="username" value={username}
            onChange={(e) => setUsername(e.target.value)} className={field} />

          <label className={label} htmlFor="password">Password</label>
          <input id="password" type="password" required minLength={8}
            autoComplete="new-password" value={password}
            onChange={(e) => setPassword(e.target.value)} className={field} />

          {error && (
            <p role="alert" className="mt-4 rounded-lg border border-neon-magenta/40 bg-neon-magenta/10 px-4 py-2 text-sm text-neon-magenta">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-6 w-full cursor-pointer rounded-xl border border-neon-magenta/60 bg-neon-magenta/15 py-3.5 font-mono text-sm uppercase tracking-widest text-neon-magenta transition-colors duration-200 hover:bg-neon-magenta/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Forging…' : 'Start the quest'}
          </button>

          <p className="mt-4 text-center text-sm text-ink-muted">
            Already playing?{' '}
            <Link href="/login" className="text-neon-cyan underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </motion.form>
      </main>
    </>
  );
}
