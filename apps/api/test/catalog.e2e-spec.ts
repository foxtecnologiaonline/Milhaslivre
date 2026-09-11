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
  categories: CategoryRecord[] = [{ id: randomUUID(), name: 'Eletrônicos', slug: 'eletronicos' }];

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

describe('Catalog (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let sellerRepository: InMemorySellerRepository;

  beforeAll(async () => {
    sellerRepository = new InMemorySellerRepository();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SELLER_REPOSITORY)
      .useValue(sellerRepository)
      .overrideProvider(PRODUCT_REPOSITORY)
      .useClass(InMemoryProductRepository)
      .overrideProvider(OFFER_REPOSITORY)
      .useClass(InMemoryOfferRepository)
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

  async function approvedSellerToken(sub: string) {
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

    return sellerToken;
  }

  it('lists a product with its offers after an approved seller creates one, on the happy path', async () => {
    const sellerToken = await approvedSellerToken('seller-catalog-1');

    const productRes = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ title: 'Notebook Gamer', description: 'Um notebook rápido' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/products/${productRes.body.id}/offers`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ priceCents: 500000, stock: 3, condition: 'new', slaDays: 5 })
      .expect(201);

    const getRes = await request(app.getHttpServer())
      .get(`/products/${productRes.body.id}`)
      .expect(200);

    expect(getRes.body.offers).toHaveLength(1);
    expect(getRes.body.offers[0]).toMatchObject({ priceCents: 500000 });

    const searchRes = await request(app.getHttpServer())
      .get('/products')
      .query({ query: 'Gamer' })
      .expect(200);

    expect(searchRes.body.some((p: { id: string }) => p.id === productRes.body.id)).toBe(true);
  });

  it('rejects offer creation from a seller that is not approved', async () => {
    const sellerToken = token('seller', 'seller-catalog-2');
    await request(app.getHttpServer())
      .post('/sellers')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ companyName: 'Loja pendente', document: '98765432100' })
      .expect(201);

    const productRes = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ title: 'Mouse', description: 'Um mouse' })
      .expect(201);

    return request(app.getHttpServer())
      .post(`/products/${productRes.body.id}/offers`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ priceCents: 5000, stock: 1, condition: 'new', slaDays: 2 })
      .expect(403);
  });

  it('rejects product creation from a buyer role', () => {
    return request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token('buyer', 'buyer-1')}`)
      .send({ title: 'x', description: 'y' })
      .expect(403);
  });

  it('returns 404 for a well-formed id that does not exist', () => {
    return request(app.getHttpServer())
      .get(`/products/${randomUUID()}`)
      .expect(404);
  });

  it('returns 400 for a malformed id', () => {
    return request(app.getHttpServer()).get('/products/not-a-uuid').expect(400);
  });
});
