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

  /** When the web app and the API sit on different registrable domains — as
   *  they do on *.vercel.app, which is a public suffix, so foo.vercel.app and
   *  bar.vercel.app are cross-site — a SameSite=Strict cookie is never sent
   *  back and refresh silently fails. Set CROSS_SITE_COOKIES=true there.
   *  On a shared parent domain (app.x.com + api.x.com) leave it unset and keep
   *  Strict, which is the stronger CSRF posture. */
  private refreshCookieOptions() {
    const crossSite = process.env.CROSS_SITE_COOKIES === 'true';
    return {
      httpOnly: true,
      sameSite: crossSite ? ('none' as const) : ('strict' as const),
      // SameSite=None is only honoured on a Secure cookie.
      secure: crossSite || process.env.NODE_ENV === 'production',
      path: '/auth',
    };
  }

  /** Access token goes to the client (kept in memory); refresh token only ever
   *  travels as a secure HttpOnly cookie scoped to /auth. */
  private send(res: Response, result: AuthResult) {
    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      ...this.refreshCookieOptions(),
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
    res.clearCookie(REFRESH_COOKIE, this.refreshCookieOptions());
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
    res.clearCookie(REFRESH_COOKIE, this.refreshCookieOptions());
  }
}
