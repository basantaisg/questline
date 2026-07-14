'use client';

import { motion } from 'framer-motion';
import { Check, Crown, Rocket, Shield, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import CryptoCheckoutModal from '@/components/CryptoCheckoutModal';
import Navbar from '@/components/Navbar';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const tiers = [
  {
    id: 'free' as const,
    name: 'Free',
    price: 0,
    icon: Shield,
    accent: 'text-ink-muted',
    button: 'border-white/20 text-ink-muted hover:border-white/40',
    perks: ['Unlimited habits & streaks', 'XP + level system', 'Focus timer', 'Guild feed'],
    ai: 'No AI access',
  },
  {
    id: 'starter' as const,
    name: 'Starter',
    price: 5,
    icon: Rocket,
    accent: 'text-neon-cyan',
    button: 'border-neon-cyan/60 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20',
    perks: ['Everything in Free', '10 AI prompts / month', 'AI 7-day roadmaps', 'Suggested quests'],
    ai: '10 AI prompts / mo',
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    price: 10,
    icon: Sparkles,
    accent: 'text-neon-lime',
    button: 'border-neon-lime/60 bg-neon-lime/10 text-neon-lime hover:bg-neon-lime/20',
    perks: ['Everything in Starter', '30 AI prompts / month', 'Daily task checklists', 'Priority support'],
    ai: '30 AI prompts / mo',
    highlight: true,
  },
  {
    id: 'elite' as const,
    name: 'Elite',
    price: 20,
    icon: Crown,
    accent: 'text-neon-magenta',
    button: 'border-neon-magenta/60 bg-neon-magenta/10 text-neon-magenta hover:bg-neon-magenta/20',
    perks: ['Everything in Pro', 'Unlimited AI prompts', 'Priority execution', 'Early features'],
    ai: 'Unlimited + priority',
  },
];

const TIER_RANK = { free: 0, starter: 1, pro: 2, elite: 3 } as const;

export default function PricingPage() {
  const { me, refreshMe } = useAuth();
  const router = useRouter();
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checkoutTier, setCheckoutTier] = useState<(typeof tiers)[number] | null>(null);

  const choose = async (tier: (typeof tiers)[number]) => {
    if (!me) {
      router.push('/signup');
      return;
    }
    setMessage(null);

    // Paid tiers go through the crypto checkout; only free is a direct switch.
    if (tier.id !== 'free') {
      setCheckoutTier(tier);
      return;
    }

    setBusyTier(tier.id);
    try {
      await post('/subscriptions/upgrade', { tier: tier.id });
      await refreshMe();
      setMessage(`You're now on the ${tier.id.toUpperCase()} plan.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Upgrade failed');
    } finally {
      setBusyTier(null);
    }
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-32">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="font-display text-3xl font-600 sm:text-4xl">
            Choose your <span className="neon-lime-text">class</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-muted">
            Habits, streaks and the feed are free forever. The AI quest architect is a
            paid-tier power.
          </p>
          {message && (
            <p className="mx-auto mt-4 max-w-sm rounded-lg border border-neon-lime/40 bg-neon-lime/10 px-4 py-2 font-mono text-sm text-neon-lime">
              {message}
            </p>
          )}
        </motion.div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier, i) => {
            const current = me?.tier === tier.id;
            // A paid period locks all lower tiers until it ends.
            const periodActive =
              me != null &&
              me.tier !== 'free' &&
              me.renewsAt != null &&
              new Date(me.renewsAt) > new Date();
            const locked =
              periodActive && !current && TIER_RANK[tier.id] < TIER_RANK[me.tier];
            return (
              <motion.div
                key={tier.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`glass glass-hover relative flex flex-col rounded-2xl p-6 ${
                  tier.highlight ? 'border-neon-lime/40 shadow-neon-lime' : ''
                }`}
              >
                {tier.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-neon-lime/50 bg-void px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-neon-lime">
                    Most picked
                  </span>
                )}
                <tier.icon className={`h-6 w-6 ${tier.accent}`} aria-hidden />
                <h2 className="mt-3 font-display text-lg font-600">{tier.name}</h2>
                <div className="mt-1 font-display text-3xl font-700">
                  ${tier.price}
                  <span className="text-sm font-400 text-ink-muted">/mo</span>
                </div>
                <div className={`mt-2 font-mono text-xs ${tier.accent}`}>{tier.ai}</div>

                <ul className="mt-5 flex-1 space-y-2.5">
                  {tier.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2 text-sm text-ink-muted">
                      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${tier.accent}`} aria-hidden />
                      {perk}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => choose(tier)}
                  disabled={current || locked || busyTier !== null}
                  title={
                    locked && me?.renewsAt
                      ? `Locked until ${new Date(me.renewsAt).toLocaleDateString()} — your ${me.tier.toUpperCase()} period is already paid`
                      : undefined
                  }
                  className={`mt-6 w-full cursor-pointer rounded-xl border py-3 font-mono text-xs uppercase tracking-widest transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${tier.button}`}
                >
                  {current
                    ? 'Current plan'
                    : locked
                      ? 'Locked until renewal'
                      : busyTier === tier.id
                        ? 'Switching…'
                        : me
                          ? `Go ${tier.name}`
                          : 'Sign up'}
                </button>
              </motion.div>
            );
          })}
        </div>

        <p className="mt-10 text-center font-mono text-xs text-ink-faint">
          Crypto checkout is a demo — addresses and confirmations are simulated. A
          real processor (Stripe / Coinbase Commerce) slots in behind
          /payments/checkout.
        </p>
      </main>

      {checkoutTier && checkoutTier.id !== 'free' && (
        <CryptoCheckoutModal
          tier={{
            id: checkoutTier.id as 'starter' | 'pro' | 'elite',
            name: checkoutTier.name,
            price: checkoutTier.price,
          }}
          onClose={() => setCheckoutTier(null)}
          onSuccess={async () => {
            await refreshMe();
            setMessage(`You're now on the ${checkoutTier.id.toUpperCase()} plan.`);
          }}
        />
      )}
    </>
  );
}
