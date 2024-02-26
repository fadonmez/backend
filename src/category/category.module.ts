import { Module } from '@nestjs/common';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { JwtStrategy } from 'src/auth/strategy/jwt.strategy';

@Module({
  controllers: [CategoryController],
  providers: [CategoryService, JwtStrategy],
  exports: [CategoryService],
})
export class CategoryModule {}
