import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import type {
  CreateReservationInput,
  ReservationRecord,
  ReservationRepository,
} from './reservation.repository';
import type { ReservationStatus } from './types';

interface ReservationRow {
  id: string;
  offer_id: string;
  quantity: number;
  status: ReservationStatus;
  created_at: Date;
  released_at: Date | null;
}

function mapRow(row: ReservationRow): ReservationRecord {
  return {
    id: row.id,
    offerId: row.offer_id,
    quantity: row.quantity,
    status: row.status,
    createdAt: row.created_at,
    releasedAt: row.released_at,
  };
}

@Injectable()
export class PgReservationRepository implements ReservationRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(input: CreateReservationInput): Promise<ReservationRecord> {
    const { rows } = await this.pool.query<ReservationRow>(
      `INSERT INTO inventory.reservations (offer_id, quantity)
       VALUES ($1, $2)
       RETURNING id, offer_id, quantity, status, created_at, released_at`,
      [input.offerId, input.quantity],
    );
    return mapRow(rows[0]);
  }

  async findById(id: string): Promise<ReservationRecord | null> {
    const { rows } = await this.pool.query<ReservationRow>(
      `SELECT id, offer_id, quantity, status, created_at, released_at
       FROM inventory.reservations WHERE id = $1`,
      [id],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async markReleased(id: string): Promise<ReservationRecord> {
    const { rows } = await this.pool.query<ReservationRow>(
      `UPDATE inventory.reservations SET status = 'released', released_at = now()
       WHERE id = $1
       RETURNING id, offer_id, quantity, status, created_at, released_at`,
      [id],
    );
    return mapRow(rows[0]);
  }
}
