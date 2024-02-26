import { Module } from '@nestjs/common';
import { ResendModule } from 'nestjs-resend';
import { EmailService } from './email.service';
import { TokenModule } from '../token/token.module';

@Module({
  imports: [
    ResendModule.forRoot({
      apiKey: 're_AVRAgJTg_2G3XAqnYuC5kg9AG7ggWc3sd',
    }),
    TokenModule,
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
