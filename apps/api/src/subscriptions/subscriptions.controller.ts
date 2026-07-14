import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsIn } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../common/jwt-payload';
import { SubscriptionsService } from './subscriptions.service';

export class UpgradeDto {
  @IsIn(['free', 'starter', 'pro', 'elite'])
  tier: 'free' | 'starter' | 'pro' | 'elite';
}

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.subs.get(user.sub);
  }

  /**
   * Only downgrading to free is allowed here, and only once the paid period
   * has ended. Paid tiers are activated by the payments flow
   * (POST /payments/checkout → POST /payments/:id/confirm) after the payment
   * is confirmed.
   */
  @Post('upgrade')
  async upgrade(@CurrentUser() user: JwtPayload, @Body() dto: UpgradeDto) {
    if (dto.tier !== 'free') {
      throw new BadRequestException(
        'Paid tiers require checkout — start one at POST /payments/checkout',
      );
    }
    await this.subs.assertTierChangeAllowed(user.sub, 'free');
    return this.subs.setTier(user.sub, 'free');
  }
}
