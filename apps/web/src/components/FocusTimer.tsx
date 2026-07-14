'use client';

import { motion } from 'framer-motion';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Habit } from '@/lib/types';

interface Preset {
  id: string;
  label: string;
  focus: number;
  break: number;
  blurb: string;
}

const PRESETS: Preset[] = [
  { id: '25-5', label: '25 / 5', focus: 25, break: 5, blurb: 'classic pomodoro' },
  { id: '45-15', label: '45 / 15', focus: 45, break: 15, blurb: 'deep session' },
  { id: '90-25', label: '90 / 25', focus: 90, break: 25, blurb: 'ultradian sprint' },
];

const STORAGE_KEY = 'questline:focus-preset';

export default function FocusTimer({
  habits,
  onSessionComplete,
}: {
  habits: Habit[];
  onSessionComplete: (habitId: string | null) => void;
}) {
  const [preset, setPreset] = useState<Preset>(PRESETS[0]);
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [secondsLeft, setSecondsLeft] = useState(PRESETS[0].focus * 60);
  const [running, setRunning] = useState(false);
  const [habitId, setHabitId] = useState<string>('');
  const total = (mode === 'focus' ? preset.focus : preset.break) * 60;
  const firedRef = useRef(false);

  // The chosen rhythm is a preference, so it survives reloads.
  useEffect(() => {
    const stored = PRESETS.find((p) => p.id === localStorage.getItem(STORAGE_KEY));
    if (stored) {
      setPreset(stored);
      setSecondsLeft(stored.focus * 60);
    }
  }, []);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => Math.max(s - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (secondsLeft > 0 || !running || firedRef.current) return;
    firedRef.current = true;
    setRunning(false);
    if (mode === 'focus') {
      onSessionComplete(habitId || null);
      setMode('break');
      setSecondsLeft(preset.break * 60);
    } else {
      setMode('focus');
      setSecondsLeft(preset.focus * 60);
    }
    firedRef.current = false;
  }, [secondsLeft, running, mode, habitId, preset, onSessionComplete]);

  /** Any rhythm or mode change resets the clock — a half-run block can't carry over. */
  const applyPreset = (next: Preset) => {
    setPreset(next);
    localStorage.setItem(STORAGE_KEY, next.id);
    setRunning(false);
    setMode('focus');
    setSecondsLeft(next.focus * 60);
  };

  const switchMode = useCallback(
    (next: 'focus' | 'break') => {
      setMode(next);
      setRunning(false);
      setSecondsLeft((next === 'focus' ? preset.focus : preset.break) * 60);
    },
    [preset],
  );

  const reset = () => {
    setRunning(false);
    setSecondsLeft(total);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const pct = 1 - secondsLeft / total;
  const R = 88;
  const C = 2 * Math.PI * R;

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-600 uppercase tracking-wide">Focus engine</h2>
        <div className="flex gap-1 font-mono text-[10px] uppercase">
          {(['focus', 'break'] as const).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`cursor-pointer rounded-md px-2.5 py-1 tracking-widest transition-colors duration-200 ${
                mode === m ? 'bg-neon-cyan/15 text-neon-cyan' : 'text-ink-faint hover:text-ink'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div
        className="mt-4 grid grid-cols-3 gap-1.5"
        role="group"
        aria-label="Focus rhythm"
      >
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => applyPreset(p)}
            aria-pressed={preset.id === p.id}
            title={`${p.focus} min focus / ${p.break} min break — ${p.blurb}`}
            className={`cursor-pointer rounded-xl border px-2 py-2 transition-colors duration-200 ${
              preset.id === p.id
                ? 'border-neon-cyan/60 bg-neon-cyan/10 text-neon-cyan'
                : 'border-white/10 text-ink-muted hover:border-white/30 hover:text-ink'
            }`}
          >
            <div className="font-mono text-xs tabular-nums">{p.label}</div>
            <div className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-ink-faint">
              {p.blurb}
            </div>
          </button>
        ))}
      </div>

      <div className="relative mx-auto mt-5 h-52 w-52">
        <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
          <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <motion.circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke={mode === 'focus' ? '#38e1ff' : '#a8ff3e'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={C}
            animate={{ strokeDashoffset: C * (1 - pct) }}
            transition={{ duration: 0.4 }}
            style={{ filter: `drop-shadow(0 0 8px ${mode === 'focus' ? '#38e1ff' : '#a8ff3e'})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-4xl font-700 tabular-nums" aria-live="polite">
            {mm}:{ss}
          </span>
          <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-ink-faint">
            {mode === 'focus' ? 'deep work' : 'recover'}
          </span>
        </div>
      </div>

      <label className="mt-4 block font-mono text-[10px] uppercase tracking-widest text-ink-faint" htmlFor="timer-habit">
        Bind to quest (XP on completion)
      </label>
      <select
        id="timer-habit"
        value={habitId}
        onChange={(e) => setHabitId(e.target.value)}
        className="mt-1.5 w-full cursor-pointer rounded-xl border border-white/15 bg-void-800 px-3 py-2.5 text-sm outline-none transition-colors duration-200 focus:border-neon-cyan/60"
      >
        <option value="">— unbound session —</option>
        {habits
          .filter((h) => !h.doneThisPeriod)
          .map((h) => (
            <option key={h.id} value={h.id}>
              {h.name} (+{h.xpReward} XP)
            </option>
          ))}
      </select>

      <div className="mt-4 flex justify-center gap-3">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setRunning((r) => !r)}
          aria-label={running ? 'Pause timer' : 'Start timer'}
          className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl border border-neon-cyan/60 bg-neon-cyan/10 text-neon-cyan transition-colors duration-200 hover:bg-neon-cyan/20"
        >
          {running ? <Pause className="h-5 w-5" aria-hidden /> : <Play className="h-5 w-5" aria-hidden />}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={reset}
          aria-label="Reset timer"
          className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl border border-white/15 text-ink-muted transition-colors duration-200 hover:border-white/35 hover:text-ink"
        >
          <RotateCcw className="h-5 w-5" aria-hidden />
        </motion.button>
      </div>
    </div>
  );
}
