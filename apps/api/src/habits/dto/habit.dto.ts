import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateHabitDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsIn(['daily', 'weekly'])
  frequency?: 'daily' | 'weekly';

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(50)
  xpReward?: number;

  @IsOptional()
  @IsIn(['cyan', 'magenta', 'lime', 'amber'])
  color?: string;
}

export class UpdateHabitDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsIn(['daily', 'weekly'])
  frequency?: 'daily' | 'weekly';

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(50)
  xpReward?: number;

  @IsOptional()
  @IsIn(['cyan', 'magenta', 'lime', 'amber'])
  color?: string;
}
