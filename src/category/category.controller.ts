import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { JwtGuard } from 'src/auth/guard';
import { Throttle } from '@nestjs/throttler';
import { CategoryDto } from './dto';

@UseGuards(JwtGuard)
@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Throttle({ short: { ttl: 3000, limit: 30 } })
  @Get(':code/:id')
  getCategories(
    @Param('id') id: string,
    @Param('code') code: string,
    @Req() req,
  ) {
    return this.categoryService.getCategories(id, code, req);
  }

  @Get(':id')
  getCategory(@Param('id') id: string, @Req() req) {
    return this.categoryService.getCategoryById(id, req);
  }

  @HttpCode(HttpStatus.CREATED)
  @Throttle({ short: { ttl: 7000, limit: 3 } })
  @Put(':id')
  updateCategory(
    @Param('id') id: string,
    @Body() categoryDto: CategoryDto,
    @Req() req,
  ) {
    return this.categoryService.updateCategory(id, categoryDto, req);
  }

  @Throttle({ short: { ttl: 8000, limit: 5 } })
  @Delete(':id')
  deleteCategory(@Param('id') id: string, @Req() req) {
    return this.categoryService.deleteCategory(id, req);
  }
}
