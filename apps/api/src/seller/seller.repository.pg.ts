import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import type {
  CreateSellerInput,
  SellerRecord,
  SellerRepository,
} from './seller.repository';
import type { SellerStatus } from './types';

interface SellerRow {
  id: string;
  user_id: string;
  company_name: string;
  document: string;
  status: SellerStatus;
  rejected_reason: string | null;
  created_at: Date;
  approved_at: Date | null;
}

function mapRow(row: SellerRow): SellerRecord {
  return {
    id: row.id,
    userId: row.user_id,
    companyName: row.company_name,
    document: row.document,
    status: row.status,
    rejectedReason: row.rejected_reason,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
  };
}

@Injectable()
export class PgSellerRepository implements SellerRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findById(id: string): Promise<SellerRecord | null> {
    const { rows } = await this.pool.query<SellerRow>(
      `SELECT id, user_id, company_name, document, status, rejected_reason, created_at, approved_at
       FROM seller.sellers WHERE id = $1`,
      [id],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<SellerRecord | null> {
    const { rows } = await this.pool.query<SellerRow>(
      `SELECT id, user_id, company_name, document, status, rejected_reason, created_at, approved_at
       FROM seller.sellers WHERE user_id = $1`,
      [userId],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async create(input: CreateSellerInput): Promise<SellerRecord> {
    const { rows } = await this.pool.query<SellerRow>(
      `INSERT INTO seller.sellers (user_id, company_name, document)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, company_name, document, status, rejected_reason, created_at, approved_at`,
      [input.userId, input.companyName, input.document],
    );
    return mapRow(rows[0]);
  }

  async updateStatus(
    id: string,
    status: SellerStatus,
    rejectedReason: string | null,
  ): Promise<SellerRecord> {
    const { rows } = await this.pool.query<SellerRow>(
      `UPDATE seller.sellers
       SET status = $2,
           rejected_reason = $3,
           approved_at = CASE WHEN $2 = 'approved' THEN now() ELSE approved_at END,
           updated_at = now()
       WHERE id = $1
       RETURNING id, user_id, company_name, document, status, rejected_reason, created_at, approved_at`,
      [id, status, rejectedReason],
    );
    return mapRow(rows[0]);
  }
}
