import { IsNotEmpty, IsString } from 'class-validator';

export class CreateWordDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  languageCode: string;

  @IsString()
  @IsNotEmpty()
  languageId: string;

  @IsString()
  @IsNotEmpty()
  wordName: string;

  @IsString()
  @IsNotEmpty()
  nativeLang: string;
}
