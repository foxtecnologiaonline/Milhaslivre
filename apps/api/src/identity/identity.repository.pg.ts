import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import type {
  CreateUserInput,
  IdentityRepository,
  RefreshTokenRecord,
  UserRecord,
} from './identity.repository';

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: UserRecord['role'];
  created_at: Date;
}

function mapUserRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: row.created_at,
  };
}

@Injectable()
export class PgIdentityRepository implements IdentityRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT id, email, name, password_hash, role, created_at
       FROM identity.users WHERE email = $1 AND deleted_at IS NULL`,
      [email],
    );
    return rows[0] ? mapUserRow(rows[0]) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT id, email, name, password_hash, role, created_at
       FROM identity.users WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] ? mapUserRow(rows[0]) : null;
  }

  async createUser(input: CreateUserInput): Promise<UserRecord> {
    const { rows } = await this.pool.query<UserRow>(
      `INSERT INTO identity.users (email, name, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, password_hash, role, created_at`,
      [input.email, input.name, input.passwordHash, input.role],
    );
    return mapUserRow(rows[0]);
  }

  async storeRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.pool.query(
      `INSERT INTO identity.refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt],
    );
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const { rows } = await this.pool.query<{
      id: string;
      user_id: string;
      expires_at: Date;
      revoked_at: Date | null;
    }>(
      `SELECT id, user_id, expires_at, revoked_at
       FROM identity.refresh_tokens WHERE token_hash = $1`,
      [tokenHash],
    );
    if (!rows[0]) return null;
    return {
      id: rows[0].id,
      userId: rows[0].user_id,
      expiresAt: rows[0].expires_at,
      revokedAt: rows[0].revoked_at,
    };
  }

  async revokeRefreshToken(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE identity.refresh_tokens SET revoked_at = now() WHERE id = $1`,
      [id],
    );
  }
}
