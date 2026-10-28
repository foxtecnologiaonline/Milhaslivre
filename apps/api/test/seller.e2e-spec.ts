import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
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

describe('Seller (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SELLER_REPOSITORY)
      .useClass(InMemorySellerRepository)
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

  it('onboards a seller and gets approved by an admin on the happy path', async () => {
    const onboardRes = await request(app.getHttpServer())
      .post('/sellers')
      .set('Authorization', `Bearer ${token('seller', 'seller-user-1')}`)
      .send({ companyName: 'Loja da Ana', document: '12345678900' })
      .expect(201);

    expect(onboardRes.body.status).toBe('pending');

    const approveRes = await request(app.getHttpServer())
      .patch(`/sellers/${onboardRes.body.id}/status`)
      .set('Authorization', `Bearer ${token('admin', 'admin-1')}`)
      .send({ status: 'approved' })
      .expect(200);

    expect(approveRes.body.status).toBe('approved');

    const getRes = await request(app.getHttpServer())
      .get(`/sellers/${onboardRes.body.id}`)
      .expect(200);
    expect(getRes.body.status).toBe('approved');
  });

  it('rejects onboarding from a buyer role', () => {
    return request(app.getHttpServer())
      .post('/sellers')
      .set('Authorization', `Bearer ${token('buyer', 'buyer-1')}`)
      .send({ companyName: 'x', document: '12345678900' })
      .expect(403);
  });

  it('rejects a status update from a non-admin', async () => {
    const onboardRes = await request(app.getHttpServer())
      .post('/sellers')
      .set('Authorization', `Bearer ${token('seller', 'seller-user-2')}`)
      .send({ companyName: 'Loja B', document: '98765432100' })
      .expect(201);

    return request(app.getHttpServer())
      .patch(`/sellers/${onboardRes.body.id}/status`)
      .set('Authorization', `Bearer ${token('seller', 'seller-user-2')}`)
      .send({ status: 'approved' })
      .expect(403);
  });

  it('returns the caller own seller profile via GET /sellers/me', async () => {
    const onboardRes = await request(app.getHttpServer())
      .post('/sellers')
      .set('Authorization', `Bearer ${token('seller', 'seller-user-3')}`)
      .send({ companyName: 'Loja C', document: '11122233300' })
      .expect(201);

    const meRes = await request(app.getHttpServer())
      .get('/sellers/me')
      .set('Authorization', `Bearer ${token('seller', 'seller-user-3')}`)
      .expect(200);

    expect(meRes.body.id).toBe(onboardRes.body.id);
  });

  it('returns 404 from GET /sellers/me when the user has not onboarded yet', () => {
    return request(app.getHttpServer())
      .get('/sellers/me')
      .set('Authorization', `Bearer ${token('seller', 'seller-user-4')}`)
      .expect(404);
  });

  it('lists pending sellers for an admin', async () => {
    await request(app.getHttpServer())
      .post('/sellers')
      .set('Authorization', `Bearer ${token('seller', 'seller-user-5')}`)
      .send({ companyName: 'Loja D', document: '55566677700' })
      .expect(201);

    const listRes = await request(app.getHttpServer())
      .get('/sellers?status=pending')
      .set('Authorization', `Bearer ${token('admin', 'admin-2')}`)
      .expect(200);

    expect(listRes.body.some((s: { userId: string }) => s.userId === 'seller-user-5')).toBe(true);
  });

  it('rejects listing sellers from a non-admin', () => {
    return request(app.getHttpServer())
      .get('/sellers')
      .set('Authorization', `Bearer ${token('seller', 'seller-user-6')}`)
      .expect(403);
  });

  it('rejects an invalid status filter', () => {
    return request(app.getHttpServer())
      .get('/sellers?status=bogus')
      .set('Authorization', `Bearer ${token('admin', 'admin-3')}`)
      .expect(400);
  });

  it('returns 404 for a well-formed id that does not exist', () => {
    return request(app.getHttpServer())
      .get('/sellers/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('returns 400 for a malformed id', () => {
    return request(app.getHttpServer()).get('/sellers/not-a-uuid').expect(400);
  });
});
