import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Db, DB } from '../db/db.module';
import { subscriptions } from '../db/schema';

export type Tier = 'free' | 'starter' | 'pro' | 'elite';

export const TIER_RANK: Record<Tier, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  elite: 3,
};

@Injectable()
export class SubscriptionsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * A paid period is non-refundable: while it is active, the only allowed
   * change is to a HIGHER tier. Free/downgrades unlock when the period ends.
   * Called by every path that can change a tier — the upgrade endpoint,
   * checkout creation, and payment confirmation.
   */
  async assertTierChangeAllowed(userId: string, newTier: Tier): Promise<void> {
    const [sub] = await this.db
      .select({ tier: subscriptions.tier, renewsAt: subscriptions.renewsAt })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    const currentTier: Tier = sub?.tier ?? 'free';
    const periodActive =
      currentTier !== 'free' && sub?.renewsAt != null && sub.renewsAt > new Date();

    if (periodActive && TIER_RANK[newTier] <= TIER_RANK[currentTier]) {
      const until = sub!.renewsAt!.toISOString().slice(0, 10);
      throw new ForbiddenException(
        `Your ${currentTier.toUpperCase()} plan is paid through ${until}. You can upgrade to a higher tier now; switching to ${newTier.toUpperCase()} unlocks when the period ends.`,
      );
    }
  }

  async get(userId: string) {
    const [sub] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);
    return sub ?? { tier: 'free' };
  }

  async setTier(userId: string, tier: Tier) {
    const renewsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const [existing] = await this.db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (existing) {
      const [updated] = await this.db
        .update(subscriptions)
        .set({ tier, renewsAt, updatedAt: new Date() })
        .where(eq(subscriptions.userId, userId))
        .returning();
      return updated;
    }
    const [created] = await this.db
      .insert(subscriptions)
      .values({ userId, tier, renewsAt })
      .returning();
    return created;
  }
}
