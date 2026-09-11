import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { CART_REPOSITORY } from '../src/cart/cart.repository';
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
import type { AddCartItemInput, CartItemRecord, CartRepository } from '../src/cart/cart.repository';

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
    const existing = this.items.find(
      (i) => i.buyerId === input.buyerId && i.offerId === input.offerId,
    );
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

describe('Cart (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let productRepository: InMemoryProductRepository;
  let offerRepository: InMemoryOfferRepository;

  beforeAll(async () => {
    productRepository = new InMemoryProductRepository();
    offerRepository = new InMemoryOfferRepository();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PRODUCT_REPOSITORY)
      .useValue(productRepository)
      .overrideProvider(OFFER_REPOSITORY)
      .useValue(offerRepository)
      .overrideProvider(CART_REPOSITORY)
      .useClass(InMemoryCartRepository)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    jwtService = app.get(JwtService);

    const product = await productRepository.create({
      title: 'Produto Cart',
      description: 'desc',
      categoryId: null,
      brand: null,
      attributes: {},
    });
    await offerRepository.create({
      productId: product.id,
      sellerId: randomUUID(),
      priceCents: 3000,
      stock: 10,
      condition: 'new',
      slaDays: 2,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  function token(role: 'buyer' | 'seller' | 'admin', sub: string) {
    return jwtService.sign({ sub, email: `${sub}@example.com`, role });
  }

  it('adds, lists and removes a cart item on the happy path', async () => {
    const offerId = offerRepository.offers[0].id;
    const buyerToken = token('buyer', 'cart-buyer-1');

    const addRes = await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ offerId, quantity: 2 })
      .expect(201);

    expect(addRes.body).toMatchObject({ offerId, quantity: 2 });

    const getRes = await request(app.getHttpServer())
      .get('/cart')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);

    expect(getRes.body).toHaveLength(1);
    expect(getRes.body[0].offer.priceCents).toBe(3000);

    await request(app.getHttpServer())
      .delete(`/cart/items/${addRes.body.id}`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(204);

    const afterDelete = await request(app.getHttpServer())
      .get('/cart')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);

    expect(afterDelete.body).toHaveLength(0);
  });

  it('rejects adding an offer that does not exist', () => {
    return request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${token('buyer', 'cart-buyer-2')}`)
      .send({ offerId: randomUUID(), quantity: 1 })
      .expect(404);
  });

  it('rejects cart access from a non-buyer role', () => {
    return request(app.getHttpServer())
      .get('/cart')
      .set('Authorization', `Bearer ${token('seller', 'cart-seller-1')}`)
      .expect(403);
  });

  it("does not let a buyer delete another buyer's cart item", async () => {
    const offerId = offerRepository.offers[0].id;
    const ownerToken = token('buyer', 'cart-buyer-3');
    const addRes = await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ offerId, quantity: 1 })
      .expect(201);

    return request(app.getHttpServer())
      .delete(`/cart/items/${addRes.body.id}`)
      .set('Authorization', `Bearer ${token('buyer', 'cart-buyer-4')}`)
      .expect(404);
  });
});
