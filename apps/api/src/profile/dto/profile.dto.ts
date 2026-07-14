import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

/** Treats "" as "clear this field" so a blank input can unset an optional value. */
const emptyToNull = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? null : value,
  );

export class UpdateProfileDto {
  @IsOptional()
  @emptyToNull()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string | null;

  @IsOptional()
  @emptyToNull()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(13, { message: 'you must be at least 13 to use QuestLine' })
  @Max(120)
  age?: number | null;

  @IsOptional()
  @emptyToNull()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  profession?: string | null;

  /**
   * http/https only. Without require_protocol an attacker could store a
   * `javascript:` or `data:` URI that the client later renders or links.
   */
  @IsOptional()
  @emptyToNull()
  @ValidateIf((_, value) => value !== null)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'image must be a valid http(s) URL' },
  )
  @MaxLength(2048)
  imageUrl?: string | null;
}

export class ChangeUsernameDto {
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username may only contain letters, numbers and underscores',
  })
  username: string;
}

/**
 * Two ways to authorize a password change — the current password, or a code
 * mailed to the registered address. Exactly one is required; the service
 * enforces that, since class-validator cannot express "one of these".
 */
export class ChangePasswordDto {
  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(128)
  newPassword: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  oldPassword?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  otp?: string;
}
