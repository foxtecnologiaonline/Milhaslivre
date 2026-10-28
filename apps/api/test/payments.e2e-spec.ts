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
import { IDEMPOTENCY_REPOSITORY } from '../src/payments/idempotency.repository';
import type { IdempotencyRecord, IdempotencyRepository } from '../src/payments/idempotency.repository';
import { PAYMENT_REPOSITORY } from '../src/payments/payment.repository';
import type { CreatePaymentInput, PaymentRecord, PaymentRepository } from '../src/payments/payment.repository';
import { SPLIT_TRANSACTION_REPOSITORY } from '../src/payments/split-transaction.repository';
import type {
  CreateSplitTransactionInput,
  SplitTransactionRecord,
  SplitTransactionRepository,
} from '../src/payments/split-transaction.repository';
import { WEBHOOK_EVENT_REPOSITORY } from '../src/payments/webhook-event.repository';
import type { WebhookEventRepository } from '../src/payments/webhook-event.repository';
import { RESERVATION_REPOSITORY } from '../src/inventory/reservation.repository';
import type {
  CreateReservationInput,
  ReservationRecord,
  ReservationRepository,
} from '../src/inventory/reservation.repository';
import { ORDER_REPOSITORY } from '../src/orders/order.repository';
import type { CreateOrderInput, OrderRecord, OrderRepository } from '../src/orders/order.repository';
import {
  CreateSellerInput,
  SELLER_REPOSITORY,
  SellerRecord,
  SellerRepository,
} from '../src/seller/seller.repository';
import type { SellerStatus } from '../src/seller/types';

class InMemorySellerRepository implements SellerRepository {
  private sellers: SellerRecord[] = [];
  async findById(id: string) {
    return this.sellers.find((s) => s.id === id) ?? null;
  }
  async findByUserId(userId: string) {
    return this.sellers.find((s) => s.userId === userId) ?? null;
  }

  async list(status?: string) {
    return status ? this.sellers.filter((s) => s.status === status) : [...this.sellers];
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
    const product: ProductRecord = { id: randomUUID(), createdAt: new Date(), isBlocked: false, ...input };
    this.products.push(product);
    return product;
  }
  async findCategoryById(id: string) {
    return this.categories.find((c) => c.id === id) ?? null;
  }

  async setBlocked(id: string, isBlocked: boolean) {
    const product = this.products.find((p) => p.id === id);
    if (!product) return null;
    product.isBlocked = isBlocked;
    return product;
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
}

class InMemoryPaymentRepository implements PaymentRepository {
  rows: PaymentRecord[] = [];
  async insert(input: CreatePaymentInput) {
    const row: PaymentRecord = { id: randomUUID(), createdAt: new Date(), ...input };
    this.rows.push(row);
    return row;
  }
  async findLatestByOrderId(orderId: string) {
    for (let i = this.rows.length - 1; i >= 0; i--) {
      if (this.rows[i].orderId === orderId) return this.rows[i];
    }
    return null;
  }
  async findLatestByGatewayId(gatewayId: string) {
    for (let i = this.rows.length - 1; i >= 0; i--) {
      if (this.rows[i].gatewayId === gatewayId) return this.rows[i];
    }
    return null;
  }
}

class InMemorySplitTransactionRepository implements SplitTransactionRepository {
  rows: SplitTransactionRecord[] = [];
  async insertMany(inputs: CreateSplitTransactionInput[]) {
    const created = inputs.map((input) => ({ id: randomUUID(), createdAt: new Date(), ...input }));
    this.rows.push(...created);
    return created;
  }
  async findByPaymentId(paymentId: string) {
    return this.rows.filter((r) => r.paymentId === paymentId);
  }
}

class InMemoryIdempotencyRepository implements IdempotencyRepository {
  private map = new Map<string, IdempotencyRecord>();
  async find(key: string) {
    return this.map.get(key) ?? null;
  }
  async store(key: string, orderId: string, response: unknown) {
    this.map.set(key, { key, orderId, response });
  }
}

class InMemoryWebhookEventRepository implements WebhookEventRepository {
  private processed = new Set<string>();
  async wasProcessed(id: string) {
    return this.processed.has(id);
  }
  async markProcessed(id: string) {
    this.processed.add(id);
  }
}

describe('Payments (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
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
      .useClass(InMemoryOrderRepository)
      .overrideProvider(PAYMENT_REPOSITORY)
      .useClass(InMemoryPaymentRepository)
      .overrideProvider(SPLIT_TRANSACTION_REPOSITORY)
      .useClass(InMemorySplitTransactionRepository)
      .overrideProvider(IDEMPOTENCY_REPOSITORY)
      .useClass(InMemoryIdempotencyRepository)
      .overrideProvider(WEBHOOK_EVENT_REPOSITORY)
      .useClass(InMemoryWebhookEventRepository)
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    await app.init();
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  function token(role: 'buyer' | 'seller' | 'admin', sub: string) {
    return jwtService.sign({ sub, email: `${sub}@example.com`, role });
  }

  async function checkedOutOrder(sub: string) {
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
      .send({ priceCents: 1500, stock: 10, condition: 'new', slaDays: 3 })
      .expect(201);

    const buyerToken = token('buyer', `${sub}-buyer`);
    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ offerId: offerRes.body.id, quantity: 2 })
      .expect(201);

    const checkoutRes = await request(app.getHttpServer())
      .post('/checkout')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(201);

    return { buyerToken, orderId: checkoutRes.body.id as string };
  }

  it('charges an order (no-op, gateway unconfigured) on the happy path', async () => {
    const { buyerToken, orderId } = await checkedOutOrder('pay-1');

    const res = await request(app.getHttpServer())
      .post('/payments/charge')
      .set('Authorization', `Bearer ${buyerToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({ orderId, method: 'pix' })
      .expect(201);

    expect(res.body.payment.status).toBe('pending');
    expect(res.body.splits).toHaveLength(1);
  });

  it('returns the same response for a repeated Idempotency-Key', async () => {
    const { buyerToken, orderId } = await checkedOutOrder('pay-2');
    const key = randomUUID();

    const first = await request(app.getHttpServer())
      .post('/payments/charge')
      .set('Authorization', `Bearer ${buyerToken}`)
      .set('Idempotency-Key', key)
      .send({ orderId, method: 'pix' })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/payments/charge')
      .set('Authorization', `Bearer ${buyerToken}`)
      .set('Idempotency-Key', key)
      .send({ orderId, method: 'pix' })
      .expect(201);

    expect(second.body.payment.id).toBe(first.body.payment.id);
  });

  it('rejects charging without an Idempotency-Key header', async () => {
    const { buyerToken, orderId } = await checkedOutOrder('pay-3');

    return request(app.getHttpServer())
      .post('/payments/charge')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ orderId, method: 'pix' })
      .expect(400);
  });

  it("rejects charging another buyer's order", async () => {
    const { orderId } = await checkedOutOrder('pay-4');

    return request(app.getHttpServer())
      .post('/payments/charge')
      .set('Authorization', `Bearer ${token('buyer', 'someone-else')}`)
      .set('Idempotency-Key', randomUUID())
      .send({ orderId, method: 'pix' })
      .expect(403);
  });

  it('accepts a webhook and reports it received', () => {
    return request(app.getHttpServer())
      .post('/payments/webhook')
      .send({ id: randomUUID(), type: 'order.paid', data: { id: 'gw_unknown', status: 'paid' } })
      .expect(200)
      .expect((res) => {
        if (res.body.received !== true) throw new Error('expected received: true');
      });
  });
});
