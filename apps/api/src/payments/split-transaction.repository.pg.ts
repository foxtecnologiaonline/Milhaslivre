import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import type {
  CreateSplitTransactionInput,
  SplitTransactionRecord,
  SplitTransactionRepository,
  SplitTransactionStatus,
} from './split-transaction.repository';

interface SplitTransactionRow {
  id: string;
  payment_id: string;
  seller_id: string;
  amount_cents: number;
  fee_cents: number;
  status: SplitTransactionStatus;
  created_at: Date;
}

function mapRow(row: SplitTransactionRow): SplitTransactionRecord {
  return {
    id: row.id,
    paymentId: row.payment_id,
    sellerId: row.seller_id,
    amountCents: row.amount_cents,
    feeCents: row.fee_cents,
    status: row.status,
    createdAt: row.created_at,
  };
}

@Injectable()
export class PgSplitTransactionRepository implements SplitTransactionRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insertMany(inputs: CreateSplitTransactionInput[]): Promise<SplitTransactionRecord[]> {
    const results: SplitTransactionRecord[] = [];
    for (const input of inputs) {
      const { rows } = await this.pool.query<SplitTransactionRow>(
        `INSERT INTO payments.split_transactions (payment_id, seller_id, amount_cents, fee_cents, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, payment_id, seller_id, amount_cents, fee_cents, status, created_at`,
        [input.paymentId, input.sellerId, input.amountCents, input.feeCents, input.status],
      );
      results.push(mapRow(rows[0]));
    }
    return results;
  }

  async findByPaymentId(paymentId: string): Promise<SplitTransactionRecord[]> {
    const { rows } = await this.pool.query<SplitTransactionRow>(
      `SELECT id, payment_id, seller_id, amount_cents, fee_cents, status, created_at
       FROM payments.split_transactions WHERE payment_id = $1 ORDER BY created_at ASC`,
      [paymentId],
    );
    return rows.map(mapRow);
  }
}
