import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import type { CreateOfferInput, OfferRecord, OfferRepository } from './offer.repository';
import type { OfferCondition } from './types';

interface OfferRow {
  id: string;
  product_id: string;
  seller_id: string;
  price_cents: number;
  stock: number;
  condition: OfferCondition;
  sla_days: number;
  is_buybox_winner: boolean;
  created_at: Date;
}

function mapRow(row: OfferRow): OfferRecord {
  return {
    id: row.id,
    productId: row.product_id,
    sellerId: row.seller_id,
    priceCents: row.price_cents,
    stock: row.stock,
    condition: row.condition,
    slaDays: row.sla_days,
    isBuyboxWinner: row.is_buybox_winner,
    createdAt: row.created_at,
  };
}

@Injectable()
export class PgOfferRepository implements OfferRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(input: CreateOfferInput): Promise<OfferRecord> {
    const { rows } = await this.pool.query<OfferRow>(
      `INSERT INTO catalog.offers (product_id, seller_id, price_cents, stock, condition, sla_days)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, product_id, seller_id, price_cents, stock, condition, sla_days, is_buybox_winner, created_at`,
      [input.productId, input.sellerId, input.priceCents, input.stock, input.condition, input.slaDays],
    );
    return mapRow(rows[0]);
  }

  async findByProductId(productId: string): Promise<OfferRecord[]> {
    const { rows } = await this.pool.query<OfferRow>(
      `SELECT id, product_id, seller_id, price_cents, stock, condition, sla_days, is_buybox_winner, created_at
       FROM catalog.offers WHERE product_id = $1 ORDER BY price_cents ASC`,
      [productId],
    );
    return rows.map(mapRow);
  }

  async findById(id: string): Promise<OfferRecord | null> {
    const { rows } = await this.pool.query<OfferRow>(
      `SELECT id, product_id, seller_id, price_cents, stock, condition, sla_days, is_buybox_winner, created_at
       FROM catalog.offers WHERE id = $1`,
      [id],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async decrementStock(id: string, quantity: number): Promise<OfferRecord | null> {
    const { rows } = await this.pool.query<OfferRow>(
      `UPDATE catalog.offers SET stock = stock - $2 WHERE id = $1 AND stock >= $2
       RETURNING id, product_id, seller_id, price_cents, stock, condition, sla_days, is_buybox_winner, created_at`,
      [id, quantity],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async incrementStock(id: string, quantity: number): Promise<OfferRecord | null> {
    const { rows } = await this.pool.query<OfferRow>(
      `UPDATE catalog.offers SET stock = stock + $2 WHERE id = $1
       RETURNING id, product_id, seller_id, price_cents, stock, condition, sla_days, is_buybox_winner, created_at`,
      [id, quantity],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async setStock(id: string, quantity: number): Promise<OfferRecord | null> {
    const { rows } = await this.pool.query<OfferRow>(
      `UPDATE catalog.offers SET stock = $2 WHERE id = $1
       RETURNING id, product_id, seller_id, price_cents, stock, condition, sla_days, is_buybox_winner, created_at`,
      [id, quantity],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }
}
