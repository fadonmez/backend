import {
  ConflictException,
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
            orderBy: {
              createdAt: 'desc',
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

      const user = await this.prisma.user.findUnique({
        where: { id: categoryDto.userId },
      });

      const userCategories = await this.prisma.category.findMany({
        where: {
          userId: categoryDto.userId,
          languageCode: categoryDto.languageCode,
        },
      });

      const categoryLenght: number = userCategories?.length;

      if (user.type === 'NORMAL' && categoryLenght >= 5) {
        throw new ForbiddenException("You've reached the category limit.");
      }
      const existingCategory = userCategories?.find(
        (element) =>
          element.categoryName === categoryDto.category.toLowerCase().trim(),
      );
      if (existingCategory) {
        throw new ConflictException('Category already exists');
      }
      const res = await this.prisma.category.create({
        data: {
          userId: categoryDto.userId,
          categoryName: categoryDto.category.toLowerCase().trim(),
          languageCode: categoryDto.languageCode,
          userLanguageId: categoryDto.languageId,
        },
      });

      return {
        message: 'Category created successfully',
        categoryId: res.id,
        statusCode: 201,
      };
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

      return { message: 'Category deleted successfully', statusCode: 200 };
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
