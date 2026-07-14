import { Body, Controller, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../common/jwt-payload';
import {
  ChangePasswordDto,
  ChangeUsernameDto,
  UpdateProfileDto,
} from './dto/profile.dto';
import { ProfileService } from './profile.service';

/**
 * Guarded at the class level: every route below requires a valid, verified
 * access token, and acts on `user.sub` from that token — the resource owner is
 * the authenticated user by construction, never a path or body parameter.
 */
@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  get(@CurrentUser() user: JwtPayload) {
    return this.profile.get(user.sub);
  }

  @Patch()
  update(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.profile.update(user.sub, dto);
  }

  @Patch('username')
  changeUsername(@CurrentUser() user: JwtPayload, @Body() dto: ChangeUsernameDto) {
    return this.profile.changeUsername(user.sub, dto);
  }

  /** Each call sends real email — keep it tight. */
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('password/request-otp')
  @HttpCode(200)
  requestPasswordOtp(@CurrentUser() user: JwtPayload) {
    return this.profile.requestPasswordOtp(user.sub);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Patch('password')
  changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    return this.profile.changePassword(user.sub, dto);
  }
}
