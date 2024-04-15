import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { CategoryDto } from './dto';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  async getCategoryById(id: string, req: Request) {
    try {
      const decodedUserInfo = req.user as { id: string; email: string };
      const category = await this.prisma.category.findUnique({
        where: { id },
        include: {
          userWords: {
            include: {
              word: {
                include: {
                  translations: true,
                },
              },
            },
          },
        },
      });
      if (!category) {
        throw new NotFoundException();
      }

      if (category.userId !== decodedUserInfo.id) {
        throw new ForbiddenException();
      }

      return category;
    } catch (error) {
      switch (error.statusCode) {
        case 404:
          throw new NotFoundException();
        case 403:
          throw new ForbiddenException();
        default:
          throw error;
      }
    }
  }

  async createCategory(categoryDto: CategoryDto, req: Request) {
    try {
      const decodedUserInfo = req.user as { id: string; email: string };
      if (categoryDto.userId !== decodedUserInfo.id) {
        throw new ForbiddenException('Not authorized');
      }
      const userCategories = await this.prisma.category.findMany({
        where: {
          userId: categoryDto.userId,
          languageCode: categoryDto.languageCode,
        },
      });
      const categoryLenght: number = userCategories?.length;
      if (categoryLenght >= 5) {
        throw new ForbiddenException('You can only have 5 categories');
      }
      const existingCategory = userCategories?.find(
        (element) =>
          element.categoryName === categoryDto.category.toLowerCase().trim(),
      );
      if (existingCategory) {
        throw new ForbiddenException('Category already exists');
      }
      await this.prisma.category.create({
        data: {
          userId: categoryDto.userId,
          categoryName: categoryDto.category.toLowerCase().trim(),
          languageCode: categoryDto.languageCode,
          userLanguageId: categoryDto.languageId,
        },
      });

      return { message: 'Category created successfully' };
    } catch (error) {
      throw error;
    }
  }

  async deleteCategory(id: string, req: Request) {
    try {
      const decodedUserInfo = req.user as { id: string; email: string };
      const category = await this.prisma.category.findUnique({
        where: { id },
      });
      if (!category) {
        throw new NotFoundException();
      }

      if (category.userId !== decodedUserInfo.id) {
        throw new ForbiddenException();
      }

      await this.prisma.category.delete({
        where: { id },
      });

      return { message: 'Category deleted successfully' };
    } catch (error) {
      switch (error.statusCode) {
        case 404:
          throw new NotFoundException();
        case 403:
          throw new ForbiddenException();
        default:
          throw error;
      }
    }
  }
}
