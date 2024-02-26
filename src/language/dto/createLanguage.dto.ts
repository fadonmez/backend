import { IsNotEmpty, IsString } from 'class-validator';

export class CreateLanguageDto {
  @IsNotEmpty()
  @IsString()
  languageCode: string;

  @IsNotEmpty()
  @IsString()
  userId: string;
}
