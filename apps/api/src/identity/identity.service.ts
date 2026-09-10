import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../config/env.schema';
import { hashPassword, verifyPassword } from './crypto/password';
import { generateRefreshToken, hashToken } from './crypto/tokens';
import type { LoginDto } from './dto/login.schema';
import type { RefreshDto } from './dto/refresh.schema';
import type { RegisterDto } from './dto/register.schema';
import { IDENTITY_REPOSITORY, IdentityRepository, UserRecord } from './identity.repository';
import type { JwtPayload } from './types';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: UserRecord['role'];
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

@Injectable()
export class IdentityService {
  constructor(
    @Inject(IDENTITY_REPOSITORY) private readonly repository: IdentityRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.repository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('email already registered');
    }

    const passwordHash = await hashPassword(dto.password);
    const user = await this.repository.createUser({
      email: dto.email,
      name: dto.name,
      passwordHash,
      role: dto.role,
    });

    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.repository.findByEmail(dto.email);
    if (!user || !(await verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('invalid credentials');
    }

    return this.issueTokens(user);
  }

  async refresh(dto: RefreshDto): Promise<AuthResult> {
    const tokenHash = hashToken(dto.refreshToken);
    const record = await this.repository.findRefreshTokenByHash(tokenHash);

    if (!record || record.revokedAt || record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('invalid refresh token');
    }

    await this.repository.revokeRefreshToken(record.id);

    const user = await this.repository.findById(record.userId);
    if (!user) {
      throw new UnauthorizedException('invalid refresh token');
    }

    return this.issueTokens(user);
  }

  async me(userId: string): Promise<PublicUser | null> {
    const user = await this.repository.findById(userId);
    return user ? toPublicUser(user) : null;
  }

  private async issueTokens(user: UserRecord): Promise<AuthResult> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);

    const refreshToken = generateRefreshToken();
    const expiryDays = this.config.get('REFRESH_TOKEN_EXPIRY_DAYS', { infer: true });
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
    await this.repository.storeRefreshToken(user.id, hashToken(refreshToken), expiresAt);

    return { accessToken, refreshToken, user: toPublicUser(user) };
  }
}

function toPublicUser(user: UserRecord): PublicUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
