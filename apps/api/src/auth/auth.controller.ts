import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { JwtPayload } from '../common/jwt-payload';
import { AuthResult, AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { SigninDto, SignupDto } from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

const REFRESH_COOKIE = 'ql_refresh';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Access token goes to the client (kept in memory); refresh token only ever
   *  travels as a secure HttpOnly SameSite=Strict cookie scoped to /auth. */
  private send(res: Response, result: AuthResult) {
    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/auth',
      maxAge: result.refreshMaxAgeMs,
    });
    return { user: result.user, accessToken: result.accessToken };
  }

  // Brute-force protection: tight limits on credential endpoints.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('signup')
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    return this.send(res, await this.auth.signup(dto));
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('signin')
  @HttpCode(200)
  async signin(@Body() dto: SigninDto, @Res({ passthrough: true }) res: Response) {
    return this.send(res, await this.auth.signin(dto));
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.send(res, await this.auth.refresh(req.cookies?.[REFRESH_COOKIE]));
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
  }

  /** Panic button: signs the user out of every device. */
  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(204)
  async logoutAll(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.revokeAllSessions(user.sub);
    res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
  }
}
