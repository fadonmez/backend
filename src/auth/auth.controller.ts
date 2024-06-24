import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleLoginDto, UpdateUserDto } from './dto';
import { Request, Response } from 'express';
import { GoogleGuard, JwtGuard } from './guard';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle({ short: { ttl: 10000, limit: 1 } })
  @Post('google-register')
  googleRegister(@Body() loginDto: GoogleLoginDto) {
    return this.authService.getProfileByToken(loginDto);
  }

  @Get('logout')
  logout(@Req() req, @Res() res) {
    return this.authService.logout(req, res);
  }

  @Get('google')
  @UseGuards(GoogleGuard)
  async googleAuth() {}

  @Get('callback/google')
  @UseGuards(GoogleGuard)
  googleAuthRedirect(@Req() req, @Res() res) {
    return this.authService.googleLogin(req, res);
  }

  @UseGuards(JwtGuard)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.updateLanguage(id, updateUserDto, req, res);
  }
}
