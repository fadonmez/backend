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

  @Get(':id')
  getAllWords(@Param('id') id: string) {
    return this.wordService.getAllWords(id);
  }

  @Throttle({ short: { ttl: 20000, limit: 3 } })
  @Post()
  createWord(@Body() createWordDto: CreateWordDto, @Req() req) {
    return this.wordService.createWord(createWordDto, req);
  }

  @Delete(':id')
  deleteWord(@Param('id') id: string, @Req() req) {
    return this.wordService.deleteWord(id, req);
  }
}
