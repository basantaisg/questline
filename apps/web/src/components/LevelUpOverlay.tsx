'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';

const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  angle: (i / 24) * Math.PI * 2,
  distance: 120 + (i % 3) * 60,
  color: ['#38e1ff', '#ff4ecd', '#a8ff3e', '#ffb84d'][i % 4],
}));

export default function LevelUpOverlay({
  level,
  onDone,
}: {
  level: number | null;
  onDone: () => void;
}) {
  useEffect(() => {
    if (level === null) return;
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [level, onDone]);

  return (
    <AnimatePresence>
      {level !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-void/80 backdrop-blur-sm"
          role="alert"
          aria-live="assertive"
        >
          {/* particle burst */}
          {PARTICLES.map((p, i) => (
            <motion.span
              key={i}
              className="absolute h-2 w-2 rounded-full"
              style={{ background: p.color, boxShadow: `0 0 10px ${p.color}` }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{
                x: Math.cos(p.angle) * p.distance,
                y: Math.sin(p.angle) * p.distance,
                opacity: 0,
                scale: 0.2,
              }}
              transition={{ duration: 1.4, ease: 'easeOut', delay: 0.15 }}
            />
          ))}

          <motion.div
            initial={{ scale: 0.5, opacity: 0, rotateX: 40 }}
            animate={{ scale: 1, opacity: 1, rotateX: 0 }}
            exit={{ scale: 1.2, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18 }}
            className="text-center"
          >
            <div className="font-mono text-sm uppercase tracking-[0.4em] text-neon-lime">
              Level up
            </div>
            <div className="animate-crackle mt-3 font-display text-7xl font-900 neon-cyan-text">
              {level}
            </div>
            <div className="mt-3 font-mono text-xs uppercase tracking-widest text-ink-muted">
              The crystal grows brighter
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
