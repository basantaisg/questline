'use client';

import { motion } from 'framer-motion';
import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import OtpInput from '@/components/OtpInput';
import { useAuth } from '@/lib/auth';

const RESEND_COOLDOWN_S = 30;

function VerifyForm() {
  const { verifyOtp, resendOtp } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') ?? '';

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);

  // Landing here with no email means the link was opened out of context; the
  // code is useless without knowing which account it belongs to.
  useEffect(() => {
    if (!email) router.replace('/signup');
  }, [email, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submit = async (e?: FormEvent, override?: string) => {
    e?.preventDefault();
    const value = override ?? code;
    if (value.length !== 6 || busy) return;

    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await verifyOtp(email, value);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setCode('');
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    setNotice(null);
    try {
      const result = await resendOtp(email);
      setNotice(result.message);
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the code');
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      onSubmit={submit}
      className="glass w-full max-w-md rounded-2xl p-8"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-neon-cyan/40 bg-neon-cyan/10">
        <MailCheck className="h-6 w-6 text-neon-cyan" aria-hidden />
      </div>

      <h1 className="mt-5 font-display text-2xl font-600">
        Check your <span className="neon-cyan-text">inbox</span>
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        We sent a 6-digit code to{' '}
        <span className="font-mono text-ink">{email}</span>. It expires in 5 minutes.
      </p>

      <OtpInput
        value={code}
        onChange={setCode}
        onComplete={(value) => submit(undefined, value)}
        disabled={busy}
        autoFocus
      />

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-neon-magenta/40 bg-neon-magenta/10 px-4 py-2 text-sm text-neon-magenta">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 rounded-lg border border-neon-lime/40 bg-neon-lime/10 px-4 py-2 text-sm text-neon-lime">
          {notice}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className="mt-6 w-full cursor-pointer rounded-xl border border-neon-cyan/60 bg-neon-cyan/15 py-3.5 font-mono text-sm uppercase tracking-widest text-neon-cyan transition-colors duration-200 hover:bg-neon-cyan/25 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? 'Verifying…' : 'Verify & enter'}
      </button>

      <div className="mt-5 text-center text-sm text-ink-muted">
        {cooldown > 0 ? (
          <span className="font-mono text-xs uppercase tracking-widest text-ink-faint">
            Resend available in {cooldown}s
          </span>
        ) : (
          <button
            type="button"
            onClick={resend}
            className="cursor-pointer text-neon-cyan underline-offset-4 hover:underline"
          >
            Didn&apos;t get it? Send a new code
          </button>
        )}
      </div>

      <p className="mt-4 text-center text-sm text-ink-muted">
        Wrong address?{' '}
        <Link href="/signup" className="text-neon-magenta underline-offset-4 hover:underline">
          Start over
        </Link>
      </p>
    </motion.form>
  );
}

export default function VerifyPage() {
  return (
    <>
      <Navbar />
      <main className="flex min-h-screen items-center justify-center px-4 pt-20">
        {/* useSearchParams suspends during prerender — Next requires the boundary. */}
        <Suspense fallback={null}>
          <VerifyForm />
        </Suspense>
      </main>
    </>
  );
}
