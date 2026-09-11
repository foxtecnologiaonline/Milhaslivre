import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { Roles } from '../identity/decorators/roles.decorator';
import { JwtAuthGuard } from '../identity/guards/jwt-auth.guard';
import { RolesGuard } from '../identity/guards/roles.guard';
import { ZodValidationPipe } from '../identity/pipes/zod-validation.pipe';
import type { JwtPayload } from '../identity/types';
import { createReviewSchema, CreateReviewDto } from './dto/create-review.schema';
import { ReviewsService } from './reviews.service';

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('buyer')
  create(@CurrentUser() user: JwtPayload, @Body(new ZodValidationPipe(createReviewSchema)) dto: CreateReviewDto) {
    return this.reviewsService.create(user.sub, dto);
  }

  @Get('products/:id/reviews')
  listForProduct(@Param('id', new ParseUUIDPipe()) productId: string) {
    return this.reviewsService.listForProduct(productId);
  }
}
