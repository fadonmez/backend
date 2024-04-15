import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LanguageService } from './language.service';
import { JwtGuard } from 'src/auth/guard';
import { CreateLanguageDto } from './dto';
import { Request } from 'express';

@UseGuards(JwtGuard)
@Controller('language')
export class LanguageController {
  constructor(private languageService: LanguageService) {}

  @Post()
  createLanguage(
    @Body() createLanguageDto: CreateLanguageDto,
    @Req() req: Request,
  ) {
    return this.languageService.createLanguage(createLanguageDto, req);
  }

  @Get(':id')
  getLanguageById(@Param('id') id: string, @Req() req) {
    return this.languageService.getLanguageById(id, req);
  }
}
