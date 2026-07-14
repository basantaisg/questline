'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'magenta' | 'lime';

const styles: Record<Variant, string> = {
  primary:
    'bg-neon-cyan/10 border-neon-cyan/60 text-neon-cyan hover:bg-neon-cyan/20 shadow-neon-cyan',
  magenta:
    'bg-neon-magenta/10 border-neon-magenta/60 text-neon-magenta hover:bg-neon-magenta/20 shadow-neon-magenta',
  lime: 'bg-neon-lime/10 border-neon-lime/60 text-neon-lime hover:bg-neon-lime/20 shadow-neon-lime',
  ghost:
    'bg-white/[0.03] border-white/15 text-ink hover:border-white/35 hover:bg-white/[0.06]',
};

interface Props extends HTMLMotionProps<'button'> {
  variant?: Variant;
  children: ReactNode;
}

export default function NeonButton({ variant = 'primary', children, className = '', ...rest }: Props) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={{ y: -1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={`cursor-pointer rounded-xl border px-5 py-2.5 font-mono text-sm font-medium uppercase tracking-wider transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
