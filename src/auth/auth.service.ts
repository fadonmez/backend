import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Redirect,
  RequestTimeoutException,
} from '@nestjs/common';
import { LoginDto, RegisterDto, UpdateUserDto } from './dto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { jwtSecret } from 'src/utils/constants';
import { EmailService } from './email/email.service';
import { TokenService } from './token/token.service';
import { UserService } from 'src/user/user.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private emailService: EmailService,
    private tokenService: TokenService,
    private userService: UserService,
  ) {}

  async login(loginDto: LoginDto, req: Request, res: Response) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: loginDto.email },
      });
      if (!user) throw new ForbiddenException('Credentials incorrect');

      if (!user.password) throw new ForbiddenException('Credentials incorrect');

      const pwMatches = await bcrypt.compare(loginDto.password, user.password);

      if (!pwMatches) throw new ForbiddenException('Credentials incorrect');

      if (!user.emailVerified) {
        // TODO: send token
        await this.emailService.sendMail(user.email, user.name, user.password);
        return res.send({ message: 'Confirmation Email Sent' });
      }

      const token = await this.signToken(
        user.id,
        user.email,
        user.nativeLanguage,
        user.type,
      );

      if (!token) {
        throw new ForbiddenException('Something went wrong!');
      }
      console.log('sa');

      res.cookie('token', token, {
        expires: new Date(Date.now() + 90 * 24 * 60 * 1000),
        httpOnly: true,
      });

      return res.send({ message: 'Logged in successfuly!' });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        console.log(error.code);
        switch (
          error.code
          //   case 'P2025':
          //     throw new ForbiddenException('User not found');
        ) {
        }
      }
      throw error;
    }
  }

  async register(registerDto: RegisterDto) {
    try {
      await this.emailService.sendMail(
        registerDto.email,
        registerDto.name,
        registerDto.password,
      );

      return { success: 'Confirmation Email Sent' };
    } catch (error) {
      throw new RequestTimeoutException('Something went wrong');
    }
  }

  async logout(req: Request, res: Response) {
    res.clearCookie('token');
    return res.send({ message: 'Logged out successfuly!' });
  }

  async signToken(
    userId: string,
    email: string,
    nativeLanguage: string,
    type: string,
  ): Promise<string> {
    const payload = {
      id: userId,
      email,
      nativeLang: nativeLanguage,
      type,
    };

    const token = await this.jwt.signAsync(payload, {
      expiresIn: '120m',
      secret: jwtSecret,
    });

    return token;
  }

  async googleLogin(req: Request, res: Response) {
    if (!req.user) {
      return 'No user from google';
    }

    const googleUser = await this.findOrCreateGoogleUser(req.user);

    if (!googleUser) {
      return res.redirect('http://localhost:3000/login?error=P2002');
    }

    const token = await this.signToken(
      googleUser.id,
      googleUser.email,
      googleUser.nativeLanguage,
      googleUser.type,
    );

    res.cookie('token', token, {
      expires: new Date(Date.now() + 90 * 24 * 60 * 1000),
      httpOnly: true,
    });

    // return res.send({ message: 'test' });
    return res.redirect('http://localhost:3000/home');
  }

  async findOrCreateGoogleUser(userData: any): Promise<any> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: userData.email },
    });

    //TODO : CHECK EMAIL ALREADY EXISTS IN ANOTHER PROVIDER

    if (existingUser) {
      if (!existingUser.password) {
        return existingUser;
      } else {
        return null;
      }
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          email: userData.email,
          name: userData.firstName,
          image: userData.picture,
          emailVerified: new Date(),
        },
      });
      return user;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        switch (error.code) {
          case 'P2002':
            console.log('P2002');
            Redirect('http://localhost:3000/login?error=P2002');
        }
      }
    }
  }

  async verify(token: string) {
    const existingToken =
      await this.tokenService.getVerificationTokenByToken(token);

    if (!existingToken) throw new NotFoundException('Token not found');

    const hasExpired = new Date(existingToken.expires) < new Date();

    if (hasExpired) throw new ForbiddenException('Token has expired');

    const hashedPassword = await bcrypt.hash(existingToken.password, 10);

    await this.prisma.user.create({
      data: {
        emailVerified: new Date(),
        email: existingToken.email,
        name: existingToken.name.toLowerCase(),
        password: hashedPassword,
      },
    });

    await this.prisma.verificationToken.delete({
      where: {
        id: existingToken.id,
      },
    });

    return { message: 'Email verified', statusCode: 200 };
  }

  async updateLanguage(userId: string, updateUserDto: UpdateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        languages: true,
      },
    });
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }
    if (existingUser.languages.length > 0)
      throw new ForbiddenException('You already have languages');
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        nativeLanguage: updateUserDto.nativeLang,
        languages: {
          create: {
            languageCode: updateUserDto.targetLang,
          },
        },
      },
    });
    return { message: 'Language updated' };
  }
}
