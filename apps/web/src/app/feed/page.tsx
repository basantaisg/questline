'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Flame, Hand, Quote, Rocket, Send, Trash2, Trophy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { api, del, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Post, ReactionType } from '@/lib/types';

const reactionMeta: Record<
  ReactionType,
  { label: string; icon: typeof Flame; active: string }
> = {
  salute: { label: 'Salute', icon: Hand, active: 'text-neon-cyan border-neon-cyan/50 bg-neon-cyan/10' },
  fire: { label: 'Fire', icon: Flame, active: 'text-neon-amber border-neon-amber/50 bg-neon-amber/10' },
  keep_going: { label: 'Keep going', icon: Rocket, active: 'text-neon-magenta border-neon-magenta/50 bg-neon-magenta/10' },
};

function timeAgo(iso: string): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function FeedPage() {
  const { me, loading } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !me) router.replace('/login');
  }, [loading, me, router]);

  const load = useCallback(async () => {
    const data = await api<Post[]>('/feed');
    setPosts(data);
  }, []);

  useEffect(() => {
    if (me) load().catch(() => undefined);
  }, [me, load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    try {
      await post('/feed', { content: content.trim() });
      setContent('');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const react = async (postId: string, type: ReactionType) => {
    // optimistic toggle
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const mineNow = p.myReactions.includes(type);
        return {
          ...p,
          myReactions: mineNow
            ? p.myReactions.filter((t) => t !== type)
            : [...p.myReactions, type],
          reactions: { ...p.reactions, [type]: p.reactions[type] + (mineNow ? -1 : 1) },
        };
      }),
    );
    try {
      await post(`/feed/${postId}/react`, { type });
    } catch {
      await load();
    }
  };

  const remove = async (postId: string) => {
    await del(`/feed/${postId}`);
    setPosts((p) => p.filter((x) => x.id !== postId));
  };

  if (loading || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center font-mono text-xs uppercase tracking-[0.3em] text-ink-faint">
        Loading feed…
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-28">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-xl font-600 sm:text-2xl"
        >
          The <span className="neon-magenta-text">guild feed</span>
        </motion.h1>

        {/* composer */}
        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          onSubmit={submit}
          className="glass mt-6 rounded-2xl p-4"
        >
          <label className="sr-only" htmlFor="composer">
            Share a quote
          </label>
          <textarea
            id="composer"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={280}
            rows={2}
            placeholder="Drop a quote that keeps you moving…"
            className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm outline-none transition-colors duration-200 placeholder:text-ink-faint focus:border-neon-magenta/50"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="font-mono text-[10px] tabular-nums text-ink-faint">
              {content.length}/280
            </span>
            <button
              type="submit"
              disabled={busy || !content.trim()}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-neon-magenta/60 bg-neon-magenta/10 px-4 py-2 font-mono text-xs uppercase tracking-widest text-neon-magenta transition-colors duration-200 hover:bg-neon-magenta/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" aria-hidden />
              Post
            </button>
          </div>
        </motion.form>

        {/* posts */}
        <div className="mt-6 space-y-4">
          <AnimatePresence mode="popLayout">
            {posts.map((p, i) => (
              <motion.article
                key={p.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                className={`glass rounded-2xl p-5 ${
                  p.type === 'milestone' ? 'border-neon-amber/30' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                        p.type === 'milestone'
                          ? 'bg-neon-amber/10 text-neon-amber'
                          : 'bg-neon-cyan/10 text-neon-cyan'
                      }`}
                      aria-hidden
                    >
                      {p.type === 'milestone' ? (
                        <Trophy className="h-4 w-4" />
                      ) : (
                        <Quote className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <span className="text-sm font-semibold">{p.author}</span>
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-neon-lime">
                        LV {p.authorLevel}
                      </span>
                      <div className="font-mono text-[10px] text-ink-faint">
                        {timeAgo(p.createdAt)}
                      </div>
                    </div>
                  </div>
                  {p.canDelete && (
                    <button
                      onClick={() => remove(p.id)}
                      aria-label={p.mine ? 'Delete post' : 'Remove post (admin)'}
                      className="cursor-pointer rounded-lg p-2 text-ink-faint transition-colors duration-200 hover:bg-white/5 hover:text-neon-magenta"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>

                <p
                  className={`mt-3 leading-relaxed ${
                    p.type === 'milestone' ? 'font-mono text-sm text-neon-amber' : 'text-[15px]'
                  }`}
                >
                  {p.content}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {(Object.keys(reactionMeta) as ReactionType[]).map((type) => {
                    const meta = reactionMeta[type];
                    const active = p.myReactions.includes(type);
                    return (
                      <motion.button
                        key={type}
                        whileTap={{ scale: 0.92 }}
                        onClick={() => react(p.id, type)}
                        aria-pressed={active}
                        aria-label={`${meta.label} (${p.reactions[type]})`}
                        className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors duration-200 ${
                          active
                            ? meta.active
                            : 'border-white/10 text-ink-muted hover:border-white/30 hover:text-ink'
                        }`}
                      >
                        <meta.icon className="h-3.5 w-3.5" aria-hidden />
                        {meta.label}
                        {p.reactions[type] > 0 && (
                          <span className="tabular-nums">{p.reactions[type]}</span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.article>
            ))}
          </AnimatePresence>

          {posts.length === 0 && (
            <div className="glass rounded-2xl p-10 text-center text-sm text-ink-muted">
              The guild is quiet. Post the first quote — or hit a streak milestone and it
              will be shared automatically.
            </div>
          )}
        </div>
      </main>
    </>
  );
}
