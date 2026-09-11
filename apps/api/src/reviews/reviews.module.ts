import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { IdentityModule } from '../identity/identity.module';
import { OrdersModule } from '../orders/orders.module';
import { REVIEW_REPOSITORY } from './review.repository';
import { PgReviewRepository } from './review.repository.pg';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [IdentityModule, OrdersModule, CatalogModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, { provide: REVIEW_REPOSITORY, useClass: PgReviewRepository }],
  exports: [ReviewsService],
})
export class ReviewsModule {}
