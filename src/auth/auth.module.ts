import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategy/jwt.strategy';
import { GoogleStrategy } from './strategy/google.straregy';
import { EmailModule } from './email/email.module';
import { UserModule } from 'src/user/user.module';
import { TokenModule } from './token/token.module';

@Module({
  imports: [JwtModule.register({}), EmailModule, TokenModule, UserModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy],
})
export class AuthModule {}
