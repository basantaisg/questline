'use client';

import { motion } from 'framer-motion';

export default function XPBar({
  level,
  xpIntoLevel,
  xpForNextLevel,
}: {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}) {
  const pct = Math.min((xpIntoLevel / Math.max(xpForNextLevel, 1)) * 100, 100);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-display text-sm font-600">
          <span className="neon-lime-text">LV {level}</span>
        </span>
        <span className="font-mono text-xs tabular-nums text-ink-muted">
          {xpIntoLevel} / {xpForNextLevel} XP
        </span>
      </div>
      <div
        className="h-3 overflow-hidden rounded-full border border-white/10 bg-white/[0.04]"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Level ${level} progress`}
      >
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-neon-cyan via-neon-lime to-neon-lime"
          style={{ boxShadow: '0 0 12px rgba(168,255,62,0.6)' }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 60, damping: 16 }}
        />
      </div>
    </div>
  );
}
