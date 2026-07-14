import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../common/jwt-payload';
import { AiQuotaGuard } from './ai-quota.guard';
import { AiService } from './ai.service';
import { RoadmapDto } from './dto/ai.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard, AiQuotaGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('roadmap')
  async roadmap(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RoadmapDto,
    @Req() req: Request & { aiQuota: { tier: string; used: number; limit: number | null } },
  ) {
    const roadmap = await this.ai.generateRoadmap(user.sub, dto.goal, req.aiQuota.tier);
    return {
      roadmap,
      quota: {
        tier: req.aiQuota.tier,
        used: req.aiQuota.used + 1,
        limit: req.aiQuota.limit,
      },
    };
  }
}
