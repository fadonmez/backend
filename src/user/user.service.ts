import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}
  async getUserById(id: string, req: Request) {
    try {
      const decodedUserInfo = req.user as { id: string; email: string };

      const foundUser = await this.prisma.user.findUnique({
        where: { id },
        include: {
          languages: {
            include: {
              categories: {
                select: {
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
              },
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
          UserWord: {
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

      if (!foundUser) {
        throw new NotFoundException();
      }

      if (foundUser.id !== decodedUserInfo.id) {
        throw new ForbiddenException();
      }

      delete foundUser.password;

      return { user: foundUser };
    } catch (error) {
      throw error;
    }
  }

  async getUserByEmail(email: string) {
    try {
      const existingUser = await this.prisma.user.findUnique({
        where: {
          email,
        },
      });
      return existingUser;
    } catch (error) {
      return null;
    }
  }
}
