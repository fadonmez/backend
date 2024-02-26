import { Module } from '@nestjs/common';
import { WordController } from './word.controller';
import { WordService } from './word.service';
import { OpenAiModule } from 'src/openai/openai.module';
import { UserModule } from 'src/user/user.module';
import { CategoryModule } from 'src/category/category.module';

@Module({
  imports: [OpenAiModule, UserModule, CategoryModule],
  controllers: [WordController],
  providers: [WordService],
})
export class WordModule {}
