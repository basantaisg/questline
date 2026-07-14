import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiQuotaGuard } from './ai-quota.guard';
import { AiService } from './ai.service';

@Module({
  controllers: [AiController],
  providers: [AiService, AiQuotaGuard],
})
export class AiModule {}
