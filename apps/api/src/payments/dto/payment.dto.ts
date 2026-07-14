import { IsIn } from 'class-validator';

export class CheckoutDto {
  @IsIn(['starter', 'pro', 'elite'])
  tier: 'starter' | 'pro' | 'elite';

  @IsIn(['btc', 'eth', 'sol', 'usdt'])
  currency: 'btc' | 'eth' | 'sol' | 'usdt';
}
