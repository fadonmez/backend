import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from 'src/auth/guard';
import { StoryService } from './story.service';
import { StoryTranslateWordDto } from './dto';
import { Throttle } from '@nestjs/throttler';

@UseGuards(JwtGuard)
@Controller('stories')
export class StoryController {
  constructor(private storyService: StoryService) {}

  @Get(':languageCode')
  getAllStories(@Param('languageCode') languageCode: string) {
    return this.storyService.getAllStories(languageCode);
  }

  @Get(':languageCode/:id')
  getStoryById(
    @Param('languageCode') languageCode: string,
    @Param('id') id: string,
  ) {
    return this.storyService.getStoryById(id);
  }

  @Throttle({
    short: { ttl: 4000, limit: 1 },
    long: { ttl: 21600000, limit: 100 },
  })
  @Put()
  updateStoryWord(
    @Body() storyTranslateWordDto: StoryTranslateWordDto,
    @Req() req,
  ) {
    return this.storyService.translateWord(storyTranslateWordDto, req);
  }
}
