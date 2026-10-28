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

describe('Orders (e2e)', () => {
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
      .send({ priceCents: 3000, stock: 10, condition: 'new', slaDays: 3 })
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

    return {
      sellerToken,
      buyerToken,
      sellerId: onboardRes.body.id as string,
      orderId: checkoutRes.body.id as string,
      subOrderId: checkoutRes.body.subOrders[0].id as string,
    };
  }

  it('lets the buyer view their consolidated order on the happy path', async () => {
    const { buyerToken, orderId } = await checkedOutOrder('ord-1');

    const res = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);

    expect(res.body.id).toBe(orderId);
  });

  it("rejects a different buyer viewing someone else's order", async () => {
    const { orderId } = await checkedOutOrder('ord-2');

    return request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${token('buyer', 'someone-else')}`)
      .expect(403);
  });

  it("lets the owning seller list their own sub-orders", async () => {
    const { sellerToken, sellerId, subOrderId } = await checkedOutOrder('ord-3');

    const res = await request(app.getHttpServer())
      .get(`/sellers/${sellerId}/orders`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200);

    expect(res.body.some((so: { id: string }) => so.id === subOrderId)).toBe(true);
  });

  it("rejects a different seller listing another seller's orders", async () => {
    const { sellerId } = await checkedOutOrder('ord-4');

    return request(app.getHttpServer())
      .get(`/sellers/${sellerId}/orders`)
      .set('Authorization', `Bearer ${token('seller', 'someone-else')}`)
      .expect(403);
  });

  it('drives a sub-order through paid -> shipped -> delivered, on the happy path', async () => {
    const { sellerToken, subOrderId } = await checkedOutOrder('ord-5');
    const subOrder = orderRepository.orders
      .flatMap((o) => o.subOrders)
      .find((so) => so.id === subOrderId)!;
    subOrder.status = 'paid';

    const shipped = await request(app.getHttpServer())
      .patch(`/suborders/${subOrderId}/status`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ status: 'shipped' })
      .expect(200);
    expect(shipped.body.status).toBe('shipped');

    const delivered = await request(app.getHttpServer())
      .patch(`/suborders/${subOrderId}/status`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ status: 'delivered' })
      .expect(200);
    expect(delivered.body.status).toBe('delivered');
  });

  it('rejects shipping a sub-order that is not paid yet', async () => {
    const { sellerToken, subOrderId } = await checkedOutOrder('ord-6');

    return request(app.getHttpServer())
      .patch(`/suborders/${subOrderId}/status`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ status: 'shipped' })
      .expect(409);
  });

  it("rejects a different seller updating another seller's sub-order", async () => {
    const { subOrderId } = await checkedOutOrder('ord-7');

    return request(app.getHttpServer())
      .patch(`/suborders/${subOrderId}/status`)
      .set('Authorization', `Bearer ${token('seller', 'someone-else')}`)
      .send({ status: 'shipped' })
      .expect(403);
  });

  it('returns 400 for a malformed order id', () => {
    return request(app.getHttpServer())
      .get('/orders/not-a-uuid')
      .set('Authorization', `Bearer ${token('buyer', 'ord-8-buyer')}`)
      .expect(400);
  });
});
