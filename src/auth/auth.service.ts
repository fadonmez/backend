import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AppleLoginDto, GoogleRegisterDto, UpdateUserDto } from './dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
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
  private readonly refreshTokenSecret: string;

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
    this.refreshTokenSecret = this.configService.get<string>(
      'REFRESH_TOKEN_SECRET',
    );
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

  async generateTokens(
    userId: string,
    email: string,
    nativeLanguage: string,
    type: string,
  ): Promise<{ token: string; refreshToken: string }> {
    const [token, refreshToken] = await Promise.all([
      this.signToken(userId, email, nativeLanguage, type),
      this.generateRefreshToken(userId),
    ]);

    return {
      token,
      refreshToken,
    };
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    try {
      const refreshToken = await this.jwt.signAsync(
        { sub: userId },
        {
          expiresIn: '1y', // 1 year expiration
          secret: this.refreshTokenSecret,
        },
      );

      // Store refresh token in database
      await this.prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        },
      });

      return refreshToken;
    } catch (error) {
      throw new HttpException(
        'Error generating refresh token',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
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

      const tokens = await this.generateTokens(
        data.user.id,
        data.user.email,
        data.user.nativeLanguage,
        data.user.type,
      );

      return {
        ...tokens,
        alreadyExists: data.alreadyExists,
        statusCode: 200,
        message: 'Logged in successfully!',
      };
    } catch (error) {
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
      message: 'Logged in successfully!',
      ...res,
      statusCode: 200,
    };
  }

  async googleRegister(registerDto: GoogleRegisterDto) {
    try {
      const data = await this.findOrCreateGoogleUser(registerDto);

      if (!data) {
        throw new ConflictException('Something went wrong!');
      }

      const tokens = await this.generateTokens(
        data.user.id,
        data.user.email,
        data.user.nativeLanguage,
        data.user.type,
      );

      return { ...tokens, alreadyExists: data.alreadyExists };
    } catch (error) {
      throw error;
    }
  }

  async logout(req: Request) {
    try {
      const userId = req.user?.['id'];
      if (!userId) {
        throw new UnauthorizedException('User not found');
      }

      await this.revokeRefreshToken(userId);

      return { message: 'Logged out successfully!' };
    } catch (error) {
      throw error;
    }
  }

  async revokeRefreshToken(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revoked: false,
      },
      data: {
        revoked: true,
      },
    });
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
      expiresIn: '15m', // 15 minutes for access token
      secret: jwtSecret,
    });

    return token;
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
      await this.prisma.user.update({
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

      return { message: 'Language updated', statusCode: 200 };
    } catch (error) {
      throw error;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<{ token: string }> {
    try {
      // Verify refresh token
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.refreshTokenSecret,
      });

      // Check if refresh token exists and is valid
      const storedToken = await this.prisma.refreshToken.findFirst({
        where: {
          token: refreshToken,
          userId: payload.sub,
          revoked: false,
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          user: true,
        },
      });

      if (!storedToken) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      // Generate new access token
      const token = await this.signToken(
        storedToken.user.id,
        storedToken.user.email,
        storedToken.user.nativeLanguage,
        storedToken.user.type,
      );

      return { token };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
