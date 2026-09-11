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
import { SHIPMENT_REPOSITORY } from '../src/shipping/shipment.repository';
import type {
  CreateShipmentInput,
  ShipmentRecord,
  ShipmentRepository,
} from '../src/shipping/shipment.repository';

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

class InMemoryShipmentRepository implements ShipmentRepository {
  shipments: ShipmentRecord[] = [];
  async findById(id: string) {
    return this.shipments.find((s) => s.id === id) ?? null;
  }
  async findBySubOrderId(subOrderId: string) {
    return this.shipments.find((s) => s.subOrderId === subOrderId) ?? null;
  }
  async create(input: CreateShipmentInput) {
    const shipment: ShipmentRecord = { id: randomUUID(), createdAt: new Date(), ...input };
    this.shipments.push(shipment);
    return shipment;
  }
}

describe('Shipping (e2e)', () => {
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
      .overrideProvider(SHIPMENT_REPOSITORY)
      .useClass(InMemoryShipmentRepository)
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

  async function paidSubOrder(sub: string) {
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

    const subOrderId = checkoutRes.body.subOrders[0].id as string;
    // Mark paid directly — the payments <-> shipping integration is covered
    // in payments.e2e-spec.ts; this test focuses on shipping's own rules.
    orderRepository.orders.find((o) => o.id === checkoutRes.body.id)!.subOrders[0].status = 'paid';

    return { sellerToken, sellerId: onboardRes.body.id as string, subOrderId };
  }

  it('quotes shipping (no-op, gateway unconfigured) on the happy path', async () => {
    const res = await request(app.getHttpServer())
      .post('/shipping/quote')
      .set('Authorization', `Bearer ${token('buyer', 'ship-buyer-1')}`)
      .send({ toZipCode: '20040-020', weightGrams: 500, declaredValueCents: 10000 })
      .expect(201);

    expect(res.body).toEqual({ carrierId: null, carrierName: null, priceCents: 0, etaDays: null });
  });

  it('generates a label for a paid sub-order and is idempotent, on the happy path', async () => {
    const { sellerToken, subOrderId } = await paidSubOrder('ship-1');

    const first = await request(app.getHttpServer())
      .post('/shipping/label')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ subOrderId })
      .expect(201);
    expect(first.body.subOrderId).toBe(subOrderId);

    const second = await request(app.getHttpServer())
      .post('/shipping/label')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ subOrderId })
      .expect(201);
    expect(second.body.id).toBe(first.body.id);

    const tracking = await request(app.getHttpServer())
      .get(`/shipping/${first.body.id}/tracking`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200);
    expect(tracking.body.status).toBe('label_generated');
  });

  it("rejects a seller generating a label for another seller's sub-order", async () => {
    const { subOrderId } = await paidSubOrder('ship-2');

    return request(app.getHttpServer())
      .post('/shipping/label')
      .set('Authorization', `Bearer ${token('seller', 'someone-else')}`)
      .send({ subOrderId })
      .expect(403);
  });

  it('rejects generating a label before the sub-order is paid', async () => {
    const sellerToken = token('seller', 'ship-3-seller');
    const onboardRes = await request(app.getHttpServer())
      .post('/sellers')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ companyName: 'Loja ship-3', document: '12345678900' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/sellers/${onboardRes.body.id}/status`)
      .set('Authorization', `Bearer ${token('admin', 'admin-1')}`)
      .send({ status: 'approved' })
      .expect(200);
    const productRes = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ title: 'Produto ship-3', description: 'desc' })
      .expect(201);
    const offerRes = await request(app.getHttpServer())
      .post(`/products/${productRes.body.id}/offers`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ priceCents: 2000, stock: 10, condition: 'new', slaDays: 3 })
      .expect(201);
    const buyerToken = token('buyer', 'ship-3-buyer');
    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ offerId: offerRes.body.id, quantity: 1 })
      .expect(201);
    const checkoutRes = await request(app.getHttpServer())
      .post('/checkout')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(201);

    return request(app.getHttpServer())
      .post('/shipping/label')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ subOrderId: checkoutRes.body.subOrders[0].id })
      .expect(403);
  });

  it('returns 404 for tracking of an unknown shipment', () => {
    return request(app.getHttpServer())
      .get(`/shipping/${randomUUID()}/tracking`)
      .set('Authorization', `Bearer ${token('buyer', 'ship-4-buyer')}`)
      .expect(404);
  });
});
