import { Module } from '@nestjs/common';
import { OpenAiModule } from 'src/openai/openai.module';
import { UserModule } from 'src/user/user.module';
import { CategoryModule } from 'src/category/category.module';
import { WordModule } from 'src/word/word.module';
import { StoryController } from './story.controller';
import { StoryService } from './story.service';

@Module({
  imports: [OpenAiModule, UserModule, CategoryModule, WordModule],
  controllers: [StoryController],
  providers: [StoryService],
})
export class StoryModule {}
