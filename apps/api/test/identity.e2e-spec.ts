import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  CreateUserInput,
  IDENTITY_REPOSITORY,
  IdentityRepository,
  RefreshTokenRecord,
  UserRecord,
} from '../src/identity/identity.repository';

class InMemoryIdentityRepository implements IdentityRepository {
  private users: UserRecord[] = [];
  private refreshTokens: (RefreshTokenRecord & { tokenHash: string })[] = [];
  private counter = 0;

  async findByEmail(email: string) {
    return this.users.find((u) => u.email === email) ?? null;
  }

  async findById(id: string) {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async createUser(input: CreateUserInput) {
    const user: UserRecord = { id: `user-${++this.counter}`, createdAt: new Date(), ...input };
    this.users.push(user);
    return user;
  }

  async storeRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {
    this.refreshTokens.push({
      id: `rt-${++this.counter}`,
      userId,
      tokenHash,
      expiresAt,
      revokedAt: null,
    });
  }

  async findRefreshTokenByHash(tokenHash: string) {
    return this.refreshTokens.find((t) => t.tokenHash === tokenHash) ?? null;
  }

  async revokeRefreshToken(id: string) {
    const token = this.refreshTokens.find((t) => t.id === id);
    if (token) token.revokedAt = new Date();
  }
}

describe('Identity (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(IDENTITY_REPOSITORY)
      .useClass(InMemoryIdentityRepository)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers and fetches /me with the issued token on the happy path', async () => {
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'buyer@example.com', password: 'password123', name: 'Buyer', role: 'buyer' })
      .expect(201);

    expect(registerRes.body.accessToken).toEqual(expect.any(String));

    const meRes = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${registerRes.body.accessToken}`)
      .expect(200);

    expect(meRes.body).toMatchObject({ email: 'buyer@example.com', role: 'buyer' });
  });

  it('rejects /me without a bearer token', () => {
    return request(app.getHttpServer()).get('/me').expect(401);
  });

  it('rejects registration with an invalid body', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'not-an-email', password: '123' })
      .expect(400);
  });
});
