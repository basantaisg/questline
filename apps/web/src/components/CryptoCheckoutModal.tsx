'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Loader2, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { post } from '@/lib/api';
import { Payment } from '@/lib/types';

const COINS = [
  { id: 'btc' as const, name: 'Bitcoin', symbol: 'BTC', glyph: '₿', accent: 'text-neon-amber', ring: 'border-neon-amber/60 bg-neon-amber/10' },
  { id: 'eth' as const, name: 'Ethereum', symbol: 'ETH', glyph: 'Ξ', accent: 'text-neon-cyan', ring: 'border-neon-cyan/60 bg-neon-cyan/10' },
  { id: 'sol' as const, name: 'Solana', symbol: 'SOL', glyph: '◎', accent: 'text-neon-magenta', ring: 'border-neon-magenta/60 bg-neon-magenta/10' },
  { id: 'usdt' as const, name: 'Tether', symbol: 'USDT', glyph: '₮', accent: 'text-neon-lime', ring: 'border-neon-lime/60 bg-neon-lime/10' },
];

type Coin = (typeof COINS)[number];
type Step = 'select' | 'pay' | 'confirming' | 'done';

const CONFIRM_STAGES = [
  'Broadcasting transaction…',
  'Waiting for block inclusion…',
  'Confirmation 1 of 2…',
  'Confirmation 2 of 2…',
];

interface Props {
  tier: { id: 'starter' | 'pro' | 'elite'; name: string; price: number };
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export default function CryptoCheckoutModal({ tier, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('select');
  const [coin, setCoin] = useState<Coin | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const pickCoin = async (selected: Coin) => {
    setCoin(selected);
    setError(null);
    setBusy(true);
    try {
      const created = await post<Payment>('/payments/checkout', {
        tier: tier.id,
        currency: selected.id,
      });
      setPayment(created);
      setStep('pay');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
      setCoin(null);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!payment) return;
    setError(null);
    setStep('confirming');
    setStage(0);

    // Staged fake-confirmation ticker while the API call settles.
    const ticker = setInterval(
      () => setStage((s) => Math.min(s + 1, CONFIRM_STAGES.length - 1)),
      900,
    );
    const minDelay = new Promise((r) => setTimeout(r, CONFIRM_STAGES.length * 900));
    try {
      const [result] = await Promise.all([
        post<{ payment: Payment }>(`/payments/${payment.id}/confirm`),
        minDelay,
      ]);
      setTxHash(result.payment.txHash);
      setStep('done');
      await onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirmation failed');
      setStep('pay');
    } finally {
      clearInterval(ticker);
    }
  };

  const copyAddress = async () => {
    if (!payment) return;
    await navigator.clipboard.writeText(payment.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
        onClick={step === 'confirming' ? undefined : onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="glass w-full max-w-md rounded-2xl p-7"
        >
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display text-xl font-600">
                Go <span className="neon-cyan-text">{tier.name}</span>
              </h2>
              <p className="mt-1 font-mono text-xs uppercase tracking-widest text-ink-muted">
                ${tier.price}/mo · crypto checkout
              </p>
            </div>
            {step !== 'confirming' && (
              <button
                onClick={onClose}
                aria-label="Close checkout"
                className="cursor-pointer rounded-lg p-1.5 text-ink-muted transition-colors duration-200 hover:bg-white/10 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <p className="mt-3 rounded-lg border border-neon-amber/30 bg-neon-amber/5 px-3 py-2 font-mono text-[11px] leading-relaxed text-neon-amber">
            DEMO MODE — no real crypto moves. Addresses and confirmations are
            simulated.
          </p>

          {error && (
            <p role="alert" className="mt-3 rounded-lg border border-neon-magenta/40 bg-neon-magenta/10 px-3 py-2 text-sm text-neon-magenta">
              {error}
            </p>
          )}

          {step === 'select' && (
            <div className="mt-5">
              <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">
                Pay with
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {COINS.map((c) => (
                  <button
                    key={c.id}
                    disabled={busy}
                    onClick={() => pickCoin(c)}
                    className={`cursor-pointer rounded-xl border p-4 text-left transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                      coin?.id === c.id
                        ? c.ring
                        : 'border-white/15 hover:border-white/35'
                    }`}
                  >
                    <span className={`text-2xl ${c.accent}`}>{c.glyph}</span>
                    <div className="mt-2 text-sm font-medium">{c.name}</div>
                    <div className="font-mono text-xs text-ink-muted">{c.symbol}</div>
                  </button>
                ))}
              </div>
              {busy && (
                <p className="mt-4 flex items-center gap-2 font-mono text-xs text-ink-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating deposit
                  address…
                </p>
              )}
            </div>
          )}

          {step === 'pay' && payment && coin && (
            <div className="mt-5">
              <div className="rounded-xl border border-white/15 bg-white/[0.03] p-4">
                <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">
                  Send exactly
                </p>
                <p className={`mt-1 font-mono text-xl ${coin.accent}`}>
                  {payment.amountCrypto} {coin.symbol}
                </p>
                <p className="mt-4 font-mono text-xs uppercase tracking-widest text-ink-muted">
                  To address
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg bg-black/40 px-3 py-2 font-mono text-xs text-ink">
                    {payment.address}
                  </code>
                  <button
                    onClick={copyAddress}
                    aria-label="Copy address"
                    className="cursor-pointer rounded-lg border border-white/15 p-2 text-ink-muted transition-colors duration-200 hover:border-neon-cyan/50 hover:text-neon-cyan"
                  >
                    {copied ? <Check className="h-4 w-4 text-neon-lime" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-3 font-mono text-[11px] text-ink-faint">
                  Quote expires in 30 minutes.
                </p>
              </div>

              <button
                onClick={confirm}
                className="mt-5 w-full cursor-pointer rounded-xl border border-neon-cyan/60 bg-neon-cyan/15 py-3.5 font-mono text-sm uppercase tracking-widest text-neon-cyan transition-colors duration-200 hover:bg-neon-cyan/25"
              >
                I&apos;ve sent the payment
              </button>
            </div>
          )}

          {step === 'confirming' && coin && (
            <div className="mt-6 flex flex-col items-center py-4 text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.6, ease: 'linear' }}
                className={`flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed ${coin.accent} border-current`}
              >
                <span className={`text-2xl ${coin.accent}`}>{coin.glyph}</span>
              </motion.div>
              <p className="mt-5 font-mono text-sm text-ink">
                {CONFIRM_STAGES[stage]}
              </p>
              <p className="mt-2 font-mono text-xs text-ink-muted">
                Verifying on-chain (simulated)
              </p>
            </div>
          )}

          {step === 'done' && (
            <div className="mt-6 flex flex-col items-center py-2 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                className="flex h-14 w-14 items-center justify-center rounded-full border border-neon-lime/60 bg-neon-lime/10"
              >
                <ShieldCheck className="h-7 w-7 text-neon-lime" />
              </motion.div>
              <p className="mt-4 font-display text-lg font-600">
                Payment confirmed
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                Welcome to the {tier.name} class.
              </p>
              {txHash && (
                <code className="mt-4 w-full truncate rounded-lg bg-black/40 px-3 py-2 font-mono text-[11px] text-ink-muted">
                  tx: {txHash}
                </code>
              )}
              <button
                onClick={onClose}
                className="mt-5 w-full cursor-pointer rounded-xl border border-neon-lime/60 bg-neon-lime/10 py-3 font-mono text-sm uppercase tracking-widest text-neon-lime transition-colors duration-200 hover:bg-neon-lime/20"
              >
                Back to the quest
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
