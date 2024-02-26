import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateLanguageDto } from './dto';

@Injectable()
export class LanguageService {
  constructor(private prisma: PrismaService) {}

  async createLanguage(createLanguageDto: CreateLanguageDto, req: Request) {
    console.log(createLanguageDto);
    try {
      const decodedUserInfo = req.user as { id: string; email: string };
      if (createLanguageDto.userId !== decodedUserInfo.id) {
        throw new ForbiddenException('Not Authorized');
      }
      const existingUser = await this.prisma.user.findUnique({
        where: { id: createLanguageDto.userId },
        include: {
          languages: true,
        },
      });

      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      if (existingUser.type !== 'PREMIUM') {
        throw new ForbiddenException('Premium only');
      }

      const existingLanguage = existingUser.languages.find(
        (language) => language.languageCode === createLanguageDto.languageCode,
      );

      if (existingLanguage) {
        throw new ForbiddenException('Language already exists');
      }

      await this.prisma.user.update({
        where: { id: createLanguageDto.userId },
        data: {
          languages: {
            create: {
              languageCode: createLanguageDto.languageCode,
            },
          },
        },
      });

      return { message: 'Language created' };
    } catch (error) {
      throw error;
    }
  }
}
