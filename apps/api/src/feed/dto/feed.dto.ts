import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(280)
  content: string;
}

export class ReactDto {
  @IsIn(['salute', 'fire', 'keep_going'])
  type: 'salute' | 'fire' | 'keep_going';
}
