import { IsNotEmpty, IsString } from 'class-validator';

export class CategoryDto {
  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsNotEmpty()
  languageCode: string;
}
