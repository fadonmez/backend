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
    const decodedUserInfo = req.user as { id: string; email: string };

    const foundUser = await this.prisma.user.findUnique({
      where: { id },
      include: {
        languages: {
          include: {
            UserWord: true,
            category: {
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
