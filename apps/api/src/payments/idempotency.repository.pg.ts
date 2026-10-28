import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import type { IdempotencyRecord, IdempotencyRepository } from './idempotency.repository';

@Injectable()
export class PgIdempotencyRepository implements IdempotencyRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async find(key: string): Promise<IdempotencyRecord | null> {
    const { rows } = await this.pool.query<{ key: string; order_id: string; response: unknown }>(
      `SELECT key, order_id, response FROM payments.idempotency_keys WHERE key = $1`,
      [key],
    );
    return rows[0] ? { key: rows[0].key, orderId: rows[0].order_id, response: rows[0].response } : null;
  }

  async store(key: string, orderId: string, response: unknown): Promise<void> {
    await this.pool.query(
      `INSERT INTO payments.idempotency_keys (key, order_id, response) VALUES ($1, $2, $3)
       ON CONFLICT (key) DO NOTHING`,
      [key, orderId, JSON.stringify(response)],
    );
  }
}
