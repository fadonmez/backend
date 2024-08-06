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

  async deleteUserById(id: string, req: Request) {
    try {
      const decodedUserInfo = req.user as { id: string; email: string };
      if (decodedUserInfo.id !== id) throw new ForbiddenException();

      await this.prisma.userLanguage.deleteMany({
        where: { userId: id },
      });

      // Kullanıcının verilerini sıfırlayın
      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: {
          emailVerified: null,
          image: null,
          nativeLanguage: null,
          languages: { set: [] }, // Boş array kullanarak ilişkiyi sıfırlayın
          password: null,
          role: 'USER',
          type: 'NORMAL',
          UserWord: { set: [] }, // Boş array kullanarak ilişkiyi sıfırlayın
        },
      });
      if (!updatedUser) {
        throw new NotFoundException();
      }

      return { statusCode: 200, message: 'user deleted' };
    } catch (error) {
      throw error;
    }
  }
}
