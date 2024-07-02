import { WordLevel } from '@prisma/client';
import { IsNotEmpty, IsString } from 'class-validator';

export class StoryTranslateWordDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  languageCode: string;

  @IsString()
  @IsNotEmpty()
  wordName: string;

  @IsString()
  @IsNotEmpty()
  nativeLang: string;
}

export class CreateStoryDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsNotEmpty()
  languageCode: string;

  @IsString()
  @IsNotEmpty()
  storyLevel: WordLevel;

  @IsString()
  @IsNotEmpty()
  imageUrl: string;
}
