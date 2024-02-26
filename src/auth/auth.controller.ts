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
import { GoogleGuard } from './guard';
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
    return this.authService.login(loginDto, req, res);
  }

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Get('logout')
  logout(@Req() req, @Res() res) {
    return this.authService.logout(req, res);
  }

  @Throttle({ short: { ttl: 1000, limit: 1 } })
  @HttpCode(HttpStatus.OK)
  @Post('new-verification')
  async newVerification(@Body() newVerification: { token: string }) {
    return this.authService.verify(newVerification.token);
  }

  @Get('google')
  @UseGuards(GoogleGuard)
  async googleAuth() {}

  @Get('callback/google')
  @UseGuards(GoogleGuard)
  googleAuthRedirect(@Req() req, @Res() res) {
    return this.authService.googleLogin(req, res);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.authService.updateLanguage(id, updateUserDto);
  }
}
