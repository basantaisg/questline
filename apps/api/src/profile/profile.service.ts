import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { and, eq, ne } from 'drizzle-orm';
import { AuthService } from '../auth/auth.service';
import { Db, DB } from '../db/db.module';
import { users } from '../db/schema';
import {
  ChangePasswordDto,
  ChangeUsernameDto,
  UpdateProfileDto,
} from './dto/profile.dto';

/** A username is locked for this long after each change. */
export const USERNAME_COOLDOWN_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
const USERNAME_COOLDOWN_MS = USERNAME_COOLDOWN_DAYS * DAY_MS;

/** The columns safe to hand back to the client — no hashes, no live OTP state. */
const publicColumns = {
  id: users.id,
  email: users.email,
  username: users.username,
  name: users.name,
  imageUrl: users.imageUrl,
  age: users.age,
  profession: users.profession,
  role: users.role,
  xp: users.xp,
  level: users.level,
  isVerified: users.isVerified,
  lastUsernameChangedAt: users.lastUsernameChangedAt,
  createdAt: users.createdAt,
};

@Injectable()
export class ProfileService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly auth: AuthService,
  ) {}

  /**
   * Every method here takes the user id straight from the verified JWT — there
   * is no caller-supplied id to tamper with, so a user can only ever read or
   * mutate their own row.
   */
  async get(userId: string) {
    const [user] = await this.db
      .select(publicColumns)
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) throw new NotFoundException('User not found');

    return { ...user, usernameChangeableIn: this.daysUntilUsernameChange(user.lastUsernameChangedAt) };
  }

  async update(userId: string, dto: UpdateProfileDto) {
    // Only copy keys the client actually sent: `undefined` means "leave alone",
    // an explicit `null` means "clear", and the two must not collapse.
    const patch: Partial<typeof users.$inferInsert> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.age !== undefined) patch.age = dto.age;
    if (dto.profession !== undefined) patch.profession = dto.profession;
    if (dto.imageUrl !== undefined) patch.imageUrl = dto.imageUrl;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('Nothing to update');
    }

    await this.db.update(users).set(patch).where(eq(users.id, userId));
    return this.get(userId);
  }

  /** Whole days the user must still wait, or 0 if the username is free to change. */
  private daysUntilUsernameChange(lastChangedAt: Date | null): number {
    if (!lastChangedAt) return 0;
    const remainingMs = lastChangedAt.getTime() + USERNAME_COOLDOWN_MS - Date.now();
    if (remainingMs <= 0) return 0;
    // Round up: with 6h left the honest answer is "1 more day", not "0".
    return Math.ceil(remainingMs / DAY_MS);
  }

  async changeUsername(userId: string, dto: ChangeUsernameDto) {
    const [user] = await this.db
      .select({ username: users.username, lastUsernameChangedAt: users.lastUsernameChangedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) throw new NotFoundException('User not found');

    if (user.username === dto.username) {
      throw new BadRequestException('That is already your username');
    }

    const daysLeft = this.daysUntilUsernameChange(user.lastUsernameChangedAt);
    if (daysLeft > 0) {
      throw new BadRequestException(
        `You can only change your username once every ${USERNAME_COOLDOWN_DAYS} days. ` +
          `Try again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
      );
    }

    const [taken] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.username, dto.username), ne(users.id, userId)))
      .limit(1);
    if (taken) throw new ConflictException('This username is taken');

    // The unique index is the real arbiter — the check above only buys a nicer
    // error message, and two racing requests can still both pass it.
    try {
      await this.db
        .update(users)
        .set({ username: dto.username, lastUsernameChangedAt: new Date() })
        .where(eq(users.id, userId));
    } catch {
      throw new ConflictException('This username is taken');
    }

    return this.get(userId);
  }

  /** Mails a code that authorizes a password change for the next 5 minutes. */
  async requestPasswordOtp(userId: string) {
    const [user] = await this.db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) throw new NotFoundException('User not found');

    await this.auth.issueOtp(userId, user.email, 'password_change');
    return { message: 'We sent a 6-digit code to your email. It expires in 5 minutes.' };
  }

  /**
   * A password change must be authorized by something the attacker with a
   * hijacked session does not have: the current password, or the mailbox.
   */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (!dto.oldPassword && !dto.otp) {
      throw new BadRequestException(
        'Provide your current password, or verify with an email code, to change your password',
      );
    }

    const [user] = await this.db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) throw new NotFoundException('User not found');

    if (dto.oldPassword) {
      const valid = await compare(dto.oldPassword, user.passwordHash);
      if (!valid) throw new UnauthorizedException('Your current password is incorrect');
    } else {
      // Throws unless a live, unexpired, password-change-scoped code matches.
      await this.auth.consumeOtp(userId, dto.otp!, 'password_change');
    }

    if (await compare(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException('Your new password must be different from the old one');
    }

    await this.db
      .update(users)
      .set({ passwordHash: await hash(dto.newPassword, 12) })
      .where(eq(users.id, userId));

    // The point of a password change is often to evict someone. Sessions
    // minted under the old password must not survive it.
    await this.auth.revokeAllSessions(userId);

    return { message: 'Password updated. Sign in again with your new password.' };
  }
}
