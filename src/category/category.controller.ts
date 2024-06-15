import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { JwtGuard } from 'src/auth/guard';
import { Throttle } from '@nestjs/throttler';
import { CategoryDto } from './dto';
import { Request } from 'express';

@UseGuards(JwtGuard)
@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Throttle({ short: { ttl: 1000, limit: 5 } })
  @Get(':id')
  getCategory(@Param('id') id: string, @Req() req: Request) {
    return this.categoryService.getCategoryById(id, req);
  }

  @HttpCode(HttpStatus.CREATED)
  @Throttle({ short: { ttl: 7000, limit: 3 } })
  @Post()
  updateCategory(@Body() categoryDto: CategoryDto, @Req() req: Request) {
    console.log(req);
    return this.categoryService.createCategory(categoryDto, req);
  }

  @Throttle({ short: { ttl: 8000, limit: 5 } })
  @Delete(':id')
  deleteCategory(@Param('id') id: string, @Req() req: Request) {
    return this.categoryService.deleteCategory(id, req);
  }
}
