import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  AppleLoginDto,
  GoogleLoginDto,
  RefreshTokenDto,
  UpdateUserDto,
} from './dto';
import { Request } from 'express';
import { JwtGuard } from './guard';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('refresh')
  @Throttle({ short: { ttl: 1000, limit: 3 } })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(refreshTokenDto.refreshToken);
  }

  @Throttle({ short: { ttl: 10000, limit: 1 } })
  @Post('google-register')
  googleRegister(@Body() loginDto: GoogleLoginDto) {
    return this.authService.getProfileByToken(loginDto);
  }

  @Throttle({ short: { ttl: 10000, limit: 1 } })
  @Post('apple')
  appleRegister(@Body() loginDto: AppleLoginDto) {
    return this.authService.appleLogin(loginDto);
  }

  @UseGuards(JwtGuard)
  @Get('logout')
  logout(@Req() req) {
    return this.authService.logout(req);
  }

  @UseGuards(JwtGuard)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: Request,
  ) {
    return this.authService.updateLanguage(id, updateUserDto, req);
  }
}
