import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { CategoryModule } from './category/category.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { EmailModule } from './auth/email/email.module';
import { TokenModule } from './auth/token/token.module';
import { OpenAiModule } from './openai/openai.module';
import { WordModule } from './word/word.module';
import { LanguageModule } from './language/language.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    PrismaModule,
    UserModule,
    EmailModule,
    OpenAiModule,
    TokenModule,
    CategoryModule,
    WordModule,
    LanguageModule,
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 3000,
        limit: 30,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
