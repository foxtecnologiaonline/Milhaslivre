import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import type {
  CreateReviewInput,
  ReviewRecord,
  ReviewRepository,
  ReviewTargetType,
} from './review.repository';

interface ReviewRow {
  id: string;
  order_item_id: string;
  author_id: string;
  target_type: ReviewTargetType;
  product_id: string | null;
  seller_id: string | null;
  rating: number;
  comment: string | null;
  created_at: Date;
}

const SELECT_COLUMNS =
  'id, order_item_id, author_id, target_type, product_id, seller_id, rating, comment, created_at';

function mapRow(row: ReviewRow): ReviewRecord {
  return {
    id: row.id,
    orderItemId: row.order_item_id,
    authorId: row.author_id,
    targetType: row.target_type,
    productId: row.product_id,
    sellerId: row.seller_id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
  };
}

@Injectable()
export class PgReviewRepository implements ReviewRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(input: CreateReviewInput): Promise<ReviewRecord> {
    const { rows } = await this.pool.query<ReviewRow>(
      `INSERT INTO reviews.reviews (order_item_id, author_id, target_type, product_id, seller_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${SELECT_COLUMNS}`,
      [
        input.orderItemId,
        input.authorId,
        input.targetType,
        input.productId,
        input.sellerId,
        input.rating,
        input.comment,
      ],
    );
    return mapRow(rows[0]);
  }

  async findByOrderItemAndTarget(
    orderItemId: string,
    targetType: ReviewTargetType,
  ): Promise<ReviewRecord | null> {
    const { rows } = await this.pool.query<ReviewRow>(
      `SELECT ${SELECT_COLUMNS} FROM reviews.reviews WHERE order_item_id = $1 AND target_type = $2`,
      [orderItemId, targetType],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findByProductId(productId: string): Promise<ReviewRecord[]> {
    const { rows } = await this.pool.query<ReviewRow>(
      `SELECT ${SELECT_COLUMNS} FROM reviews.reviews
       WHERE target_type = 'product' AND product_id = $1
       ORDER BY created_at DESC`,
      [productId],
    );
    return rows.map(mapRow);
  }
}
