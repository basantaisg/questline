import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { Db, DB } from '../db/db.module';
import { payments } from '../db/schema';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

export type PaidTier = 'starter' | 'pro' | 'elite';
export type CryptoCurrency = 'btc' | 'eth' | 'sol' | 'usdt';

const TIER_PRICES_USD: Record<PaidTier, number> = {
  starter: 5,
  pro: 10,
  elite: 20,
};

/**
 * DEMO ONLY — fixed exchange rates and generated addresses. Nothing touches a
 * real chain; a live integration (Coinbase Commerce / NOWPayments) would
 * replace the address generator and the confirm() simulation with webhooks.
 */
const DEMO_RATES_USD: Record<CryptoCurrency, number> = {
  btc: 67_500,
  eth: 3_400,
  sol: 155,
  usdt: 1,
};

const PAYMENT_WINDOW_MS = 30 * 60 * 1000;

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function randomFrom(alphabet: string, length: number): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function demoAddress(currency: CryptoCurrency): string {
  switch (currency) {
    case 'btc':
      return `bc1q${randomFrom(BECH32, 38)}`;
    case 'sol':
      return randomFrom(BASE58, 44);
    case 'eth':
    case 'usdt':
      return `0x${randomBytes(20).toString('hex')}`;
  }
}

function demoTxHash(currency: CryptoCurrency): string {
  switch (currency) {
    case 'btc':
      return randomBytes(32).toString('hex');
    case 'sol':
      return randomFrom(BASE58, 88);
    case 'eth':
    case 'usdt':
      return `0x${randomBytes(32).toString('hex')}`;
  }
}

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly subs: SubscriptionsService,
  ) {}

  async checkout(userId: string, tier: PaidTier, currency: CryptoCurrency) {
    // No paying for a sideways/downward move while the current period runs.
    await this.subs.assertTierChangeAllowed(userId, tier);

    const amountUsd = TIER_PRICES_USD[tier];
    const amountCrypto = (amountUsd / DEMO_RATES_USD[currency])
      .toFixed(8)
      .replace(/\.?0+$/, '');

    const [payment] = await this.db
      .insert(payments)
      .values({
        userId,
        tier,
        currency,
        amountUsd,
        amountCrypto,
        address: demoAddress(currency),
        expiresAt: new Date(Date.now() + PAYMENT_WINDOW_MS),
      })
      .returning();
    return payment;
  }

  async get(userId: string, paymentId: string) {
    const [payment] = await this.db
      .select()
      .from(payments)
      .where(and(eq(payments.id, paymentId), eq(payments.userId, userId)))
      .limit(1);
    if (!payment) throw new NotFoundException('Payment not found');
    return this.expireIfStale(payment);
  }

  /**
   * Demo confirmation: stands in for on-chain verification. Generates a tx
   * hash, marks the payment confirmed, and only then activates the tier.
   */
  async confirm(userId: string, paymentId: string) {
    // Tripwire: this endpoint grants tiers WITHOUT verifying real payment.
    // It must never run in production unless explicitly opted into demo mode.
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.PAYMENTS_DEMO_MODE !== 'true'
    ) {
      throw new ForbiddenException(
        'Demo payment confirmation is disabled in production',
      );
    }

    const payment = await this.get(userId, paymentId);

    if (payment.status === 'confirmed') {
      throw new BadRequestException('This payment is already confirmed');
    }
    if (payment.status === 'expired') {
      throw new BadRequestException(
        'Payment window expired — start a new checkout',
      );
    }

    // Re-validate before granting: the user's tier may have changed between
    // checkout and confirm (e.g. a higher tier was activated in the meantime).
    await this.subs.assertTierChangeAllowed(userId, payment.tier as PaidTier);

    const [confirmed] = await this.db
      .update(payments)
      .set({
        status: 'confirmed',
        txHash: demoTxHash(payment.currency),
        confirmedAt: new Date(),
      })
      .where(and(eq(payments.id, paymentId), eq(payments.status, 'pending')))
      .returning();
    if (!confirmed) throw new BadRequestException('Payment is no longer pending');

    const subscription = await this.subs.setTier(
      userId,
      confirmed.tier as PaidTier,
    );
    return { payment: confirmed, subscription };
  }

  private async expireIfStale(payment: typeof payments.$inferSelect) {
    if (payment.status !== 'pending' || payment.expiresAt > new Date()) {
      return payment;
    }
    const [expired] = await this.db
      .update(payments)
      .set({ status: 'expired' })
      .where(and(eq(payments.id, payment.id), eq(payments.status, 'pending')))
      .returning();
    return expired ?? payment;
  }
}
