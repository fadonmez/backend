import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from 'src/auth/guard';
import { UserService } from './user.service';
import { GetUser } from 'src/auth/decorator';
import { User } from '@prisma/client';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';

@UseGuards(JwtGuard)
// this is a guard for all routes in this controller. It checks if the user is logged in and has a valid token. If the user is not logged in or the token is invalid, it will throw an UnauthorizedException.
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  getMe(@GetUser() user: User) {
    return user;
  }

  @Throttle({ short: { ttl: 1000, limit: 10 } })
  @Get(':id')
  getUserById(@Param('id') userId: string, @Req() req: Request) {
    return this.userService.getUserById(userId, req);
  }
}
