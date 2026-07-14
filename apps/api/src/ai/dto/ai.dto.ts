import { IsString, MaxLength, MinLength } from 'class-validator';

export class RoadmapDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  goal: string;
}
