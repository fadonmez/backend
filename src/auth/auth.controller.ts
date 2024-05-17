import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, UpdateUserDto } from './dto';
import { Request, Response } from 'express';
import { GoogleGuard, JwtGuard } from './guard';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    console.log('istek');
    return this.authService.login(loginDto, req, res);
  }

  @Throttle({ short: { ttl: 10000, limit: 1 } })
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Get('logout')
  logout(@Req() req, @Res() res) {
    return this.authService.logout(req, res);
  }

  @Throttle({ short: { ttl: 10000, limit: 1 } })
  @HttpCode(HttpStatus.OK)
  @Post('new-verification')
  async newVerification(
    @Body() newVerification: { token: string; email: string },
  ) {
    return this.authService.verify(
      newVerification.token,
      newVerification.email,
    );
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
    console.log('sa istek');
    return this.authService.updateLanguage(id, updateUserDto, req, res);
  }
}
