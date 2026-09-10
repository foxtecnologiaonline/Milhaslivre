import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../config/env.schema';
import { IdentityService } from './identity.service';
import type {
  CreateUserInput,
  IdentityRepository,
  RefreshTokenRecord,
  UserRecord,
} from './identity.repository';

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

function buildService() {
  const repository = new InMemoryIdentityRepository();
  const jwtService = new JwtService({ secret: 'unit-test-secret', signOptions: { expiresIn: '1h' } });
  const config = {
    get: (key: keyof Env) => (key === 'REFRESH_TOKEN_EXPIRY_DAYS' ? 30 : undefined),
  } as unknown as ConfigService<Env, true>;

  return { service: new IdentityService(repository, jwtService, config), repository };
}

const baseRegisterDto = {
  email: 'ana@example.com',
  password: 'super-secret-1',
  name: 'Ana',
  role: 'buyer' as const,
};

describe('IdentityService', () => {
  describe('register', () => {
    it('creates a user and issues tokens on the happy path', async () => {
      const { service } = buildService();

      const result = await service.register(baseRegisterDto);

      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.user).toMatchObject({ email: baseRegisterDto.email, role: 'buyer' });
    });

    it('rejects a duplicate email', async () => {
      const { service } = buildService();
      await service.register(baseRegisterDto);

      await expect(service.register(baseRegisterDto)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('issues tokens for correct credentials on the happy path', async () => {
      const { service } = buildService();
      await service.register(baseRegisterDto);

      const result = await service.login({
        email: baseRegisterDto.email,
        password: baseRegisterDto.password,
      });

      expect(result.accessToken).toEqual(expect.any(String));
    });

    it('rejects an incorrect password', async () => {
      const { service } = buildService();
      await service.register(baseRegisterDto);

      await expect(
        service.login({ email: baseRegisterDto.email, password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token on the happy path', async () => {
      const { service } = buildService();
      const { refreshToken } = await service.register(baseRegisterDto);

      const result = await service.refresh({ refreshToken });

      expect(result.refreshToken).not.toBe(refreshToken);
      expect(result.accessToken).toEqual(expect.any(String));
    });

    it('rejects a token that was already used (revoked on rotation)', async () => {
      const { service } = buildService();
      const { refreshToken } = await service.register(baseRegisterDto);
      await service.refresh({ refreshToken });

      await expect(service.refresh({ refreshToken })).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
