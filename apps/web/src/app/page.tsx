'use client';

import { motion, useInView } from 'framer-motion';
import {
  Brain,
  Flame,
  Gauge,
  Gem,
  MessagesSquare,
  Swords,
  Timer,
  TrendingUp,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/auth';

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: 'easeOut' as const },
  }),
};

function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const duration = 1400;
    let raf: number;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target]);

  return (
    <span ref={ref} className="font-mono tabular-nums">
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}

const features = [
  {
    icon: Swords,
    title: 'XP for every rep',
    body: 'Every habit completed drops XP. Streaks stack bonus multipliers. Break a streak and the system takes its cut — losses hurt, and that is the point.',
    accent: 'text-neon-cyan',
    glow: 'hover:shadow-neon-cyan',
  },
  {
    icon: Gem,
    title: 'A crystal that grows with you',
    body: 'Your dashboard hosts a living 3D crystal. It spins faster with hot streaks and shifts color as you level. Neglect your quests and watch it dim.',
    accent: 'text-neon-magenta',
    glow: 'hover:shadow-neon-magenta',
  },
  {
    icon: Brain,
    title: 'AI quest architect',
    body: 'Tell the Gemini-powered coach your goal. It returns a 7-day roadmap with daily checklists and auto-suggested habits, tuned to your pace.',
    accent: 'text-neon-lime',
    glow: 'hover:shadow-neon-lime',
  },
  {
    icon: Timer,
    title: 'Focus timer',
    body: 'A built-in pomodoro engine tracks real engagement. Finish a focus block, bank the XP.',
    accent: 'text-neon-amber',
    glow: '',
  },
  {
    icon: MessagesSquare,
    title: 'The feed',
    body: 'Post quotes, auto-share milestones, and throw Salutes and Fire at your crew.',
    accent: 'text-neon-cyan',
    glow: '',
  },
  {
    icon: Gauge,
    title: 'Streak meters',
    body: 'Daily meters that crackle with energy when you cross 7, 30 and 100-day milestones.',
    accent: 'text-neon-magenta',
    glow: '',
  },
];

const tiers = [
  { name: 'Free', price: '$0', ai: 'No AI access', highlight: false },
  { name: 'Starter', price: '$5', ai: '3 AI prompts / mo', highlight: false },
  { name: 'Pro', price: '$10', ai: '50 AI prompts / mo', highlight: true },
  { name: 'Elite', price: '$20', ai: 'Unlimited + priority', highlight: false },
];

export default function Landing() {
  const { me, loading } = useAuth();
  const router = useRouter();

  // Signed-in players skip the pitch and land on their dashboard.
  useEffect(() => {
    if (!loading && me) router.replace('/dashboard');
  }, [loading, me, router]);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-36">
        {/* HERO */}
        <section className="relative flex min-h-[70vh] flex-col items-center justify-center text-center">
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={0}
            className="mb-6 rounded-full border border-neon-cyan/30 bg-neon-cyan/5 px-4 py-1.5 font-mono text-xs uppercase tracking-[0.25em] text-neon-cyan"
          >
            Habit RPG · Focus · AI Coach
          </motion.p>

          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={1}
            className="font-display text-4xl font-700 leading-[1.1] sm:text-6xl lg:text-7xl"
          >
            LEVEL UP
            <br />
            <span className="neon-cyan-text">YOUR LIFE</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={2}
            className="mt-6 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg"
          >
            QuestLine turns discipline into a game you actually want to play — XP,
            streaks, a living crystal, and an AI that architects your next seven days.
          </motion.p>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={3}
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
          >
            <Link
              href={me ? '/dashboard' : '/signup'}
              className="animate-pulse-glow cursor-pointer rounded-xl border border-neon-cyan/70 bg-neon-cyan/15 px-8 py-4 font-mono text-sm font-medium uppercase tracking-widest text-neon-cyan transition-colors duration-200 hover:bg-neon-cyan/25"
            >
              {me ? 'Continue your quest' : 'Begin your quest'}
            </Link>
            {!me && (
              <Link
                href="/login"
                className="cursor-pointer rounded-xl border border-white/15 px-8 py-4 font-mono text-sm uppercase tracking-widest text-ink-muted transition-colors duration-200 hover:border-white/35 hover:text-ink"
              >
                I have a save file
              </Link>
            )}
          </motion.div>

          {/* floating glyphs */}
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
            <Zap className="absolute left-[8%] top-[18%] h-6 w-6 animate-drift text-neon-cyan/30" />
            <Flame className="absolute right-[12%] top-[30%] h-7 w-7 animate-drift text-neon-magenta/30 [animation-delay:2s]" />
            <Gem className="absolute bottom-[18%] left-[18%] h-8 w-8 animate-drift text-neon-lime/25 [animation-delay:4s]" />
          </div>
        </section>

        {/* STATS */}
        <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: 'XP earned by players', value: 4823917, suffix: '' },
            { label: 'Longest live streak', value: 412, suffix: ' days' },
            { label: 'Quests completed today', value: 12409, suffix: '' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              custom={i}
              className="glass rounded-2xl p-6 text-center"
            >
              <div className="text-3xl font-semibold text-neon-cyan">
                <CountUp target={stat.value} suffix={stat.suffix} />
              </div>
              <div className="mt-2 font-mono text-xs uppercase tracking-widest text-ink-muted">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </section>

        {/* FEATURES — bento */}
        <section className="mt-28">
          <motion.h2
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            custom={0}
            className="font-display text-2xl font-600 sm:text-4xl"
          >
            The <span className="neon-magenta-text">game loop</span>
          </motion.h2>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {features.map((feature, i) => (
              <motion.article
                key={feature.title}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                custom={i % 3}
                className={`glass glass-hover rounded-2xl p-6 ${i < 3 ? 'md:row-span-2' : ''} ${feature.glow}`}
              >
                <feature.icon className={`h-7 w-7 ${feature.accent}`} aria-hidden />
                <h3 className="mt-4 font-display text-base font-600">{feature.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-muted">{feature.body}</p>
              </motion.article>
            ))}
          </div>
        </section>

        {/* PRICING PREVIEW */}
        <section className="mt-28">
          <motion.h2
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            custom={0}
            className="font-display text-2xl font-600 sm:text-4xl"
          >
            Choose your <span className="neon-lime-text">class</span>
          </motion.h2>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tiers.map((tier, i) => (
              <motion.div
                key={tier.name}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                custom={i}
                className={`glass glass-hover rounded-2xl p-6 ${
                  tier.highlight ? 'border-neon-cyan/50 shadow-neon-cyan' : ''
                }`}
              >
                <div className="font-mono text-xs uppercase tracking-widest text-ink-muted">
                  {tier.name}
                </div>
                <div className="mt-2 font-display text-3xl font-600">
                  {tier.price}
                  <span className="text-sm text-ink-muted">/mo</span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
                  <TrendingUp className="h-4 w-4 text-neon-lime" aria-hidden />
                  {tier.ai}
                </div>
              </motion.div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/pricing"
              className="font-mono text-sm uppercase tracking-widest text-neon-cyan underline-offset-4 hover:underline"
            >
              Full plan details →
            </Link>
          </div>
        </section>

        <footer className="mt-28 border-t border-white/10 pt-8 text-center font-mono text-xs uppercase tracking-widest text-ink-faint">
          QuestLine · forge your streaks · {new Date().getFullYear()}
        </footer>
      </main>
    </>
  );
}
