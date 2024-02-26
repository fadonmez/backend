import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
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
}
