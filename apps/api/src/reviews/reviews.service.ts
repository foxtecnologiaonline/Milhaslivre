import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { OrdersService } from '../orders/orders.service';
import type { CreateReviewDto } from './dto/create-review.schema';
import { REVIEW_REPOSITORY, ReviewRecord, ReviewRepository } from './review.repository';

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(REVIEW_REPOSITORY) private readonly repository: ReviewRepository,
    private readonly ordersService: OrdersService,
    private readonly catalogService: CatalogService,
  ) {}

  async create(authorId: string, dto: CreateReviewDto): Promise<ReviewRecord> {
    const context = await this.ordersService.getOrderItemContext(dto.orderItemId);

    if (context.buyerId !== authorId) {
      throw new ForbiddenException('cannot review a purchase that is not yours');
    }
    if (context.status !== 'delivered') {
      throw new ConflictException('reviews are only allowed after the order is delivered');
    }

    const existing = await this.repository.findByOrderItemAndTarget(dto.orderItemId, dto.targetType);
    if (existing) {
      throw new ConflictException(`already reviewed this ${dto.targetType} for this purchase`);
    }

    let productId: string | null = null;
    let sellerId: string | null = null;
    if (dto.targetType === 'product') {
      const offer = await this.catalogService.getOfferById(context.offerId);
      productId = offer.productId;
    } else {
      sellerId = context.sellerId;
    }

    return this.repository.create({
      orderItemId: dto.orderItemId,
      authorId,
      targetType: dto.targetType,
      productId,
      sellerId,
      rating: dto.rating,
      comment: dto.comment ?? null,
    });
  }

  async listForProduct(productId: string): Promise<ReviewRecord[]> {
    return this.repository.findByProductId(productId);
  }
}
