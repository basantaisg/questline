'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Trophy, Zap } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import AIPlanner from '@/components/AIPlanner';
import FocusTimer from '@/components/FocusTimer';
import HabitCard from '@/components/HabitCard';
import LevelUpOverlay from '@/components/LevelUpOverlay';
import Navbar from '@/components/Navbar';
import NewHabitModal, { NewHabit } from '@/components/NewHabitModal';
import XPBar from '@/components/XPBar';
import { api, del, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CompleteResult, Habit } from '@/lib/types';

const Crystal = dynamic(() => import('@/components/Crystal'), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center font-mono text-xs uppercase tracking-widest text-ink-faint">
      Summoning crystal…
    </div>
  ),
});

interface Toast {
  id: number;
  text: string;
  tone: 'lime' | 'magenta' | 'amber';
}

export default function DashboardPage() {
  const { me, loading, refreshMe } = useAuth();
  const router = useRouter();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (!loading && !me) router.replace('/login');
  }, [loading, me, router]);

  const loadHabits = useCallback(async () => {
    const data = await api<Habit[]>('/habits');
    setHabits(data);
  }, []);

  useEffect(() => {
    if (me) loadHabits().catch(() => undefined);
  }, [me, loadHabits]);

  const pushToast = (text: string, tone: Toast['tone'] = 'lime') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((toast) => toast.id !== id)), 3800);
  };

  const completeHabit = async (habit: Habit) => {
    setBusyId(habit.id);
    try {
      const result = await post<CompleteResult>(`/habits/${habit.id}/complete`);
      pushToast(
        `+${result.xpAwarded} XP · ${habit.name}` +
          (result.penalty ? `  (−${result.penalty} streak break)` : ''),
        result.penalty ? 'amber' : 'lime',
      );
      if (result.milestone) {
        pushToast(`${result.milestone}-day milestone shared to the feed!`, 'amber');
      }
      if (result.leveledUp) setLevelUp(result.level);
      await Promise.all([loadHabits(), refreshMe()]);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed', 'magenta');
    } finally {
      setBusyId(null);
    }
  };

  const archiveHabit = async (habit: Habit) => {
    try {
      await del(`/habits/${habit.id}`);
      setHabits((h) => h.filter((x) => x.id !== habit.id));
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed', 'magenta');
    }
  };

  const createHabit = async (habit: NewHabit) => {
    await post('/habits', habit);
    await loadHabits();
    pushToast(`Quest added: ${habit.name}`);
  };

  const onFocusComplete = (habitId: string | null) => {
    if (habitId) {
      const habit = habits.find((h) => h.id === habitId);
      if (habit) void completeHabit(habit);
    } else {
      pushToast('Focus block complete. Recover, then go again.');
    }
  };

  if (loading || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center font-mono text-xs uppercase tracking-[0.3em] text-ink-faint">
        Loading save file…
      </div>
    );
  }

  const bestStreak = Math.max(me.stats.bestStreak, ...habits.map((h) => h.streak), 0);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-28">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="font-display text-xl font-600 sm:text-2xl">
            Welcome back, <span className="neon-cyan-text">{me.username}</span>
          </h1>
        </motion.div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* LEFT — crystal + stats */}
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="glass rounded-2xl p-6"
            >
              <Crystal level={me.level} bestStreak={bestStreak} />
              <XPBar
                level={me.progress.level}
                xpIntoLevel={me.progress.xpIntoLevel}
                xpForNextLevel={me.progress.xpForNextLevel}
              />
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/[0.03] p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-lg font-semibold text-neon-cyan">
                    <Zap className="h-4 w-4" aria-hidden />
                    <span className="font-mono tabular-nums">{me.xp}</span>
                  </div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
                    total XP
                  </div>
                </div>
                <div className="rounded-xl bg-white/[0.03] p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-lg font-semibold text-neon-amber">
                    <Trophy className="h-4 w-4" aria-hidden />
                    <span className="font-mono tabular-nums">{bestStreak}</span>
                  </div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
                    best streak
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <FocusTimer habits={habits} onSessionComplete={onFocusComplete} />
            </motion.div>
          </div>

          {/* MIDDLE — habits */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="mb-4 flex items-center justify-between"
            >
              <h2 className="font-display text-sm font-600 uppercase tracking-wide">
                Active quests
              </h2>
              <button
                onClick={() => setModalOpen(true)}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-neon-cyan/50 bg-neon-cyan/10 px-3 py-2 font-mono text-xs uppercase tracking-widest text-neon-cyan transition-colors duration-200 hover:bg-neon-cyan/20"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                New
              </button>
            </motion.div>

            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {habits.map((habit) => (
                  <HabitCard
                    key={habit.id}
                    habit={habit}
                    onComplete={completeHabit}
                    onArchive={archiveHabit}
                    busy={busyId === habit.id}
                  />
                ))}
              </AnimatePresence>
              {habits.length === 0 && (
                <div className="glass rounded-2xl border-dashed p-8 text-center text-sm text-ink-muted">
                  No quests yet. Forge your first habit and start earning XP.
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — AI planner */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <AIPlanner
              me={me}
              onAddHabit={(habit) =>
                void createHabit({ ...habit, color: 'lime' }).catch((err) =>
                  pushToast(err instanceof Error ? err.message : 'Failed', 'magenta'),
                )
              }
            />
          </motion.div>
        </div>
      </main>

      {/* toasts */}
      <div className="fixed bottom-6 left-1/2 z-[80] flex -translate-x-1/2 flex-col gap-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              className={`glass rounded-xl px-5 py-3 font-mono text-sm ${
                toast.tone === 'lime'
                  ? 'text-neon-lime'
                  : toast.tone === 'amber'
                    ? 'text-neon-amber'
                    : 'text-neon-magenta'
              }`}
            >
              {toast.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <NewHabitModal open={modalOpen} onClose={() => setModalOpen(false)} onCreate={createHabit} />
      <LevelUpOverlay level={levelUp} onDone={() => setLevelUp(null)} />
    </>
  );
}
