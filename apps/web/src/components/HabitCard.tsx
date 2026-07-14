'use client';

import { motion } from 'framer-motion';
import { Check, Trash2, Zap } from 'lucide-react';
import { Habit } from '@/lib/types';
import StreakMeter from './StreakMeter';

const accents: Record<Habit['color'], { text: string; border: string }> = {
  cyan: { text: 'text-neon-cyan', border: 'hover:border-neon-cyan/40' },
  magenta: { text: 'text-neon-magenta', border: 'hover:border-neon-magenta/40' },
  lime: { text: 'text-neon-lime', border: 'hover:border-neon-lime/40' },
  amber: { text: 'text-neon-amber', border: 'hover:border-neon-amber/40' },
};

export default function HabitCard({
  habit,
  onComplete,
  onArchive,
  busy,
}: {
  habit: Habit;
  onComplete: (habit: Habit) => void;
  onArchive: (habit: Habit) => void;
  busy: boolean;
}) {
  const accent = accents[habit.color] ?? accents.cyan;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`glass glass-hover rounded-2xl p-5 ${accent.border}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-sm font-600">{habit.name}</h3>
          <p className="mt-1 flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-ink-faint">
            {habit.frequency}
            <span className={`flex items-center gap-0.5 ${accent.text}`}>
              <Zap className="h-3 w-3" aria-hidden />+{habit.xpReward} XP
            </span>
          </p>
          {habit.description && (
            <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{habit.description}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => onArchive(habit)}
            aria-label={`Archive ${habit.name}`}
            className="cursor-pointer rounded-lg p-2 text-ink-faint transition-colors duration-200 hover:bg-white/5 hover:text-neon-magenta"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            disabled={habit.doneThisPeriod || busy}
            onClick={() => onComplete(habit)}
            aria-label={
              habit.doneThisPeriod ? `${habit.name} completed` : `Complete ${habit.name}`
            }
            className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border transition-colors duration-200 disabled:cursor-not-allowed ${
              habit.doneThisPeriod
                ? 'border-neon-lime/60 bg-neon-lime/15 text-neon-lime shadow-neon-lime'
                : 'border-white/20 bg-white/[0.04] text-ink-muted hover:border-neon-lime/60 hover:text-neon-lime'
            }`}
          >
            <Check className="h-5 w-5" aria-hidden />
          </motion.button>
        </div>
      </div>

      <StreakMeter streak={habit.streak} unit={habit.frequency === 'daily' ? 'day' : 'week'} />
    </motion.div>
  );
}
