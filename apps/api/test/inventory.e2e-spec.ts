import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
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
import {
  CreateReservationInput,
  RESERVATION_REPOSITORY,
  ReservationRecord,
  ReservationRepository,
} from '../src/inventory/reservation.repository';
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

describe('Inventory (e2e)', () => {
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
      .overrideProvider(RESERVATION_REPOSITORY)
      .useClass(InMemoryReservationRepository)
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

  async function approvedSellerOffer(sub: string, stock: number) {
    const sellerToken = token('seller', sub);
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
      .send({ title: 'Produto', description: 'Descrição' })
      .expect(201);

    const offerRes = await request(app.getHttpServer())
      .post(`/products/${productRes.body.id}/offers`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ priceCents: 1000, stock, condition: 'new', slaDays: 3 })
      .expect(201);

    return { sellerToken, offerId: offerRes.body.id as string };
  }

  it('reserves and releases stock atomically on the happy path', async () => {
    const { offerId } = await approvedSellerOffer('inv-seller-1', 10);
    const buyerToken = token('buyer', 'inv-buyer-1');

    const reserveRes = await request(app.getHttpServer())
      .post(`/offers/${offerId}/reserve`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ quantity: 4 })
      .expect(201);

    expect(reserveRes.body.status).toBe('active');

    const releaseRes = await request(app.getHttpServer())
      .post(`/offers/${offerId}/release`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ reservationId: reserveRes.body.id })
      .expect(201);

    expect(releaseRes.body.status).toBe('released');
  });

  it('rejects reserving more than the available stock', async () => {
    const { offerId } = await approvedSellerOffer('inv-seller-2', 2);

    return request(app.getHttpServer())
      .post(`/offers/${offerId}/reserve`)
      .set('Authorization', `Bearer ${token('buyer', 'inv-buyer-2')}`)
      .send({ quantity: 5 })
      .expect(409);
  });

  it('lets the owning seller update stock', async () => {
    const { sellerToken, offerId } = await approvedSellerOffer('inv-seller-3', 10);

    const res = await request(app.getHttpServer())
      .patch(`/offers/${offerId}/stock`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ stock: 99 })
      .expect(200);

    expect(res.body.stock).toBe(99);
  });

  it("rejects a seller updating another seller's offer stock", async () => {
    const { offerId } = await approvedSellerOffer('inv-seller-4', 10);
    const otherSellerToken = await approvedSellerOffer('inv-seller-5', 1).then((r) => r.sellerToken);

    return request(app.getHttpServer())
      .patch(`/offers/${offerId}/stock`)
      .set('Authorization', `Bearer ${otherSellerToken}`)
      .send({ stock: 5 })
      .expect(403);
  });

  it('rejects reserve/release/stock update without a token', async () => {
    const { offerId } = await approvedSellerOffer('inv-seller-6', 10);

    await request(app.getHttpServer()).post(`/offers/${offerId}/reserve`).send({ quantity: 1 }).expect(401);
    await request(app.getHttpServer())
      .patch(`/offers/${offerId}/stock`)
      .send({ stock: 1 })
      .expect(401);
  });
});
