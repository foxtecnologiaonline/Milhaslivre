import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import type { OfferRecord } from '../catalog/offer.repository';
import type { AddCartItemDto } from './dto/add-cart-item.schema';
import { CART_REPOSITORY, CartItemRecord, CartRepository } from './cart.repository';

export interface CartItemWithOffer extends CartItemRecord {
  offer: OfferRecord;
}

@Injectable()
export class CartService {
  constructor(
    @Inject(CART_REPOSITORY) private readonly repository: CartRepository,
    private readonly catalogService: CatalogService,
  ) {}

  async addItem(buyerId: string, dto: AddCartItemDto): Promise<CartItemRecord> {
    await this.catalogService.getOfferById(dto.offerId);
    return this.repository.upsertItem({ buyerId, offerId: dto.offerId, quantity: dto.quantity });
  }

  async getCart(buyerId: string): Promise<CartItemWithOffer[]> {
    const items = await this.repository.findByBuyerId(buyerId);
    return Promise.all(
      items.map(async (item) => ({ ...item, offer: await this.catalogService.getOfferById(item.offerId) })),
    );
  }

  async removeItem(buyerId: string, itemId: string): Promise<void> {
    const item = await this.repository.findById(itemId);
    if (!item || item.buyerId !== buyerId) {
      throw new NotFoundException('cart item not found');
    }
    await this.repository.removeItem(itemId);
  }
}
