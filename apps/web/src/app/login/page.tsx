'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { me, loading, signin } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in? No need to log in again.
  useEffect(() => {
    if (!loading && me && !busy) router.replace('/dashboard');
  }, [loading, me, busy, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signin(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
      setBusy(false);
    }
  };

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
            Resume your <span className="neon-cyan-text">quest</span>
          </h1>
          <p className="mt-2 text-sm text-ink-muted">Sign in to keep the streak alive.</p>

          <label className="mt-6 block font-mono text-xs uppercase tracking-widest text-ink-muted" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-base outline-none transition-colors duration-200 focus:border-neon-cyan/60"
          />

          <label className="mt-4 block font-mono text-xs uppercase tracking-widest text-ink-muted" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-base outline-none transition-colors duration-200 focus:border-neon-cyan/60"
          />

          {error && (
            <p role="alert" className="mt-4 rounded-lg border border-neon-magenta/40 bg-neon-magenta/10 px-4 py-2 text-sm text-neon-magenta">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-6 w-full cursor-pointer rounded-xl border border-neon-cyan/60 bg-neon-cyan/15 py-3.5 font-mono text-sm uppercase tracking-widest text-neon-cyan transition-colors duration-200 hover:bg-neon-cyan/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Loading save…' : 'Sign in'}
          </button>

          <p className="mt-4 text-center text-sm text-ink-muted">
            New here?{' '}
            <Link href="/signup" className="text-neon-cyan underline-offset-4 hover:underline">
              Create a character
            </Link>
          </p>
        </motion.form>
      </main>
    </>
  );
}
