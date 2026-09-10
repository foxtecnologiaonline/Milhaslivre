import type { Role } from './types';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  createdAt: Date;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface CreateUserInput {
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
}

export const IDENTITY_REPOSITORY = Symbol('IDENTITY_REPOSITORY');

export interface IdentityRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  createUser(input: CreateUserInput): Promise<UserRecord>;
  storeRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revokeRefreshToken(id: string): Promise<void>;
}
