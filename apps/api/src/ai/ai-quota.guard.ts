import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { and, count, eq, gte } from 'drizzle-orm';
import { startOfMonthUtc } from '../common/dates';
import { isAdmin } from '../common/is-admin';
import { JwtPayload } from '../common/jwt-payload';
import { Db, DB } from '../db/db.module';
import { aiUsageLogs, subscriptions } from '../db/schema';
import { TIER_AI_LIMITS } from '../users/users.service';

/**
 * Enforces per-tier monthly AI quotas *before* the controller runs:
 *   free → 0 prompts, starter → 3/mo, pro → 50/mo, elite → unlimited.
 * Attaches { tier, used, limit } to the request for the controller.
 */
@Injectable()
export class AiQuotaGuard implements CanActivate {
  constructor(@Inject(DB) private readonly db: Db) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user: JwtPayload | undefined = req.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    // Admins are not billed and are never quota-limited: skip the tier checks.
    if (await isAdmin(this.db, user.sub)) {
      req.aiQuota = { tier: 'elite', used: 0, limit: null };
      return true;
    }

    const [sub] = await this.db
      .select({ tier: subscriptions.tier })
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.sub))
      .limit(1);
    const tier = sub?.tier ?? 'free';
    const limit = TIER_AI_LIMITS[tier] ?? 0;

    if (limit === 0) {
      throw new ForbiddenException(
        'AI coaching requires a paid plan. Upgrade to Starter, Pro or Elite to unlock it.',
      );
    }

    const [row] = await this.db
      .select({ used: count() })
      .from(aiUsageLogs)
      .where(
        and(
          eq(aiUsageLogs.userId, user.sub),
          gte(aiUsageLogs.createdAt, startOfMonthUtc()),
        ),
      );
    const used = row?.used ?? 0;

    if (used >= limit) {
      throw new ForbiddenException(
        `You've used all ${limit} AI prompts on the ${tier} plan this month. Upgrade for more.`,
      );
    }

    req.aiQuota = { tier, used, limit: Number.isFinite(limit) ? limit : null };
    return true;
  }
}
