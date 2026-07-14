'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { FormEvent, useState } from 'react';

export interface NewHabit {
  name: string;
  description?: string;
  frequency: 'daily' | 'weekly';
  xpReward: number;
  color: 'cyan' | 'magenta' | 'lime' | 'amber';
}

const colors = ['cyan', 'magenta', 'lime', 'amber'] as const;
const swatch: Record<string, string> = {
  cyan: 'bg-neon-cyan',
  magenta: 'bg-neon-magenta',
  lime: 'bg-neon-lime',
  amber: 'bg-neon-amber',
};

export default function NewHabitModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (habit: NewHabit) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');
  const [xpReward, setXpReward] = useState(10);
  const [color, setColor] = useState<(typeof colors)[number]>('cyan');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onCreate({ name, description: description || undefined, frequency, xpReward, color });
      setName('');
      setDescription('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create habit');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-void/80 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.form
            initial={{ scale: 0.92, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={submit}
            className="glass w-full max-w-md rounded-2xl p-6"
            role="dialog"
            aria-modal="true"
            aria-label="New quest"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-600">
                New <span className="neon-cyan-text">quest</span>
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="cursor-pointer rounded-lg p-2 text-ink-faint transition-colors duration-200 hover:bg-white/5 hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <label className="mt-5 block font-mono text-xs uppercase tracking-widest text-ink-muted" htmlFor="habit-name">
              Name
            </label>
            <input
              id="habit-name"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Deep work · 1 hour"
              className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-base outline-none transition-colors duration-200 placeholder:text-ink-faint focus:border-neon-cyan/60"
            />

            <label className="mt-4 block font-mono text-xs uppercase tracking-widest text-ink-muted" htmlFor="habit-desc">
              Description <span className="text-ink-faint">(optional)</span>
            </label>
            <input
              id="habit-desc"
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-base outline-none transition-colors duration-200 focus:border-neon-cyan/60"
            />

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <span className="block font-mono text-xs uppercase tracking-widest text-ink-muted">
                  Frequency
                </span>
                <div className="mt-2 flex gap-2">
                  {(['daily', 'weekly'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFrequency(f)}
                      className={`cursor-pointer rounded-lg border px-3 py-2 font-mono text-xs uppercase tracking-wider transition-colors duration-200 ${
                        frequency === f
                          ? 'border-neon-cyan/60 bg-neon-cyan/10 text-neon-cyan'
                          : 'border-white/15 text-ink-muted hover:border-white/35'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block font-mono text-xs uppercase tracking-widest text-ink-muted" htmlFor="habit-xp">
                  XP reward: {xpReward}
                </label>
                <input
                  id="habit-xp"
                  type="range"
                  min={5}
                  max={50}
                  step={5}
                  value={xpReward}
                  onChange={(e) => setXpReward(Number(e.target.value))}
                  className="mt-3 w-full cursor-pointer accent-[#38e1ff]"
                />
              </div>
            </div>

            <span className="mt-4 block font-mono text-xs uppercase tracking-widest text-ink-muted">
              Sigil color
            </span>
            <div className="mt-2 flex gap-3">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`${c} color`}
                  className={`h-8 w-8 cursor-pointer rounded-full transition-transform duration-200 ${swatch[c]} ${
                    color === c ? 'scale-110 ring-2 ring-white/70 ring-offset-2 ring-offset-void' : 'opacity-50 hover:opacity-90'
                  }`}
                />
              ))}
            </div>

            {error && (
              <p role="alert" className="mt-4 rounded-lg border border-neon-magenta/40 bg-neon-magenta/10 px-4 py-2 text-sm text-neon-magenta">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="mt-6 w-full cursor-pointer rounded-xl border border-neon-cyan/60 bg-neon-cyan/15 py-3.5 font-mono text-sm uppercase tracking-widest text-neon-cyan transition-colors duration-200 hover:bg-neon-cyan/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'Forging…' : 'Add quest'}
            </button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
