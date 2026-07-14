'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Brain, Lock, Plus, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { post } from '@/lib/api';
import { Me, Roadmap } from '@/lib/types';

export default function AIPlanner({
  me,
  onAddHabit,
}: {
  me: Me;
  onAddHabit: (habit: { name: string; frequency: 'daily' | 'weekly'; xpReward: number }) => void;
}) {
  const [goal, setGoal] = useState('');
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [quota, setQuota] = useState<{ used: number; limit: number | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = me.tier === 'free';
  const used = quota?.used ?? me.ai.used;
  const limit = quota?.limit !== undefined ? quota.limit : me.ai.limit;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await post<{ roadmap: Roadmap; quota: { used: number; limit: number | null } }>(
        '/ai/roadmap',
        { goal },
      );
      setRoadmap(result.roadmap);
      setQuota(result.quota);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The AI engine faltered — try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-sm font-600 uppercase tracking-wide">
          <Brain className="h-4 w-4 text-neon-lime" aria-hidden />
          AI quest architect
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
          {limit === null ? 'unlimited' : `${used}/${limit} used`}
        </span>
      </div>

      {locked ? (
        <div className="mt-5 flex flex-col items-center rounded-xl border border-dashed border-white/15 py-8 text-center">
          <Lock className="h-6 w-6 text-ink-faint" aria-hidden />
          <p className="mt-3 max-w-[24ch] text-sm text-ink-muted">
            The AI coach is a paid-tier power. Unlock 7-day roadmaps from $5/mo.
          </p>
          <Link
            href="/pricing"
            className="mt-4 cursor-pointer rounded-xl border border-neon-lime/60 bg-neon-lime/10 px-5 py-2.5 font-mono text-xs uppercase tracking-widest text-neon-lime transition-colors duration-200 hover:bg-neon-lime/20"
          >
            Upgrade
          </Link>
        </div>
      ) : (
        <>
          <form onSubmit={submit} className="mt-4">
            <label className="sr-only" htmlFor="ai-goal">
              Your goal
            </label>
            <textarea
              id="ai-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              required
              minLength={3}
              maxLength={500}
              rows={2}
              placeholder='e.g. "Ship my side project while training for a 10k"'
              className="w-full resize-none rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm outline-none transition-colors duration-200 placeholder:text-ink-faint focus:border-neon-lime/60"
            />
            <button
              type="submit"
              disabled={busy || goal.trim().length < 3}
              className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-neon-lime/60 bg-neon-lime/10 py-3 font-mono text-xs uppercase tracking-widest text-neon-lime transition-colors duration-200 hover:bg-neon-lime/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden />
              {busy ? 'Consulting the oracle…' : 'Generate 7-day roadmap'}
            </button>
          </form>

          {error && (
            <p role="alert" className="mt-3 rounded-lg border border-neon-magenta/40 bg-neon-magenta/10 px-4 py-2 text-sm text-neon-magenta">
              {error}
            </p>
          )}

          <AnimatePresence>
            {roadmap && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-5 border-t border-white/10 pt-4">
                  <h3 className="font-display text-sm font-600 text-neon-lime">{roadmap.title}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{roadmap.summary}</p>

                  <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
                    {roadmap.days.map((day) => (
                      <div key={day.day} className="rounded-xl bg-white/[0.03] p-3">
                        <div className="font-mono text-[10px] uppercase tracking-widest text-neon-cyan">
                          Day {day.day} — {day.theme}
                        </div>
                        <ul className="mt-2 space-y-1">
                          {day.tasks.map((task, i) => (
                            <li key={i} className="flex gap-2 text-sm text-ink-muted">
                              <span className="text-neon-lime" aria-hidden>▸</span>
                              {task}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  {roadmap.suggestedHabits.length > 0 && (
                    <>
                      <div className="mt-4 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
                        Suggested quests
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {roadmap.suggestedHabits.map((habit) => (
                          <button
                            key={habit.name}
                            onClick={() => onAddHabit(habit)}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-neon-cyan/40 bg-neon-cyan/5 px-3 py-1.5 font-mono text-xs text-neon-cyan transition-colors duration-200 hover:bg-neon-cyan/15"
                          >
                            <Plus className="h-3 w-3" aria-hidden />
                            {habit.name}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
