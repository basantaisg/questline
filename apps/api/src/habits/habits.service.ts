import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { addDays, todayUtc, weekStart } from '../common/dates';
import {
  levelFromXp,
  levelProgress,
  MILESTONES,
  STREAK_BREAK_PENALTY,
  streakBonus,
} from '../common/leveling';
import { Db, DB } from '../db/db.module';
import {
  habitCompletions,
  habits,
  posts,
  streaks,
  users,
} from '../db/schema';
import { CreateHabitDto, UpdateHabitDto } from './dto/habit.dto';

@Injectable()
export class HabitsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Tenant isolation: every query is scoped to the authenticated user. */
  private async ownedHabit(habitId: string, userId: string) {
    const [habit] = await this.db
      .select()
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
      .limit(1);
    if (!habit) throw new NotFoundException('Habit not found');
    return habit;
  }

  async list(userId: string) {
    const rows = await this.db
      .select()
      .from(habits)
      .where(and(eq(habits.userId, userId), eq(habits.archived, false)))
      .orderBy(desc(habits.createdAt));

    if (rows.length === 0) return [];

    const habitIds = rows.map((h) => h.id);
    const streakRows = await this.db
      .select()
      .from(streaks)
      .where(inArray(streaks.habitId, habitIds));

    const today = todayUtc();
    const thisWeek = weekStart(today);
    const byHabit = new Map(streakRows.map((s) => [s.habitId, s]));

    return rows.map((habit) => {
      const streak = byHabit.get(habit.id);
      const last = streak?.lastCompletedOn ?? null;
      const doneThisPeriod =
        habit.frequency === 'daily'
          ? last === today
          : last !== null && weekStart(last) === thisWeek;

      // A daily streak is "alive" if completed today or yesterday.
      const alive =
        habit.frequency === 'daily'
          ? last === today || last === addDays(today, -1)
          : last !== null &&
            (weekStart(last) === thisWeek || weekStart(last) === addDays(thisWeek, -7));

      return {
        ...habit,
        streak: alive ? (streak?.current ?? 0) : 0,
        longestStreak: streak?.longest ?? 0,
        doneThisPeriod,
        lastCompletedOn: last,
      };
    });
  }

  async create(userId: string, dto: CreateHabitDto) {
    const [habit] = await this.db
      .insert(habits)
      .values({
        userId,
        name: dto.name,
        description: dto.description,
        frequency: dto.frequency ?? 'daily',
        xpReward: dto.xpReward ?? 10,
        color: dto.color ?? 'cyan',
      })
      .returning();
    await this.db.insert(streaks).values({ habitId: habit.id, userId });
    return habit;
  }

  async update(habitId: string, userId: string, dto: UpdateHabitDto) {
    await this.ownedHabit(habitId, userId);
    const [updated] = await this.db
      .update(habits)
      .set(dto)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
      .returning();
    return updated;
  }

  async archive(habitId: string, userId: string) {
    await this.ownedHabit(habitId, userId);
    await this.db
      .update(habits)
      .set({ archived: true })
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)));
    return { ok: true };
  }

  /**
   * Core gamification loop: complete a habit → streak math → XP (with streak
   * bonus and break penalty) → level recalculation → milestone auto-post.
   */
  async complete(habitId: string, userId: string) {
    const habit = await this.ownedHabit(habitId, userId);
    const today = todayUtc();

    // One completion per period.
    const [already] = await this.db
      .select({ id: habitCompletions.id, completedOn: habitCompletions.completedOn })
      .from(habitCompletions)
      .where(
        and(
          eq(habitCompletions.habitId, habitId),
          eq(habitCompletions.completedOn, today),
        ),
      )
      .limit(1);
    if (already) throw new ConflictException('Already completed today');

    let [streak] = await this.db
      .select()
      .from(streaks)
      .where(eq(streaks.habitId, habitId))
      .limit(1);
    if (!streak) {
      [streak] = await this.db
        .insert(streaks)
        .values({ habitId, userId })
        .returning();
    }

    const last = streak.lastCompletedOn;
    if (habit.frequency === 'weekly' && last && weekStart(last) === weekStart(today)) {
      throw new ConflictException('Already completed this week');
    }

    // Streak continuation rules.
    let broke = false;
    let current: number;
    if (!last) {
      current = 1;
    } else if (habit.frequency === 'daily') {
      if (last === addDays(today, -1)) current = streak.current + 1;
      else {
        broke = streak.current > 1;
        current = 1;
      }
    } else {
      const lastWeek = addDays(weekStart(today), -7);
      if (weekStart(last) === lastWeek) current = streak.current + 1;
      else {
        broke = streak.current > 1;
        current = 1;
      }
    }

    const longest = Math.max(streak.longest, current);
    const penalty = broke ? STREAK_BREAK_PENALTY : 0;
    const xpAwarded = habit.xpReward + streakBonus(current);

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) throw new NotFoundException('User not found');

    const newXp = Math.max(0, user.xp + xpAwarded - penalty);
    const newLevel = levelFromXp(newXp);
    const leveledUp = newLevel > user.level;

    await this.db
      .update(streaks)
      .set({ current, longest, lastCompletedOn: today })
      .where(eq(streaks.id, streak.id));
    await this.db.insert(habitCompletions).values({
      habitId,
      userId,
      completedOn: today,
      xpAwarded,
    });
    await this.db
      .update(users)
      .set({ xp: newXp, level: newLevel })
      .where(eq(users.id, userId));

    // Auto-share streak milestones to the feed.
    if (MILESTONES.includes(current)) {
      const unit = habit.frequency === 'daily' ? 'day' : 'week';
      await this.db.insert(posts).values({
        userId,
        type: 'milestone',
        content: `${user.username} just hit a ${current}-${unit} streak in ${habit.name}!`,
      });
    }

    return {
      xpAwarded,
      penalty,
      streakBroken: broke,
      streak: current,
      longestStreak: longest,
      milestone: MILESTONES.includes(current) ? current : null,
      totalXp: newXp,
      leveledUp,
      ...levelProgress(newXp),
    };
  }
}
