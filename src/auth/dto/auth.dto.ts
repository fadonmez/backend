import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  @IsString()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}

export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  @Length(3, 20, { message: 'Password must be at between 3 and 20 characters' })
  password: string;
}

export class GoogleRegisterDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  email: string;

  @IsNotEmpty()
  @IsString()
  picture: string;
}

export class GoogleLoginDto {
  @IsNotEmpty()
  @IsString()
  idToken: string;
}

export class AppleLoginDto {
  @IsNotEmpty()
  @IsString()
  idToken: string;

  @IsOptional()
  email: string;

  @IsOptional()
  name: string;
}

export class UpdateUserDto {
  @IsNotEmpty()
  @IsString()
  nativeLang: string;

  @IsNotEmpty()
  @IsString()
  targetLang: string;
}
