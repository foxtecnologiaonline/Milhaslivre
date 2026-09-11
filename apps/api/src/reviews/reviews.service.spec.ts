import { ConflictException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CatalogService } from '../catalog/catalog.service';
import type { CreateOfferInput, OfferRecord, OfferRepository } from '../catalog/offer.repository';
import type {
  CategoryRecord,
  ProductRecord,
  ProductRepository,
} from '../catalog/product.repository';
import type { OrderRecord, OrderRepository, SubOrderRecord } from '../orders/order.repository';
import { OrdersService } from '../orders/orders.service';
import type { SellerService } from '../seller/seller.service';
import {
  CreateReviewInput,
  ReviewRecord,
  ReviewRepository,
  ReviewTargetType,
} from './review.repository';
import { ReviewsService } from './reviews.service';

class NullProductRepository implements ProductRepository {
  async findById(): Promise<ProductRecord | null> {
    return null;
  }
  async search(): Promise<ProductRecord[]> {
    return [];
  }
  async create(): Promise<ProductRecord> {
    throw new Error('not used');
  }
  async findCategoryById(): Promise<CategoryRecord | null> {
    return null;
  }
  async setBlocked(): Promise<ProductRecord | null> {
    return null;
  }
}

class InMemoryOfferRepository implements OfferRepository {
  offers: OfferRecord[] = [];

  seed(overrides: Partial<OfferRecord> = {}): OfferRecord {
    const offer: OfferRecord = {
      id: overrides.id ?? `offer-${this.offers.length + 1}`,
      productId: 'product-1',
      sellerId: 'seller-1',
      priceCents: 1000,
      stock: 10,
      condition: 'new',
      slaDays: 3,
      isBuyboxWinner: false,
      createdAt: new Date(),
      ...overrides,
    };
    this.offers.push(offer);
    return offer;
  }

  async create(input: CreateOfferInput) {
    return this.seed(input);
  }
  async findByProductId(productId: string) {
    return this.offers.filter((o) => o.productId === productId);
  }
  async findById(id: string) {
    return this.offers.find((o) => o.id === id) ?? null;
  }
  async decrementStock(id: string, quantity: number) {
    const offer = this.offers.find((o) => o.id === id);
    if (!offer || offer.stock < quantity) return null;
    offer.stock -= quantity;
    return offer;
  }
  async incrementStock(id: string, quantity: number) {
    const offer = this.offers.find((o) => o.id === id);
    if (!offer) return null;
    offer.stock += quantity;
    return offer;
  }
  async setStock(id: string, quantity: number) {
    const offer = this.offers.find((o) => o.id === id);
    if (!offer) return null;
    offer.stock = quantity;
    return offer;
  }
}

class InMemoryOrderRepository implements OrderRepository {
  orders: OrderRecord[] = [];

  seed(subOrderOverrides: Partial<SubOrderRecord> = {}, orderItemId = 'item-1', offerId = 'offer-1') {
    const orderId = `order-${this.orders.length + 1}`;
    const subOrder: SubOrderRecord = {
      id: `${orderId}-sub-1`,
      orderId,
      sellerId: 'seller-1',
      subtotalCents: 1000,
      shippingCents: 0,
      status: 'delivered',
      items: [{ id: orderItemId, subOrderId: `${orderId}-sub-1`, offerId, qty: 1, unitPriceCents: 1000 }],
      ...subOrderOverrides,
    };
    const order: OrderRecord = {
      id: orderId,
      buyerId: 'buyer-1',
      totalCents: subOrder.subtotalCents,
      status: 'confirmed',
      createdAt: new Date(),
      subOrders: [subOrder],
    };
    this.orders.push(order);
    return { order, subOrder };
  }

  async createOrder(): Promise<OrderRecord> {
    throw new Error('not used');
  }
  async findById(id: string) {
    return this.orders.find((o) => o.id === id) ?? null;
  }
  async findSubOrderById(id: string) {
    for (const order of this.orders) {
      const subOrder = order.subOrders.find((so) => so.id === id);
      if (subOrder) return subOrder;
    }
    return null;
  }
  async findSubOrdersBySellerId(sellerId: string) {
    return this.orders.flatMap((order) => order.subOrders.filter((so) => so.sellerId === sellerId));
  }
  async findOrderItemContext(orderItemId: string) {
    for (const order of this.orders) {
      for (const subOrder of order.subOrders) {
        const item = subOrder.items.find((i) => i.id === orderItemId);
        if (item) {
          return {
            orderItemId,
            offerId: item.offerId,
            subOrderId: subOrder.id,
            sellerId: subOrder.sellerId,
            buyerId: order.buyerId,
            status: subOrder.status,
          };
        }
      }
    }
    return null;
  }
  async markOrderConfirmed() {}
  async updateSubOrderStatus(id: string, status: string) {
    for (const order of this.orders) {
      const subOrder = order.subOrders.find((so) => so.id === id);
      if (subOrder) {
        subOrder.status = status;
        return subOrder;
      }
    }
    throw new Error('not found');
  }
}

class InMemoryReviewRepository implements ReviewRepository {
  reviews: ReviewRecord[] = [];
  private counter = 0;

  async create(input: CreateReviewInput) {
    const review: ReviewRecord = { id: `review-${++this.counter}`, createdAt: new Date(), ...input };
    this.reviews.push(review);
    return review;
  }
  async findByOrderItemAndTarget(orderItemId: string, targetType: ReviewTargetType) {
    return (
      this.reviews.find((r) => r.orderItemId === orderItemId && r.targetType === targetType) ?? null
    );
  }
  async findByProductId(productId: string) {
    return this.reviews.filter((r) => r.targetType === 'product' && r.productId === productId);
  }
}

function buildService() {
  const offerRepository = new InMemoryOfferRepository();
  offerRepository.seed({ id: 'offer-1', productId: 'product-1', sellerId: 'seller-1' });
  const sellerService = {} as unknown as SellerService;
  const catalogService = new CatalogService(new NullProductRepository(), offerRepository, sellerService);

  const orderRepository = new InMemoryOrderRepository();
  const ordersService = new OrdersService(orderRepository, new EventEmitter2());

  const reviewRepository = new InMemoryReviewRepository();
  const reviewsService = new ReviewsService(reviewRepository, ordersService, catalogService);

  return { reviewsService, orderRepository, reviewRepository };
}

describe('ReviewsService', () => {
  describe('create', () => {
    it('creates a product review for a delivered purchase, on the happy path', async () => {
      const { reviewsService, orderRepository } = buildService();
      const { subOrder } = orderRepository.seed({ status: 'delivered' }, 'item-1', 'offer-1');

      const review = await reviewsService.create('buyer-1', {
        orderItemId: subOrder.items[0].id,
        targetType: 'product',
        rating: 5,
        comment: 'Ótimo produto',
      });

      expect(review).toMatchObject({ targetType: 'product', productId: 'product-1', sellerId: null, rating: 5 });
    });

    it('creates a seller review on the happy path', async () => {
      const { reviewsService, orderRepository } = buildService();
      const { subOrder } = orderRepository.seed({ status: 'delivered' }, 'item-2', 'offer-1');

      const review = await reviewsService.create('buyer-1', {
        orderItemId: subOrder.items[0].id,
        targetType: 'seller',
        rating: 4,
      });

      expect(review).toMatchObject({ targetType: 'seller', sellerId: 'seller-1', productId: null });
    });

    it('rejects reviewing before the order is delivered', async () => {
      const { reviewsService, orderRepository } = buildService();
      const { subOrder } = orderRepository.seed({ status: 'shipped' }, 'item-3', 'offer-1');

      await expect(
        reviewsService.create('buyer-1', { orderItemId: subOrder.items[0].id, targetType: 'product', rating: 5 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("rejects reviewing someone else's purchase", async () => {
      const { reviewsService, orderRepository } = buildService();
      const { subOrder } = orderRepository.seed({ status: 'delivered' }, 'item-4', 'offer-1');

      await expect(
        reviewsService.create('someone-else', {
          orderItemId: subOrder.items[0].id,
          targetType: 'product',
          rating: 5,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a duplicate review for the same order item and target', async () => {
      const { reviewsService, orderRepository } = buildService();
      const { subOrder } = orderRepository.seed({ status: 'delivered' }, 'item-5', 'offer-1');
      await reviewsService.create('buyer-1', {
        orderItemId: subOrder.items[0].id,
        targetType: 'product',
        rating: 5,
      });

      await expect(
        reviewsService.create('buyer-1', { orderItemId: subOrder.items[0].id, targetType: 'product', rating: 3 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('listForProduct', () => {
    it('returns only reviews for that product, on the happy path', async () => {
      const { reviewsService, orderRepository } = buildService();
      const { subOrder: subA } = orderRepository.seed({ status: 'delivered' }, 'item-a', 'offer-1');
      await reviewsService.create('buyer-1', { orderItemId: subA.items[0].id, targetType: 'product', rating: 5 });

      const reviews = await reviewsService.listForProduct('product-1');

      expect(reviews).toHaveLength(1);
      expect(reviews[0].productId).toBe('product-1');
    });

    it('returns an empty list for a product with no reviews', async () => {
      const { reviewsService } = buildService();

      const reviews = await reviewsService.listForProduct('unknown-product');

      expect(reviews).toEqual([]);
    });
  });
});
