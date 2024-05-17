import {
  ConflictException,
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

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private emailService: EmailService,
    private tokenService: TokenService,
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

      return { message: 'Logged in successfuly!', token, statusCode: 200 };
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
    console.log(registerDto);
    try {
      await this.emailService.sendMail(
        registerDto.email,
        registerDto.name,
        registerDto.password,
      );

      return { success: 'Confirmation Email Sent', statusCode: 201 };
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
      expiresIn: '10d',
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
    setTimeout(() => {
      return res.redirect('http://localhost:3000/home');
    }, 800);
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

  async verify(token: string, email: string) {
    try {
      const existingToken =
        await this.tokenService.getVerificationTokenByToken(token);

      console.log(existingToken);

      if (!existingToken) throw new NotFoundException('Token not found');

      if (existingToken.email !== email)
        throw new ConflictException('Not allowed');

      //TODO: CHECK IF TOKEN HAS EXPIRED

      const hasExpired = new Date(existingToken.expires) < new Date();

      if (hasExpired) {
        await this.prisma.verificationToken.delete({
          where: {
            id: existingToken.id,
          },
        });
        throw new ForbiddenException('Token has expired');
      }

      const isMatched = existingToken.token === token;

      console.log(isMatched);

      const hashedPassword = await bcrypt.hash(existingToken.password, 10);

      const user = await this.prisma.user.create({
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

      const jwtToken = await this.signToken(
        user.id,
        user.email,
        user.nativeLanguage,
        user.type,
      );

      await this.prisma.verificationToken.deleteMany({
        where: {
          expires: {
            lt: new Date(), // Geçmişteki tüm tarihler
          },
        },
      });

      return { message: 'Email verified', token: jwtToken, statusCode: 200 };
    } catch (error) {
      if (error.status === 404) throw new NotFoundException(error.message);
      if (error.status === 403) throw new ForbiddenException(error.message);
      if (error.status === 409) throw new ConflictException(error.message);
      if (error instanceof PrismaClientKnownRequestError) {
        switch (error.code) {
          case 'P2002':
            throw new ForbiddenException(
              'Email already exists with different provider',
            );
        }
      }
    }
  }

  async updateLanguage(
    userId: string,
    updateUserDto: UpdateUserDto,
    req: Request,
    res: Response,
  ) {
    try {
      const decodedUserInfo = req.user as { id: string; email: string };

      if (userId !== decodedUserInfo.id) {
        throw new ForbiddenException('Not Authorized');
      }

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
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          nativeLanguage: updateUserDto.nativeLang,
          languages: {
            create: {
              languageCode: updateUserDto.targetLang,
              isFirst: true,
            },
          },
        },
      });
      console.log(updatedUser);
      const token = await this.signToken(
        updatedUser.id,
        updatedUser.email,
        updatedUser.nativeLanguage,
        updatedUser.type,
      );

      res.cookie('token', token, {
        expires: new Date(Date.now() + 90 * 24 * 60 * 1000),
        httpOnly: true,
      });

      return { message: 'Language updated', statusCode: 200 };
    } catch (error) {
      throw error;
    }
  }
}
