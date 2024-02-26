import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TokenService {
  constructor(private prisma: PrismaService) {}
  async createToken(email: string, name: string, password: string) {
    const token = uuidv4();

    const expires = new Date(new Date().getTime() + 3600 * 1000);

    const existingToken = await this.getVerificationTokenByEmail(email);

    if (existingToken) {
      await this.prisma.verificationToken.delete({
        where: {
          id: existingToken.id,
        },
      });
    }

    const verificationToken = await this.prisma.verificationToken.create({
      data: {
        email,
        name,
        password,
        token,
        expires,
      },
    });

    return verificationToken;
  }

  async getVerificationTokenByEmail(email: string) {
    try {
      const verificationToken = await this.prisma.verificationToken.findFirst({
        where: {
          email,
        },
      });
      return verificationToken;
    } catch (error) {
      return null;
    }
  }

  async getVerificationTokenByToken(token: string) {
    try {
      const verificationToken = await this.prisma.verificationToken.findUnique({
        where: {
          token,
        },
      });
      return verificationToken;
    } catch (error) {
      return null;
    }
  }
}
