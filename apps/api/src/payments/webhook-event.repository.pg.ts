import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import type { WebhookEventRepository } from './webhook-event.repository';

@Injectable()
export class PgWebhookEventRepository implements WebhookEventRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async wasProcessed(id: string): Promise<boolean> {
    const { rows } = await this.pool.query(`SELECT 1 FROM payments.webhook_events WHERE id = $1`, [id]);
    return rows.length > 0;
  }

  async markProcessed(id: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO payments.webhook_events (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
      [id],
    );
  }
}
