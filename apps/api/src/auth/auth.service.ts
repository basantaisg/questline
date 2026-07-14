import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { JwtPayload } from '../common/jwt-payload';
import { Db, DB } from '../db/db.module';
import { refreshTokens, subscriptions, users } from '../db/schema';
import { SigninDto, SignupDto } from './dto/auth.dto';

export interface AuthResult {
  user: { id: string; email: string; username: string; xp: number; level: number };
  accessToken: string;
  refreshToken: string;
  refreshMaxAgeMs: number;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
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

  async signup(dto: SignupDto): Promise<AuthResult> {
    const [existing] = await this.db
      .select({ id: users.id, email: users.email, username: users.username })
      .from(users)
      .where(eq(users.email, dto.email.toLowerCase()))
      .limit(1);
    if (existing) throw new ConflictException('An account with this email already exists');

    const [usernameTaken] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, dto.username))
      .limit(1);
    if (usernameTaken) throw new ConflictException('This username is taken');

    const passwordHash = await hash(dto.password, 12);
    const [user] = await this.db
      .insert(users)
      .values({
        email: dto.email.toLowerCase(),
        username: dto.username,
        passwordHash,
      })
      .returning();

    // Every new account starts on the free tier.
    await this.db.insert(subscriptions).values({ userId: user.id, tier: 'free' });

    return this.issueTokens(user.id, user.email, user.username, user.xp, user.level);
  }

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
    return this.issueTokens(user.id, user.email, user.username, user.xp, user.level);
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

    return this.issueTokens(user.id, user.email, user.username, user.xp, user.level);
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
  ): Promise<AuthResult> {
    const payload: JwtPayload = { sub: id, email, username };

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
      user: { id, email, username, xp, level },
      accessToken,
      refreshToken,
      refreshMaxAgeMs,
    };
  }
}
