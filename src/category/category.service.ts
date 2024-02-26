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

  async getCategory(id: string, req: Request) {
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

  async updateCategory(id: string, categoryDto: CategoryDto, req: Request) {
    try {
      const decodedUserInfo = req.user as { id: string; email: string };

      if (id !== decodedUserInfo.id) {
        throw new ForbiddenException('Not authorized');
      }

      const userCategories = await this.prisma.userLanguage.findUnique({
        where: { userId: id },
        select: {
          category: true,
        },
      });

      const categoryLenght: number = userCategories?.category.length;

      if (categoryLenght >= 5) {
        throw new ForbiddenException('You can only have 5 categories');
      }

      const existingCategory = userCategories?.category.find(
        (element) =>
          element.categoryName === categoryDto.category.toLowerCase().trim(),
      );

      if (existingCategory) {
        throw new ForbiddenException('Category already exists');
      }

      await this.prisma.userLanguage.update({
        where: { userId: id },
        data: {
          category: {
            create: {
              categoryName: categoryDto.category.toLowerCase().trim(),
            },
          },
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
