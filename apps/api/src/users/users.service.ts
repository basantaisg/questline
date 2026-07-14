import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { count, eq, gte, and, max } from 'drizzle-orm';
import { startOfMonthUtc } from '../common/dates';
import { levelProgress } from '../common/leveling';
import { Db, DB } from '../db/db.module';
import { aiUsageLogs, habitCompletions, streaks, subscriptions, users } from '../db/schema';

export const TIER_AI_LIMITS: Record<string, number> = {
  free: 0,
  starter: 3,
  pro: 50,
  elite: Number.POSITIVE_INFINITY,
};

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async getMe(userId: string) {
    const [user] = await this.db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        name: users.name,
        imageUrl: users.imageUrl,
        age: users.age,
        profession: users.profession,
        role: users.role,
        xp: users.xp,
        level: users.level,
        isVerified: users.isVerified,
        lastUsernameChangedAt: users.lastUsernameChangedAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) throw new NotFoundException('User not found');

    const [sub] = await this.db
      .select({ tier: subscriptions.tier, renewsAt: subscriptions.renewsAt })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);
    const tier = sub?.tier ?? 'free';
    const renewsAt = tier !== 'free' ? (sub?.renewsAt ?? null) : null;

    const [completions] = await this.db
      .select({ total: count() })
      .from(habitCompletions)
      .where(eq(habitCompletions.userId, userId));

    const [best] = await this.db
      .select({ longest: max(streaks.longest) })
      .from(streaks)
      .where(eq(streaks.userId, userId));

    const [aiThisMonth] = await this.db
      .select({ used: count() })
      .from(aiUsageLogs)
      .where(
        and(
          eq(aiUsageLogs.userId, userId),
          gte(aiUsageLogs.createdAt, startOfMonthUtc()),
        ),
      );

    // Admins are ungated: report unlimited AI regardless of the tier they hold,
    // matching what AiQuotaGuard actually enforces.
    const limit = user.role === 'admin' ? Number.POSITIVE_INFINITY : TIER_AI_LIMITS[tier];
    return {
      ...user,
      tier,
      renewsAt,
      progress: levelProgress(user.xp),
      stats: {
        totalCompletions: completions?.total ?? 0,
        bestStreak: best?.longest ?? 0,
      },
      ai: {
        used: aiThisMonth?.used ?? 0,
        limit: Number.isFinite(limit) ? limit : null,
      },
    };
  }
}
