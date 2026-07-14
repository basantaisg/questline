'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/feed', label: 'Feed' },
  { href: '/pricing', label: 'Plans' },
];

const authedLinks = [...links, { href: '/profile', label: 'Profile' }];

export default function Navbar() {
  const { me, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="fixed left-4 right-4 top-4 z-50"
    >
      <nav className="glass mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-5 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-neon-cyan" aria-hidden />
          <span className="font-display text-sm font-700 tracking-wide">
            QUEST<span className="neon-cyan-text">LINE</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {(me ? authedLinks : links).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors duration-200 ${
                pathname === link.href
                  ? 'bg-neon-cyan/10 text-neon-cyan'
                  : 'text-ink-muted hover:bg-white/5 hover:text-ink'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {me ? (
            <>
              <span className="hidden font-mono text-xs text-ink-muted sm:block">
                <span className="neon-lime-text">LV {me.level}</span> · {me.username}
              </span>
              <button
                onClick={async () => {
                  await logout();
                  router.push('/');
                }}
                className="cursor-pointer rounded-lg border border-white/15 px-4 py-2 font-mono text-xs uppercase tracking-widest text-ink-muted transition-colors duration-200 hover:border-neon-magenta/50 hover:text-neon-magenta"
              >
                Exit
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-4 py-2 font-mono text-xs uppercase tracking-widest text-ink-muted transition-colors duration-200 hover:text-ink"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg border border-neon-cyan/60 bg-neon-cyan/10 px-4 py-2 font-mono text-xs uppercase tracking-widest text-neon-cyan transition-colors duration-200 hover:bg-neon-cyan/20"
              >
                Start
              </Link>
            </>
          )}
        </div>
      </nav>
    </motion.header>
  );
}
