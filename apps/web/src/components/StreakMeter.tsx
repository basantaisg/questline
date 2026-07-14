'use client';

import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';

const MILESTONES = [7, 14, 30, 50, 100];

export default function StreakMeter({ streak, unit }: { streak: number; unit: string }) {
  const next = MILESTONES.find((m) => m > streak) ?? streak + 50;
  const prev = MILESTONES.filter((m) => m <= streak).pop() ?? 0;
  const pct = Math.min(((streak - prev) / (next - prev)) * 100, 100);
  const atMilestone = MILESTONES.includes(streak);
  const hot = streak >= 7;

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span
          className={`flex items-center gap-1.5 font-mono text-xs ${
            hot ? 'text-neon-amber' : 'text-ink-muted'
          } ${atMilestone ? 'animate-crackle' : ''}`}
        >
          <Flame
            className={`h-3.5 w-3.5 ${streak > 0 ? 'text-neon-amber' : 'text-ink-faint'}`}
            aria-hidden
          />
          {streak} {unit} streak
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
          next: {next}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
        <motion.div
          className={`h-full rounded-full ${
            atMilestone
              ? 'animate-crackle bg-gradient-to-r from-neon-amber to-neon-magenta'
              : 'bg-gradient-to-r from-neon-cyan/70 to-neon-amber'
          }`}
          style={hot ? { boxShadow: '0 0 8px rgba(255,184,77,0.7)' } : undefined}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
