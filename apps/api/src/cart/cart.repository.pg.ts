import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import type { AddCartItemInput, CartItemRecord, CartRepository } from './cart.repository';

interface CartItemRow {
  id: string;
  buyer_id: string;
  offer_id: string;
  quantity: number;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: CartItemRow): CartItemRecord {
  return {
    id: row.id,
    buyerId: row.buyer_id,
    offerId: row.offer_id,
    quantity: row.quantity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class PgCartRepository implements CartRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async upsertItem(input: AddCartItemInput): Promise<CartItemRecord> {
    const { rows } = await this.pool.query<CartItemRow>(
      `INSERT INTO cart.cart_items (buyer_id, offer_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (buyer_id, offer_id)
       DO UPDATE SET quantity = cart.cart_items.quantity + EXCLUDED.quantity, updated_at = now()
       RETURNING id, buyer_id, offer_id, quantity, created_at, updated_at`,
      [input.buyerId, input.offerId, input.quantity],
    );
    return mapRow(rows[0]);
  }

  async findByBuyerId(buyerId: string): Promise<CartItemRecord[]> {
    const { rows } = await this.pool.query<CartItemRow>(
      `SELECT id, buyer_id, offer_id, quantity, created_at, updated_at
       FROM cart.cart_items WHERE buyer_id = $1 ORDER BY created_at ASC`,
      [buyerId],
    );
    return rows.map(mapRow);
  }

  async findById(id: string): Promise<CartItemRecord | null> {
    const { rows } = await this.pool.query<CartItemRow>(
      `SELECT id, buyer_id, offer_id, quantity, created_at, updated_at
       FROM cart.cart_items WHERE id = $1`,
      [id],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async removeItem(id: string): Promise<void> {
    await this.pool.query(`DELETE FROM cart.cart_items WHERE id = $1`, [id]);
  }
}
