'use client';

import { motion } from 'framer-motion';
import { AtSign, KeyRound, Lock, MailCheck, ShieldCheck, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import OtpInput from '@/components/OtpInput';
import { api, patch, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Profile } from '@/lib/types';

const field =
  'mt-2 w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-base outline-none transition-colors duration-200 focus:border-neon-cyan/60 disabled:cursor-not-allowed disabled:opacity-40';
const label = 'block font-mono text-xs uppercase tracking-widest text-ink-muted';
const card = 'glass rounded-2xl p-6 sm:p-8';

/** One banner slot per card, so a save on one form can't clobber another's message. */
type Feedback = { kind: 'ok' | 'err'; text: string } | null;

function Banner({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  const ok = feedback.kind === 'ok';
  return (
    <p
      role={ok ? 'status' : 'alert'}
      className={`mt-4 rounded-lg border px-4 py-2 text-sm ${
        ok
          ? 'border-neon-lime/40 bg-neon-lime/10 text-neon-lime'
          : 'border-neon-magenta/40 bg-neon-magenta/10 text-neon-magenta'
      }`}
    >
      {feedback.text}
    </p>
  );
}

function SubmitButton({
  busy,
  disabled,
  children,
  tone = 'cyan',
}: {
  busy: boolean;
  disabled?: boolean;
  children: string;
  tone?: 'cyan' | 'magenta';
}) {
  const tones = {
    cyan: 'border-neon-cyan/60 bg-neon-cyan/15 text-neon-cyan hover:bg-neon-cyan/25',
    magenta:
      'border-neon-magenta/60 bg-neon-magenta/15 text-neon-magenta hover:bg-neon-magenta/25',
  };
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      className={`mt-6 w-full cursor-pointer rounded-xl border py-3.5 font-mono text-sm uppercase tracking-widest transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]}`}
    >
      {busy ? 'Saving…' : children}
    </button>
  );
}

export default function ProfilePage() {
  const { me, loading, logout, refreshMe } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!loading && !me) router.replace('/login');
  }, [loading, me, router]);

  const load = useCallback(async () => {
    setProfile(await api<Profile>('/profile'));
  }, []);

  useEffect(() => {
    if (me) void load().catch(() => setProfile(null));
  }, [me, load]);

  if (loading || !profile) {
    return (
      <>
        <Navbar />
        <main className="flex min-h-screen items-center justify-center pt-20">
          <p className="font-mono text-xs uppercase tracking-widest text-ink-faint">
            Loading character sheet…
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto min-h-screen max-w-3xl px-4 pb-24 pt-28">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Header profile={profile} />
          <div className="mt-6 space-y-6">
            <BasicInfoCard profile={profile} onSaved={async (p) => { setProfile(p); await refreshMe(); }} />
            <UsernameCard profile={profile} onSaved={async (p) => { setProfile(p); await refreshMe(); }} />
            <PasswordCard
              onChanged={async () => {
                // Changing the password revokes every session, this one included.
                await logout();
                router.push('/login');
              }}
            />
          </div>
        </motion.div>
      </main>
    </>
  );
}

function Header({ profile }: { profile: Profile }) {
  return (
    <div className="flex items-center gap-5">
      {/* Plain <img>: the URL is arbitrary user input, so it can't go through
          next/image's allow-listed remote loader. */}
      {profile.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.imageUrl}
          alt=""
          className="h-20 w-20 shrink-0 rounded-2xl border border-neon-cyan/40 object-cover shadow-neon-cyan"
        />
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.04]">
          <UserRound className="h-8 w-8 text-ink-faint" aria-hidden />
        </div>
      )}

      <div className="min-w-0">
        <h1 className="truncate font-display text-3xl font-600">
          {profile.name ?? profile.username}
        </h1>
        <p className="mt-1 truncate font-mono text-xs uppercase tracking-widest text-ink-muted">
          <span className="neon-lime-text">LV {profile.level}</span> · @{profile.username}
          {profile.profession ? ` · ${profile.profession}` : ''}
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-muted">
          <ShieldCheck className="h-4 w-4 text-neon-lime" aria-hidden />
          <span className="truncate">{profile.email}</span>
          <span className="font-mono text-xs uppercase tracking-widest text-neon-lime">
            Verified
          </span>
        </p>
      </div>
    </div>
  );
}

function BasicInfoCard({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved: (p: Profile) => void | Promise<void>;
}) {
  const [name, setName] = useState(profile.name ?? '');
  const [age, setAge] = useState(profile.age?.toString() ?? '');
  const [profession, setProfession] = useState(profile.profession ?? '');
  const [imageUrl, setImageUrl] = useState(profile.imageUrl ?? '');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setBusy(true);
    try {
      const updated = await patch<Profile>('/profile', {
        name: name.trim() || null,
        // "" clears the field; a number goes through as a number, since the DTO
        // validates an int and would reject the string form.
        age: age.trim() === '' ? null : Number(age),
        profession: profession.trim() || null,
        imageUrl: imageUrl.trim() || null,
      });
      await onSaved(updated);
      setFeedback({ kind: 'ok', text: 'Profile updated.' });
    } catch (err) {
      setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Update failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={card}>
      <h2 className="flex items-center gap-2 font-display text-lg font-600">
        <UserRound className="h-5 w-5 text-neon-cyan" aria-hidden />
        Basic info
      </h2>
      <p className="mt-1 text-sm text-ink-muted">Leave a field empty to clear it.</p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="name">Display name</label>
          <input id="name" type="text" maxLength={80} value={name}
            onChange={(e) => setName(e.target.value)} className={field} />
        </div>
        <div>
          <label className={label} htmlFor="age">Age</label>
          <input id="age" type="number" min={13} max={120} value={age}
            onChange={(e) => setAge(e.target.value)} className={field} />
        </div>
        <div>
          <label className={label} htmlFor="profession">Profession</label>
          <input id="profession" type="text" maxLength={80} value={profession}
            onChange={(e) => setProfession(e.target.value)} className={field} />
        </div>
        <div>
          <label className={label} htmlFor="imageUrl">Avatar URL</label>
          <input id="imageUrl" type="url" inputMode="url" placeholder="https://…"
            value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={field} />
        </div>
      </div>

      <Banner feedback={feedback} />
      <SubmitButton busy={busy}>Save changes</SubmitButton>
    </form>
  );
}

function UsernameCard({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved: (p: Profile) => void | Promise<void>;
}) {
  const [username, setUsername] = useState(profile.username);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);

  const daysLeft = profile.usernameChangeableIn;
  const locked = daysLeft > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setBusy(true);
    try {
      const updated = await patch<Profile>('/profile/username', { username });
      await onSaved(updated);
      setFeedback({ kind: 'ok', text: `You're now @${updated.username}. Locked for 14 days.` });
    } catch (err) {
      setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Update failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={card}>
      <h2 className="flex items-center gap-2 font-display text-lg font-600">
        <AtSign className="h-5 w-5 text-neon-magenta" aria-hidden />
        Username
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Changeable once every 14 days.
      </p>

      {/* The server enforces the cooldown regardless; disabling the input just
          saves the user a pointless round-trip. */}
      {locked && (
        <p className="mt-4 flex items-center gap-2 rounded-lg border border-neon-amber/40 bg-neon-amber/10 px-4 py-2 text-sm text-neon-amber">
          <Lock className="h-4 w-4 shrink-0" aria-hidden />
          Locked for another {daysLeft} day{daysLeft === 1 ? '' : 's'}.
        </p>
      )}

      <div className="mt-5">
        <label className={label} htmlFor="username">Handle</label>
        <input
          id="username"
          type="text"
          minLength={3}
          maxLength={32}
          pattern="[a-zA-Z0-9_]+"
          required
          disabled={locked}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={field}
        />
      </div>

      <Banner feedback={feedback} />
      <SubmitButton
        busy={busy}
        disabled={locked || username === profile.username}
        tone="magenta"
      >
        Change username
      </SubmitButton>
    </form>
  );
}

type AuthMethod = 'password' | 'otp';

function PasswordCard({ onChanged }: { onChanged: () => void | Promise<void> }) {
  const [method, setMethod] = useState<AuthMethod>('password');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);

  const requestOtp = async () => {
    setFeedback(null);
    setBusy(true);
    try {
      const result = await post<{ message: string }>('/profile/password/request-otp');
      setOtpSent(true);
      setFeedback({ kind: 'ok', text: result.message });
    } catch (err) {
      setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Could not send code' });
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setBusy(true);
    try {
      await patch<{ message: string }>('/profile/password', {
        newPassword,
        // Exactly one authorization path is sent — the API rejects neither.
        ...(method === 'password' ? { oldPassword } : { otp }),
      });
      await onChanged();
    } catch (err) {
      setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Update failed' });
      setBusy(false);
    }
  };

  const tab = (active: boolean) =>
    `flex-1 cursor-pointer rounded-lg px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors duration-200 ${
      active ? 'bg-neon-cyan/10 text-neon-cyan' : 'text-ink-muted hover:bg-white/5 hover:text-ink'
    }`;

  return (
    <form onSubmit={submit} className={card}>
      <h2 className="flex items-center gap-2 font-display text-lg font-600">
        <KeyRound className="h-5 w-5 text-neon-lime" aria-hidden />
        Password
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Authorize with your current password, or with a code emailed to you. Changing it
        signs you out everywhere.
      </p>

      <div className="mt-5 flex gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1">
        <button type="button" onClick={() => setMethod('password')} className={tab(method === 'password')}>
          Current password
        </button>
        <button type="button" onClick={() => setMethod('otp')} className={tab(method === 'otp')}>
          Email code
        </button>
      </div>

      {method === 'password' ? (
        <div className="mt-5">
          <label className={label} htmlFor="oldPassword">Current password</label>
          <input id="oldPassword" type="password" required autoComplete="current-password"
            value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className={field} />
        </div>
      ) : (
        <div className="mt-5">
          {otpSent ? (
            <>
              <span className={label}>Emailed code</span>
              <OtpInput value={otp} onChange={setOtp} disabled={busy} />
            </>
          ) : (
            <button
              type="button"
              onClick={requestOtp}
              disabled={busy}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 py-3 font-mono text-xs uppercase tracking-widest text-ink-muted transition-colors duration-200 hover:border-neon-cyan/50 hover:text-neon-cyan disabled:opacity-40"
            >
              <MailCheck className="h-4 w-4" aria-hidden />
              {busy ? 'Sending…' : 'Email me a code'}
            </button>
          )}
        </div>
      )}

      <div className="mt-5">
        <label className={label} htmlFor="newPassword">New password</label>
        <input id="newPassword" type="password" required minLength={8} autoComplete="new-password"
          value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={field} />
      </div>

      <Banner feedback={feedback} />
      <SubmitButton
        busy={busy}
        disabled={method === 'otp' && otp.length !== 6}
      >
        Update password
      </SubmitButton>
    </form>
  );
}
