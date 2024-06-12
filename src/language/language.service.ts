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

      if (existingUser.nativeLanguage === createLanguageDto.languageCode) {
        throw new ForbiddenException('Native language cannot be added');
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
              isFirst: false,
            },
          },
        },
      });

      return { message: 'Language created' };
    } catch (error) {
      throw error;
    }
  }

  async getLanguageById(id: string, req: Request) {
    try {
      const decodedUserInfo = req.user as { id: string; email: string };
      const language = await this.prisma.userLanguage.findUnique({
        where: { id },
        include: {
          categories: {
            include: {
              userWords: true,
            },
          },
        },
      });
      if (!language) {
        throw new NotFoundException('Language not found');
      }
      if (language.userId !== decodedUserInfo.id) {
        throw new ForbiddenException('Not Authorized');
      }
      return language.categories;
    } catch (error) {
      throw error;
    }
  }

  async cancelSubscription(id: string, req: Request) {
    try {
      const decodedUserInfo = req.user as { id: string; email: string };

      if (id !== decodedUserInfo.id) {
        throw new ForbiddenException('Not Authorized');
      }

      await this.prisma.userLanguage.deleteMany({
        where: { userId: id, isFirst: false },
      });

      const user = await this.prisma.user.findUnique({
        where: { id },
        include: {
          languages: true,
          UserWord: {
            orderBy: {
              createdAt: 'asc', // createdAt'e göre artan sıralama yaparak ilk eklenen kelimeleri alır
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const remainingWords = user.UserWord.length;
      const exceededWords = Math.max(0, remainingWords - 25);

      if (exceededWords > 0) {
        const wordsToDelete = user.UserWord.slice(0, exceededWords);
        await this.prisma.userWord.deleteMany({
          where: {
            id: {
              in: wordsToDelete.map((word) => word.id),
            },
          },
        });
      }

      await this.prisma.user.update({
        where: { id },
        data: {
          type: 'NORMAL',
        },
      });
      return { message: 'Language deleted', statusCode: 201 };
    } catch (error) {
      throw error;
    }
  }

  async createSubsciption(id: string, req: Request) {
    try {
      const decodedUserInfo = req.user as { id: string; email: string };

      if (id !== decodedUserInfo.id) {
        throw new ForbiddenException('Not Authorized');
      }
      await this.prisma.user.update({
        where: { id },
        data: {
          type: 'PREMIUM',
        },
      });
      return { message: 'Language created', statusCode: 201 };
    } catch (error) {
      throw error;
    }
  }
}
