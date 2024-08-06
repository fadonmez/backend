import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppleLoginDto, GoogleRegisterDto, UpdateUserDto } from './dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { jwtSecret } from 'src/utils/constants';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as jwtToken from 'jsonwebtoken';
import { jwtDecode, JwtHeader } from 'jwt-decode';
import * as jwksClient from 'jwks-rsa';

export type JwtTokenSchema = {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string;
  nonce: string;
  c_hash: string;
  email: string;
  email_verified: string;
  is_private_email: string;
  auth_time: number;
};
@Injectable()
export class AuthService {
  private google: OAuth2Client;
  private readonly audience: string;
  private readonly isInProd: boolean;

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private configService: ConfigService,
  ) {
    this.google = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.JWT_SECRET,
    );
    this.isInProd = configService.get<string>('NODE_ENV') === 'production';
    this.audience = this.isInProd ? 'com.aitu.svogo' : 'com.aitu.svogo';
  }

  public async ValidateTokenAndDecode(token: string): Promise<JwtTokenSchema> {
    const tokenDecodedHeader: JwtHeader & { kid: string } = jwtDecode<
      JwtHeader & { kid: string }
    >(token, {
      header: true,
    });
    const { data }: any = await axios.get(
      'https://appleid.apple.com/auth/keys',
    );
    const client: jwksClient.JwksClient = jwksClient({
      jwksUri: 'https://appleid.apple.com/auth/keys',
    });
    const kid: string = tokenDecodedHeader.kid;
    const sharedKid: string = data.keys.filter((x) => x['kid'] === kid)[0]?.[
      'kid'
    ];
    const key: jwksClient.CertSigningKey | jwksClient.RsaSigningKey =
      await client.getSigningKey(sharedKid);
    const signingKey: string = key.getPublicKey();
    if (!signingKey) {
      throw new HttpException(
        'Validation failed for login.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    try {
      const res: JwtTokenSchema = <JwtTokenSchema>(
        jwtToken.verify(token, signingKey)
      );
      this.ValidateToken(res);
      return res;
    } catch (error) {
      throw error;
    }
  }

  private ValidateToken(token: JwtTokenSchema): void {
    if (token.iss !== 'https://appleid.apple.com') {
      throw { message: 'Issuers do not match!' };
    }
    if (token.aud !== this.audience) {
      throw { message: 'Audiences do not match!' };
    }
  }

  async appleLogin(loginDto: AppleLoginDto): Promise<any> {
    try {
      const validatedToken = await this.ValidateTokenAndDecode(
        loginDto.idToken,
      );

      const data = await this.findOrCreateUser(
        validatedToken.sub,
        loginDto.email,
        loginDto.name,
      );

      const token = await this.signToken(
        data.user.id,
        data.user.email,
        data.user.nativeLanguage,
        data.user.type,
      );

      return {
        token,
        alreadyExists: data.alreadyExists,
        statusCode: 200,
        message: 'Logged in succesfully !',
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async findOrCreateUser(sub: string, email?: string, name?: string) {
    let user = await this.prisma.user.findUnique({
      where: { sub },
    });

    if (user && !user.emailVerified) {
      user = await this.prisma.user.update({
        where: { sub },
        data: {
          emailVerified: new Date(),
        },
      });
      return { user, alreadyExists: true };
    }

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          sub,
          email,
          name,
          emailVerified: new Date(),
        },
      });
      return { user, alreadyExists: false };
    }

    return { user, alreadyExists: true };
  }

  async getProfileByToken(loginDto: any): Promise<any> {
    const ticket = await this.google.verifyIdToken({
      idToken: loginDto.idToken,
    });

    const data = ticket.getPayload();

    if (!data) {
      throw new ForbiddenException('Invalid credentials');
    }

    const res = await this.googleRegister({
      email: data.email,
      name: data.name,
      picture: data.picture,
    });

    return {
      message: 'Logged in successfuly!',
      token: res.token,
      statusCode: 200,
      alreadyExists: res.alreadyExists,
    };
  }

  async googleRegister(registerDto: GoogleRegisterDto) {
    try {
      const data = await this.findOrCreateGoogleUser(registerDto);

      if (!data) {
        throw new ConflictException('Something went wrong!');
      }

      const token = await this.signToken(
        data.user.id,
        data.user.email,
        data.user.nativeLanguage,
        data.user.type,
      );

      return { token, alreadyExists: data.alreadyExists };
    } catch (error) {
      console.log(error);
      throw error;
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

    if (existingUser && !existingUser.emailVerified && !existingUser.image) {
      await this.prisma.user.update({
        where: { email: userData.email },
        data: {
          image: userData.picture,
          emailVerified: new Date(),
        },
      });
    }

    //TODO : CHECK EMAIL ALREADY EXISTS IN ANOTHER PROVIDER

    if (existingUser) {
      if (!existingUser.password) {
        return { user: existingUser, alreadyExists: true };
      } else {
        return null;
      }
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          email: userData.email,
          name: userData.name,
          image: userData.picture,
          emailVerified: new Date(),
        },
      });
      return { user, alreadyExists: false };
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        switch (error.code) {
          case 'P2002':
            console.log('P2002');
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
