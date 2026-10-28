import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import type {
  CreateShipmentInput,
  ShipmentRecord,
  ShipmentRepository,
  ShipmentStatus,
} from './shipment.repository';

interface ShipmentRow {
  id: string;
  sub_order_id: string;
  carrier: string | null;
  tracking_code: string | null;
  status: ShipmentStatus;
  price_cents: number;
  eta_days: number | null;
  created_at: Date;
}

const SELECT_COLUMNS =
  'id, sub_order_id, carrier, tracking_code, status, price_cents, eta_days, created_at';

function mapRow(row: ShipmentRow): ShipmentRecord {
  return {
    id: row.id,
    subOrderId: row.sub_order_id,
    carrier: row.carrier,
    trackingCode: row.tracking_code,
    status: row.status,
    priceCents: row.price_cents,
    etaDays: row.eta_days,
    createdAt: row.created_at,
  };
}

@Injectable()
export class PgShipmentRepository implements ShipmentRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findById(id: string): Promise<ShipmentRecord | null> {
    const { rows } = await this.pool.query<ShipmentRow>(
      `SELECT ${SELECT_COLUMNS} FROM shipping.shipments WHERE id = $1`,
      [id],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findBySubOrderId(subOrderId: string): Promise<ShipmentRecord | null> {
    const { rows } = await this.pool.query<ShipmentRow>(
      `SELECT ${SELECT_COLUMNS} FROM shipping.shipments WHERE sub_order_id = $1`,
      [subOrderId],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async create(input: CreateShipmentInput): Promise<ShipmentRecord> {
    const { rows } = await this.pool.query<ShipmentRow>(
      `INSERT INTO shipping.shipments (sub_order_id, carrier, tracking_code, status, price_cents, eta_days)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${SELECT_COLUMNS}`,
      [input.subOrderId, input.carrier, input.trackingCode, input.status, input.priceCents, input.etaDays],
    );
    return mapRow(rows[0]);
  }
}
