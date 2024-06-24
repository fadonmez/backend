import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { WordService } from './word.service';
import { CreateWordDto } from './dto';
import { JwtGuard } from 'src/auth/guard';
import { Throttle } from '@nestjs/throttler';

@UseGuards(JwtGuard)
@Controller('words')
export class WordController {
  constructor(private wordService: WordService) {}

  @Get(':languageCode')
  getAllWords(@Param('languageCode') languageCode: string) {
    return this.wordService.getAllWords(languageCode);
  }

  @Throttle({
    short: { ttl: 3000, limit: 1 },
    long: { ttl: 21600000, limit: 100 },
  })
  @Post()
  createWord(@Body() createWordDto: CreateWordDto, @Req() req) {
    console.log(req.user);
    return this.wordService.createWord(createWordDto, req);
  }

  @Delete(':id')
  deleteWord(@Param('id') id: string, @Req() req) {
    return this.wordService.deleteWord(id, req);
  }
}
