import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import type {
  CreatePaymentInput,
  PaymentMethod,
  PaymentRecord,
  PaymentRepository,
  PaymentStatus,
} from './payment.repository';

interface PaymentRow {
  id: string;
  order_id: string;
  gateway_id: string | null;
  status: PaymentStatus;
  method: PaymentMethod;
  total_cents: number;
  created_at: Date;
}

function mapRow(row: PaymentRow): PaymentRecord {
  return {
    id: row.id,
    orderId: row.order_id,
    gatewayId: row.gateway_id,
    status: row.status,
    method: row.method,
    totalCents: row.total_cents,
    createdAt: row.created_at,
  };
}

@Injectable()
export class PgPaymentRepository implements PaymentRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insert(input: CreatePaymentInput): Promise<PaymentRecord> {
    const { rows } = await this.pool.query<PaymentRow>(
      `INSERT INTO payments.payments (order_id, gateway_id, status, method, total_cents)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, order_id, gateway_id, status, method, total_cents, created_at`,
      [input.orderId, input.gatewayId, input.status, input.method, input.totalCents],
    );
    return mapRow(rows[0]);
  }

  async findLatestByOrderId(orderId: string): Promise<PaymentRecord | null> {
    const { rows } = await this.pool.query<PaymentRow>(
      `SELECT id, order_id, gateway_id, status, method, total_cents, created_at
       FROM payments.payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [orderId],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findLatestByGatewayId(gatewayId: string): Promise<PaymentRecord | null> {
    const { rows } = await this.pool.query<PaymentRow>(
      `SELECT id, order_id, gateway_id, status, method, total_cents, created_at
       FROM payments.payments WHERE gateway_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [gatewayId],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }
}
