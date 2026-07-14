import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { JwtPayload, Role } from '../common/jwt-payload';
import {
  OTP_MAX_ATTEMPTS,
  generateOtp,
  hashOtp,
  otpExpiry,
  otpMatches,
} from '../common/otp';
import { Db, DB } from '../db/db.module';
import { MailService } from '../mail/mail.service';
import { refreshTokens, subscriptions, users } from '../db/schema';
import { ResendOtpDto, SigninDto, SignupDto, VerifyOtpDto } from './dto/auth.dto';

export type OtpPurpose = 'signup' | 'password_change';

export interface AuthResult {
  user: {
    id: string;
    email: string;
    username: string;
    xp: number;
    level: number;
    role: Role;
  };
  accessToken: string;
  refreshToken: string;
  refreshMaxAgeMs: number;
}

export interface PendingVerification {
  status: 'verification_required';
  email: string;
  message: string;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * Per-account brute-force lockout, keyed by submitted email (whether or not
   * the account exists — no enumeration). In-memory: move to Redis/DB when
   * running more than one instance.
   */
  private readonly failedLogins = new Map<string, { count: number; lockedUntil: number }>();

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  private assertNotLocked(email: string) {
    const entry = this.failedLogins.get(email);
    if (entry && entry.lockedUntil > Date.now()) {
      throw new UnauthorizedException(
        'Too many failed attempts — try again in a few minutes',
      );
    }
  }

  private recordFailedLogin(email: string) {
    const entry = this.failedLogins.get(email) ?? { count: 0, lockedUntil: 0 };
    entry.count += 1;
    if (entry.count >= MAX_FAILED_LOGINS) {
      entry.lockedUntil = Date.now() + LOCKOUT_MS;
      entry.count = 0;
    }
    this.failedLogins.set(email, entry);
  }

  private get refreshTtlDays(): number {
    return Number(this.config.get('REFRESH_TOKEN_TTL_DAYS') ?? 7);
  }

  // ---------------------------------------------------------------- OTP core

  /**
   * Mints a fresh code, replaces any pending one, and emails it. Shared by
   * signup, resend, and the password-change authorization flow.
   */
  async issueOtp(userId: string, email: string, purpose: OtpPurpose): Promise<void> {
    const code = generateOtp();

    await this.db
      .update(users)
      .set({
        otpCode: hashOtp(code),
        otpExpiresAt: otpExpiry(),
        otpPurpose: purpose,
        otpAttempts: 0,
      })
      .where(eq(users.id, userId));

    await this.mail.sendOtp(email, code, purpose);
  }

  /**
   * Validates a pending code and burns it. Throws on every failure path; on
   * success the OTP columns are cleared so a code is strictly single-use.
   *
   * The `purpose` check is what stops a signup code — which the user may still
   * have sitting in their inbox — from being replayed to authorize a password
   * change, and vice versa.
   */
  async consumeOtp(userId: string, code: string, purpose: OtpPurpose): Promise<void> {
    const [user] = await this.db
      .select({
        otpCode: users.otpCode,
        otpExpiresAt: users.otpExpiresAt,
        otpPurpose: users.otpPurpose,
        otpAttempts: users.otpAttempts,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user?.otpCode || !user.otpExpiresAt || user.otpPurpose !== purpose) {
      throw new BadRequestException('No verification code is pending — request a new one');
    }

    if (user.otpExpiresAt <= new Date()) {
      await this.clearOtp(userId);
      throw new BadRequestException('That code has expired — request a new one');
    }

    if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
      await this.clearOtp(userId);
      throw new BadRequestException('Too many incorrect attempts — request a new code');
    }

    if (!otpMatches(code, user.otpCode)) {
      // Count the miss. Six digits is only a million possibilities, so an
      // uncapped code would fall to an online guessing attack.
      await this.db
        .update(users)
        .set({ otpAttempts: user.otpAttempts + 1 })
        .where(eq(users.id, userId));
      throw new BadRequestException('That code is incorrect');
    }

    await this.clearOtp(userId);
  }

  private clearOtp(userId: string) {
    return this.db
      .update(users)
      .set({ otpCode: null, otpExpiresAt: null, otpPurpose: null, otpAttempts: 0 })
      .where(eq(users.id, userId));
  }

  // ----------------------------------------------------------------- Signup

  /**
   * Creates the account in an unverified state and emails a code. Deliberately
   * returns no session: nothing but /auth/verify-otp can move the account
   * forward until the address is proven.
   */
  async signup(dto: SignupDto): Promise<PendingVerification> {
    const email = dto.email.toLowerCase();

    const [existing] = await this.db
      .select({ id: users.id, isVerified: users.isVerified })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing?.isVerified) {
      throw new ConflictException('An account with this email already exists');
    }

    const [usernameOwner] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, dto.username))
      .limit(1);
    if (usernameOwner && usernameOwner.id !== existing?.id) {
      throw new ConflictException('This username is taken');
    }

    const passwordHash = await hash(dto.password, 12);

    // An unverified row for this address is an abandoned or interrupted signup,
    // not an account: nobody has ever proven they own the mailbox, so it is
    // safe to overwrite and re-issue. The new code still lands in the real
    // inbox, so this hands an attacker nothing.
    const userId = existing
      ? await this.resetPendingSignup(existing.id, dto.username, passwordHash)
      : await this.createUser(email, dto.username, passwordHash);

    try {
      await this.issueOtp(userId, email, 'signup');
    } catch (err) {
      // The mailbox is the only way into this account, so a send failure means
      // signup did not succeed — say so plainly instead of leaking a 500. The
      // half-built row is harmless: it is unverified, and signing up again
      // simply overwrites it and re-sends.
      this.logger.error(`Signup OTP send failed for ${email}: ${String(err)}`);
      throw new ServiceUnavailableException(
        "We couldn't send your verification email. Please try again in a moment.",
      );
    }

    return {
      status: 'verification_required',
      email,
      message: 'We sent a 6-digit code to your email. It expires in 5 minutes.',
    };
  }

  private async createUser(email: string, username: string, passwordHash: string) {
    const [user] = await this.db
      .insert(users)
      .values({ email, username, passwordHash, isVerified: false })
      .returning({ id: users.id });

    // Every new account starts on the free tier, as a plain user — admin is
    // granted out-of-band (seed script), never through public signup.
    await this.db.insert(subscriptions).values({ userId: user.id, tier: 'free' });
    return user.id;
  }

  private async resetPendingSignup(id: string, username: string, passwordHash: string) {
    await this.db.update(users).set({ username, passwordHash }).where(eq(users.id, id));
    return id;
  }

  /** Verifies a signup code and, on success, signs the user straight in. */
  async verifyOtp(dto: VerifyOtpDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase();
    this.assertNotLocked(email);

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      this.recordFailedLogin(email);
      throw new BadRequestException('That code is incorrect');
    }
    if (user.isVerified) {
      throw new BadRequestException('This account is already verified — just sign in');
    }

    try {
      await this.consumeOtp(user.id, dto.code, 'signup');
    } catch (err) {
      this.recordFailedLogin(email);
      throw err;
    }

    this.failedLogins.delete(email);
    await this.db.update(users).set({ isVerified: true }).where(eq(users.id, user.id));

    return this.issueTokens(user.id, user.email, user.username, user.xp, user.level, user.role, true);
  }

  /**
   * Re-sends a signup code. Always reports success: a differing response for a
   * known vs unknown address would turn this into an account-existence oracle.
   */
  async resendOtp(dto: ResendOtpDto): Promise<{ message: string }> {
    const email = dto.email.toLowerCase();
    const generic = { message: 'If that account is awaiting verification, a new code is on its way.' };

    const [user] = await this.db
      .select({ id: users.id, email: users.email, isVerified: users.isVerified })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user || user.isVerified) return generic;

    try {
      await this.issueOtp(user.id, user.email, 'signup');
    } catch (err) {
      // A mail-provider outage must not confirm the address exists either.
      this.logger.error(`Failed to resend signup OTP: ${String(err)}`);
    }
    return generic;
  }

  // ----------------------------------------------------------------- Signin

  async signin(dto: SigninDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase();
    this.assertNotLocked(email);

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // Same error for unknown email and bad password — no account enumeration.
    if (!user) {
      this.recordFailedLogin(email);
      throw new UnauthorizedException('Invalid email or password');
    }
    const valid = await compare(dto.password, user.passwordHash);
    if (!valid) {
      this.recordFailedLogin(email);
      throw new UnauthorizedException('Invalid email or password');
    }

    this.failedLogins.delete(email);

    // Correct credentials, unproven mailbox: no session is minted. Only
    // disclosed *after* the password checks out, so it is not an oracle.
    if (!user.isVerified) {
      await this.issueOtp(user.id, user.email, 'signup').catch((err) =>
        this.logger.error(`Failed to send verification code on signin: ${String(err)}`),
      );
      throw new ForbiddenException({
        statusCode: 403,
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
        message: 'Verify your email to continue — we sent you a fresh code.',
      });
    }

    return this.issueTokens(user.id, user.email, user.username, user.xp, user.level, user.role, true);
  }

  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    if (!refreshToken) throw new UnauthorizedException('Missing refresh token');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = sha256(refreshToken);
    const [stored] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    if (!stored || stored.userId !== payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // A rotated/expired token coming back is a theft signal — the legitimate
    // client already holds the successor. Fail closed: kill every session.
    if (stored.revoked || stored.expiresAt <= new Date()) {
      await this.revokeAllSessions(stored.userId);
      throw new UnauthorizedException('Session invalidated — please sign in again');
    }

    // Rotate: a refresh token is single-use.
    await this.db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.id, stored.id));

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);
    if (!user) throw new UnauthorizedException('User no longer exists');

    // Re-read from the DB rather than trusting the old claim, so an account
    // that lost its verified status cannot ride an old token forward.
    if (!user.isVerified) {
      await this.revokeAllSessions(user.id);
      throw new UnauthorizedException('Verify your email to continue');
    }

    return this.issueTokens(user.id, user.email, user.username, user.xp, user.level, user.role, true);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.tokenHash, sha256(refreshToken)));
  }

  /** Revokes every refresh token for the user — all devices sign out. */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.userId, userId));
  }

  private async issueTokens(
    id: string,
    email: string,
    username: string,
    xp: number,
    level: number,
    role: Role,
    verified: boolean,
  ): Promise<AuthResult> {
    const payload: JwtPayload = { sub: id, email, username, role, verified };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('ACCESS_TOKEN_TTL') ?? '15m',
      algorithm: 'HS256',
    });

    const refreshMaxAgeMs = this.refreshTtlDays * 24 * 60 * 60 * 1000;
    const refreshToken = await this.jwt.signAsync(
      { ...payload, jti: randomUUID() },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: `${this.refreshTtlDays}d`,
        algorithm: 'HS256',
      },
    );

    // Only the hash is persisted — a DB leak cannot replay sessions.
    await this.db.insert(refreshTokens).values({
      userId: id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + refreshMaxAgeMs),
    });

    return {
      user: { id, email, username, xp, level, role },
      accessToken,
      refreshToken,
      refreshMaxAgeMs,
    };
  }
}
