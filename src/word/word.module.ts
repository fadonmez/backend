import { Module } from '@nestjs/common';
import { WordController } from './word.controller';
import { WordService } from './word.service';
import { OpenAiModule } from 'src/openai/openai.module';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [OpenAiModule, UserModule],
  controllers: [WordController],
  providers: [WordService],
})
export class WordModule {}
