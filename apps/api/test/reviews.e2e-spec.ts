import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { CART_REPOSITORY } from '../src/cart/cart.repository';
import type { AddCartItemInput, CartItemRecord, CartRepository } from '../src/cart/cart.repository';
import {
  CreateOfferInput,
  OFFER_REPOSITORY,
  OfferRecord,
  OfferRepository,
} from '../src/catalog/offer.repository';
import {
  CategoryRecord,
  CreateProductInput,
  PRODUCT_REPOSITORY,
  ProductRecord,
  ProductRepository,
} from '../src/catalog/product.repository';
import { RESERVATION_REPOSITORY } from '../src/inventory/reservation.repository';
import type {
  CreateReservationInput,
  ReservationRecord,
  ReservationRepository,
} from '../src/inventory/reservation.repository';
import { ORDER_REPOSITORY } from '../src/orders/order.repository';
import type { CreateOrderInput, OrderRecord, OrderRepository } from '../src/orders/order.repository';
import { REVIEW_REPOSITORY } from '../src/reviews/review.repository';
import type {
  CreateReviewInput,
  ReviewRecord,
  ReviewRepository,
  ReviewTargetType,
} from '../src/reviews/review.repository';
import {
  CreateSellerInput,
  SELLER_REPOSITORY,
  SellerRecord,
  SellerRepository,
} from '../src/seller/seller.repository';
import type { SellerStatus } from '../src/seller/types';

class InMemorySellerRepository implements SellerRepository {
  sellers: SellerRecord[] = [];
  async findById(id: string) {
    return this.sellers.find((s) => s.id === id) ?? null;
  }
  async findByUserId(userId: string) {
    return this.sellers.find((s) => s.userId === userId) ?? null;
  }
  async create(input: CreateSellerInput) {
    const seller: SellerRecord = {
      id: randomUUID(),
      userId: input.userId,
      companyName: input.companyName,
      document: input.document,
      status: 'pending',
      rejectedReason: null,
      createdAt: new Date(),
      approvedAt: null,
      recipientId: null,
    };
    this.sellers.push(seller);
    return seller;
  }
  async updateStatus(id: string, status: SellerStatus, rejectedReason: string | null) {
    const seller = this.sellers.find((s) => s.id === id);
    if (!seller) throw new Error('not found');
    seller.status = status;
    seller.rejectedReason = rejectedReason;
    seller.approvedAt = status === 'approved' ? new Date() : seller.approvedAt;
    return seller;
  }
  async attachRecipient(id: string, recipientId: string) {
    const seller = this.sellers.find((s) => s.id === id);
    if (!seller) throw new Error('not found');
    seller.recipientId = recipientId;
    return seller;
  }
}

class InMemoryProductRepository implements ProductRepository {
  products: ProductRecord[] = [];
  categories: CategoryRecord[] = [];
  async findById(id: string) {
    return this.products.find((p) => p.id === id) ?? null;
  }
  async search(query: string | undefined) {
    if (!query) return this.products;
    return this.products.filter((p) => p.title.toLowerCase().includes(query.toLowerCase()));
  }
  async create(input: CreateProductInput) {
    const product: ProductRecord = { id: randomUUID(), createdAt: new Date(), ...input };
    this.products.push(product);
    return product;
  }
  async findCategoryById(id: string) {
    return this.categories.find((c) => c.id === id) ?? null;
  }
}

class InMemoryOfferRepository implements OfferRepository {
  offers: OfferRecord[] = [];
  async create(input: CreateOfferInput) {
    const offer: OfferRecord = { id: randomUUID(), isBuyboxWinner: false, createdAt: new Date(), ...input };
    this.offers.push(offer);
    return offer;
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

class InMemoryCartRepository implements CartRepository {
  items: CartItemRecord[] = [];
  async upsertItem(input: AddCartItemInput) {
    const existing = this.items.find((i) => i.buyerId === input.buyerId && i.offerId === input.offerId);
    if (existing) {
      existing.quantity += input.quantity;
      existing.updatedAt = new Date();
      return existing;
    }
    const item: CartItemRecord = { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...input };
    this.items.push(item);
    return item;
  }
  async findByBuyerId(buyerId: string) {
    return this.items.filter((i) => i.buyerId === buyerId);
  }
  async findById(id: string) {
    return this.items.find((i) => i.id === id) ?? null;
  }
  async removeItem(id: string) {
    this.items = this.items.filter((i) => i.id !== id);
  }
}

class InMemoryReservationRepository implements ReservationRepository {
  reservations: ReservationRecord[] = [];
  async create(input: CreateReservationInput) {
    const reservation: ReservationRecord = {
      id: randomUUID(),
      status: 'active',
      createdAt: new Date(),
      releasedAt: null,
      ...input,
    };
    this.reservations.push(reservation);
    return reservation;
  }
  async findById(id: string) {
    return this.reservations.find((r) => r.id === id) ?? null;
  }
  async markReleased(id: string) {
    const reservation = this.reservations.find((r) => r.id === id);
    if (!reservation) throw new Error('not found');
    reservation.status = 'released';
    reservation.releasedAt = new Date();
    return reservation;
  }
}

class InMemoryOrderRepository implements OrderRepository {
  orders: OrderRecord[] = [];

  async createOrder(input: CreateOrderInput): Promise<OrderRecord> {
    const orderId = randomUUID();
    const subOrders = input.subOrders.map((subOrder) => {
      const subOrderId = randomUUID();
      const subtotalCents = subOrder.items.reduce((sum, i) => sum + i.unitPriceCents * i.qty, 0);
      return {
        id: subOrderId,
        orderId,
        sellerId: subOrder.sellerId,
        subtotalCents,
        shippingCents: subOrder.shippingCents,
        status: 'pending',
        items: subOrder.items.map((item) => ({
          id: randomUUID(),
          subOrderId,
          offerId: item.offerId,
          qty: item.qty,
          unitPriceCents: item.unitPriceCents,
        })),
      };
    });
    const order: OrderRecord = {
      id: orderId,
      buyerId: input.buyerId,
      totalCents: subOrders.reduce((sum, so) => sum + so.subtotalCents + so.shippingCents, 0),
      status: 'pending',
      createdAt: new Date(),
      subOrders,
    };
    this.orders.push(order);
    return order;
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
  async markOrderConfirmed(id: string) {
    const order = this.orders.find((o) => o.id === id);
    if (order) order.status = 'confirmed';
  }
  async updateSubOrderStatus(id: string, status: string) {
    for (const order of this.orders) {
      const subOrder = order.subOrders.find((so) => so.id === id);
      if (subOrder) {
        subOrder.status = status;
        return subOrder;
      }
    }
    throw new Error('sub-order not found');
  }
}

class InMemoryReviewRepository implements ReviewRepository {
  reviews: ReviewRecord[] = [];
  async create(input: CreateReviewInput) {
    const review: ReviewRecord = { id: randomUUID(), createdAt: new Date(), ...input };
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

describe('Reviews (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let orderRepository: InMemoryOrderRepository;

  beforeAll(async () => {
    orderRepository = new InMemoryOrderRepository();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SELLER_REPOSITORY)
      .useClass(InMemorySellerRepository)
      .overrideProvider(PRODUCT_REPOSITORY)
      .useClass(InMemoryProductRepository)
      .overrideProvider(OFFER_REPOSITORY)
      .useClass(InMemoryOfferRepository)
      .overrideProvider(CART_REPOSITORY)
      .useClass(InMemoryCartRepository)
      .overrideProvider(RESERVATION_REPOSITORY)
      .useClass(InMemoryReservationRepository)
      .overrideProvider(ORDER_REPOSITORY)
      .useValue(orderRepository)
      .overrideProvider(REVIEW_REPOSITORY)
      .useClass(InMemoryReviewRepository)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  function token(role: 'buyer' | 'seller' | 'admin', sub: string) {
    return jwtService.sign({ sub, email: `${sub}@example.com`, role });
  }

  async function deliveredPurchase(sub: string) {
    const sellerToken = token('seller', `${sub}-seller`);
    const onboardRes = await request(app.getHttpServer())
      .post('/sellers')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ companyName: `Loja ${sub}`, document: '12345678900' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/sellers/${onboardRes.body.id}/status`)
      .set('Authorization', `Bearer ${token('admin', 'admin-1')}`)
      .send({ status: 'approved' })
      .expect(200);

    const productRes = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ title: `Produto ${sub}`, description: 'desc' })
      .expect(201);
    const offerRes = await request(app.getHttpServer())
      .post(`/products/${productRes.body.id}/offers`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ priceCents: 2000, stock: 10, condition: 'new', slaDays: 3 })
      .expect(201);

    const buyerToken = token('buyer', `${sub}-buyer`);
    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ offerId: offerRes.body.id, quantity: 1 })
      .expect(201);
    const checkoutRes = await request(app.getHttpServer())
      .post('/checkout')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(201);

    const orderItemId = checkoutRes.body.subOrders[0].items[0].id as string;

    return { buyerToken, productId: productRes.body.id as string, orderItemId };
  }

  function markDelivered(orderItemId: string) {
    for (const order of orderRepository.orders) {
      for (const subOrder of order.subOrders) {
        if (subOrder.items.some((i) => i.id === orderItemId)) {
          subOrder.status = 'delivered';
        }
      }
    }
  }

  it('reviews a delivered purchase and lists it on the product, on the happy path', async () => {
    const { buyerToken, productId, orderItemId } = await deliveredPurchase('rev-1');
    markDelivered(orderItemId);

    const reviewRes = await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ orderItemId, targetType: 'product', rating: 5, comment: 'Excelente' })
      .expect(201);
    expect(reviewRes.body.productId).toBe(productId);

    const listRes = await request(app.getHttpServer()).get(`/products/${productId}/reviews`).expect(200);
    expect(listRes.body.some((r: { id: string }) => r.id === reviewRes.body.id)).toBe(true);
  });

  it('rejects reviewing before the order is delivered', async () => {
    const { buyerToken, orderItemId } = await deliveredPurchase('rev-2');

    return request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ orderItemId, targetType: 'product', rating: 5 })
      .expect(409);
  });

  it("rejects reviewing another buyer's purchase", async () => {
    const { orderItemId } = await deliveredPurchase('rev-3');
    markDelivered(orderItemId);

    return request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${token('buyer', 'someone-else')}`)
      .send({ orderItemId, targetType: 'product', rating: 5 })
      .expect(403);
  });

  it('rejects a duplicate review for the same order item and target', async () => {
    const { buyerToken, orderItemId } = await deliveredPurchase('rev-4');
    markDelivered(orderItemId);
    await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ orderItemId, targetType: 'product', rating: 5 })
      .expect(201);

    return request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ orderItemId, targetType: 'product', rating: 3 })
      .expect(409);
  });

  it('returns an empty list for a product with no reviews', () => {
    return request(app.getHttpServer())
      .get(`/products/${randomUUID()}/reviews`)
      .expect(200)
      .expect([]);
  });
});
